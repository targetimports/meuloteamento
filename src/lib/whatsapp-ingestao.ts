import type { Prisma, WhatsappTipoMensagem } from '@prisma/client';
import { prisma } from './prisma';
import { gravarDocumento } from './storage-seguro';
import { baixarMidia, solicitarHistorico, obterFotoPerfil } from './evolution-go';
import { paraData, telefoneDoJid, ehGrupo, type EventoNormalizado } from './whatsapp-evento';

/**
 * Ingestão de eventos do WhatsApp — o que o webhook faz depois de responder.
 *
 * Portado do módulo equivalente do Target Import Manager, que roda em produção
 * há meses. Cada regra aqui tem um defeito atrás dela; os comentários dizem
 * qual, porque sem isso a próxima pessoa "simplifica" e o defeito volta.
 */

// ── Leitura do conteúdo ─────────────────────────────────────────────────────

interface ConteudoLido {
  tipo: WhatsappTipoMensagem | 'PROTOCOLO';
  texto: string;
  mime?: string;
  nomeArquivo?: string;
  protocolo?: Record<string, any>;
}

export function lerConteudo(msg: Record<string, any> = {}): ConteudoLido {
  if (msg.conversation) return { tipo: 'TEXTO', texto: msg.conversation };
  if (msg.extendedTextMessage) {
    return { tipo: 'TEXTO', texto: msg.extendedTextMessage.text || '' };
  }
  if (msg.imageMessage) {
    return {
      tipo: 'IMAGEM',
      texto: msg.imageMessage.caption || '',
      mime: msg.imageMessage.mimetype,
    };
  }
  if (msg.videoMessage) {
    return {
      tipo: 'VIDEO',
      texto: msg.videoMessage.caption || '',
      mime: msg.videoMessage.mimetype,
    };
  }
  if (msg.audioMessage) return { tipo: 'AUDIO', texto: '', mime: msg.audioMessage.mimetype };
  if (msg.documentMessage) {
    return {
      tipo: 'DOCUMENTO',
      texto: msg.documentMessage.caption || '',
      mime: msg.documentMessage.mimetype,
      nomeArquivo: msg.documentMessage.fileName,
    };
  }
  if (msg.stickerMessage) return { tipo: 'STICKER', texto: '', mime: msg.stickerMessage.mimetype };

  /**
   * 🔴 Mensagem de PROTOCOLO não é mensagem — é uma ordem sobre outra mensagem.
   *
   * Editar e apagar chegam assim. Sem reconhecer, caem como tipo desconhecido
   * sem texto e sem mídia, e a bolha anuncia "arquivo não baixado": o cliente
   * corrige um preço e a conversa exibe um aviso de anexo perdido que nunca
   * existiu, no meio do histórico.
   */
  if (msg.protocolMessage || msg.editedMessage) {
    return {
      tipo: 'PROTOCOLO',
      texto: '',
      protocolo: msg.protocolMessage || { editedMessage: msg.editedMessage },
    };
  }
  if (msg.locationMessage) {
    const l = msg.locationMessage;
    return {
      tipo: 'LOCALIZACAO',
      texto: `📍 Localização: ${l.degreesLatitude}, ${l.degreesLongitude}`,
    };
  }
  if (msg.contactMessage || msg.contactsArrayMessage) {
    return { tipo: 'CONTATO', texto: msg.contactMessage?.displayName || 'Contato' };
  }
  return { tipo: 'TEXTO', texto: '' };
}

/**
 * 🔴 Grupo NÃO tem telefone — e fingir que tem é perigoso.
 *
 * O JID de grupo é `120363143104495367@g.us`. Sem esta saída ele viraria o
 * "telefone" 120363143104495367, cujos últimos dígitos entram no mesmo
 * casamento que liga conversa a lead. Um grupo poderia ser fundido na conversa
 * de um cliente real por coincidência numérica — e mensagem de grupo dentro do
 * histórico de um cliente é o tipo de erro que ninguém percebe.
 */
export function telefoneDe(remoteJid: string, jidAlternativo?: string): string | null {
  if (ehGrupo(remoteJid)) return null;
  const ehLid = String(remoteJid || '').includes('@lid');
  if (ehLid && jidAlternativo) return telefoneDoJid(jidAlternativo);
  if (ehLid) return null;
  return telefoneDoJid(remoteJid);
}

