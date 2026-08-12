import crypto from 'crypto';

/**
 * Cliente do **Evolution GO** — o gateway da caixa de entrada de WhatsApp.
 *
 * ⚠️ NÃO é a Evolution API v2 (Node/Baileys) que `lib/evolution.ts` usa para
 * disparar cobrança. São dois produtos com contratos diferentes: procurar a
 * documentação da v2 aqui não ajuda, os caminhos e a autenticação são outros.
 * Os dois convivem de propósito — a régua continua no que já funciona.
 *
 * ── Autenticação em dois níveis ─────────────────────────────────────────────
 * A chave global (`EVOLUTION_GO_API_KEY`) vale só para criar, listar e excluir
 * instância. Todo o resto — conectar, QR, status, enviar — usa o **token da
 * instância**, gerado por nós antes do create e guardado em
 * `whatsapp_instancias.token`.
 *
 * ── Armadilhas confirmadas no servidor do ERP, herdadas aqui ────────────────
 * 1. O nome do evento em `subscribe` é MAIÚSCULO e case-sensitive. "Message" é
 *    aceito pela API e descartado em silêncio — o webhook fica registrado e
 *    nenhuma mensagem chega nunca.
 * 2. O webhook não tem rota própria: vai no corpo do `/instance/connect`. Quem
 *    conecta sem `webhookUrl` pareia normalmente e não recebe nada.
 * 3. Não existe evento de conexão. Estado de pareamento só por consulta a
 *    `/instance/status` (`Connected` + `LoggedIn`).
 */

const BASE = (process.env.EVOLUTION_GO_URL || '').replace(/\/+$/, '');
const CHAVE_GLOBAL = process.env.EVOLUTION_GO_API_KEY || '';
const TIMEOUT_MS = 25_000;

export function gatewayConfigurado(): boolean {
  return Boolean(BASE && CHAVE_GLOBAL);
}

/** Eventos aceitos pelo servidor — descobertos por teste, o spec não lista. */
export const EVENTOS_VALIDOS = [
  'ALL',
  'MESSAGE',
  'PRESENCE',
  'CHAT_PRESENCE',
  'HISTORY_SYNC',
  'QRCODE',
  'CALL',
  'READ_RECEIPT',
  'CONTACT',
] as const;

/** O que a caixa de entrada precisa: mensagem, leitura e histórico. */
export const EVENTOS_PADRAO = ['MESSAGE', 'READ_RECEIPT', 'HISTORY_SYNC'];

/** Token da instância: 32 hex, gerado por nós ANTES do create. */
export function gerarToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * URL que o gateway vai chamar quando chegar mensagem.
 *
 * O token no caminho é o segredo que autentica o webhook: qualquer um pode
 * fazer POST na nossa rota, e é ele que separa o gateway de um curioso.
 */
export function urlDoWebhook(tokenInstancia: string): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!base || !tokenInstancia) return null;
  return `${base}/api/whatsapp/webhook/${tokenInstancia}`;
}

export type Resultado<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; detalhe?: unknown };

