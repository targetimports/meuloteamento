import crypto from 'crypto';

/**
 * Endereço temporário e assinado para o gateway buscar um arquivo nosso.
 *
 * 🔴 Existe por um conflito real entre duas decisões corretas.
 *
 * O `/send/media` do Evolution GO **busca o arquivo por URL** — ele não aceita
 * base64, porque um anexo de 20 MB dentro de um JSON não atravessa duas camadas
 * de proxy. Mas a nossa mídia vive no cofre, fora do webroot e cifrada, porque
 * é onde documento de cliente tem que ficar.
 *
 * A saída é um endereço que existe por poucos minutos e só serve para UM
 * arquivo: assinado com HMAC sobre (id + expiração), sem sessão. Quem não tem a
 * assinatura não passa, e quem tem só alcança aquele arquivo, e só até expirar.
 *
 * O segredo é o `JWT_SECRET`, com um rótulo próprio no HMAC para que uma
 * assinatura daqui nunca valha como token de sessão em outro lugar.
 */

const ROTULO = 'whatsapp-midia-saida';
/** Curto de propósito: o gateway busca o arquivo em segundos. */
const VALIDADE_SEGUNDOS = 300;

function segredo(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto demais para assinar a URL de mídia.');
  }
  return s;
}

function assinar(payload: string): string {
  return crypto.createHmac('sha256', segredo()).update(`${ROTULO}:${payload}`).digest('base64url');
}

/** Token opaco: `<mensagemId>.<expiraEm>.<assinatura>` */
export function gerarTokenDeSaida(mensagemId: string): string {
  const expiraEm = Math.floor(Date.now() / 1000) + VALIDADE_SEGUNDOS;
  const payload = `${mensagemId}.${expiraEm}`;
  return `${payload}.${assinar(payload)}`;
}

export function validarTokenDeSaida(token: string): { mensagemId: string } | null {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;

  const [mensagemId, expiraEmTexto, assinatura] = partes;
  const payload = `${mensagemId}.${expiraEmTexto}`;

  const esperada = assinar(payload);
  // Comparação em tempo constante: comparar strings com `===` vaza, pelo tempo,
  // quantos caracteres iniciais estão certos.
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const expiraEm = Number(expiraEmTexto);
  if (!Number.isFinite(expiraEm) || expiraEm < Math.floor(Date.now() / 1000)) return null;

  return { mensagemId };
}

export function urlDeSaida(mensagemId: string): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/api/whatsapp/saida/${gerarTokenDeSaida(mensagemId)}`;
}