// ── Nome do contato ─────────────────────────────────────────────────────────

/** Nome de verdade tem letra. "557599394960" e "+55 75 9939-4960" não têm. */
const temLetra = (v: string | null | undefined) => /\p{L}/u.test(String(v || ''));

/**
 * Confiança da origem do nome. Nome vindo da agenda do WhatsApp não pode ser
 * rebaixado pelo `pushName` da próxima mensagem, que é o apelido escolhido pela
 * pessoa — muitas vezes só um emoji ou o nome da loja.
 */
const FORCA_NOME: Record<string, number> = { manual: 3, contatos: 2, push: 1, numero: 0 };

/**
 * Decide se `candidato` deve virar o novo nome. `null` quando não há nada
 * melhor, para quem chama gravar só o que muda.
 *
 * Duas regras que existem para não estragar o que já está certo: candidato sem
 * letra é descartado (um número JAMAIS substitui um nome), e nome manual é
 * intocável — quem renomeou tinha um motivo, e a sincronização não desfaz isso
 * a cada 24h.
 */
export function nomeMelhor(
  conversa: { nome: string | null; nomeOrigem: string; nomeManual: boolean },
  candidato: string | null | undefined,
  origem: string
): string | null {
  const nome = String(candidato || '').trim();
  if (!nome || !temLetra(nome)) return null;
  if (conversa.nomeManual) return null;

  const atual = String(conversa.nome || '').trim();
  if (nome === atual) return null;

  // Sem letra no nome atual = ainda é o número; qualquer nome de verdade ganha.
  const forcaAtual = temLetra(atual) ? (FORCA_NOME[conversa.nomeOrigem] ?? FORCA_NOME.push) : FORCA_NOME.numero;
  if ((FORCA_NOME[origem] ?? 0) < forcaAtual) return null;
  return nome;
}

// ── Mídia ───────────────────────────────────────────────────────────────────

const ROTULO_MIDIA: Record<string, string> = {
  IMAGEM: '📷 Foto',
  AUDIO: '🎤 Áudio',
  VIDEO: '🎬 Vídeo',
  DOCUMENTO: '📎 Documento',
  STICKER: 'Figurinha',
  LOCALIZACAO: '📍 Localização',
  CONTATO: '👤 Contato',
};

/**
 * Grava a mídia no cofre e devolve o caminho.
 *
 * 🔴 Vai para o cofre (fora do webroot, cifrado), NUNCA para `public/`.
 * Cliente manda foto de RG por WhatsApp com naturalidade, e `public/` é
 * exatamente o vazamento que este sistema já teve por outra porta.
 *
 * Best-effort de propósito: mídia que não baixa não pode impedir a mensagem de
 * ser gravada. Perder o áudio é ruim; perder a mensagem inteira é pior.
 */
async function salvarMidia(
  token: string,
  conversaId: string,
  messageId: string,
  conteudo: Record<string, any>,
  lido: ConteudoLido,
  base64Evento: string | null
): Promise<{ caminho: string; tamanho: number } | null> {
  try {
    let b64 = base64Evento;

    // 🔴 Na prática o evento quase nunca traz base64 — no ERP foram 26 de 26
    // mensagens de mídia sem arquivo, aparecendo como bolha vazia. O download
    // explícito é o caminho que funciona; o base64 do evento fica como atalho
    // caso uma versão do servidor passe a mandá-lo.
    if (!b64) {
      const r = await baixarMidia(token, conteudo);
      if (!r.ok) {
        console.warn('[whatsapp] download de mídia falhou:', JSON.stringify(r.detalhe ?? r.error).slice(0, 200));
        return null;
      }
      const d = (r.data ?? {}) as Record<string, any>;

      // 🔴 Diagnóstico SEMPRE, não só no fracasso. No ERP, quando um campo
      // casou com o conteúdo ERRADO (uma chave de 20 caracteres em vez do
      // áudio), gravaram-se 14 bytes de lixo e o player aparecia mudo, sem uma
      // linha de log para explicar. Falha silenciosa com aparência de sucesso.
      if (typeof d === 'object' && d !== null) {
        const forma = Object.entries(d)
          .map(([k, v]) => `${k}:${typeof v === 'string' ? v.length + 'ch' : typeof v}`)
          .join(' ');
        console.log('[whatsapp] resposta do download →', forma.slice(0, 300));
      }

      b64 =
        d.base64 || d.Base64 || d.media || d.Media || d.data || d.Data ||
        d.buffer || d.Buffer || (typeof d === 'string' ? d : null);
    }

    if (!b64 || typeof b64 !== 'string') return null;

    const limpo = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
    const buffer = Buffer.from(limpo, 'base64');
    // Conteúdo pequeno demais para ser mídia: quase sempre é uma chave ou um
    // erro serializado que casou com o nome do campo.
    if (buffer.length < 100) {
      console.warn(`[whatsapp] mídia de ${buffer.length} bytes descartada (não é arquivo)`);
      return null;
    }

    const ext = (lido.mime || '').split('/')[1]?.split(';')[0] || 'bin';
    const nome = `${Date.now()}-${messageId.slice(-12) || 'midia'}.${ext}`;
    const caminho = await gravarDocumento({
      subdir: `whatsapp/${conversaId}`,
      nomeArquivo: nome,
      conteudo: buffer,
      mimeType: lido.mime ?? null,
    });
    return { caminho, tamanho: buffer.length };
  } catch (e) {
    console.error('[whatsapp] falha ao salvar mídia:', e);
    return null;
  }
}

