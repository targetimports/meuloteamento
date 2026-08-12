'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { enviarMidia, enviarTexto } from '@/lib/evolution-go';
import { gravarDocumento } from '@/lib/storage-seguro';
import { urlDeSaida } from '@/lib/whatsapp-url-temporaria';

type Resultado = { ok: boolean; erro?: string };

async function minhaInstancia() {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true, token: true, status: true },
  });
  return { sessao, instancia };
}

const TIPO_POR_MIME: Array<[RegExp, 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO']> = [
  [/^image\//, 'IMAGEM'],
  [/^video\//, 'VIDEO'],
  [/^audio\//, 'AUDIO'],
];

function tipoDoMime(mime: string): 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' {
  for (const [re, tipo] of TIPO_POR_MIME) if (re.test(mime)) return tipo;
  return 'DOCUMENTO';
}

/** O que o gateway espera no campo `type` do /send/media. */
const TIPO_GATEWAY: Record<string, string> = {
  IMAGEM: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENTO: 'document',
};

const ROTULO_ENVIO: Record<string, string> = {
  IMAGEM: '📷 Foto',
  VIDEO: '🎬 Vídeo',
  AUDIO: '🎤 Áudio',
  DOCUMENTO: '📎 Documento',
};

const MAX_MIDIA_BYTES = 25 * 1024 * 1024;

/**
 * Envia um arquivo.
 *
 * A ordem importa: grava no cofre → cria a mensagem (para existir um id) → gera
 * a URL temporária desse id → manda o gateway buscar. O `/send/media` não
 * aceita base64, e a URL assinada precisa apontar para um registro que já
 * existe.
 *
 * Se o envio falhar, a mensagem é removida da conversa: bolha na tela de algo
 * que o cliente nunca recebeu é pior que um erro na cara de quem tentou mandar.
 */
export async function enviarArquivo(conversaId: string, form: FormData): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Você não tem WhatsApp conectado.' };
  if (instancia.status !== 'CONECTADA') {
    return { ok: false, erro: 'Seu WhatsApp está desconectado.' };
  }

  const arquivo = form.get('arquivo');
  const legenda = String(form.get('legenda') ?? '').trim();
  if (!(arquivo instanceof File)) return { ok: false, erro: 'Nenhum arquivo.' };
  if (arquivo.size === 0) return { ok: false, erro: 'Arquivo vazio.' };
  if (arquivo.size > MAX_MIDIA_BYTES) {
    return { ok: false, erro: `Arquivo maior que ${MAX_MIDIA_BYTES / 1024 / 1024} MB.` };
  }

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };

  const mime = arquivo.type || 'application/octet-stream';
  const tipo = tipoDoMime(mime);
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const agora = new Date();

  const caminho = await gravarDocumento({
    subdir: `whatsapp/${conversaId}`,
    nomeArquivo: `${Date.now()}-${arquivo.name}`,
    conteudo: buffer,
    mimeType: mime,
  });

  const mensagem = await prisma.whatsappMensagem.create({
    data: {
      conversaId,
      messageId: `local-${Date.now()}`,
      daMim: true,
      tipo,
      texto: legenda || null,
      midiaCaminho: caminho,
      midiaMime: mime,
      midiaTamanho: buffer.length,
      nomeArquivo: arquivo.name,
      enviadaEm: agora,
      status: 'PENDENTE',
    },
  });

  const url = urlDeSaida(mensagem.id);
  if (!url) {
    await prisma.whatsappMensagem.delete({ where: { id: mensagem.id } });
    return {
      ok: false,
      erro: 'NEXT_PUBLIC_APP_URL não configurada — o gateway não conseguiria buscar o arquivo.',
    };
  }

  const r = await enviarMidia(instancia.token, conversa.remoteJid, {
    url,
    tipo: TIPO_GATEWAY[tipo],
    legenda: legenda || undefined,
    nomeArquivo: tipo === 'DOCUMENTO' ? arquivo.name : undefined,
  });

  if (!r.ok) {
    await prisma.whatsappMensagem.delete({ where: { id: mensagem.id } });
    return { ok: false, erro: `O WhatsApp recusou o arquivo: ${r.error}` };
  }

  const idReal = r.data?.id ?? r.data?.ID;
  await prisma.$transaction([
    prisma.whatsappMensagem.update({
      where: { id: mensagem.id },
      data: { status: 'ENVIADA', ...(idReal ? { messageId: idReal } : {}) },
    }),
    prisma.whatsappConversa.update({
      where: { id: conversaId },
      data: {
        ultimaMensagemEm: agora,
        ultimaMensagemMinha: true,
        ultimaMensagemPreview: legenda || ROTULO_ENVIO[tipo],
        naoLidas: 0,
      },
    }),
  ]);

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/** Envia citando outra mensagem — o "responder" do WhatsApp. */
export async function responderMensagem(
  conversaId: string,
  texto: string,
  citadaId: string
): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const citada = await prisma.whatsappMensagem.findFirst({
    where: { id: citadaId, conversa: { instanciaId: instancia.id } },
    select: { messageId: true, texto: true, daMim: true, tipo: true },
  });
  if (!citada) return { ok: false, erro: 'Mensagem citada não encontrada.' };

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { remoteJid: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };

  const conteudo = texto.trim();
  if (!conteudo) return { ok: false, erro: 'Mensagem vazia.' };

  const r = await enviarTexto(instancia.token, conversa.remoteJid, conteudo, {
    key: { id: citada.messageId, fromMe: citada.daMim },
  });
  if (!r.ok) return { ok: false, erro: `O WhatsApp recusou o envio: ${r.error}` };

  const agora = new Date();
  await prisma.$transaction([
    prisma.whatsappMensagem.create({
      data: {
        conversaId,
        messageId: r.data?.id ?? r.data?.ID ?? `local-${Date.now()}`,
        daMim: true,
        tipo: 'TEXTO',
        texto: conteudo,
        enviadaEm: agora,
        status: 'ENVIADA',
        // O resumo da citada fica gravado: ela pode ser apagada depois, e a
        // citação precisa continuar legível — é o contexto do que foi respondido.
        respondeA: citada.messageId,
        respondeATexto: (citada.texto ?? citada.tipo).slice(0, 120),
        respondeADeMim: citada.daMim,
      },
    }),
    prisma.whatsappConversa.update({
      where: { id: conversaId },
      data: {
        ultimaMensagemEm: agora,
        ultimaMensagemMinha: true,
        ultimaMensagemPreview: conteudo.slice(0, 120),
        naoLidas: 0,
      },
    }),
  ]);

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/**
 * Encaminha uma mensagem para outra conversa.
 *
 * Com mídia, a cópia aponta para o MESMO arquivo do cofre: encaminhar não
 * duplica bytes. Um vídeo de 20 MB reenviado cinco vezes seriam 100 MB de disco
 * para o mesmo conteúdo.
 */
export async function encaminharMensagem(
  mensagemId: string,
  paraConversaId: string
): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const m = await prisma.whatsappMensagem.findFirst({
    where: { id: mensagemId, conversa: { instanciaId: instancia.id } },
    select: { texto: true, tipo: true, midiaCaminho: true, midiaMime: true, nomeArquivo: true },
  });
  if (!m) return { ok: false, erro: 'Mensagem não encontrada.' };

  const destino = await prisma.whatsappConversa.findFirst({
    where: { id: paraConversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true },
  });
  if (!destino) return { ok: false, erro: 'Conversa de destino não encontrada.' };

  const agora = new Date();

  if (!m.midiaCaminho) {
    if (!m.texto) return { ok: false, erro: 'Nada para encaminhar.' };
    const r = await enviarTexto(instancia.token, destino.remoteJid, m.texto);
    if (!r.ok) return { ok: false, erro: `O WhatsApp recusou: ${r.error}` };

    await prisma.$transaction([
      prisma.whatsappMensagem.create({
        data: {
          conversaId: destino.id,
          messageId: r.data?.id ?? r.data?.ID ?? `local-${Date.now()}`,
          daMim: true,
          tipo: 'TEXTO',
          texto: m.texto,
          enviadaEm: agora,
          status: 'ENVIADA',
        },
      }),
      prisma.whatsappConversa.update({
        where: { id: destino.id },
        data: {
          ultimaMensagemEm: agora,
          ultimaMensagemMinha: true,
          ultimaMensagemPreview: m.texto.slice(0, 120),
        },
      }),
    ]);
    revalidatePath('/admin/whatsapp/chat');
    return { ok: true };
  }

  const copia = await prisma.whatsappMensagem.create({
    data: {
      conversaId: destino.id,
      messageId: `local-${Date.now()}`,
      daMim: true,
      tipo: m.tipo,
      texto: m.texto,
      midiaCaminho: m.midiaCaminho,
      midiaMime: m.midiaMime,
      nomeArquivo: m.nomeArquivo,
      enviadaEm: agora,
      status: 'PENDENTE',
    },
  });

  const url = urlDeSaida(copia.id);
  const r = url
    ? await enviarMidia(instancia.token, destino.remoteJid, {
        url,
        tipo: TIPO_GATEWAY[m.tipo] ?? 'document',
        legenda: m.texto ?? undefined,
        nomeArquivo: m.nomeArquivo ?? undefined,
      })
    : { ok: false as const, error: 'sem_url' };

  if (!r.ok) {
    await prisma.whatsappMensagem.delete({ where: { id: copia.id } });
    return { ok: false, erro: 'Não foi possível encaminhar o arquivo.' };
  }

  await prisma.whatsappConversa.update({
    where: { id: destino.id },
    data: {
      ultimaMensagemEm: agora,
      ultimaMensagemMinha: true,
      ultimaMensagemPreview: m.texto || ROTULO_ENVIO[m.tipo] || 'Encaminhada',
    },
  });

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/**
 * Nota interna: fica só aqui, NUNCA vai para o WhatsApp.
 *
 * É o recado que a equipe deixa sobre a conversa — "pediu desconto", "ligar
 * depois das 18h" — sem o cliente ver. Aparece no meio das mensagens de
 * propósito: é ali que será lido, na hora de responder.
 */
export async function adicionarNotaInterna(conversaId: string, texto: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const conteudo = texto.trim();
  if (!conteudo) return { ok: false, erro: 'Nota vazia.' };

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };

  await prisma.whatsappMensagem.create({
    data: {
      conversaId,
      messageId: `nota-${Date.now()}`,
      daMim: true,
      tipo: 'SISTEMA',
      texto: conteudo,
      notaInterna: true,
      enviadaEm: new Date(),
      status: 'ENVIADA',
    },
  });

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}
