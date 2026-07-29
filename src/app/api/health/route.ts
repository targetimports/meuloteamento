import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { ok: boolean; ms?: number; info?: unknown }> = {};

  try {
    const t = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true, ms: Date.now() - t };
  } catch (err) {
    checks.db = { ok: false, info: String(err) };
  }

  try {
    const t = Date.now();
    const pendentes = await prisma.asaasWebhookLog.count({ where: { processed: false } });
    const fila = await prisma.envioComunicacao.count({ where: { status: 'PENDENTE' } });
    checks.queues = { ok: true, ms: Date.now() - t, info: { webhooks_pendentes: pendentes, envios_pendentes: fila } };
  } catch (err) {
    checks.queues = { ok: false, info: String(err) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      uptimeMs: Date.now() - start,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
