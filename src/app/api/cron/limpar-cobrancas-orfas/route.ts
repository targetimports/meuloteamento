/**
 * Limpeza retroativa de cobranças órfãs no Asaas.
 *
 * Cenário: vendas que foram CANCELADAS/DISTRATADAS no nosso banco mas cujas
 * cobranças (PIX/boleto/cartão) continuaram vivas no Asaas — o Asaas
 * continua mandando lembrete automático pro cliente todo dia, mesmo a venda
 * estando morta no nosso sistema.
 *
 * Este job:
 *   1. Encontra todas parcelas com asaasPaymentId não nulo cuja venda está
 *      em status CANCELADA ou DISTRATADA.
 *   2. Pra cada uma, chama DELETE no Asaas (idempotente — 404/400 são OK).
 *   3. Zera os campos asaas* da parcela local.
 *
 * Pode ser chamado:
 *   - Manualmente uma vez (mutirão de limpeza pra parar mensagens em massa)
 *   - Como cron rodando 1x por dia (pega resíduos novos)
 *
 * Autenticação: token CRON.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CRON_TOKEN } from '@/lib/env';
import { getLoteadoraAsaasContext } from '@/lib/asaas-context';
import { deletePayment, AsaasError } from '@/lib/asaas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-cron-token');
  const queryToken = req.nextUrl.searchParams.get('token');
  if (headerToken !== CRON_TOKEN && queryToken !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  // Busca parcelas órfãs: têm asaasPaymentId, venda CANCELADA/DISTRATADA.
  // NÃO filtra status da parcela — mesmo PAGO mantemos rastro do Asaas
  // pra não apagar histórico de pagamento legítimo. Mas pra deletar do
  // Asaas só faz sentido nas que ainda não foram pagas.
  const candidatas = await prisma.parcela.findMany({
    where: {
      asaasPaymentId: { not: null },
      status: { in: ['PENDENTE', 'ATRASADO', 'CANCELADO'] },
      venda: { status: { in: ['CANCELADA', 'DISTRATADA'] } },
    },
    select: {
      id: true,
      numero: true,
      asaasPaymentId: true,
      vendaId: true,
      venda: {
        select: {
          numero: true,
          status: true,
          lote: { select: { loteamento: { select: { loteadoraId: true } } } },
        },
      },
    },
  });

  const deletadas: string[] = [];
  const falhas: string[] = [];
  // Cache de contextos Asaas por loteadora pra evitar re-fetch
  const ctxCache = new Map<string, unknown>();

  for (const p of candidatas) {
    const loteadoraId = p.venda.lote.loteamento.loteadoraId;
    let ctx = ctxCache.get(loteadoraId) as Awaited<
      ReturnType<typeof getLoteadoraAsaasContext>
    > | null;
    if (ctx === undefined) {
      ctx = await getLoteadoraAsaasContext(loteadoraId);
      ctxCache.set(loteadoraId, ctx);
    }
    if (!ctx) {
      falhas.push(`#${p.venda.numero}/p${p.numero} (sem Asaas configurado)`);
      continue;
    }

    if (dryRun) {
      deletadas.push(
        `[DRY] #${p.venda.numero}/p${p.numero} payment=${p.asaasPaymentId}`
      );
      continue;
    }

    try {
      await deletePayment(ctx, p.asaasPaymentId!);
    } catch (err) {
      if (
        !(err instanceof AsaasError) ||
        (err.status !== 404 && err.status !== 400)
      ) {
        falhas.push(
          `#${p.venda.numero}/p${p.numero}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        continue;
      }
      // 404/400 = já não existe no Asaas — segue zerando local
    }

    // Zera campos Asaas da parcela local
    try {
      await prisma.parcela.update({
        where: { id: p.id },
        data: {
          asaasPaymentId: null,
          asaasInvoiceUrl: null,
          asaasPixCode: null,
          asaasPixQrCode: null,
          asaasBoletoUrl: null,
        },
      });
      deletadas.push(`#${p.venda.numero}/p${p.numero}`);
    } catch (err) {
      falhas.push(
        `#${p.venda.numero}/p${p.numero} (zerar local): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    candidatas: candidatas.length,
    deletadas: deletadas.length,
    falhas: falhas.length,
    detalhesDeletadas: deletadas.slice(0, 100),
    detalhesFalhas: falhas.slice(0, 100),
    timestamp: new Date().toISOString(),
  });
}
