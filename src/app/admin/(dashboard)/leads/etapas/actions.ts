'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';
import { garantirEtapas } from '@/lib/pipeline';

type Resultado = { ok: boolean; error?: string };

const etapaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(40, 'Nome muito longo'),
  cor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #rrggbb)'),
  slaHoras: z.coerce.number().int().min(1).max(8760).nullable(),
  ehFinal: z.boolean(),
  ehGanho: z.boolean(),
});

/**
 * Confere que a etapa é do funil de quem está logado.
 *
 * A action é um endpoint POST próprio: proteger a tela não protege a etapa.
 */
async function assertAcessoEtapa(etapaId: string): Promise<void> {
  const session = await requireAdmin();
  if (!session.loteadoraId) return;

  const etapa = await prisma.pipelineStage.findUnique({
    where: { id: etapaId },
    select: { pipeline: { select: { loteadoraId: true } } },
  });
  if (!etapa || etapa.pipeline.loteadoraId !== session.loteadoraId) {
    throw new Error('Acesso negado: esta etapa é de outra empresa.');
  }
}

export async function criarEtapa(input: z.infer<typeof etapaSchema>): Promise<Resultado> {
  await requireAdmin();
  const parsed = etapaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const tid = await tenantId();
    const etapas = await garantirEtapas(tid);
    const pipeline = await prisma.pipelineStage.findUniqueOrThrow({
      where: { id: etapas[0].id },
      select: { pipelineId: true },
    });

    // Entra no fim, mas antes das etapas finais: etapa nova é passo do meio do
    // atendimento, e nascer depois de "Convertido" deixaria o funil ilegível.
    const ultimaNaoFinal = etapas.filter((e) => !e.ehFinal).at(-1);
    const ordem = (ultimaNaoFinal?.ordem ?? -1) + 1;

    await prisma.$transaction(async (tx) => {
      await tx.pipelineStage.updateMany({
        where: { pipelineId: pipeline.pipelineId, ordem: { gte: ordem } },
        data: { ordem: { increment: 1 } },
      });
      await tx.pipelineStage.create({
        data: {
          pipelineId: pipeline.pipelineId,
          nome: parsed.data.nome,
          cor: parsed.data.cor,
          ordem,
          slaHoras: parsed.data.slaHoras,
          ehFinal: parsed.data.ehFinal,
          ehGanho: parsed.data.ehGanho,
          // Etapa criada na tela não tem equivalente no enum antigo. O lead que
          // parar aqui mantém o status que já tinha (ver dadosDeMovimentacao).
          statusLegado: null,
        },
      });
    });

    revalidatePath('/admin/leads');
    revalidatePath('/admin/leads/etapas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function atualizarEtapa(
  id: string,
  input: z.infer<typeof etapaSchema>
): Promise<Resultado> {
  const parsed = etapaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await assertAcessoEtapa(id);
    await prisma.pipelineStage.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        cor: parsed.data.cor,
        slaHoras: parsed.data.slaHoras,
        ehFinal: parsed.data.ehFinal,
        ehGanho: parsed.data.ehGanho,
      },
    });
    revalidatePath('/admin/leads');
    revalidatePath('/admin/leads/etapas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Exclui uma etapa, movendo antes quem estava nela.
 *
 * O destino é obrigatório de propósito. O banco resolveria sozinho (a FK é
 * `onDelete: SetNull`), mas aí os leads cairiam em "sem etapa" e quem excluiu
 * não saberia para onde foram — apagar uma coluna não pode ser um jeito
 * silencioso de perder o rastro de quem estava dentro dela.
 */
export async function excluirEtapa(id: string, destinoId: string): Promise<Resultado> {
  const session = await requireAdmin();
  try {
    await assertAcessoEtapa(id);
    await assertAcessoEtapa(destinoId);
    if (id === destinoId) return { ok: false, error: 'Escolha outra etapa como destino.' };

    const tid = await tenantId();
    const etapas = await garantirEtapas(tid);
    if (etapas.length <= 2) {
      return { ok: false, error: 'O funil precisa de pelo menos duas etapas.' };
    }

    const destino = etapas.find((e) => e.id === destinoId);
    if (!destino) return { ok: false, error: 'Etapa de destino não encontrada.' };

    await prisma.$transaction(async (tx) => {
      const movidos = await tx.lead.findMany({ where: { stageId: id }, select: { id: true } });

      await tx.lead.updateMany({
        where: { stageId: id },
        data: {
          stageId: destinoId,
          statusDesde: new Date(),
          ...(destino.statusLegado ? { status: destino.statusLegado } : {}),
        },
      });

      if (movidos.length > 0) {
        await tx.leadInteracao.createMany({
          data: movidos.map((l) => ({
            leadId: l.id,
            tipo: 'NOTA' as const,
            conteudo: `Etapa excluída — lead movido para ${destino.nome}`,
            userId: session.sub,
          })),
        });
      }

      await tx.pipelineStage.delete({ where: { id } });
    });

    revalidatePath('/admin/leads');
    revalidatePath('/admin/leads/etapas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Reordena o funil. Recebe os ids na ordem desejada. */
export async function reordenarEtapas(ids: string[]): Promise<Resultado> {
  try {
    for (const id of ids) await assertAcessoEtapa(id);

    await prisma.$transaction(
      ids.map((id, i) => prisma.pipelineStage.update({ where: { id }, data: { ordem: i } }))
    );

    revalidatePath('/admin/leads');
    revalidatePath('/admin/leads/etapas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
