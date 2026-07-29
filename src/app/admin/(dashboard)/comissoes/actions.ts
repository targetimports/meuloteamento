'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, requireAdmin } from '@/lib/tenant';

/**
 * Marca uma parcela de comissão como PAGA (admin repassou ao corretor).
 *
 * Pré-condição: status atual deve ser LIBERADA (cliente já pagou).
 * Se ainda está BLOQUEADA, retorna erro — admin precisa esperar o cliente
 * pagar a parcela vinculada OU forçar via outro fluxo.
 */
export async function pagarComissao(
  comissaoId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin();

  const contaId = String(formData.get('contaId') || '').trim();
  const valorPagoStr = String(formData.get('valorPago') || '').replace(',', '.');
  const observacoes = String(formData.get('observacoes') || '').trim();

  const valorPago = parseFloat(valorPagoStr);

  const c = await prisma.comissaoParcela.findUnique({
    where: { id: comissaoId },
    include: {
      venda: {
        include: { lote: { include: { loteamento: { select: { loteadoraId: true } } } } },
      },
    },
  });
  if (!c) throw new Error('Comissão não encontrada');
  if (!(await canAccessLoteamento(c.venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para esta comissão');
  }
  if (c.status !== 'LIBERADA' && c.status !== 'BLOQUEADA') {
    throw new Error(
      `Comissão está ${c.status} — não dá para repassar nesse estado`
    );
  }
  if (!contaId) {
    throw new Error('Selecione a conta de onde sai o dinheiro');
  }
  if (!isFinite(valorPago) || valorPago <= 0) {
    throw new Error('Valor inválido');
  }

  await prisma.comissaoParcela.update({
    where: { id: comissaoId },
    data: {
      status: 'PAGA',
      pagaEm: new Date(),
      valorPago,
      contaId,
      observacoes: observacoes
        ? `${c.observacoes ? c.observacoes + '\n' : ''}[${new Date().toLocaleDateString('pt-BR')}] ${session.email}: ${observacoes}`
        : c.observacoes,
    },
  });

  revalidatePath('/admin/comissoes');
  revalidatePath(`/admin/vendas/${c.vendaId}`);
}

/**
 * Reverte uma comissão paga por engano (PAGA → LIBERADA).
 * Apaga valorPago/pagaEm/contaId. Histórico preservado em observacoes.
 */
export async function estornarComissao(comissaoId: string): Promise<void> {
  const session = await requireAdmin();

  const c = await prisma.comissaoParcela.findUnique({
    where: { id: comissaoId },
    include: {
      venda: {
        include: { lote: { include: { loteamento: { select: { loteadoraId: true } } } } },
      },
    },
  });
  if (!c) throw new Error('Comissão não encontrada');
  if (!(await canAccessLoteamento(c.venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para esta comissão');
  }
  if (c.status !== 'PAGA') {
    throw new Error('Só dá pra estornar comissão paga');
  }

  await prisma.comissaoParcela.update({
    where: { id: comissaoId },
    data: {
      status: 'LIBERADA',
      pagaEm: null,
      valorPago: null,
      contaId: null,
      observacoes: `${c.observacoes ? c.observacoes + '\n' : ''}[${new Date().toLocaleDateString('pt-BR')}] ${session.email}: estornada (paga por engano)`,
    },
  });

  revalidatePath('/admin/comissoes');
  revalidatePath(`/admin/vendas/${c.vendaId}`);
}

/**
 * Força uma comissão BLOQUEADA → LIBERADA mesmo sem o cliente ter pagado.
 * Útil em casos especiais (acordo paralelo, adiantamento).
 */
const liberarSchema = z.object({
  comissaoId: z.string(),
  motivo: z.string().trim().min(3, 'Informe um motivo'),
});

export async function liberarManual(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const parsed = liberarSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos');
  }
  const { comissaoId, motivo } = parsed.data;

  const c = await prisma.comissaoParcela.findUnique({
    where: { id: comissaoId },
    include: {
      venda: {
        include: { lote: { include: { loteamento: { select: { loteadoraId: true } } } } },
      },
    },
  });
  if (!c) throw new Error('Comissão não encontrada');
  if (!(await canAccessLoteamento(c.venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  if (c.status !== 'BLOQUEADA') {
    throw new Error('Só dá pra liberar manualmente comissão BLOQUEADA');
  }

  await prisma.comissaoParcela.update({
    where: { id: comissaoId },
    data: {
      status: 'LIBERADA',
      liberadaEm: new Date(),
      observacoes: `${c.observacoes ? c.observacoes + '\n' : ''}[${new Date().toLocaleDateString('pt-BR')}] ${session.email}: liberada manualmente — ${motivo}`,
    },
  });

  revalidatePath('/admin/comissoes');
}
