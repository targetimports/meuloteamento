'use server';

/**
 * Reserva manual (admin) — marca um lote como RESERVADO sem precisar de cliente.
 * Útil pra "segurar" um lote enquanto a negociação acontece offline.
 *
 * Idempotente: se o lote já está reservado, falha graciosamente.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, requireAdmin } from '@/lib/tenant';
import { mudarStatusLote, temPagamentoNoLote } from '@/lib/lote-status';

export async function reservarLoteAdmin(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const loteId = String(formData.get('loteId') || '').trim();
  const motivo = String(formData.get('motivo') || '').trim();
  const diasStr = String(formData.get('dias') || '7').trim();

  // Sentinela: dias = 0 OU "ilimitado" → reserva sem prazo definido
  const ilimitado = diasStr === '0' || diasStr.toLowerCase() === 'ilimitado';
  const dias = ilimitado ? 0 : Math.max(1, Math.min(365, parseInt(diasStr, 10) || 7));

  if (!loteId) throw new Error('Selecione um lote');

  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    include: {
      loteamento: { select: { slug: true, loteadoraId: true } },
    },
  });
  if (!lote) throw new Error('Lote não encontrado');
  if (!(await canAccessLoteamento(lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para este lote');
  }
  if (lote.status !== 'DISPONIVEL') {
    throw new Error(`Lote já está com status ${lote.status} — não pode ser reservado.`);
  }

  const motivoFinal = ilimitado
    ? `Reserva interna SEM PRAZO por ${session.email}` +
      (motivo ? ` — ${motivo}` : '')
    : `Reserva interna por ${session.email} até ${
        new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
      }` + (motivo ? ` — ${motivo}` : '');

  await mudarStatusLote({
    loteId: lote.id,
    novoStatus: 'RESERVADO',
    motivo: motivoFinal,
    userId: session.sub,
    userType: 'ADMIN',
  });

  revalidatePath('/admin/vendas');
  revalidatePath(`/admin/loteamentos/${lote.loteamento.slug}/lotes`);
  revalidatePath(`/${lote.loteamento.slug}`);
}

/**
 * Edita uma reserva existente — atualiza o prazo e/ou a observação.
 *
 * Como a reserva é guardada apenas como texto no histórico do lote (LoteHistorico),
 * a edição cria uma NOVA entrada no histórico marcada como [EDITADA] com o novo
 * motivo. O lote continua RESERVADO; o restante do sistema enxerga apenas a
 * última entrada de histórico para reconstruir o motivo/prazo atual.
 */
export async function editarReservaAdmin(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const loteId = String(formData.get('loteId') || '').trim();
  const motivo = String(formData.get('motivo') || '').trim();
  const diasStr = String(formData.get('dias') || '7').trim();

  const ilimitado = diasStr === '0' || diasStr.toLowerCase() === 'ilimitado';
  const dias = ilimitado ? 0 : Math.max(1, Math.min(365, parseInt(diasStr, 10) || 7));

  if (!loteId) throw new Error('Lote inválido');

  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    include: { loteamento: { select: { slug: true, loteadoraId: true } } },
  });
  if (!lote) throw new Error('Lote não encontrado');
  if (!(await canAccessLoteamento(lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para este lote');
  }
  if (lote.status !== 'RESERVADO') {
    throw new Error(`Apenas lotes RESERVADOS podem ter sua reserva editada (atual: ${lote.status}).`);
  }

  const motivoFinal = ilimitado
    ? `[EDITADA] Reserva interna SEM PRAZO por ${session.email}` +
      (motivo ? ` — ${motivo}` : '')
    : `[EDITADA] Reserva interna por ${session.email} até ${
        new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
      }` + (motivo ? ` — ${motivo}` : '');

  // Registra no histórico mantendo o status (statusAntes = statusDepois = RESERVADO)
  await prisma.loteHistorico.create({
    data: {
      loteId: lote.id,
      statusAntes: 'RESERVADO',
      statusDepois: 'RESERVADO',
      motivo: motivoFinal,
      userId: session.sub,
      userType: 'ADMIN',
    },
  });
  // Atualiza o updatedAt do lote pra refletir na listagem
  await prisma.lote.update({
    where: { id: lote.id },
    data: { updatedAt: new Date() },
  });

  revalidatePath('/admin/vendas');
  revalidatePath(`/admin/loteamentos/${lote.loteamento.slug}/lotes`);
  revalidatePath(`/${lote.loteamento.slug}`);
}

/**
 * Libera um lote reservado (volta pra DISPONIVEL).
 */
export async function liberarReservaAdmin(loteId: string, motivo?: string): Promise<void> {
  const session = await requireAdmin();

  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    include: {
      loteamento: { select: { slug: true, loteadoraId: true } },
    },
  });
  if (!lote) throw new Error('Lote não encontrado');
  if (!(await canAccessLoteamento(lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para este lote');
  }
  if (lote.status !== 'RESERVADO') {
    throw new Error('Apenas lotes RESERVADOS podem ser liberados.');
  }

  // PROTEÇÃO: se há pagamento parcial no lote, BLOQUEIA a liberação.
  // O admin precisa distratar a venda formalmente primeiro (que devolve
  // valores ao cliente). Soltar o lote sem distratar seria perder rastro
  // do dinheiro recebido.
  const pagamento = await temPagamentoNoLote(lote.id);
  if (pagamento.tem) {
    const vendaInfo = pagamento.vendasComPagamento
      .map((v) => `#${v.numero} (${v.status})`)
      .join(', ');
    throw new Error(
      `Este lote NÃO pode ser liberado: o cliente já pagou R$ ${pagamento.somaValorPago.toFixed(2)} ` +
        `(${pagamento.totalParcelasPagas} parcela(s) paga(s)` +
        (pagamento.cobrancasAvulsasPagas > 0
          ? ` + ${pagamento.cobrancasAvulsasPagas} cobrança(s) avulsa(s)`
          : '') +
        `)${vendaInfo ? ` na(s) venda(s) ${vendaInfo}` : ''}. ` +
        `Distrate a venda primeiro (com devolução do valor pago) antes de liberar o lote.`
    );
  }

  await mudarStatusLote({
    loteId: lote.id,
    novoStatus: 'DISPONIVEL',
    motivo: `Liberado por ${session.email}${motivo ? ` — ${motivo}` : ''}`,
    userId: session.sub,
    userType: 'ADMIN',
  });

  // Cancela qualquer reserva ativa no model Reserva também
  await prisma.reserva.updateMany({
    where: { loteId: lote.id, status: 'ATIVA' },
    data: { status: 'CANCELADA' },
  });

  revalidatePath('/admin/vendas');
  revalidatePath(`/${lote.loteamento.slug}`);
}
