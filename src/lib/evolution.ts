/**
 * Client ADMIN da Evolution API (auto-hospedada no próprio servidor).
 *
 * Diferente de `comunicacao.ts` (que ENVIA usando a config salva na loteadora):
 * aqui gerenciamos o CICLO DE VIDA da instância de WhatsApp — criar, pegar QR,
 * checar status, desconectar — para a tela "Conectar WhatsApp".
 *
 * Lê EVOLUTION_API_URL + EVOLUTION_API_KEY do ambiente (chave global da Evolution).
 * Roda apenas no servidor (server actions / route handlers).
 */

const API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.EVOLUTION_API_KEY || '';

export function evolutionConfigured(): boolean {
  return Boolean(API_URL && API_KEY);
}

export function evolutionBaseUrl(): string {
  return API_URL;
}

export interface EvoInstanceInfo {
  exists: boolean;
  state: 'open' | 'connecting' | 'close' | 'unknown';
  number: string | null; // só dígitos, quando conectado
  apikey: string | null; // apikey/token da instância
}

export interface EvoConnectInfo {
  base64: string | null; // QR como data-url (data:image/png;base64,...)
  pairingCode: string | null;
  code: string | null;
}

function digits(s?: string | null): string | null {
  if (!s) return null;
  const d = String(s).replace(/\D/g, '');
  return d || null;
}

function normState(raw: unknown): EvoInstanceInfo['state'] {
  return raw === 'open' || raw === 'connecting' || raw === 'close' ? raw : 'unknown';
}

async function evoFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: any }> {
  if (!evolutionConfigured()) {
    throw new Error(
      'Evolution não configurada no servidor (EVOLUTION_API_URL / EVOLUTION_API_KEY)'
    );
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

/** Detalhes da instância via fetchInstances (inclui número conectado e apikey). */
export async function fetchInstance(instanceName: string): Promise<EvoInstanceInfo> {
  const { ok, body } = await evoFetch(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
  );
  if (!ok || !body) return { exists: false, state: 'unknown', number: null, apikey: null };
  const arr = Array.isArray(body) ? body : [body];
  const found = arr.find((it: any) => {
    const name = it?.name || it?.instanceName || it?.instance?.instanceName;
    return name === instanceName;
  });
  if (!found) return { exists: false, state: 'unknown', number: null, apikey: null };
  const state = normState(
    found?.connectionStatus || found?.status || found?.instance?.state || found?.state
  );
  const number = digits(found?.ownerJid || found?.owner || found?.number);
  const apikey = found?.token || found?.apikey || found?.hash || null;
  return { exists: true, state, number, apikey };
}

/** Garante que a instância existe; cria se não. Retorna a apikey da instância. */
export async function ensureInstance(instanceName: string): Promise<{ apikey: string | null }> {
  const info = await fetchInstance(instanceName);
  if (info.exists) return { apikey: info.apikey };

  const { ok, body, status } = await evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
  });
  if (!ok) {
    throw new Error(
      `Evolution create ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`
    );
  }
  const apikey =
    typeof body?.hash === 'string' ? body.hash : body?.hash?.apikey ?? null;
  return { apikey };
}

/** Estado da conexão (open/connecting/close). Quando open, resolve o número. */
export async function getConnectionState(instanceName: string): Promise<EvoInstanceInfo> {
  const { ok, body } = await evoFetch(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`
  );
  if (!ok || !body) return { exists: false, state: 'unknown', number: null, apikey: null };
  const state = normState(body?.instance?.state || body?.state);
  let number: string | null = null;
  if (state === 'open') {
    const fi = await fetchInstance(instanceName);
    number = fi.number;
  }
  return { exists: true, state, number, apikey: null };
}

/** QR code (e pairing code) para parear o WhatsApp. */
export async function getConnectQR(
  instanceName: string,
  number?: string
): Promise<EvoConnectInfo> {
  const q = number ? `?number=${encodeURIComponent(number)}` : '';
  const { ok, body, status } = await evoFetch(
    `/instance/connect/${encodeURIComponent(instanceName)}${q}`
  );
  if (!ok) throw new Error(`Evolution connect ${status}`);
  const base64: string | null = body?.base64 ?? body?.qrcode?.base64 ?? null;
  return {
    base64: base64
      ? base64.startsWith('data:')
        ? base64
        : `data:image/png;base64,${base64}`
      : null,
    pairingCode: body?.pairingCode ?? body?.qrcode?.pairingCode ?? null,
    code: body?.code ?? body?.qrcode?.code ?? null,
  };
}

/** Desconecta (logout) a instância. */
export async function logoutInstance(instanceName: string): Promise<void> {
  await evoFetch(`/instance/logout/${encodeURIComponent(instanceName)}`, {
    method: 'DELETE',
  });
}

/** Envia um texto direto pela Evolution (usado no botão "Enviar teste"). */
export async function sendTextViaEvolution(
  instanceName: string,
  number: string,
  text: string
): Promise<{ ok: boolean; erro?: string }> {
  const { ok, body, status } = await evoFetch(
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    { method: 'POST', body: JSON.stringify({ number, text }) }
  );
  if (!ok) {
    const detail =
      typeof body === 'string' ? body.slice(0, 150) : JSON.stringify(body).slice(0, 150);
    return { ok: false, erro: `Evolution ${status}: ${detail}` };
  }
  return { ok: true };
}

/** Nome determinístico da instância para uma loteadora. */
export function instanceNameForLoteadora(
  loteadoraId: string,
  stored?: string | null
): string {
  if (stored && stored.trim()) return stored.trim();
  return `lot-${loteadoraId}`;
}
