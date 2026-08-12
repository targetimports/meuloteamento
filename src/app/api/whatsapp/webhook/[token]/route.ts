import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  normalizarEvento,
  extrairTexto,
  detectarTipo,
  paraData,
  telefoneDoJid,
  ehGrupo,
} from '@/lib/whatsapp-evento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recebe os eventos do gateway Evolution GO.
 *
 * O token no caminho é a autenticação: qualquer um consegue fazer POST aqui, e
 * é ele que separa o gateway de um curioso. Como é o mesmo token que autentica
 * a instância no gateway, ele já existe e não precisa de segredo adicional.
 *
 * 🔴 RESPONDE ANTES DE PROCESSAR. O gateway reenvia o evento quando a resposta
 * demora, e reenvio vira mensagem duplicada na tela. Gravar leva algumas
 * consultas ao banco; o "ok" não pode esperar por elas.
 *
 * A idempotência é garantida de qualquer forma pelo par
 * (conversa, messageId) — reenvio que escape da corrida não duplica a bolha.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || token.length < 16) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let corpo: Record<string, unknown> | null = null;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'json inválido' }, { status: 400 });
  }

  // Processa fora do caminho da resposta. `void` é deliberado: não esperamos.
  void processar(token, corpo).catch((e) => {
    console.error('[whatsapp:webhook] falha ao processar evento:', e);
  });

  return NextResponse.json({ ok: true });
}

async function processar(token: string, corpo: Record<string, unknown> | null): Promise<void> {
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { token },
    select: { id: true, status: true },
  });
  // Token desconhecido: instância excluída aqui e ainda viva no gateway. Ignora
  // em silêncio — responder erro faria o gateway reenviar para sempre.
  if (!instancia) return;

  const evento = normalizarEvento(corpo);
  if (!evento) return;

  // Só mensagem interessa por ora. Recibo de leitura e sincronia de histórico
  // entram numa próxima etapa, quando a caixa de entrada existir na tela.
  if (evento.tipo && !['MESSAGE', 'MESSAGES', 'HISTORYSYNC', 'HISTORY_SYNC'].includes(evento.tipo)) {
    return;
  }
  if (!evento.remoteJid || !evento.messageId) return;

  const grupo = ehGrupo(evento.remoteJid);
  // Em conversa LID o `remoteJid` é um identificador interno; o telefone real
  // vem no jid alternativo.
  const telefone = telefoneDoJid(evento.jidAlternativo) ?? telefoneDoJid(evento.remoteJid);
  const texto = extrairTexto(evento.conteudo);
  const tipo = detectarTipo(evento.conteudo);
  const enviadaEm = paraData(evento.timestamp);

  const conversa = await prisma.whatsappConversa.upsert({
    where: {
      instanciaId_remoteJid: { instanciaId: instancia.id, remoteJid: evento.remoteJid },
    },
    create: {
      instanciaId: instancia.id,
      remoteJid: evento.remoteJid,
      telefone,
      nome: evento.pushName || null,
      ehGrupo: grupo,
    },
    update: {
      // O nome só melhora, nunca piora: `pushName` vem vazio na mensagem que
      // nós enviamos, e sobrescrever apagaria o nome já conhecido do contato.
      ...(evento.pushName ? { nome: evento.pushName } : {}),
      ...(telefone ? { telefone } : {}),
    },
    select: { id: true },
  });

  const previa = texto?.slice(0, 120) ?? rotuloDeMidia(tipo);

  try {
    await prisma.$transaction([
      prisma.whatsappMensagem.create({
        data: {
          conversaId: conversa.id,
          messageId: evento.messageId,
          daMim: evento.daMim,
          tipo,
          texto,
          enviadaEm,
          status: evento.daMim ? 'ENVIADA' : 'ENTREGUE',
        },
      }),
      prisma.whatsappConversa.update({
        where: { id: conversa.id },
        data: {
          ultimaMensagemEm: enviadaEm,
          ultimaMensagemMinha: evento.daMim,
          ultimaMensagemPreview: previa,
          // Mensagem nossa zera o contador: se eu respondi, não há o que ler.
          naoLidas: evento.daMim ? 0 : { increment: 1 },
        },
      }),
    ]);
  } catch (e) {
    // Violação da chave (conversa, messageId) = reenvio do mesmo evento.
    // É o caso esperado, não um erro: sai sem duplicar e sem poluir o log.
    const codigo = (e as { code?: string }).code;
    if (codigo === 'P2002') return;
    throw e;
  }
}

function rotuloDeMidia(tipo: string): string {
  switch (tipo) {
    case 'IMAGEM':
      return '📷 Foto';
    case 'VIDEO':
      return '🎥 Vídeo';
    case 'AUDIO':
      return '🎤 Áudio';
    case 'DOCUMENTO':
      return '📄 Documento';
    case 'STICKER':
      return 'Figurinha';
    case 'LOCALIZACAO':
      return '📍 Localização';
    case 'CONTATO':
      return '👤 Contato';
    default:
      return '';
  }
}
