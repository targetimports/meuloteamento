import type { WhatsappTipoMensagem } from '@prisma/client';

/**
 * Normalização do evento que o Evolution GO entrega no webhook.
 *
 * O gateway é escrito em Go sobre o whatsmeow e entrega os campos em
 * PascalCase (`Info.Chat`, `Info.IsFromMe`), mas nem sempre: o mesmo servidor
 * usa outras grafias dentro de `key` na sincronia de histórico. Por isso cada
 * campo é procurado em todas as grafias plausíveis.
 *
 * Isso não é excesso de zelo — é o registro de defeitos que já aconteceram no
 * ERP e que este código herda resolvidos. Um webhook que ignora o evento em
 * silêncio é o pior tipo de falha, porque parece estar funcionando.
 */

export interface EventoNormalizado {
  tipo: string;
  remoteJid: string;
  daMim: boolean;
  messageId: string;
  /** Nome de exibição de quem enviou. Vazio quando a mensagem é nossa. */
  pushName: string;
  /** Em conversa LID, o telefone real por trás do identificador interno. */
  jidAlternativo: string;
  timestamp: number | string | null;
  conteudo: Record<string, unknown>;
  base64: string | null;
  /** Em grupo, quem falou. O `remoteJid` é o grupo. */
  participante: string;
}

