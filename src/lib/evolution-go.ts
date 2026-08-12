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

export function enviarTexto(token: string, destino: string, texto: string) {
  return chamar<{ id?: string }>('POST', '/message/send/text', {
    apikey: token,
    body: { phone: normalizarDestino(destino), message: texto },
  });
}

export function marcarComoLida(token: string, destino: string, messageId: string) {
  return chamar('POST', '/message/read', {
    apikey: token,
    body: { phone: normalizarDestino(destino), messageId },
  });
}
