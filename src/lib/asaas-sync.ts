/**
 * SINCRONIZAÇÃO ATIVA DE PAGAMENTOS ASAAS
 *
 * Propósito: redundância contra falha de webhook. Em vez de esperar o Asaas
 * notificar (que pode falhar por DNS, certificado, token errado, fila travada,
 * etc), nós CONSULTAMOS o Asaas e detectamos pagamentos que estão PAGOS lá
 * mas ainda PENDENTES/ATRASADOS aqui.
 *
 * Estratégia:
 *   1. Para cada loteadora com chave Asaas:
 *      a. Lista todas as parcelas com asaasPaymentId não-nulo e status
 *         PENDENTE/ATRASADO.
 *      b. Para cada uma, GET /v3/payments/{id} no Asaas.
 *      c. Se status remoto for RECEIVED/CONFIRMED/OVERDUE/REFUNDED, monta um
 *         payload-fake equivalente ao webhook e roda processarEventoAsaas().
 *         Isso garante 100% de paridade com o caminho do webhook.
 *
 *   2. Modo "full": também faz GET /v3/payments?status=RECEIVED&dateCreated[ge]=…
 *      para pegar pagamentos que cheguem com externalReference de parcela
 *      sem asaasPaymentId no banco (cenário extremo).
 *
 * Como invocar:
 *   - Cron a cada 5-10 min: GET /api/cron/sync-asaas-pagamentos?token=…
 *   - Botão manual no admin financeiro (server action sincronizarPagamentosManual)
 */

import { prisma } from './prisma';
import {
  getPayment,
  request,
  type AsaasContext,
  type AsaasPayment,
  type AsaasPaymentStatus,
  type AsaasWebhookEvent,
  type AsaasWebhookPayload,
  AsaasError,
} from './asaas';
import { getLoteadoraAsaasContext } from './asaas-context';
import { processarEventoAsaas } from './asaas-webhook';

export interface SyncResult {
  loteadoraId: string;
  loteadoraNome: string;
  parcelasVerificadas: number;
  atualizacoes: number;
  erros: Array<{ parcelaId: string; paymentId: string; msg: string }>;
  detalhes: Array<{
    parcelaId: string;
    paymentId: string;
    statusLocal: string;
    statusAsaas: AsaasPaymentStatus;
    acao: 'PAGO' | 'OVERDUE' | 'REFUNDED' | 'IGNORADO';
  }>;
  /** Pagamentos extras descobertos via /payments?status=RECEIVED (modo full). */
  descobertasFull?: number;
}

export interface SyncGlobalResult {
  ok: boolean;
  iniciadoEm: string;
  finalizadoEm: string;
  duracaoMs: number;
  loteadoras: SyncResult[];
  totalAtualizacoes: number;
  totalErros: number;
}

/** Eventos que geram mutação de estado quando o status remoto muda. */
function statusParaEvento(status: AsaasPaymentStatus): AsaasWebhookEvent | null {
  switch (status) {
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'PAYMENT_RECEIVED';
    case 'CONFIRMED':
      return 'PAYMENT_CONFIRMED';
    case 'OVERDUE':
      return 'PAYMENT_OVERDUE';
    case 'REFUNDED':
      return 'PAYMENT_REFUNDED';
    default:
      // PENDING, REFUND_REQUESTED, CHARGEBACK_* → não fazem mutação aqui
      return null;
  }
}

function eventoParaAcao(
  evento: AsaasWebhookEvent
): 'PAGO' | 'OVERDUE' | 'REFUNDED' | 'IGNORADO' {
  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') return 'PAGO';
  if (evento === 'PAYMENT_OVERDUE') return 'OVERDUE';
  if (evento === 'PAYMENT_REFUNDED') return 'REFUNDED';
  return 'IGNORADO';
}

/**
 * Verifica se vale a pena disparar o processarEventoAsaas comparando o status
 * local da parcela com o que o Asaas reportou. Evita logspam por re-aplicar
 * o mesmo estado.
 */
function precisaAtualizar(
  statusLocal: string,
  evento: AsaasWebhookEvent
): boolean {
  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    return statusLocal !== 'PAGO';
  }
  if (evento === 'PAYMENT_OVERDUE') {
    return statusLocal === 'PENDENTE'; // só vira ATRASADO se ainda estava pendente
  }
  if (evento === 'PAYMENT_REFUNDED') {
    return statusLocal !== 'ESTORNADO';
  }
  return false;
}

/**
 * Roda a sincronização para UMA loteadora.
 *
 * @param modo "quick" = só checa parcelas já com asaasPaymentId.
 *             "full"  = também varre /payments?status=RECEIVED dos últimos 30d
 *                       procurando pagamentos órfãos no banco.
 */
