'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';
import { enfileirar, buildIdempotencyKey } from '@/lib/comunicacao';

const bulkSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(200),
});

const bulkStatusSchema = bulkSchema.extend({
  novoStatus: z.enum(['NOVO', 'EM_ATENDIMENTO', 'AGENDADO', 'CONVERTIDO', 'PERDIDO']),
});

const bulkCorretorSchema = bulkSchema.extend({
  corretorId: z.string().nullable(),
});

const bulkMessageSchema = bulkSchema.extend({
  canal: z.enum(['WHATSAPP', 'EMAIL']),
  assunto: z.string().optional(),
  template: z.string().min(5),
});

function whereTenant(tid: string | null) {
  return tid
    ? { OR: [{ loteamento: { loteadoraId: tid } }, { loteamento: null }] }
    : {};
}

export async function bulkMudarStatus(input: z.infer<typeof bulkStatusSchema>) {
  const session = await requireAdmin();
  const tid = await tenantId();
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'inválido' };

  const r = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.leadIds }, ...whereTenant(tid) },
    data: { status: parsed.data.novoStatus, statusDesde: new Date() },
  });

  await prisma.leadInteracao.createMany({
    data: parsed.data.leadIds.map((id) => ({
      leadId: id,
      tipo: 'NOTA' as const,
      conteudo: `Status alterado em lote para ${parsed.data.novoStatus}`,
      userId: session.sub,
    })),
  });

  revalidatePath('/admin/leads');
  return { ok: true, atualizados: r.count };
}

export async function bulkAtribuirCorretor(input: z.infer<typeof bulkCorretorSchema>) {
  await requireAdmin();
  const tid = await tenantId();
  const parsed = bulkCorretorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'inválido' };

  const r = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.leadIds }, ...whereTenant(tid) },
    data: { corretorId: parsed.data.corretorId },
  });
  revalidatePath('/admin/leads');
  return { ok: true, atualizados: r.count };
}

export async function bulkEnviarMensagem(input: z.infer<typeof bulkMessageSchema>) {
  const session = await requireAdmin();
  const tid = await tenantId();
  const parsed = bulkMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'inválido' };

  const leads = await prisma.lead.findMany({
    where: { id: { in: parsed.data.leadIds }, ...whereTenant(tid) },
    include: { loteamento: { include: { loteadora: true } } },
  });

  const hoje = new Date().toISOString().slice(0, 10);
  let criados = 0;
  for (const lead of leads) {
    const destinatario =
      parsed.data.canal === 'EMAIL' ? lead.email : lead.telefone;
    if (!destinatario) continue;
    const idem = buildIdempotencyKey([
      'bulk-msg',
      session.sub,
      lead.id,
      parsed.data.canal,
      hoje,
    ]);
    const { jaExistia } = await enfileirar({
      loteadoraId: lead.loteamento?.loteadoraId ?? tid ?? null,
      canal: parsed.data.canal,
      destinatario,
      assunto: parsed.data.assunto,
      template: parsed.data.template,
      contexto: {
        cliente: { nome: lead.nome },
        lead: { nome: lead.nome, telefone: lead.telefone, email: lead.email },
        loteamento: lead.loteamento
          ? { nome: lead.loteamento.nome, cidade: lead.loteamento.cidade }
          : { nome: '', cidade: '' },
      },
      userId: session.sub,
      idempotencyKey: idem,
    });
    if (!jaExistia) criados++;
  }

  revalidatePath('/admin/leads');
  return { ok: true, criados, totalLeads: leads.length };
}