// ── Conversa ────────────────────────────────────────────────────────────────

/**
 * Acha a conversa deste contato ou cria.
 *
 * 🔴 Procura também pelo TELEFONE, não só pelo JID.
 *
 * O mesmo contato chega ora como `…@s.whatsapp.net`, ora como `…@lid`. Sem
 * casar pelo telefone, cada forma vira uma conversa: a pessoa aparece duas
 * vezes na fila, com metade das mensagens em cada uma, e o histórico fica
 * partido sem que ninguém entenda por quê.
 */
async function acharOuCriarConversa(input: {
  instanciaId: string;
  remoteJid: string;
  nome: string | null;
  telefone: string | null;
}) {
  const porJid = await prisma.whatsappConversa.findUnique({
    where: {
      instanciaId_remoteJid: { instanciaId: input.instanciaId, remoteJid: input.remoteJid },
    },
  });
  if (porJid) return porJid;

  if (input.telefone) {
    const irma = await prisma.whatsappConversa.findFirst({
      where: { instanciaId: input.instanciaId, telefone: input.telefone, ehGrupo: false },
      orderBy: { ultimaMensagemEm: 'desc' },
    });
    // Adota o JID novo: a partir daqui as duas formas caem na mesma conversa.
    if (irma) {
      return prisma.whatsappConversa.update({
        where: { id: irma.id },
        data: { remoteJid: input.remoteJid },
      });
    }
  }

  return prisma.whatsappConversa.create({
    data: {
      instanciaId: input.instanciaId,
      remoteJid: input.remoteJid,
      telefone: input.telefone,
      nome: input.nome,
      nomeOrigem: input.nome ? 'push' : 'numero',
      ehGrupo: ehGrupo(input.remoteJid),
    },
  });
}

/** Situações que contam como atendimento encerrado — mensagem do cliente reabre. */
const ENCERRADAS = new Set(['encerrado', 'ganho', 'perdido']);

// ── Tratadores ──────────────────────────────────────────────────────────────

/**
 * Uma mensagem chegou.
 *
 * 🔴 A MESMA mensagem pode chegar mais de uma vez: pelo webhook ao vivo, pelo
 * HISTORY_SYNC (que alcança mensagens recentes) e pelo eco do que nós mesmos
 * enviamos. No ERP mediram 27 ids com duas cópias — vários com a mesma
 * mensagem gravada uma vez como recebida e outra como enviada, o que além de
 * repetir a bolha embaralhava quem falou por último e, com isso, a espera por
 * resposta e a prévia da fila.
 */
