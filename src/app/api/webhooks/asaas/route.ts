import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AsaasWebhookPayload } from '@/lib/asaas';

/**
 * Webhook do Asaas — modo ENFILEIRA + WORKER.
 *
 * Esta rota faz APENAS:
 *   1. Valida token
 *   2. Insere log (idempotente via unique [event, paymentId])
 *   3. Responde 200 imediatamente
 *
 * O processamento real é feito pelo worker em
 *   /api/cron/processar-webhooks-asaas
 * que roda a cada minuto.
 */
export async function POST(req: NextRequest) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenObrigatorio = process.env.NODE_ENV === 'production';

  if (tokenObrigatorio && !expectedToken) {
    console.error('[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado em produção');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }
  if (expectedToken) {
    const token = req.headers.get('asaas-access-token');
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 });
    }
  }

  let payload: AsaasWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    await prisma.asaasWebhookLog.create({
      data: {
        event: payload.event,
        paymentId: payload.payment?.id ?? null,
        payload: payload as unknown as object,
        processed: false,
      },
    });
    return NextResponse.json({ ok: true, queued: true });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error('[asaas-webhook] erro ao gravar log:', err);
    return NextResponse.json({ error: 'log failed' }, { status: 500 });
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
