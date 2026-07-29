import { prisma } from '@/lib/prisma';
import { mudarStatusLote } from '@/lib/lote-status';
import {
  liberarComissoesDaParcela,
  rebloquearComissoesDaParcela,
  cancelarComissoesDaVenda,
} from '@/lib/comissao';
import type { AsaasPayment, AsaasWebhookEvent, AsaasWebhookPayload } from '@/lib/asaas';

/**
 * Processa um evento de webhook Asaas.
 *
 * Estratégia:
 *   1. Localiza a parcela pelo asaasPaymentId.
 *   2. Aplica a mudança de estado da parcela e/ou venda.
 *   3. Quando a venda atinge "venda confirmada" → lote vira VENDIDO.
 *
 * Eventos relevantes:
 *   - PAYMENT_CONFIRMED  → parcela aprovada (ainda não recebida em conta)
 *   - PAYMENT_RECEIVED   → dinheiro caiu na conta (baixa definitiva)
 *   - PAYMENT_OVERDUE    → parcela atrasou → venda fica INADIMPLENTE
 *   - PAYMENT_REFUNDED   → estorno
 *   - PAYMENT_DELETED    → cobrança excluída
 *   - PAYMENT_RESTORED   → cobrança restaurada após exclusão
 */
export async function processarEventoAsaas(payload: AsaasWebhookPayload) {
  const { event, payment } = payload;
  if (!payment?.id) return;

  const parcela = await prisma.parcela.findUnique({
    where: { asaasPaymentId: payment.id },
    include: {
      venda: {
        include: {
          parcelas: true,
          // Precisamos do loteadoraId pra achar a conta ASAAS dessa loteadora
          lote: { select: { loteamento: { select: { loteadoraId: true } } } },
        },
      },
    },
  });

  if (!parcela) {
    // Pode ser uma cobrança AVULSA (sem vínculo com Venda/Parcela).
    // Identificamos pelo externalReference (formato "avulsa:<id>") ou pelo paymentId direto.
    const ext = payment.externalReference;
    const avulsaId =
      ext && ext.startsWith('avulsa:') ? ext.slice('avulsa:'.length) : null;

    const cobranca =
      (avulsaId
        ? await prisma.cobrancaAvulsa.findUnique({ where: { id: avulsaId } })
        : null) ??
      (await prisma.cobrancaAvulsa.findUnique({
        where: { asaasPaymentId: payment.id },
      }));

    if (cobranca) {
      await processarEventoAsaasAvulsa(event, payment, cobranca.id);
      return;
    }

    console.warn(`[asaas-webhook] payment ${payment.id} não encontrado (parcela nem avulsa)`);
    return;
  }

  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      // 🚨 Guarda crítica: se a parcela ou a venda já foram canceladas
      // localmente (distrato/cancelamento), NÃO aceitar o pagamento.
      // Isso evita estado inconsistente quando um PIX órfão é pago no Asaas
      // depois do cancelamento. O dinheiro fica registrado no Asaas e o
      // admin precisa decidir: reabrir a venda OU estornar o cliente.
      const parcelaCancelada =
        parcela.status === 'CANCELADO' || parcela.status === 'ESTORNADO';
      const vendaFinalizada =
        parcela.venda.status === 'CANCELADA' ||
        parcela.venda.status === 'DISTRATADA';

      if (parcelaCancelada || vendaFinalizada) {
        console.warn(
          `[asaas-webhook] payment ${payment.id} recebido para parcela ${parcela.id} ` +
            `mas parcela.status=${parcela.status} / venda.status=${parcela.venda.status} — ` +
            `IGNORANDO (precisa intervenção manual: reabrir venda ou estornar pagamento)`
        );
        // Anota no histórico da parcela (para auditoria)
        try {
          await prisma.parcelaHistorico.create({
            data: {
              parcelaId: parcela.id,
              action: 'PAGAMENTO_IGNORADO',
              motivo:
                `Pagamento Asaas ${payment.id} (R$ ${payment.value ?? '?'}) ` +
                `recebido mas IGNORADO: parcela.status=${parcela.status}, ` +
                `venda.status=${parcela.venda.status}. ` +
                `Decida manualmente: reabrir venda ou estornar o cliente.`,
              userType: 'SYSTEM',
              diff: {
                paymentId: payment.id,
                paymentValue: payment.value,
                event,
              } as object,
            },
          });
        } catch (histErr) {
          console.warn('[asaas-webhook] falha ao registrar histórico:', histErr);
        }
        break;
      }

      const novoStatus = event === 'PAYMENT_RECEIVED' ? 'PAGO' : parcela.status;
      const valorPago = payment.value ?? Number(parcela.valor);

      // ===== Resolve conta financeira destino =====
      // Se a parcela já tem contaId setado (admin escolheu na criação), respeita.
      // Senão, busca a conta ativa do tipo ASAAS da loteadora dessa venda.
      // Garante que o saldo Asaas reflita corretamente o que entrou via webhook.
      let contaIdDestino: string | null = parcela.contaId;
      if (!contaIdDestino) {
        const loteadoraId = parcela.venda.lote.loteamento.loteadoraId;
        const contaAsaas = await prisma.contaFinanceira.findFirst({
          where: { loteadoraId, tipo: 'ASAAS', ativa: true },
          orderBy: { ordem: 'asc' },
          select: { id: true },
        });
        contaIdDestino = contaAsaas?.id ?? null;
      }

      await prisma.parcela.update({
        where: { id: parcela.id },
        data: {
          status: 'PAGO',
          valorPago,
          pagoEm: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
          ...(contaIdDestino ? { contaId: contaIdDestino } : {}),
        },
      });

      // Libera comissões vinculadas a esta parcela (BLOQUEADA → LIBERADA)
      await liberarComissoesDaParcela(parcela.id);

      // Recarrega para checar se TODAS as parcelas foram pagas
      const venda = await prisma.venda.findUnique({
        where: { id: parcela.vendaId },
        include: { parcelas: true },
      });
      if (!venda) return;

      const todasPagas = venda.parcelas.every(
        (p) => p.id === parcela.id || p.status === 'PAGO'
      );
      const algumaPaga = venda.parcelas.some(
        (p) => p.id === parcela.id || p.status === 'PAGO'
      );

      if (todasPagas) {
        await prisma.venda.update({
          where: { id: venda.id },
          data: { status: 'QUITADA', dataQuitacao: new Date() },
        });
        await mudarStatusLote({
          loteId: venda.loteId,
          novoStatus: 'VENDIDO',
          motivo: `Venda ${venda.numero} quitada (pagamento Asaas ${payment.id})`,
          userType: 'SYSTEM',
        });
      } else if (algumaPaga && venda.status === 'INADIMPLENTE') {
        await prisma.venda.update({
          where: { id: venda.id },
          data: { status: 'ATIVA' },
        });
      }
      void novoStatus; // silencia warning
      break;
    }

    case 'PAYMENT_OVERDUE': {
      await prisma.parcela.update({
        where: { id: parcela.id },
        data: { status: 'ATRASADO' },
      });
      await prisma.venda.update({
        where: { id: parcela.vendaId },
        data: { status: 'INADIMPLENTE' },
      });
      break;
    }

    case 'PAYMENT_REFUNDED': {
      await prisma.parcela.update({
        where: { id: parcela.id },
        data: { status: 'ESTORNADO', pagoEm: null, valorPago: null },
      });
      // Devolve comissões liberadas-mas-não-pagas para BLOQUEADA
      await rebloquearComissoesDaParcela(parcela.id);
      break;
    }

    case 'PAYMENT_DELETED': {
      await prisma.parcela.update({
        where: { id: parcela.id },
        data: { status: 'CANCELADO' },
      });
      await rebloquearComissoesDaParcela(parcela.id);
      break;
    }

    case 'PAYMENT_RESTORED': {
      await prisma.parcela.update({
        where: { id: parcela.id },
        data: { status: 'PENDENTE' },
      });
      break;
    }

    default:
      // Eventos como PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_BANK_SLIP_VIEWED
      // são informativos — não alteramos estado interno.
      break;
  }
}