function primeiro(obj: Record<string, unknown>, ...nomes: string[]): string {
  for (const n of nomes) {
    const v = obj[n];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

export function normalizarEvento(body: Record<string, any> | null): EventoNormalizado | null {
  if (!body) return null;

  // Formato real do Evolution GO: `event` é uma STRING no topo ("Message",
  // "Receipt", "HistorySync") e o conteúdo vem em `data`.
  const tipo = String(
    body.type || (typeof body.event === 'string' ? body.event : '') || ''
  ).toUpperCase();
  const ev = (body.event && typeof body.event === 'object' ? body.event : null) || body.data || {};

  const info = ev.Info || ev.info || (ev.Chat ? ev : null);
  if (info) {
    /**
     * 🔴 A DIREÇÃO é lida em todas as grafias possíveis.
     *
     * No ERP lia-se só `IsFromMe`/`isFromMe`. Quando o evento vinha com
     * `FromMe` ou `key.fromMe`, a leitura dava `false` e a mensagem que o
     * atendente mandou do próprio celular era gravada como recebida —
     * aparecia do lado do cliente, como se ele tivesse escrito.
     *
     * Não é cosmético: quem falou por último decide a espera por resposta, o
     * "Você:" da prévia e qualquer métrica de atendimento.
     */
    const daMim = Boolean(
      info.IsFromMe ?? info.isFromMe ?? info.FromMe ?? info.fromMe ??
      info.Key?.FromMe ?? info.key?.fromMe
    );

    return {
      tipo,
      remoteJid: primeiro(info, 'Chat', 'chat', 'RemoteJid'),
      daMim,
      messageId: primeiro(info, 'ID', 'Id', 'id'),
      // PushName é o nome de QUEM ENVIOU. Na mensagem que nós mandamos isso é
      // o nosso próprio nome — usá-lo aqui rebatiza o contato com o nome do
      // atendente e enche a caixa de conversas com o mesmo nome.
      pushName: daMim ? '' : primeiro(info, 'PushName', 'pushName'),
      // Conversa em modo LID: o Chat é um identificador interno de 15 dígitos,
      // não um telefone. O par real vem em senderAlt (recebida) ou
      // recipientAlt (enviada) — é o que permite exibir o número certo.
      jidAlternativo: daMim
        ? primeiro(info, 'RecipientAlt', 'recipientAlt')
        : primeiro(info, 'SenderAlt', 'senderAlt'),
      timestamp: info.Timestamp ?? info.timestamp ?? null,
      conteudo: ev.Message || ev.message || info.Message || {},
      base64: ev.base64 || ev.Base64 || null,
      // Em grupo, quem falou. Sem isto, dez pessoas viram uma só na tela.
      participante: primeiro(info, 'Sender', 'sender', 'Participant', 'participant'),
    };
  }

  // Formato de chave/mensagem (compatível com o padrão da v2).
  const key = ev.key || ev.Key;
  if (key) {
    return {
      tipo,
      remoteJid: key.remoteJid || '',
      daMim: Boolean(key.fromMe),
      messageId: key.id || '',
      pushName: ev.pushName || '',
      jidAlternativo: '',
      timestamp: ev.messageTimestamp ?? null,
      conteudo: ev.message || {},
      base64: ev.base64 || null,
      participante: '',
    };
  }

  return null;
}

/** Extrai o texto da mensagem, qualquer que seja o invólucro. */
export function extrairTexto(conteudo: Record<string, any>): string | null {
  if (!conteudo) return null;
  return (
    conteudo.conversation ||
    conteudo.Conversation ||
    conteudo.extendedTextMessage?.text ||
    conteudo.ExtendedTextMessage?.Text ||
    conteudo.imageMessage?.caption ||
    conteudo.ImageMessage?.Caption ||
    conteudo.videoMessage?.caption ||
    conteudo.VideoMessage?.Caption ||
    conteudo.documentMessage?.caption ||
    conteudo.DocumentMessage?.Caption ||
    null
  );
}

/** Que tipo de mensagem é esta. */
export function detectarTipo(conteudo: Record<string, any>): WhatsappTipoMensagem {
  if (!conteudo) return 'TEXTO';
  const tem = (...nomes: string[]) => nomes.some((n) => conteudo[n]);

  if (tem('imageMessage', 'ImageMessage')) return 'IMAGEM';
  if (tem('videoMessage', 'VideoMessage')) return 'VIDEO';
  if (tem('audioMessage', 'AudioMessage', 'pttMessage')) return 'AUDIO';
  if (tem('documentMessage', 'DocumentMessage')) return 'DOCUMENTO';
  if (tem('stickerMessage', 'StickerMessage')) return 'STICKER';
  if (tem('locationMessage', 'LocationMessage')) return 'LOCALIZACAO';
  if (tem('contactMessage', 'ContactMessage', 'contactsArrayMessage')) return 'CONTATO';
  if (tem('protocolMessage', 'ProtocolMessage')) return 'SISTEMA';
  return 'TEXTO';
}

/**
 * Converte o carimbo do WhatsApp em Date.
 *
 * Vem em segundos (epoch) ou já como string ISO, conforme o evento. Tratar
 * segundos como milissegundos jogaria a mensagem para 1970 e ela sumiria do
 * fim da conversa — que é onde a pessoa está olhando.
 */
export function paraData(valor: number | string | null): Date {
  if (!valor) return new Date();
  if (typeof valor === 'number') {
    return new Date(valor < 1e12 ? valor * 1000 : valor);
  }
  const n = Number(valor);
  if (!Number.isNaN(n) && n > 0) {
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Telefone legível a partir do JID, quando não for grupo.
 *
 * O JID pode trazer o identificador do aparelho depois de dois-pontos —
 * `557598490492:31@s.whatsapp.net` é o celular 55 75 98490492 no device 31.
 * Remover só os não-dígitos colaria o `31` no fim e produziria
 * `55759849049231`: um número que não existe, gravado como o telefone do
 * contato e usado depois para abrir conversa e disparar cobrança.
 */
export function telefoneDoJid(jid: string): string | null {
  if (!jid || jid.includes('@g.us')) return null;
  const semSufixo = jid.split('@')[0] ?? '';
  const semDispositivo = semSufixo.split(':')[0] ?? '';
  const num = semDispositivo.replace(/\D/g, '');
  return num || null;
}

export function ehGrupo(jid: string): boolean {
  return Boolean(jid && jid.includes('@g.us'));
}
