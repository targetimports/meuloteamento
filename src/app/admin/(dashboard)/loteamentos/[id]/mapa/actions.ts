'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertAcessoLoteamento } from '@/lib/tenant';
import { getSession } from '@/lib/auth';

const posicaoSchema = z.object({
  loteId: z.string().min(1),
  mapaX: z.number().min(0).max(100).nullable(),
  mapaY: z.number().min(0).max(100).nullable(),
  mapaLargura: z.number().min(0).max(100).nullable(),
  mapaAltura: z.number().min(0).max(100).nullable(),
});

const payloadSchema = z.object({
  posicoes: z.array(posicaoSchema),
});

export async function salvarPosicoes(
  loteamentoId: string,
  raw: unknown
): Promise<{ ok: boolean; error?: string; updated?: number }> {
  await assertAcessoLoteamento(loteamentoId);
  const session = await getSession();
  if (!session) return { ok: false, error: 'Não autenticado' };

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Payload inválido' };
  }

  // Verifica que todos os lotes pertencem ao loteamento
  const ids = parsed.data.posicoes.map((p) => p.loteId);
  const count = await prisma.lote.count({
    where: { id: { in: ids }, loteamentoId },
  });
  if (count !== ids.length) {
    return { ok: false, error: 'Algum lote não pertence a este loteamento' };
  }

  // Aplica em transação
  await prisma.$transaction(
    parsed.data.posicoes.map((p) =>
      prisma.lote.update({
        where: { id: p.loteId },
        data: {
          mapaX: p.mapaX,
          mapaY: p.mapaY,
          mapaLargura: p.mapaLargura,
          mapaAltura: p.mapaAltura,
        },
      })
    )
  );

  revalidatePath(`/admin/loteamentos/${loteamentoId}/mapa`);
  revalidatePath(`/admin/loteamentos/${loteamentoId}`);

  // Também limpa o cache da LP pública
  const loteamento = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { slug: true },
  });
  if (loteamento) revalidatePath(`/${loteamento.slug}`);

  return { ok: true, updated: parsed.data.posicoes.length };
}

const sateliteCalibSchema = z.object({
  offsetX: z.number().min(-200).max(200),
  offsetY: z.number().min(-200).max(200),
  scaleX: z.number().min(0.1).max(5),
  scaleY: z.number().min(0.1).max(5),
  rotation: z.number().min(-180).max(180),
});

/**
 * Salva a calibração específica da vista satélite (não afeta posições da planta).
 * Aplicada APENAS no Stand 3D, ao posicionar lotes sobre o satélite.
 */
export async function salvarCalibracaoSatelite(
  loteamentoId: string,
  raw: unknown
): Promise<{ ok: boolean; error?: string }> {
  await assertAcessoLoteamento(loteamentoId);
  const session = await getSession();
  if (!session) return { ok: false, error: 'Não autenticado' };

  const parsed = sateliteCalibSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Calibração inválida' };
  }

  await prisma.loteamento.update({
    where: { id: loteamentoId },
    data: { mapaSateliteCalib: parsed.data as unknown as object },
  });

  const loteamento = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { slug: true },
  });
  revalidatePath(`/admin/loteamentos/${loteamentoId}/mapa`);
  if (loteamento) revalidatePath(`/touch/${loteamento.slug}`);

  return { ok: true };
}

export async function resetarCalibracaoSatelite(
  loteamentoId: string
): Promise<{ ok: boolean }> {
  await assertAcessoLoteamento(loteamentoId);
  const session = await getSession();
  if (!session) return { ok: false };
  await prisma.loteamento.update({
    where: { id: loteamentoId },
    data: { mapaSateliteCalib: Prisma.JsonNull },
  });
  const loteamento = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { slug: true },
  });
  revalidatePath(`/admin/loteamentos/${loteamentoId}/mapa`);
  if (loteamento) revalidatePath(`/touch/${loteamento.slug}`);
  return { ok: true };
}
