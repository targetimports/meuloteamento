'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/tenant';

type FormState = { error?: string; ok?: boolean };

const STATUS = ['NOVO', 'NEGOCIANDO', 'CLIENTE', 'PERDIDO'] as const;

const mudarStatusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(STATUS),
});

/** Move o interessado no funil (Novo → Negociando → Cliente/Perdido). */
export async function mudarStatusInteressado(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = mudarStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Dados inválidos' };

  await prisma.interessado.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  revalidatePath('/admin/interessados');
  return { ok: true };
}

/**
 * Marca que o time respondeu. Nao envia e-mail: o envio sai do cliente de
 * e-mail do proprio usuario (mailto), porque a fila de e-mail do sistema nunca
 * entregou uma mensagem sequer em producao — so WhatsApp — e prometer um envio
 * que pode falhar em silencio seria pior do que nao prometer.
 */
export async function marcarComoRespondido(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'Interessado não informado' };

  const atual = await prisma.interessado.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!atual) return { error: 'Interessado não encontrado' };

  await prisma.interessado.update({
    where: { id },
    data: {
      respondidoEm: new Date(),
      // So promove quem ainda estava parado em NOVO; nao rebaixa quem ja
      // virou CLIENTE nem ressuscita PERDIDO.
      ...(atual.status === 'NOVO' ? { status: 'NEGOCIANDO' as const } : {}),
    },
  });

  revalidatePath('/admin/interessados');
  return { ok: true };
}

const observacoesSchema = z.object({
  id: z.string().trim().min(1),
  observacoes: z.string().trim().max(2000),
});

/** Anotacao interna do time comercial. */
export async function salvarObservacoes(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireSuperAdmin();

  const parsed = observacoesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Dados inválidos' };

  await prisma.interessado.update({
    where: { id: parsed.data.id },
    data: { observacoes: parsed.data.observacoes || null },
  });

  revalidatePath('/admin/interessados');
  return { ok: true };
}
