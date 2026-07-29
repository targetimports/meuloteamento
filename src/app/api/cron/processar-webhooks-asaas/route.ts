import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processarEventoAsaas } from '@/lib/asaas-webhook';
import { CRON_TOKEN } from '@/lib/env';
import type { AsaasWebhookPayload } from '@/lib/asaas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TENTATIVAS = 5;
const BATCH = 30;

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-cron-token');
  const queryToken = req.nextUrl.searchParams.get('token');
  if (headerToken !== CRON_TOKEN && queryToken !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const pendentes = await prisma.asaasWebhookLog.findMany({
    where: { processed: false, tentativas: { lt: MAX_TENTATIVAS } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });

  const resultados: { id: string; ok: boolean; erro?: string }[] = [];

  for (const log of pendentes) {
    try {
      await processarEventoAsaas(log.payload as unknown as AsaasWebhookPayload);
      await prisma.asaasWebhookLog.update({
        where: { id: log.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: null,
          tentativas: { increment: 1 },
        },
      });
      resultados.push({ id: log.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.asaasWebhookLog.update({
        where: { id: log.id },
        data: { error: msg, tentativas: { increment: 1 } },
      });
      resultados.push({ id: log.id, ok: false, erro: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    total: pendentes.length,
    ok_count: resultados.filter((r) => r.ok).length,
    falhou: resultados.filter((r) => !r.ok).length,
    detalhes: resultados,
  });
}
