'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId, isSuperAdmin } from '@/lib/tenant';

const schema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório'),
  tipo: z.enum(['ASAAS', 'CAIXA', 'BANCO', 'OUTROS']),
  descricao: z.string().trim().optional(),
  banco: z.string().trim().optional(),
  agencia: z.string().trim().optional(),
  numeroConta: z.string().trim().optional(),
  chavePix: z.string().trim().optional(),
  titular: z.string().trim().optional(),
  saldoInicial: z.coerce.number().default(0),
  cor: z.string().trim().optional(),
  loteadoraId: z.string().optional(),
});

type FormState = { error?: string; ok?: boolean; id?: string };

async function resolveLoteadoraId(input: string | undefined): Promise<string> {
  const tid = await tenantId();
  if (tid) return tid;
  if (!(await isSuperAdmin())) throw new Error('Sem permissão');
  if (!input) throw new Error('Selecione a loteadora');
  return input;
}

/** Wrapper void usado direto em <form action={criarContaSimple}> */
export async function criarContaSimple(formData: FormData): Promise<void> {
  const r = await criarConta({}, formData);
  if (r.error) throw new Error(r.error);
}

export async function criarConta(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  try {
    const loteadoraId = await resolveLoteadoraId(parsed.data.loteadoraId);
    const conta = await prisma.contaFinanceira.create({
      data: {
        loteadoraId,
        nome: parsed.data.nome,
        tipo: parsed.data.tipo,
        descricao: parsed.data.descricao || null,
        banco: parsed.data.banco || null,
        agencia: parsed.data.agencia || null,
        numeroConta: parsed.data.numeroConta || null,
        chavePix: parsed.data.chavePix || null,
        titular: parsed.data.titular || null,
        saldoInicial: parsed.data.saldoInicial,
        cor: parsed.data.cor || null,
        ativa: true,
      },
    });
    revalidatePath('/admin/contas');
    return { ok: true, id: conta.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function atualizarConta(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = schema.partial().safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error('Dados inválidos');
  await prisma.contaFinanceira.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao || null,
      banco: parsed.data.banco || null,
      agencia: parsed.data.agencia || null,
      numeroConta: parsed.data.numeroConta || null,
      chavePix: parsed.data.chavePix || null,
      titular: parsed.data.titular || null,
      saldoInicial: parsed.data.saldoInicial,
      cor: parsed.data.cor || null,
    },
  });
  revalidatePath('/admin/contas');
}

export async function toggleAtivaConta(id: string): Promise<void> {
  await requireAdmin();
  const conta = await prisma.contaFinanceira.findUnique({
    where: { id },
    select: { ativa: true },
  });
  if (!conta) throw new Error('Conta não encontrada');
  await prisma.contaFinanceira.update({
    where: { id },
    data: { ativa: !conta.ativa },
  });
  revalidatePath('/admin/contas');
}

export async function excluirConta(id: string): Promise<void> {
  await requireAdmin();
  // Não exclui se tem parcela vinculada (FK protege)
  const parcelas = await prisma.parcela.count({ where: { contaId: id } });
  if (parcelas > 0) {
    throw new Error(
      `Não é possível excluir: ${parcelas} parcela(s) vinculadas a esta conta. Desative em vez disso.`
    );
  }
  await prisma.contaFinanceira.delete({ where: { id } });
  revalidatePath('/admin/contas');
}
