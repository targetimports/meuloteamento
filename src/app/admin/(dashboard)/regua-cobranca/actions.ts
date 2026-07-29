'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';

const reguaSchema = z.object({
  nome: z.string().trim().min(2),
  descricao: z.string().trim().optional(),
  ativa: z.coerce.boolean().optional(),
});

const passoSchema = z.object({
  diasOffset: z.coerce.number().int(),
  canal: z.enum(['WHATSAPP', 'EMAIL', 'SMS']),
  template: z.string().min(5),
  ativo: z.coerce.boolean().optional(),
});

export async function criarRegua(prev: unknown, formData: FormData) {
  await requireAdmin();
  const tid = await tenantId();
  if (!tid) return { error: 'só admins de loteadora podem criar régua' };

  const parsed = reguaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const r = await prisma.reguaCobranca.create({
    data: {
      loteadoraId: tid,
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      ativa: parsed.data.ativa ?? true,
    },
  });
  revalidatePath('/admin/regua-cobranca');
  redirect(`/admin/regua-cobranca/${r.id}`);
}

export async function atualizarRegua(id: string, prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = reguaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await prisma.reguaCobranca.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      ativa: parsed.data.ativa ?? true,
    },
  });
  revalidatePath('/admin/regua-cobranca');
  revalidatePath(`/admin/regua-cobranca/${id}`);
  return { ok: true };
}

export async function adicionarPasso(reguaId: string, prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = passoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const ultimo = await prisma.reguaCobrancaPasso.findFirst({
    where: { reguaId },
    orderBy: { ordem: 'desc' },
  });
  await prisma.reguaCobrancaPasso.create({
    data: {
      reguaId,
      ordem: (ultimo?.ordem ?? 0) + 1,
      diasOffset: parsed.data.diasOffset,
      canal: parsed.data.canal,
      template: parsed.data.template,
      ativo: parsed.data.ativo ?? true,
    },
  });
  revalidatePath(`/admin/regua-cobranca/${reguaId}`);
  return { ok: true };
}

export async function removerPasso(passoId: string, reguaId: string) {
  await requireAdmin();
  await prisma.reguaCobrancaPasso.delete({ where: { id: passoId } });
  revalidatePath(`/admin/regua-cobranca/${reguaId}`);
}

export async function ativarRegua(reguaId: string) {
  await requireAdmin();
  const tid = await tenantId();
  if (!tid) return;
  await prisma.loteadora.update({
    where: { id: tid },
    data: { reguaCobrancaId: reguaId },
  });
  await prisma.reguaCobranca.update({
    where: { id: reguaId },
    data: { ativa: true },
  });
  revalidatePath('/admin/regua-cobranca');
}

export async function desativarRegua(reguaId: string) {
  await requireAdmin();
  const tid = await tenantId();
  if (!tid) return;
  await prisma.loteadora.update({
    where: { id: tid },
    data: { reguaCobrancaId: null },
  });
  revalidatePath('/admin/regua-cobranca');
}