export async function sincronizarLoteadora(
  loteadoraId: string,
  loteadoraNome: string,
  modo: 'quick' | 'full' = 'quick'
): Promise<SyncResult> {
  const result: SyncResult = {
    loteadoraId,
    loteadoraNome,
    parcelasVerificadas: 0,
    atualizacoes: 0,
    erros: [],
    detalhes: [],
  };

  const ctx = await getLoteadoraAsaasContext(loteadoraId);
  if (!ctx) {
    result.erros.push({
      parcelaId: '-',
      paymentId: '-',
      msg: 'Loteadora sem chave Asaas configurada',
    });
    return result;
  }

  // ---- MODO QUICK: parcelas com payment id em aberto ----
  const parcelas = await prisma.parcela.findMany({
    where: {
      venda: { lote: { loteamento: { loteadoraId } } },
      asaasPaymentId: { not: null },
      status: { in: ['PENDENTE', 'ATRASADO'] },
    },
    select: {
      id: true,
      status: true,
      valor: true,
      asaasPaymentId: true,
    },
    take: 500,
  });

  for (const p of parcelas) {
    if (!p.asaasPaymentId) continue;
    result.parcelasVerificadas += 1;

    let remoto: AsaasPayment;
    try {
      remoto = await getPayment(ctx, p.asaasPaymentId);
    } catch (err) {
      // 404 = cobrança não existe mais no Asaas. Não é necessariamente erro
      // (pode ter sido deletada manualmente). Loga e segue.
      if (err instanceof AsaasError && err.status === 404) {
        result.detalhes.push({
          parcelaId: p.id,
          paymentId: p.asaasPaymentId,
          statusLocal: p.status,
          statusAsaas: 'PENDING',
          acao: 'IGNORADO',
        });
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      result.erros.push({ parcelaId: p.id, paymentId: p.asaasPaymentId, msg });
      continue;
    }

    const evento = statusParaEvento(remoto.status);
    if (!evento || !precisaAtualizar(p.status, evento)) {
      result.detalhes.push({
        parcelaId: p.id,
        paymentId: p.asaasPaymentId,
        statusLocal: p.status,
        statusAsaas: remoto.status,
        acao: 'IGNORADO',
      });
      continue;
    }

    // Monta payload-fake como se viesse do webhook
    const fakePayload: AsaasWebhookPayload = {
      event: evento,
      payment: remoto,
    } as AsaasWebhookPayload;

    try {
      await processarEventoAsaas(fakePayload);
      result.atualizacoes += 1;
      result.detalhes.push({
        parcelaId: p.id,
        paymentId: p.asaasPaymentId,
        statusLocal: p.status,
        statusAsaas: remoto.status,
        acao: eventoParaAcao(evento),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.erros.push({ parcelaId: p.id, paymentId: p.asaasPaymentId, msg });
    }
  }

  // ---- MODO FULL: também procura pagamentos RECEIVED dos últimos 30 dias ----
  if (modo === 'full') {
    try {
      const trintaDiasAtras = new Date(Date.now() - 30 * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
      const lista = await request<{ data: AsaasPayment[] }>(
        `/payments?status=RECEIVED&dateCreated[ge]=${trintaDiasAtras}&limit=100`,
        ctx
      );
      let extras = 0;
      for (const pgto of lista.data ?? []) {
        // Já está sincronizado? Pula.
        const jaTem = await prisma.parcela.findFirst({
          where: { asaasPaymentId: pgto.id },
          select: { id: true, status: true },
        });
        if (jaTem && jaTem.status === 'PAGO') continue;
        if (jaTem) {
          // Tem parcela mas status não está PAGO ainda → processa
          await processarEventoAsaas({
            event: 'PAYMENT_RECEIVED',
            payment: pgto,
          } as AsaasWebhookPayload);
          extras += 1;
          continue;
        }
        // Não tem parcela com esse paymentId. Tenta achar por externalReference.
        if (pgto.externalReference) {
          const porExt = await prisma.parcela.findUnique({
            where: { id: pgto.externalReference },
            select: { id: true, status: true, asaasPaymentId: true },
          });
          if (porExt && porExt.status !== 'PAGO') {
            // Vincula o paymentId e processa
            await prisma.parcela.update({
              where: { id: porExt.id },
              data: { asaasPaymentId: pgto.id },
            });
            await processarEventoAsaas({
              event: 'PAYMENT_RECEIVED',
              payment: pgto,
            } as AsaasWebhookPayload);
            extras += 1;
          }
        }
      }
      result.descobertasFull = extras;
      result.atualizacoes += extras;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.erros.push({ parcelaId: '-', paymentId: 'list-payments', msg });
    }
  }

  return result;
}

/**
 * Sincroniza TODAS as loteadoras com chave Asaas configurada.
 */
export async function sincronizarTodasLoteadoras(
  modo: 'quick' | 'full' = 'quick'
): Promise<SyncGlobalResult> {
  const iniciou = Date.now();
  const loteadoras = await prisma.loteadora.findMany({
    where: { asaasApiKey: { not: null } },
    select: { id: true, nome: true },
  });

  const results: SyncResult[] = [];
  for (const lo of loteadoras) {
    const r = await sincronizarLoteadora(lo.id, lo.nome, modo);
    results.push(r);
  }

  const finalizou = Date.now();
  return {
    ok: true,
    iniciadoEm: new Date(iniciou).toISOString(),
    finalizadoEm: new Date(finalizou).toISOString(),
    duracaoMs: finalizou - iniciou,
    loteadoras: results,
    totalAtualizacoes: results.reduce((s, r) => s + r.atualizacoes, 0),
    totalErros: results.reduce((s, r) => s + r.erros.length, 0),
  };
}