export async function tratarMensagem(
  instancia: { id: string; token: string },
  evento: EventoNormalizado
): Promise<void> {
  const { remoteJid, daMim, messageId, pushName, timestamp, conteudo, base64, jidAlternativo, participante } = evento;
  if (!remoteJid) return;
  // Status/stories não são conversa.
  if (remoteJid === 'status@broadcast') return;

  const lido = lerConteudo(conteudo || {});

  // Editar/apagar age sobre uma mensagem existente e não cria bolha nova. Sai
  // ANTES de mexer na conversa: edição não é atividade nova, não deve reordenar
  // a fila nem reabrir atendimento encerrado.
  if (lido.tipo === 'PROTOCOLO') {
    await tratarProtocolo(instancia.id, lido.protocolo ?? {}, remoteJid);
    return;
  }

  const grupo = ehGrupo(remoteJid);
  const telefone = telefoneDe(remoteJid, jidAlternativo);

  const conversa = await acharOuCriarConversa({
    instanciaId: instancia.id,
    remoteJid,
    // Em grupo o `pushName` é de quem falou, não do grupo.
    nome: grupo ? null : pushName || null,
    telefone,
  });

  if (messageId) {
    const jaTem = await prisma.whatsappMensagem.findUnique({
      where: { conversaId_messageId: { conversaId: conversa.id, messageId } },
      select: { id: true },
    });
    // Sem messageId não há como comparar: nesse caso grava, porque perder é
    // pior que repetir.
    if (jaTem) return;
  }

  // Primeira mensagem deste contato: pede o histórico do chat ao WhatsApp, com
  // esta mensagem como referência. A marca é gravada ANTES de disparar —
  // pedido que falha é melhor que pedido que se repete sozinho para sempre.
  if (!conversa.historicoPedido && messageId) {
    await prisma.whatsappConversa.update({
      where: { id: conversa.id },
      data: { historicoPedido: new Date() },
    });
    void solicitarHistorico(instancia.token, {
      count: 50,
      messageInfo: { Chat: remoteJid, ID: messageId, IsFromMe: daMim, Sender: remoteJid },
    }).catch(() => {});
  }

  let midia: { caminho: string; tamanho: number } | null = null;
  if (lido.mime) {
    midia = await salvarMidia(instancia.token, conversa.id, messageId, conteudo, lido, base64);
  }

  const quando = paraData(timestamp);
  const previa = (lido.texto || ROTULO_MIDIA[lido.tipo] || 'Mensagem').slice(0, 120);

  await prisma.whatsappMensagem.create({
    data: {
      conversaId: conversa.id,
      messageId: messageId || `sem-id-${Date.now()}`,
      daMim,
      tipo: lido.tipo as WhatsappTipoMensagem,
      texto: lido.texto || null,
      midiaCaminho: midia?.caminho ?? null,
      midiaMime: lido.mime ?? null,
      midiaTamanho: midia?.tamanho ?? null,
      nomeArquivo: lido.nomeArquivo ?? null,
      enviadaEm: quando,
      status: daMim ? 'ENVIADA' : 'ENTREGUE',
      // Só em grupo: quem falou, com o nome que valia no momento.
      ...(grupo && !daMim
        ? { participante: telefoneDoJid(participante), participanteNome: pushName || null }
        : {}),
    },
  });

  // O pushName é a fonte mais fraca de nome, e em GRUPO nunca vale: ali ele é
  // de quem falou, e aplicá-lo faria o grupo se chamar "Jerônimo" depois de uma
  // mensagem e "Maria" depois da seguinte — a fila trocaria de nome sozinha.
  const nomeNovo = grupo ? null : nomeMelhor(conversa, pushName, 'push');

  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPreview: previa,
      ultimaMensagemMinha: daMim,
      naoLidas: daMim ? 0 : { increment: 1 },
      // Mensagem do cliente reabre atendimento já encerrado.
      ...(daMim ? {} : ENCERRADAS.has(conversa.situacao) ? { situacao: 'novo' } : {}),
      ...(nomeNovo ? { nome: nomeNovo, nomeOrigem: 'push' } : {}),
      // Conversa LID criada antes de sabermos o número: assim que um evento
      // traz o JID alternativo, o telefone entra sem recriar a conversa.
      ...(!conversa.telefone && telefone ? { telefone } : {}),
    },
  });

  // 🔴 A URL da foto vem do CDN do WhatsApp e EXPIRA — sem revalidar, a imagem
  // quebra sozinha semanas depois, e o sintoma aparece longe da causa. Grupo
  // fica de fora: a rota de avatar espera um telefone, e o JID de grupo não é.
  if (!grupo) {
    void renovarAvatar(instancia.token, conversa.id, remoteJid, conversa.fotoAtualizadaEm);
  }
}

/**
 * Recibo de entrega/leitura — é o que acende o segundo tique e o azul.
 */
