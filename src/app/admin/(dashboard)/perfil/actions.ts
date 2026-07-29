'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession, signSession, setSessionCookie } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';

type FormState = { error?: string; ok?: string };

const perfilSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
});

export async function atualizarPerfil(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: 'Não autenticado' };

  const parsed = perfilSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const { nome, email } = parsed.data;

  const conflict = await prisma.adminUser.findFirst({
    where: { email, NOT: { id: session.sub } },
  });
  if (conflict) return { error: 'Este e-mail já está em uso por outro usuário.' };

  const updated = await prisma.adminUser.update({
    where: { id: session.sub },
    data: { nome, email },
  });

  // Atualiza o cookie com os novos dados
  const token = await signSession({
    sub: updated.id,
    email: updated.email,
    nome: updated.nome,
    role: updated.role,
    loteadoraId: updated.loteadoraId,
  });
  await setSessionCookie(token);

  revalidatePath('/admin');
  return { ok: 'Perfil atualizado.' };
}

const senhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Senha atual obrigatória'),
    novaSenha: z.string().min(8, 'Nova senha precisa de pelo menos 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmar, {
    message: 'Confirmação não confere',
    path: ['confirmar'],
  });

export async function trocarSenha(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: 'Não autenticado' };

  const parsed = senhaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const { senhaAtual, novaSenha } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { id: session.sub } });
  if (!user) return { error: 'Usuário não encontrado' };

  const ok = await verifyPassword(senhaAtual, user.passwordHash);
  if (!ok) return { error: 'Senha atual incorreta' };

  const passwordHash = await hashPassword(novaSenha);
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return { ok: 'Senha atualizada com sucesso.' };
}
