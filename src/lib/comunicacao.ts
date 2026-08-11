import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { renderTemplate } from './template';
import { dentroDaJanelaCobranca } from './horario-cobranca';

export type Canal = 'WHATSAPP' | 'EMAIL' | 'SMS';

interface ProviderResult {
  ok: boolean;
  providerId?: string | null;
  erro?: string;
}

interface SendInput {
  loteadoraId?: string | null;
  canal: Canal;
  destinatario: string;
  assunto?: string | null;
  template: string;
  contexto: Record<string, unknown>;
  parcelaId?: string | null;
  userId?: string | null;
  idempotencyKey?: string | null;
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

export async function sendWhatsApp(params: {
  loteadoraId?: string | null;
  destinatario: string;
  corpo: string;
}): Promise<ProviderResult> {
  const loteadora = params.loteadoraId
    ? await prisma.loteadora.findUnique({ where: { id: params.loteadoraId } })
    : null;

  const provider = loteadora?.whatsappProvider || process.env.WHATSAPP_PROVIDER;
  const token = loteadora?.whatsappToken || process.env.WHATSAPP_TOKEN;
  const instance = loteadora?.whatsappInstance || process.env.WHATSAPP_INSTANCE;
  const baseUrl = loteadora?.whatsappBaseUrl || process.env.WHATSAPP_BASE_URL;

  if (!provider || !token) {
    return { ok: false, erro: 'Provider WhatsApp não configurado' };
  }

  const phone = digits(params.destinatario);
  if (!phone) return { ok: false, erro: 'Telefone inválido' };
  // Normaliza para formato internacional E.164 sem o '+': se vier sem o 55
  // do Brasil (DDD+número = 10 ou 11 dígitos), adiciona.
  const phoneIntl = phone.length <= 11 ? `55${phone}` : phone;

  try {
    if (provider === 'evolution') {
      // Evolution API (auto-hospedado).
      // Endpoint: POST {baseUrl}/message/sendText/{instance}
      // Headers: apikey: <token>
      // Body: { number, text }
      if (!baseUrl) {
        return { ok: false, erro: 'Evolution: base URL não configurado' };
      }
      if (!instance) {
        return { ok: false, erro: 'Evolution: instance não configurado' };
      }
      const base = baseUrl.replace(/\/+$/, '');
      const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: token,
        },
        body: JSON.stringify({ number: phoneIntl, text: params.corpo }),
      });
      if (!res.ok) {
        // Captura o body de erro pra ajudar o admin (Evolution costuma
        // retornar JSON com message)
        const errBody = await res.text().catch(() => '');
        return {
          ok: false,
          erro: `Evolution ${res.status}: ${errBody.slice(0, 200)}`,
        };
      }
      const data = (await res.json().catch(() => ({}))) as {
        key?: { id?: string };
        messageId?: string;
      };
      return {
        ok: true,
        providerId: data.key?.id ?? data.messageId ?? null,
      };
    }

    if (provider === 'zapi') {
      const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: params.corpo }),
      });
      if (!res.ok) return { ok: false, erro: `ZAPI ${res.status}` };
      const data = (await res.json()) as { messageId?: string };
      return { ok: true, providerId: data.messageId ?? null };
    }

    if (provider === 'meta_cloud') {
      const url = `https://graph.facebook.com/v18.0/${instance}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: params.corpo },
        }),
      });
      if (!res.ok) return { ok: false, erro: `Meta ${res.status}` };
      const data = (await res.json()) as { messages?: { id: string }[] };
      return { ok: true, providerId: data.messages?.[0]?.id ?? null };
    }

    return { ok: false, erro: `Provider ${provider} não implementado` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendEmail(params: {
  loteadoraId?: string | null;
  destinatario: string;
  assunto: string;
  corpo: string;
}): Promise<ProviderResult> {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.EMAIL_API_KEY;
  if (!provider || !apiKey) return { ok: false, erro: 'EMAIL_PROVIDER não configurado' };

  const loteadora = params.loteadoraId
    ? await prisma.loteadora.findUnique({ where: { id: params.loteadoraId } })
    : null;
  const from =
    loteadora?.emailFromAddress ||
    process.env.EMAIL_FROM ||
    'no-reply@meuloteamento.com';

  try {
    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: params.destinatario,
          subject: params.assunto,
          html: params.corpo,
        }),
      });
      if (!res.ok) return { ok: false, erro: `Resend ${res.status}` };
      const data = (await res.json()) as { id?: string };
      return { ok: true, providerId: data.id ?? null };
    }
    return { ok: false, erro: `Provider ${provider} não implementado` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function enfileirar(input: SendInput): Promise<{ id: string; jaExistia: boolean }> {
  const corpo = renderTemplate(input.template, input.contexto);
  const assunto = input.assunto
    ? renderTemplate(input.assunto, input.contexto)
    : null;

  const idem = input.idempotencyKey ?? null;
  if (idem) {
    const existing = await prisma.envioComunicacao.findUnique({
      where: { idempotencyKey: idem },
    });
    if (existing) return { id: existing.id, jaExistia: true };
  }

  try {
    const e = await prisma.envioComunicacao.create({
      data: {
        loteadoraId: input.loteadoraId ?? null,
        canal: input.canal,
        destinatario: input.destinatario,
        assunto,
        corpo,
        parcelaId: input.parcelaId ?? null,
        userId: input.userId ?? null,
        idempotencyKey: idem,
        status: 'PENDENTE',
      },
    });
    return { id: e.id, jaExistia: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await prisma.envioComunicacao.findUnique({
        where: { idempotencyKey: idem! },
      });
      return { id: existing!.id, jaExistia: true };
    }
    throw e;
  }
}

/** Gotejamento padrão do WhatsApp. Vale para qualquer caller que não passe opts. */
export const GOTEJAMENTO_PADRAO = {
  maxWhatsapp: 6,
  delayMinMs: 6000,
  delayMaxMs: 14000,
} as const;

export interface ProcessarFilaOpts {
  /** Máx. de WhatsApp por rodada (gotejamento anti-ban). */
  maxWhatsapp?: number;
  /** Atraso mínimo entre um WhatsApp e o próximo (ms). */
  delayMinMs?: number;
  /** Atraso máximo entre um WhatsApp e o próximo (ms). */
  delayMaxMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function processarFila(
  limite = 50,
  opts: ProcessarFilaOpts = {}
): Promise<{ enviados: number; falhou: number; adiados: number }> {
  // Fora da janela 08h-12h (BRT), NÃO processa cobrança (envios ligados a uma
  // parcela). Recuperação de senha / leads (parcelaId null) saem a qualquer hora.
  const foraDaJanela = !dentroDaJanelaCobranca();

  const pendentes = await prisma.envioComunicacao.findMany({
    where: {
      status: 'PENDENTE',
      tentativas: { lt: 5 },
      ...(foraDaJanela ? { parcelaId: null } : {}),
    },
    take: limite,
    orderBy: { createdAt: 'asc' },
  });

  let enviados = 0;
  let falhou = 0;
  let adiados = 0;
  let whatsappEnviados = 0;
  const maxWpp = opts.maxWhatsapp ?? GOTEJAMENTO_PADRAO.maxWhatsapp;
  const dMin = opts.delayMinMs ?? GOTEJAMENTO_PADRAO.delayMinMs;
  const dMax = opts.delayMaxMs ?? GOTEJAMENTO_PADRAO.delayMaxMs;

  for (const envio of pendentes) {
    // Gotejamento do WhatsApp: limita por rodada e espaça entre um e outro.
    // (e-mail/SMS não entram no limite nem no atraso — saem imediato.)
    if (envio.canal === 'WHATSAPP') {
      if (whatsappEnviados >= maxWpp) {
        adiados++; // fica PENDENTE p/ próxima rodada (não gasta tentativa)
        continue;
      }
      if (whatsappEnviados > 0 && dMax > 0) {
        await sleep(dMin + Math.random() * Math.max(0, dMax - dMin));
      }
    }

    let result: ProviderResult;
    if (envio.canal === 'WHATSAPP') {
      result = await sendWhatsApp({
        loteadoraId: envio.loteadoraId,
        destinatario: envio.destinatario,
        corpo: envio.corpo,
      });
      whatsappEnviados++;
    } else if (envio.canal === 'EMAIL') {
      result = await sendEmail({
        loteadoraId: envio.loteadoraId,
        destinatario: envio.destinatario,
        assunto: envio.assunto ?? '(sem assunto)',
        corpo: envio.corpo,
      });
    } else {
      result = { ok: false, erro: 'SMS não implementado' };
    }

    await prisma.envioComunicacao.update({
      where: { id: envio.id },
      data: {
        status: result.ok ? 'ENVIADO' : 'FALHOU',
        providerId: result.providerId ?? null,
        erro: result.erro ?? null,
        tentativas: { increment: 1 },
        enviadoEm: result.ok ? new Date() : null,
      },
    });

    if (result.ok) enviados++;
    else falhou++;
  }

  return { enviados, falhou, adiados };
}

export function buildIdempotencyKey(parts: (string | number)[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
}
