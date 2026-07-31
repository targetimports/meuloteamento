'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdmin, whereLoteadora, loteadoraAlvoId } from '@/lib/tenant';

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

const corretorSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  telefone: z.string().trim().optional().nullable(),
  cpfCnpj: z.string().trim().optional().nullable(),
  creci: z.string().trim().optional().nullable(),
  comissaoPadrao: z.coerce.number().min(0).max(100).default(0),
  ativo: checkbox.default(true),
  observacoes: z.string().trim().optional().nullable(),
});

type FormState = { error?: string; ok?: boolean };

function buildData(parsed: z.infer<typeof corretorSchema>) {
  return {
    nome: parsed.nome,
    email: parsed.email,
    telefone: parsed.telefone || null,
    cpfCnpj: parsed.cpfCnpj || null,
    creci: parsed.creci || null,
    comissaoPadrao: parsed.comissaoPadrao,
    ativo: parsed.ativo,
    observacoes: parsed.observacoes || null,
  };
}

export async function criarCorretor(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = corretorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const loteadoraId = await loteadoraAlvoId();
  if (!loteadoraId) {
    return {
      error:
        'Não foi possível identificar a loteadora deste corretor. Abra a empresa em /admin/loteadoras e cadastre por lá.',
    };
  }

  const data = buildData(parsed.data);

  // Unicidade agora e POR loteadora: a mesma pessoa pode ser corretor de duas
  // empresas diferentes sem colidir.
  const existingEmail = await prisma.corretor.findFirst({
    where: { loteadoraId, email: data.email },
  });
  if (existingEmail) return { error: 'Já existe um corretor com este e-mail nesta empresa.' };

  if (data.cpfCnpj) {
    const existingCpf = await prisma.corretor.findFirst({
      where: { loteadoraId, cpfCnpj: data.cpfCnpj },
    });
    if (existingCpf) return { error: 'Já existe um corretor com este CPF/CNPJ nesta empresa.' };
  }

  const created = await prisma.corretor.create({ data: { ...data, loteadoraId } });

  revalidatePath('/admin/corretores');
  redirect(`/admin/corretores/${created.id}`);
}

export async function atualizarCorretor(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const parsed = corretorSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  // Confere que o corretor e da loteadora de quem esta editando.
  const alvo = await prisma.corretor.findFirst({
    where: { id, ...(await whereLoteadora()) },
    select: { loteadoraId: true },
  });
  if (!alvo) return { error: 'Corretor não encontrado.' };

  const data = buildData(parsed.data);

  const conflictEmail = await prisma.corretor.findFirst({
    where: { loteadoraId: alvo.loteadoraId, email: data.email, NOT: { id } },
  });
  if (conflictEmail) return { error: 'Já existe outro corretor com este e-mail nesta empresa.' };

  if (data.cpfCnpj) {
    const conflictCpf = await prisma.corretor.findFirst({
      where: { loteadoraId: alvo.loteadoraId, cpfCnpj: data.cpfCnpj, NOT: { id } },
    });
    if (conflictCpf) return { error: 'Já existe outro corretor com este CPF/CNPJ nesta empresa.' };
  }

  await prisma.corretor.update({ where: { id }, data });

  revalidatePath('/admin/corretores');
  revalidatePath(`/admin/corretores/${id}`);
  return { ok: true };
}

export async function excluirCorretor(id: string): Promise<void> {
  await requireAdmin();

  const alvo = await prisma.corretor.findFirst({
    where: { id, ...(await whereLoteadora()) },
    select: { id: true },
  });
  if (!alvo) throw new Error('Corretor não encontrado.');

  const vendas = await prisma.venda.count({ where: { corretorId: id } });
  if (vendas > 0) {
    throw new Error(`Não é possível excluir: corretor tem ${vendas} venda(s) vinculada(s). Inative em vez de excluir.`);
  }
  await prisma.corretor.delete({ where: { id } });
  revalidatePath('/admin/corretores');
  redirect('/admin/corretores');
}