async function chamar<T = unknown>(
  metodo: string,
  caminho: string,
  opts: { apikey?: string; body?: unknown } = {}
): Promise<Resultado<T>> {
  if (!gatewayConfigurado()) {
    return { ok: false, error: 'Gateway não configurado (EVOLUTION_GO_URL / EVOLUTION_GO_API_KEY).' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        apikey: opts.apikey || CHAVE_GLOBAL,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    const texto = await res.text();
    let dados: unknown = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = { raw: texto };
    }

    if (!res.ok) {
      console.warn(`[evolution-go] ${metodo} ${caminho} → ${res.status}`, texto.slice(0, 300));
      return { ok: false, error: 'erro_gateway', status: res.status, detalhe: dados };
    }

    const corpo = dados as { data?: T } | null;
    return { ok: true, data: (corpo?.data ?? dados) as T };
  } catch (e) {
    const err = e as Error;
    const abortado = err.name === 'AbortError';
    console.error(`[evolution-go] ${metodo} ${caminho} falhou:`, err.message);
    return { ok: false, error: abortado ? 'timeout' : 'inalcancavel', detalhe: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Instância (chave GLOBAL) ────────────────────────────────────────────────

/** Cria a instância. Devolve `id` (UUID) — é o que exclui depois. */
export function criarInstancia(nome: string, token: string) {
  return chamar<{ id: string }>('POST', '/instance/create', { body: { name: nome, token } });
}

export function excluirInstancia(instanciaGateway: string) {
  return chamar('DELETE', `/instance/delete/${encodeURIComponent(instanciaGateway)}`);
}

export interface InstanciaNoGateway {
  id?: string;
  name?: string;
  token?: string;
  /** `557598490492:31@s.whatsapp.net` — número, aparelho e domínio. */
  jid?: string;
  connected?: boolean;
  events?: string;
  webhook?: string;
}

export function listarInstancias() {
  return chamar<InstanciaNoGateway[]>('GET', '/instance/all');
}

/**
 * Dados da instância no gateway, incluindo o `jid`.
 *
 * Existe porque `/instance/status` responde apenas `{Connected, LoggedIn,
 * Name}` — não diz QUAL número pareou. O número só aparece na listagem, que
 * exige a chave global.
 */
export async function detalhesDaInstancia(nome: string): Promise<InstanciaNoGateway | null> {
  const r = await listarInstancias();
  if (!r.ok || !Array.isArray(r.data)) return null;
  return r.data.find((i) => i.name === nome) ?? null;
}

// ── Instância (token da INSTÂNCIA) ──────────────────────────────────────────

/**
 * Conecta e, no mesmo passo, registra o webhook e assina os eventos.
 *
 * `eventString` vazio na resposta significa que nenhum evento foi aceito — o
 * pareamento funciona e nenhuma mensagem chega (armadilha 1). Quem chama deve
 * conferir isso em vez de assumir sucesso.
 */
export function conectar(
  token: string,
  opts: { eventos?: string[]; telefone?: string } = {}
) {
  const body: Record<string, unknown> = { subscribe: opts.eventos ?? EVENTOS_PADRAO };
  const hook = urlDoWebhook(token);
  if (hook) body.webhookUrl = hook;
  if (opts.telefone) body.phone = opts.telefone;
  return chamar<{ eventString?: string }>('POST', '/instance/connect', { apikey: token, body });
}

/** QR como data URI PNG — vai direto no `src` de um `<img>`. */
export function obterQr(token: string) {
  return chamar<{ qrcode?: string; base64?: string }>('GET', '/instance/qr', { apikey: token });
}

/** `{ Connected, LoggedIn, Name }` — `LoggedIn: true` significa pareado. */
export function obterStatus(token: string) {
  return chamar<{ Connected?: boolean; LoggedIn?: boolean; Name?: string }>(
    'GET',
    '/instance/status',
    { apikey: token }
  );
}

export function desconectar(token: string) {
  return chamar('POST', '/instance/disconnect', { apikey: token });
}

export function sairDaConta(token: string) {
  return chamar('DELETE', '/instance/logout', { apikey: token });
}

export function reconectar(token: string) {
  return chamar('POST', '/instance/reconnect', { apikey: token });
}

// ── Mensagens (token da INSTÂNCIA) ──────────────────────────────────────────

/**
 * Destino aceito pelo servidor: só dígitos com DDI (5571999998888).
 *
 * 🔴 JID de GRUPO passa INTEIRO. `120363143104495367@g.us` sem o sufixo vira um
 * número de 18 dígitos que o servidor tenta entregar a um telefone inexistente:
 * a resposta no grupo não sai, e o erro volta como "número inválido", que não
 * aponta para lugar nenhum.
 */
export function normalizarDestino(valor: string): string {
  const v = (valor || '').trim();
  if (v.includes('@')) return v; // JID completo (grupo ou contato)
  return v.replace(/\D/g, '');
}

export function enviarTexto(token: string, destino: string, texto: string, quoted?: unknown) {
  return chamar<{ id?: string; ID?: string }>('POST', '/send/text', {
    apikey: token,
    body: { number: normalizarDestino(destino), text: texto, ...(quoted ? { quoted } : {}) },
  });
}

/**
 * Mídia por URL — o servidor BUSCA o arquivo, não recebe base64.
 *
 * Base64 de 20 MB dentro de um JSON seria payload demais para atravessar duas
 * camadas de proxy. A consequência para nós é que o arquivo precisa estar
 * alcançável pelo gateway no momento do envio; como a mídia vive no cofre
 * (privado), quem chama precisa produzir um endereço temporário.
 */
export function enviarMidia(
  token: string,
  destino: string,
  opts: { url: string; tipo: string; legenda?: string; nomeArquivo?: string; quoted?: unknown }
) {
  return chamar<{ id?: string; ID?: string }>('POST', '/send/media', {
    apikey: token,
    body: {
      number: normalizarDestino(destino),
      url: opts.url,
      type: opts.tipo,
      ...(opts.legenda ? { caption: opts.legenda } : {}),
      ...(opts.nomeArquivo ? { filename: opts.nomeArquivo } : {}),
      ...(opts.quoted ? { quoted: opts.quoted } : {}),
    },
  });
}

export function marcarLida(token: string, messageId: string, destino: string) {
  return chamar('POST', '/message/markread', {
    apikey: token,
    body: { id: messageId, number: normalizarDestino(destino) },
  });
}

export function reagir(
  token: string,
  opts: { destino: string; messageId: string; daMim: boolean; emoji: string }
) {
  return chamar('POST', '/message/react', {
    apikey: token,
    body: {
      number: normalizarDestino(opts.destino),
      messageId: opts.messageId,
      fromMe: Boolean(opts.daMim),
      emoji: opts.emoji,
    },
  });
}

export function apagarMensagem(
  token: string,
  opts: { destino: string; messageId: string; daMim: boolean }
) {
  return chamar('POST', '/message/delete', {
    apikey: token,
    body: {
      number: normalizarDestino(opts.destino),
      messageId: opts.messageId,
      fromMe: Boolean(opts.daMim),
    },
  });
}

/**
 * Baixa a mídia de uma mensagem recebida.
 *
 * 🔴 "Mídia chega em base64 no evento" é falso. No ERP foram 26 mensagens de
 * mídia (20 áudios, 3 figurinhas, 1 documento, 1 imagem) e TODAS com o arquivo
 * vazio — o campo `base64` do webhook nunca veio preenchido, e o sintoma na
 * tela era uma bolha vazia com só o horário.
 *
 * O caminho certo é este endpoint: manda-se de volta o objeto `Message` cru que
 * veio no webhook (é ele que carrega `mediaKey`, `directPath` e o resto do que
 * o WhatsApp exige para decifrar) e o servidor devolve o conteúdo. O retorno é
 * um mapa sem forma declarada no spec, então quem chama procura o base64 em
 * mais de um nome possível.
 */
export function baixarMidia(token: string, message: unknown) {
  return chamar<Record<string, unknown>>('POST', '/message/downloadmedia', {
    apikey: token,
    body: { message },
  });
}

/**
 * Pede ao WhatsApp o histórico de um chat, a partir de uma mensagem de
 * referência. O retorno chega depois, pelo webhook, como HISTORY_SYNC.
 */
export function solicitarHistorico(
  token: string,
  opts: { count?: number; messageInfo: Record<string, unknown> }
) {
  return chamar('POST', '/chat/history-sync', {
    apikey: token,
    body: { count: opts.count ?? 50, messageInfo: opts.messageInfo },
  });
}

/**
 * Foto de perfil do contato.
 *
 * A URL vem do CDN do WhatsApp e EXPIRA — quem chama guarda a data e revalida,
 * em vez de tratar como permanente.
 *
 * ⚠️ Não confundir com `/user/profilePicture`, que DEFINE a nossa própria foto.
 */
export function obterFotoPerfil(token: string, jidOuNumero: string, preview = true) {
  const bruto = String(jidOuNumero || '');
  const number = bruto.includes('@') ? bruto : `${normalizarDestino(bruto)}@s.whatsapp.net`;
  return chamar<{ url?: string; URL?: string }>('POST', '/user/avatar', {
    apikey: token,
    body: { number, preview },
  });
}

/**
 * Agenda de contatos do número conectado.
 *
 * É a fonte de nome mais confiável que existe: o `pushName` do webhook só
 * aparece quando o contato mandou mensagem, e some quando fomos nós que
 * iniciamos a conversa.
 */
export function listarContatos(token: string) {
  return chamar<Array<{ Jid?: string; FullName?: string; FirstName?: string; PushName?: string; BusinessName?: string }>>(
    'GET',
    '/user/contacts',
    { apikey: token }
  );
}
