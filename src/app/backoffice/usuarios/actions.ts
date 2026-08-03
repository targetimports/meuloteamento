'use server';

/**
 * Usuários DO BACKOFFICE — quem opera a plataforma.
 *
 * Não confundir com os usuários de uma empresa-cliente, que vivem em
 * /backoffice/empresas/[id]/usuarios e têm loteadoraId preenchido. Aqui são
 * os de loteadoraId nulo: enxergam todas as empresas e o financeiro da
 * plataforma inteira.
 *
 * A GUARDA MAIS IMPORTANTE deste arquivo é a do último super admin. Excluir
 * ou desativar o único que resta tranca todo mundo para fora do backoffice,
 * e não há tela para desfazer isso — só acesso direto ao banco. Por isso a
 * checagem aparece em três lugares, e não numa função só de fachada.
 */

import crypto from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { hashPassword } from '@/lib/password';

type EstadoForm = {
  error?: string;
  ok?: boolean;
  senhaGerada?: string;
  emailCriado?: string;
};

function gerarSenha(): string {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').substring(0, 12);
}

const usuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
});

function revalidar() {
  revalidatePath('/backoffice/usuarios');
}

/** Quantos super admins ativos existem além deste. */
async function outrosAtivos(exceptoId: string): Promise<number> {
  return prisma.adminUser.count({
    where: { loteadoraId: null, ativo: true, NOT: { id: exceptoId } },
  });
}

export async function criarUsuarioBackoffice(
  _prev: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  await requireBackoffice();

  const parsed = usuarioSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { nome, email } = parsed.data;

  // O e-mail é único na tabela inteira, não só entre super admins: um mesmo
  // endereço não pode ser super admin e usuário de uma empresa ao mesmo tempo.
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    return { error: 'Já existe um usuário com este e-mail.' };
  }

  const senha = gerarSenha();
  await prisma.adminUser.create({
    data: {
      nome,
      email,
      role: 'SUPER_ADMIN',
      passwordHash: await hashPassword(senha),
      loteadoraId: null,
      ativo: true,
    },
  });

  revalidar();
  return { ok: true, senhaGerada: senha, emailCriado: email };
}

export async function atualizarUsuarioBackoffice(
  _prev: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  await requireBackoffice();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'Usuário não informado.' };

  const parsed = usuarioSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { nome, email } = parsed.data;

  const conflito = await prisma.adminUser.findFirst({
    where: { email, NOT: { id } },
    select: { id: true },
  });
  if (conflito) return { error: 'Este e-mail já está em uso por outro usuário.' };

  await prisma.adminUser.update({ where: { id }, data: { nome, email } });
  revalidar();
  return { ok: true };
}

/*
 * Não existe reset de senha de terceiro aqui: cada um troca a própria em
 * /backoffice/perfil, informando a senha atual. A senha gerada na criação
 * segue existindo, e é a única que este arquivo produz.
 */

export async function alternarAtivoBackoffice(id: string): Promise<void> {
  const sessao = await requireBackoffice();

  if (id === sessao.sub) {
    throw new Error('Você não pode desativar a própria conta.');
  }

  const alvo = await prisma.adminUser.findUnique({
    where: { id },
    select: { ativo: true, loteadoraId: true },
  });
  if (!alvo || alvo.loteadoraId !== null) {
    throw new Error('Usuário não é do backoffice.');
  }

  // Desativando alguém: precisa sobrar pelo menos um ativo além dele.
  if (alvo.ativo && (await outrosAtivos(id)) === 0) {
    throw new Error(
      'Este é o último super admin ativo. Desativá-lo deixaria o backoffice sem ninguém com acesso.'
    );
  }

  await prisma.adminUser.update({ where: { id }, data: { ativo: !alvo.ativo } });
  revalidar();
}

export async function excluirUsuarioBackoffice(id: string): Promise<void> {
  const sessao = await requireBackoffice();

  if (id === sessao.sub) {
    throw new Error('Você não pode excluir a própria conta.');
  }

  const alvo = await prisma.adminUser.findUnique({
    where: { id },
    select: { ativo: true, loteadoraId: true },
  });
  if (!alvo || alvo.loteadoraId !== null) {
    throw new Error('Usuário não é do backoffice.');
  }

  if (alvo.ativo && (await outrosAtivos(id)) === 0) {
    throw new Error(
      'Este é o último super admin ativo. Excluí-lo deixaria o backoffice sem ninguém com acesso.'
    );
  }

  await prisma.adminUser.delete({ where: { id } });
  revalidar();
}