/**
 * Atualiza o status de uma CobrancaAvulsa a partir de um evento Asaas.
 */
async function processarEventoAsaasAvulsa(
  event: AsaasWebhookEvent,
  payment: AsaasPayment,
  cobrancaId: string
) {
  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      const atualizada = await prisma.cobrancaAvulsa.update({
        where: { id: cobrancaId },
        data: {
          status: 'PAGO',
          pagoEm: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
          asaasPaymentId: payment.id,
        },
        select: { loteId: true, valor: true, id: true },
      });
      // PROTEÇÃO: se a cobrança avulsa estava vinculada a um lote e o lote
      // ainda está DISPONIVEL, reserva ele imediatamente (qualquer valor
      // pago já trava o lote — admin precisa devolver/distratar pra liberar).
      if (atualizada.loteId) {
        try {
          const lote = await prisma.lote.findUnique({
            where: { id: atualizada.loteId },
            select: { status: true },
          });
          if (lote?.status === 'DISPONIVEL') {
            await prisma.lote.update({
              where: { id: atualizada.loteId },
              data: { status: 'RESERVADO' },
            });
            await prisma.loteHistorico.create({
              data: {
                loteId: atualizada.loteId,
                statusAntes: 'DISPONIVEL',
                statusDepois: 'RESERVADO',
                motivo:
                  `[AUTO] Reservado por pagamento R$ ${Number(atualizada.valor).toFixed(2)} ` +
                  `via cobrança avulsa ${atualizada.id.slice(-6)} (Asaas)`,
                userType: 'SYSTEM',
              },
            });
          } else if (lote) {
            // Apenas registra anotação reforçando que o pagamento ocorreu
            await prisma.loteHistorico.create({
              data: {
                loteId: atualizada.loteId,
                statusAntes: lote.status,
                statusDepois: lote.status,
                motivo:
                  `[PAGAMENTO] R$ ${Number(atualizada.valor).toFixed(2)} ` +
                  `recebido via cobrança avulsa ${atualizada.id.slice(-6)}`,
                userType: 'SYSTEM',
              },
            });
          }
        } catch (err) {
          console.error('[webhook] erro ao reservar lote por cobranca avulsa paga', err);
        }
      }
      break;
    }
    case 'PAYMENT_REFUNDED': {
      await prisma.cobrancaAvulsa.update({
        where: { id: cobrancaId },
        data: { status: 'ESTORNADO', pagoEm: null },
      });
      break;
    }
    case 'PAYMENT_DELETED': {
      await prisma.cobrancaAvulsa.update({
        where: { id: cobrancaId },
        data: { status: 'CANCELADO' },
      });
      break;
    }
    case 'PAYMENT_RESTORED': {
      await prisma.cobrancaAvulsa.update({
        where: { id: cobrancaId },
        data: { status: 'PENDENTE' },
      });
      break;
    }
    default:
      break;
  }
}
