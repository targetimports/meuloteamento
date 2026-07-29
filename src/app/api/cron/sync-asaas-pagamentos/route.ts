/**
 * CRON: sincronização ativa de pagamentos com Asaas.
 *
 * Roda a cada N minutos (configurável no PM2/cron-systemd/cron-vercel) e
 * detecta pagamentos PAGOS no Asaas que ainda estão PENDENTES/ATRASADOS
 * no banco — sem depender exclusivamente do webhook.
 *
 * Querystring:
 *   - token: obrigatório (CRON_TOKEN do env)
 *   - modo=quick (default) | full
 *       quick: só checa parcelas com asaasPaymentId.
 *       full:  também varre /payments?status=RECEIVED dos últimos 30 dias
 *              procurando órfãos.
 *
 * Resposta:
 *   { ok, totalAtualizacoes, totalErros, loteadoras: [...] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { CRON_TOKEN } from '@/lib/env';
import { sincronizarTodasLoteadoras } from '@/lib/asaas-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Pode demorar (varre todas as loteadoras + faz N requisições HTTP)
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-cron-token');
  const queryToken = req.nextUrl.searchParams.get('token');
  if (headerToken !== CRON_TOKEN && queryToken !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const modo =
    req.nextUrl.searchParams.get('modo') === 'full' ? 'full' : 'quick';

  try {
    const result = await sincronizarTodasLoteadoras(modo);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/sync-asaas] erro:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