export async function tratarRecibo(instanciaId: string, data: Record<string, any>): Promise<void> {
  if (!data) return;

  const ids: string[] = data.MessageIDs || data.messageIds || data.IDs || data.ids || [];
  const tipo = String(data.Type || data.type || '').toLowerCase();
  if (!Array.isArray(ids) || ids.length === 0) return;

  // "read"/"played" = azul; qualquer outro recibo = entregue.
  const status = tipo.includes('read') || tipo.includes('play') ? 'LIDA' : 'ENTREGUE';

  await prisma.whatsappMensagem.updateMany({
    where: {
      messageId: { in: ids },
      conversa: { instanciaId },
      daMim: true,
      // Nunca rebaixa: uma mensagem lida não volta a "entregue" porque chegou
      // um recibo de entrega atrasado.
      ...(status === 'ENTREGUE' ? { status: { in: ['PENDENTE', 'ENVIADA'] } } : {}),
    },
    data: { status },
  });
}

/**
 * Sincronia de histórico: o WhatsApp devolve mensagens antigas em lote.
 *
 * Reaproveita `tratarMensagem` por mensagem, então a deduplicação e todas as
 * regras de nome, mídia e prévia valem igual — histórico não é um caminho
 * paralelo com regras próprias, que foi como o defeito das duplicatas nasceu.
 */
export async function tratarHistorico(
  instancia: { id: string; token: string },
  data: Record<string, any>,
  normalizar: (corpo: Record<string, any>) => EventoNormalizado | null
): Promise<void> {
  if (!data) return;
  const lista: any[] =
    data.Messages || data.messages || data.Conversations || data.conversations || [];
  if (!Array.isArray(lista)) return;

  let processadas = 0;
  for (const item of lista) {
    const evento = normalizar({ event: 'Message', data: item });
    if (!evento?.remoteJid) continue;
    try {
      await tratarMensagem(instancia, evento);
      processadas++;
    } catch (e) {
      // Uma mensagem ruim no meio do histórico não pode abortar o lote.
      console.warn('[whatsapp] item de histórico ignorado:', (e as Error).message);
    }
  }
  if (processadas > 0) console.log(`[whatsapp] histórico: ${processadas} mensagem(ns) ingeridas`);
}

/** Editar e apagar: agem sobre uma mensagem que já existe. */
async function tratarProtocolo(
  instanciaId: string,
  protocolo: Record<string, any>,
  remoteJid: string
): Promise<void> {
  const alvo =
    protocolo?.key?.id || protocolo?.Key?.ID || protocolo?.editedMessage?.key?.id || null;
  if (!alvo) return;

  const tipo = String(protocolo?.type || protocolo?.Type || '').toUpperCase();

  // REVOKE = apagada para todos.
  if (tipo.includes('REVOKE')) {
    await prisma.whatsappMensagem.updateMany({
      where: { messageId: alvo, conversa: { instanciaId, remoteJid } },
      data: { texto: 'Mensagem apagada', tipo: 'SISTEMA', midiaCaminho: null },
    });
    return;
  }

  const novo =
    protocolo?.editedMessage?.message?.conversation ||
    protocolo?.editedMessage?.conversation ||
    protocolo?.EditedMessage?.Message?.Conversation ||
    null;
  if (novo) {
    await prisma.whatsappMensagem.updateMany({
      where: { messageId: alvo, conversa: { instanciaId, remoteJid } },
      data: { texto: novo, editada: true },
    });
  }
}

/** Foto do contato: renova quando vencida (>24h) ou quando nunca foi buscada. */
async function renovarAvatar(
  token: string,
  conversaId: string,
  remoteJid: string,
  atualizadaEm: Date | null
): Promise<void> {
  const VENCIMENTO_MS = 24 * 60 * 60 * 1000;
  if (atualizadaEm && Date.now() - atualizadaEm.getTime() < VENCIMENTO_MS) return;

  try {
    const r = await obterFotoPerfil(token, remoteJid);
    const url = r.ok ? (r.data?.url ?? r.data?.URL ?? null) : null;
    await prisma.whatsappConversa.update({
      where: { id: conversaId },
      // Carimba a data mesmo sem foto: contato sem avatar não pode virar uma
      // chamada externa por mensagem recebida, para sempre.
      data: { fotoAtualizadaEm: new Date(), ...(url ? { fotoUrl: url } : {}) },
    });
  } catch {
    /* best-effort */
  }
}

export type { Prisma };
