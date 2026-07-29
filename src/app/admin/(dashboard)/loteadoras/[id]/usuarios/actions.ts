'use server';

import { z } from 'zod';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';

type FormState = {
  error?: string;
  ok?: boolean;
  senhaGerada?: string;
  emailCriado?: string;
};

const userSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  role: z.enum(['ADMIN', 'OPERADOR', 'FINANCEIRO']).default('ADMIN'),
});

function gerarSenha(): string {
  // 12 chars: letras + números (sem ambiguidade)
  return crypto
    .randomBytes(9)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 12);
}

export async function criarUsuarioLoteadora(
  loteadoraId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireAdmin();
  if (!(await canAccessLoteadora(loteadoraId))) {
    return { error: 'Sem permissão para esta loteadora.' };
  }

  // Apenas SUPER_ADMIN e ADMIN podem criar usuários
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return { error: 'Você não tem permissão para criar usuários.' };
  }

  const parsed = userSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const { nome, email, role } = parsed.data;

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return { error: 'Já existe um usuário com este e-mail.' };
  }

  const senha = gerarSenha();
  const passwordHash = await hashPassword(senha);

  await prisma.adminUser.create({
    data: {
      email,
      nome,
      role,
      passwordHash,
      loteadoraId,
      ativo: true,
    },
  });

  revalidatePath(`/admin/loteadoras/${loteadoraId}/usuarios`);
  return { ok: true, senhaGerada: senha, emailCriado: email };
}

export async function resetarSenhaUsuario(
  loteadoraId: string,
  userId: string
): Promise<{ ok: boolean; senha?: string; error?: string }> {
  const session = await requireAdmin();
  if (!(await canAccessLoteadora(loteadoraId))) {
    return { ok: false, error: 'Sem permissão' };
  }
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return { ok: false, error: 'Sem permissão para resetar senha' };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!target || target.loteadoraId !== loteadoraId) {
    return { ok: false, error: 'Usuário não pertence a esta loteadora' };
  }

  const senha = gerarSenha();
  const passwordHash = await hashPassword(senha);
  await prisma.adminUser.update({
    where: { id: userId },
    data: { passwordHash },
  });

  revalidatePath(`/admin/loteadoras/${loteadoraId}/usuarios`);
  return { ok: true, senha };
}

export async function toggleAtivoUsuario(
  loteadoraId: string,
  userId: string
): Promise<void> {
  const session = await requireAdmin();
  if (!(await canAccessLoteadora(loteadoraId))) {
    throw new Error('Sem permissão');
  }
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    throw new Error('Sem permissão');
  }

  const target = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!target || target.loteadoraId !== loteadoraId) {
    throw new Error('Usuário não pertence a esta loteadora');
  }
  if (target.id === session.sub) {
    throw new Error('Você não pode desativar a si mesmo');
  }

  await prisma.adminUser.update({
    where: { id: userId },
    data: { ativo: !target.ativo },
  });

  revalidatePath(`/admin/loteadoras/${loteadoraId}/usuarios`);
}

export async function excluirUsuarioLoteadora(
  loteadoraId: string,
  userId: string
): Promise<void> {
  const session = await requireAdmin();
  if (!(await canAccessLoteadora(loteadoraId))) {
    throw new Error('Sem permissão');
  }
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    throw new Error('Sem permissão');
  }

  const target = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!target || target.loteadoraId !== loteadoraId) {
    throw new Error('Usuário não pertence a esta loteadora');
  }
  if (target.id === session.sub) {
    throw new Error('Você não pode excluir a si mesmo');
  }

  await prisma.adminUser.delete({ where: { id: userId } });
  revalidatePath(`/admin/loteadoras/${loteadoraId}/usuarios`);
}
