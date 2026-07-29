'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';

type FormState = { error?: string; ok?: boolean };

// =====================================================================
// LEGADO — usado pela tela de edição antiga
// =====================================================================

const atualizarLeadSchema = z.object({
  status: z.enum(['NOVO', 'EM_ATENDIMENTO', 'AGENDADO', 'CONVERTIDO', 'PERDIDO']),
  corretorId: z.string().trim().optional().or(z.literal('')),
  observacoesInternas: z.string().trim().optional().nullable(),
});

export async function atualizarLead(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const parsed = atualizarLeadSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  await prisma.lead.update({
    where: { id },
    data: {
      status: parsed.data.status,
      corretorId: parsed.data.corretorId || null,
      observacoesInternas: parsed.data.observacoesInternas || null,
    },
  });

  revalidatePath('/admin/leads');
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true };
}

export async function excluirLead(id: string): Promise<void> {
  await requireAdmin();
  await prisma.lead.delete({ where: { id } });
  revalidatePath('/admin/leads');
}

// =====================================================================
// CRM — Kanban / drag-drop
// =====================================================================

type LeadStatus = 'NOVO' | 'EM_ATENDIMENTO' | 'AGENDADO' | 'CONVERTIDO' | 'PERDIDO';
type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';

/**
 * Move o lead para outra coluna (status) e/ou nova posição na coluna.
 * O drag-drop chama isso quando o card é solto.
 */
export async function moverLead(input: {
  leadId: string;
  novoStatus: LeadStatus;
  ordem: number; // nova posição (cálculo entre vizinhos no front)
  motivo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: { id: true, status: true },
    });
    if (!lead) return { ok: false, error: 'Lead não encontrado' };

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { status: input.novoStatus, ordem: input.ordem },
      });

      // Auto-cria interação registrando a mudança de status
      if (lead.status !== input.novoStatus) {
        await tx.leadInteracao.create({
          data: {
            leadId: input.leadId,
            tipo: 'NOTA',
            conteudo: `Movido de ${lead.status} → ${input.novoStatus}${
              input.motivo ? ` (${input.motivo})` : ''
            }`,
            userId: session.sub,
          },
        });
      }
    });

    revalidatePath('/admin/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Atribui (ou desatribui) um corretor ao lead.
 */
export async function atribuirCorretor(input: {
  leadId: string;
  corretorId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  try {
    const corretor = input.corretorId
      ? await prisma.corretor.findUnique({
          where: { id: input.corretorId },
          select: { nome: true },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { corretorId: input.corretorId },
      });
      await tx.leadInteracao.create({
        data: {
          leadId: input.leadId,
          tipo: 'NOTA',
          conteudo: corretor
            ? `Atribuído ao corretor ${corretor.nome}`
            : 'Corretor removido',
          userId: session.sub,
        },
      });
    });

    revalidatePath('/admin/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Muda a temperatura comercial do lead (FRIO/MORNO/QUENTE).
 */
export async function setTemperatura(input: {
  leadId: string;
  temperatura: Temperatura;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { temperatura: input.temperatura },
      });
      await tx.leadInteracao.create({
        data: {
          leadId: input.leadId,
          tipo: 'NOTA',
          conteudo: `Temperatura alterada para ${input.temperatura}`,
          userId: session.sub,
        },
      });
    });
    revalidatePath('/admin/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Adiciona uma interação manual (nota, ligação, etc).
 */
export async function adicionarInteracao(input: {
  leadId: string;
  tipo: 'NOTA' | 'LIGACAO' | 'WHATSAPP' | 'EMAIL' | 'VISITA' | 'REUNIAO' | 'PROPOSTA' | 'OUTRO';
  conteudo: string;
  resultado?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!input.conteudo.trim()) return { ok: false, error: 'Conteúdo vazio' };

  try {
    await prisma.leadInteracao.create({
      data: {
        leadId: input.leadId,
        tipo: input.tipo,
        conteudo: input.conteudo.trim(),
        resultado: input.resultado?.trim() || null,
        userId: session.sub,
      },
    });
    // Auto-atualiza updatedAt do lead
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { updatedAt: new Date() },
    });
    revalidatePath('/admin/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Agenda próxima ação (texto livre + data).
 */
export async function agendarProximaAcao(input: {
  leadId: string;
  acao: string;
  data: string; // ISO yyyy-mm-dd ou yyyy-mm-ddThh:mm
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin();
  try {
    const dt = new Date(input.data);
    if (isNaN(dt.getTime())) return { ok: false, error: 'Data inválida' };

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: input.leadId },
        data: {
          proximaAcao: input.acao.trim(),
          proximaAcaoData: dt,
        },
      });
      await tx.leadInteracao.create({
        data: {
          leadId: input.leadId,
          tipo: 'NOTA',
          conteudo: `📅 Agendado: ${input.acao.trim()} — ${dt.toLocaleString('pt-BR')}`,
          userId: session.sub,
        },
      });
    });

    revalidatePath('/admin/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Adiciona ou remove uma tag.
 */
export async function toggleTag(input: {
  leadId: string;
  tag: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: { tags: true },
    });
    if (!lead) return { ok: false, error: 'Lead não encontrado' };

    const current = (lead.tags as string[] | null) ?? [];
    const t = input.tag.trim().toLowerCase();
    if (!t) return { ok: false, error: 'Tag vazia' };

    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { tags: next },
    });
    revalidatePath('/admin/leads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
