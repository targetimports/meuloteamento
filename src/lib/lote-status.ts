import { Prisma } from '@prisma/client';
import type { LoteStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface MudarStatusInput {
  loteId: string;
  novoStatus: LoteStatus;
  motivo?: string | null;
  userId?: string | null;
  userType?: 'ADMIN' | 'CLIENTE' | 'SYSTEM';
  // Permite executar dentro de uma transação já aberta
  tx?: Prisma.TransactionClient;
}

/**
 * Muda o status do lote registrando histórico na mesma transação.
 * Se nenhuma transação for passada, cria uma própria.
 */
export async function mudarStatusLote(input: MudarStatusInput) {
  const { loteId, novoStatus, motivo, userId, userType = 'SYSTEM', tx } = input;

  const run = async (db: Prisma.TransactionClient) => {
    const lote = await db.lote.findUnique({ where: { id: loteId } });
    if (!lote) throw new Error(`Lote ${loteId} não encontrado`);
    if (lote.status === novoStatus) return lote;

    const atualizado = await db.lote.update({
      where: { id: loteId },
      data: {
        status: novoStatus,
        motivoBloqueio: novoStatus === 'BLOQUEADO' ? motivo ?? lote.motivoBloqueio : null,
      },
    });

    await db.loteHistorico.create({
      data: {
        loteId,
        statusAntes: lote.status,
        statusDepois: novoStatus,
        motivo: motivo ?? null,
        userId: userId ?? null,
        userType,
      },
    });

    return atualizado;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/**
 * Lock pessimista no lote (SELECT ... FOR UPDATE).
 * Usar dentro de uma transação ao iniciar uma reserva/compra.
 */
export async function lockLote(tx: Prisma.TransactionClient, loteId: string) {
  const rows = await tx.$queryRaw<{ id: string; status: LoteStatus }[]>`
    SELECT id, status FROM lotes WHERE id = ${loteId} FOR UPDATE
  `;
  return rows[0] ?? null;
}

/**
 * Retorna informações de pagamento associado a um lote.
 *
 * Um lote é considerado "tem pagamento" quando:
 *   - Existe pelo menos UMA parcela com status PAGO em alguma venda
 *     do lote cujo status NÃO é CANCELADA nem DISTRATADA;
 *   - OU existe uma CobrancaAvulsa vinculada ao lote com status PAGO.
 *
 * Lotes nesta condição NÃO devem voltar para DISPONIVEL automaticamente —
 * mesmo que o pagamento seja menor que a entrada esperada, o dinheiro do
 * cliente já está com a loteadora. A regra de negócio é: a reserva passa
 * a ser INDEFINIDA e o admin precisa distratar a venda (com devolução)
 * antes que o lote possa ser comercializado novamente.
 *
 * Usado por:
 *   - cron de expiração de reservas (não auto-cancela)
 *   - liberação manual de reserva (bloqueia)
 *   - visualização (mostra badge "RESERVADO — pagamento recebido")
 */
export async function temPagamentoNoLote(loteId: string): Promise<{
  tem: boolean;
  totalParcelasPagas: number;
  somaValorPago: number;
  vendasComPagamento: Array<{ id: string; numero: number; status: string }>;
  cobrancasAvulsasPagas: number;
}> {
  // 1) Parcelas PAGO em vendas vivas
  const parcelasPagas = await prisma.parcela.findMany({
    where: {
      status: 'PAGO',
      venda: {
        loteId,
        status: { notIn: ['CANCELADA', 'DISTRATADA'] },
      },
    },
    select: {
      valor: true,
      valorPago: true,
      venda: { select: { id: true, numero: true, status: true } },
    },
  });

  // 2) Cobranças avulsas pagas
  const cobrancasAvulsasPagas = await prisma.cobrancaAvulsa.count({
    where: { loteId, status: 'PAGO' },
  });

  const somaValorPago = parcelasPagas.reduce(
    (s, p) => s + Number(p.valorPago ?? p.valor),
    0
  );

  // Dedup vendas (cada venda pode aparecer várias vezes via parcelas)
  const vendasMap = new Map<string, { id: string; numero: number; status: string }>();
  for (const p of parcelasPagas) {
    vendasMap.set(p.venda.id, p.venda);
  }

  return {
    tem: parcelasPagas.length > 0 || cobrancasAvulsasPagas > 0,
    totalParcelasPagas: parcelasPagas.length,
    somaValorPago,
    vendasComPagamento: Array.from(vendasMap.values()),
    cobrancasAvulsasPagas,
  };
}
