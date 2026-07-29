'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

type FormState = { error?: string; ok?: boolean };

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

const tabelaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe um nome'),
  descricao: z.string().trim().optional().nullable(),
  descontoPct: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0).max(100).optional()
  ),
  entradaPct: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0).max(100).optional()
  ),
  parcelasMin: z.coerce.number().int().min(1).default(1),
  parcelasMax: z.coerce.number().int().min(1).default(1),
  ativo: checkbox.default(true),
  ordem: z.coerce.number().int().default(0),
});

export async function criarTabela(
  loteamentoId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = tabelaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const data = parsed.data;
  if (data.parcelasMin > data.parcelasMax) {
    return { error: 'Parcelas mínimas não pode exceder o máximo.' };
  }

  await prisma.tabelaPreco.create({
    data: {
      loteamentoId,
      nome: data.nome,
      descricao: data.descricao || null,
      descontoPct: data.descontoPct ?? null,
      entradaPct: data.entradaPct ?? null,
      parcelasMin: data.parcelasMin,
      parcelasMax: data.parcelasMax,
      ativo: data.ativo,
      ordem: data.ordem,
    },
  });

  revalidatePath(`/admin/loteamentos/${loteamentoId}/tabelas-preco`);
  return { ok: true };
}

export async function atualizarTabela(
  tabelaId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = tabelaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const data = parsed.data;
  if (data.parcelasMin > data.parcelasMax) {
    return { error: 'Parcelas mínimas não pode exceder o máximo.' };
  }

  const tabela = await prisma.tabelaPreco.update({
    where: { id: tabelaId },
    data: {
      nome: data.nome,
      descricao: data.descricao || null,
      descontoPct: data.descontoPct ?? null,
      entradaPct: data.entradaPct ?? null,
      parcelasMin: data.parcelasMin,
      parcelasMax: data.parcelasMax,
      ativo: data.ativo,
      ordem: data.ordem,
    },
  });

  revalidatePath(`/admin/loteamentos/${tabela.loteamentoId}/tabelas-preco`);
  return { ok: true };
}

export async function excluirTabela(tabelaId: string): Promise<void> {
  const tabela = await prisma.tabelaPreco.delete({ where: { id: tabelaId } });
  revalidatePath(`/admin/loteamentos/${tabela.loteamentoId}/tabelas-preco`);
}
