import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mudarStatusLote, temPagamentoNoLote } from '@/lib/lote-status';
import { CRON_TOKEN } from '@/lib/env';
import { getLoteadoraAsaasContext } from '@/lib/asaas-context';
import { deletePayment, AsaasError } from '@/lib/asaas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPIRACAO_MIN = 60;

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-cron-token');
  const queryToken = req.nextUrl.searchParams.get('token');
  if (headerToken !== CRON_TOKEN && queryToken !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const limite = new Date(Date.now() - EXPIRACAO_MIN * 60 * 1000);

  // SÓ atua em vendas de CHECKOUT_ONLINE — esse cron foi feito pra matar
  // checkout abandonado (cliente abre PIX no site e some). Vendas ADMIN ficam
  // protegidas: corretora lança contrato, entrada pode ser boleto/cheque
  // /espécie com vencimento dias depois, então não dá pra cancelar em 60min.
  // Adiciona também filtro extra: parcela 1 precisa ser tipo ENTRADA
  // (não MENSAL — venda sem entrada não tem parcela ENTRADA, fica imune).
  const candidatos = await prisma.venda.findMany({
    where: {
      status: 'ATIVA',
      origem: 'CHECKOUT_ONLINE',
      createdAt: { lt: limite },
      parcelas: {
        some: { numero: 1, status: 'PENDENTE', tipo: 'ENTRADA' },
      },
    },
    select: {
      id: true,
      numero: true,
      loteId: true,
      createdAt: true,
      lote: {
        select: { id: true, codigo: true, loteamento: { select: { slug: true, loteadoraId: true } } },
      },
      parcelas: {
        select: { id: true, numero: true, status: true, tipo: true },
        orderBy: { numero: 'asc' },
        take: 1,
      },
    },
  });

  const expiradas: string[] = [];
  const protegidasPorPagamento: string[] = [];

  for (const v of candidatos) {
    const entrada = v.parcelas[0];
    if (!entrada || entrada.status !== 'PENDENTE' || entrada.tipo !== 'ENTRADA') continue;

    // PROTEÇÃO: se já houve qualquer pagamento parcial no lote (PARCELA paga em
    // qualquer venda viva OU cobrança avulsa paga), NÃO auto-cancela e NÃO
    // libera o lote — manter o lote "reservado indefinidamente" pra evitar
    // que outra pessoa compre por cima do dinheiro já recebido.
    const pagamento = await temPagamentoNoLote(v.loteId);
    if (pagamento.tem) {
      // Marca a venda apenas com observação informativa (sem cancelar).
      // Garante que o lote NÃO está DISPONIVEL — se por algum motivo voltou,
      // força pra RESERVADO com motivo claro.
      try {
        await prisma.$transaction(async (tx) => {
          await tx.venda.update({
            where: { id: v.id },
            data: {
              observacoes:
                `[${new Date().toLocaleString('pt-BR')}] Cron tentou auto-cancelar mas há ` +
                `${pagamento.totalParcelasPagas} parcela(s) paga(s) (R$ ${pagamento.somaValorPago.toFixed(2)}) ` +
                `e/ou ${pagamento.cobrancasAvulsasPagas} cobrança(s) avulsa(s) paga(s). ` +
                `Lote permanece RESERVADO — admin precisa distratar p/ liberar.`,
            },
          });
          await tx.vendaHistorico.create({
            data: {
              vendaId: v.id,
              action: 'CRON_PROTEGIDA_POR_PAGAMENTO',
              motivo: `Auto-cancel bloqueado: cliente já pagou R$ ${pagamento.somaValorPago.toFixed(2)}`,
              userType: 'SYSTEM',
            },
          });
          // Garante reserva indefinida: se status atual permite alguém comprar
          // (DISPONIVEL), força RESERVADO. Se já está EM_PAGAMENTO/VENDIDO, OK.
          const loteAtual = await tx.lote.findUnique({
            where: { id: v.loteId },
            select: { status: true },
          });
          if (loteAtual?.status === 'DISPONIVEL') {
            await mudarStatusLote({
              loteId: v.loteId,
              novoStatus: 'RESERVADO',
              motivo:
                `Reserva indefinida — cliente pagou R$ ${pagamento.somaValorPago.toFixed(2)} ` +
                `na venda #${v.numero}, lote NÃO pode ser comercializado até distrato.`,
              userType: 'SYSTEM',
              tx,
            });
          } else {
            // Apenas registra anotação histórica reforçando a proteção
            await tx.loteHistorico.create({
              data: {
                loteId: v.loteId,
                statusAntes: loteAtual?.status ?? 'RESERVADO',
                statusDepois: loteAtual?.status ?? 'RESERVADO',
                motivo:
                  `[PROTEÇÃO] Reserva indefinida — venda #${v.numero} tem ` +
                  `R$ ${pagamento.somaValorPago.toFixed(2)} pago(s) pelo cliente.`,
                userType: 'SYSTEM',
              },
            });
          }
        });
        protegidasPorPagamento.push(`#${v.numero} (lote ${v.lote.codigo})`);
      } catch (e) {
        console.error('[cron] erro ao proteger venda com pagamento', v.id, e);
      }
      continue;
    }

    try {
      // 1) ANTES de cancelar: deleta as cobranças no Asaas pra parar
      //    os lembretes automáticos que o Asaas envia (email/sms/whatsapp).
      //    Falha silenciosa por payment — se a Asaas retornar 404/400 o
      //    cobrança já não existe lá, segue em frente.
      const parcelasComAsaas = await prisma.parcela.findMany({
        where: {
          vendaId: v.id,
          asaasPaymentId: { not: null },
          status: { in: ['PENDENTE', 'ATRASADO'] },
        },
        select: { id: true, asaasPaymentId: true },
      });
      if (parcelasComAsaas.length > 0) {
        const ctx = await getLoteadoraAsaasContext(v.lote.loteamento.loteadoraId);
        if (ctx) {
          for (const p of parcelasComAsaas) {
            if (!p.asaasPaymentId) continue;
            try {
              await deletePayment(ctx, p.asaasPaymentId);
            } catch (err) {
              if (
                !(err instanceof AsaasError) ||
                (err.status !== 404 && err.status !== 400)
              ) {
                console.warn('[cron] falha ao apagar Asaas', p.asaasPaymentId, err);
              }
            }
          }
        }
      }

      // 2) Agora a transação local
      await prisma.$transaction(async (tx) => {
        await tx.venda.update({
          where: { id: v.id },
          data: {
            status: 'CANCELADA',
            observacoes: `[expirou em ${new Date().toLocaleString('pt-BR')}] Auto-cancelada — PIX da entrada não foi pago em ${EXPIRACAO_MIN} minutos.`,
          },
        });
        await tx.parcela.updateMany({
          where: { vendaId: v.id, status: { in: ['PENDENTE', 'ATRASADO'] } },
          data: {
            status: 'CANCELADO',
            // Zera referências Asaas pra evitar futuras tentativas
            asaasPaymentId: null,
            asaasInvoiceUrl: null,
            asaasPixCode: null,
            asaasPixQrCode: null,
            asaasBoletoUrl: null,
          },
        });
        await tx.vendaHistorico.create({
          data: {
            vendaId: v.id,
            action: 'AUTO_CANCELADA',
            motivo: `PIX entrada não pago em 60min — ${parcelasComAsaas.length} cobrança(s) Asaas deletada(s)`,
            userType: 'SYSTEM',
          },
        });
        await mudarStatusLote({
          loteId: v.loteId,
          novoStatus: 'DISPONIVEL',
          motivo: `Auto-liberado — PIX expirou (venda #${v.numero})`,
          userType: 'SYSTEM',
          tx,
        });
      });
      expiradas.push(`#${v.numero} (lote ${v.lote.codigo})`);
    } catch (e) {
      console.error('[cron] erro ao expirar venda', v.id, e);
    }
  }

  return NextResponse.json({
    ok: true,
    verificadas: candidatos.length,
    expiradas: expiradas.length,
    detalhes: expiradas,
    protegidasPorPagamento: protegidasPorPagamento.length,
    detalhesProtegidas: protegidasPorPagamento,
    timestamp: new Date().toISOString(),
  });
}
