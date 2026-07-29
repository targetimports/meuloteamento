'use server';

import crypto from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';
import { gerarContratoVenda, enviarParaAssinatura } from '@/lib/contrato';
import { logVenda } from '@/lib/audit';
import {
  TEMPLATE_PARQUE_TUCANO_HTML,
  TEMPLATE_PARQUE_TUCANO_NOME,
} from '@/lib/templates/parque-tucano';

const templateSchema = z.object({
  nome: z.string().trim().min(2),
  descricao: z.string().trim().optional(),
  conteudoHtml: z.string().min(20),
  ativo: z.coerce.boolean().optional(),
  default: z.coerce.boolean().optional(),
});

export async function salvarTemplate(prev: unknown, formData: FormData) {
  await requireAdmin();
  const tid = await tenantId();
  const id = String(formData.get('id') || '');

  const parsed = templateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'dados inválidos' };
  }

  const data = parsed.data;

  if (data.default) {
    await prisma.contratoTemplate.updateMany({
      where: tid ? { loteadoraId: tid } : {},
      data: { default: false },
    });
  }

  if (id) {
    await prisma.contratoTemplate.update({
      where: { id },
      data: {
        nome: data.nome,
        descricao: data.descricao ?? null,
        conteudoHtml: data.conteudoHtml,
        ativo: data.ativo ?? true,
        default: data.default ?? false,
      },
    });
  } else {
    const novo = await prisma.contratoTemplate.create({
      data: {
        loteadoraId: tid,
        nome: data.nome,
        descricao: data.descricao ?? null,
        conteudoHtml: data.conteudoHtml,
        ativo: data.ativo ?? true,
        default: data.default ?? false,
      },
    });
    revalidatePath('/admin/contratos');
    redirect(`/admin/contratos/${novo.id}`);
  }

  revalidatePath('/admin/contratos');
  return { ok: true };
}

export async function excluirTemplate(id: string) {
  await requireAdmin();
  await prisma.contratoTemplate.delete({ where: { id } });
  revalidatePath('/admin/contratos');
  redirect('/admin/contratos');
}

export async function gerarContratoAction(vendaId: string, templateId?: string | null) {
  const session = await requireAdmin();
  try {
    const r = await gerarContratoVenda({ vendaId, templateId: templateId ?? null, userId: session.sub });
    await logVenda({
      vendaId,
      action: 'CONTRATO_GERADO',
      diff: { templateId: templateId ?? null, hash: r.hash },
      userId: session.sub,
      userType: 'ADMIN',
    });
    revalidatePath(`/admin/vendas/${vendaId}`);
    return { ok: true, hash: r.hash };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function enviarParaAssinaturaAction(vendaId: string) {
  const session = await requireAdmin();
  const r = await enviarParaAssinatura(vendaId);
  if (r.ok) {
    await logVenda({
      vendaId,
      action: 'CONTRATO_ENVIADO_ASSINATURA',
      diff: { signerId: r.signerId ?? null },
      userId: session.sub,
      userType: 'ADMIN',
    });
  }
  revalidatePath(`/admin/vendas/${vendaId}`);
  return r;
}

/**
 * Edita manualmente o HTML do contrato JÁ GERADO de uma venda específica.
 *
 * Diferente de "Regenerar" (que sobrescreve tudo a partir do modelo), aqui o
 * admin ajusta pontualmente o texto do contrato daquele cliente. O snapshot em
 * venda.contratoHtml é atualizado e o hash de integridade recalculado.
 *
 * Bloqueado se o contrato já foi assinado (não se altera documento assinado).
 */
export async function salvarContratoEditadoAction(vendaId: string, html: string) {
  const session = await requireAdmin();
  const tid = await tenantId();

  const conteudo = String(html ?? '').trim();
  if (conteudo.length < 20) {
    return { ok: false as const, error: 'Conteúdo do contrato muito curto.' };
  }

  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    select: {
      contratoStatus: true,
      lote: { select: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) return { ok: false as const, error: 'Venda não encontrada.' };
  if (tid && venda.lote.loteamento.loteadoraId !== tid) {
    return { ok: false as const, error: 'Sem permissão para esta venda.' };
  }
  if (venda.contratoStatus === 'ASSINADO') {
    return { ok: false as const, error: 'Contrato já assinado não pode ser editado.' };
  }

  const hash = crypto.createHash('sha256').update(conteudo, 'utf8').digest('hex');

  await prisma.venda.update({
    where: { id: vendaId },
    data: { contratoHtml: conteudo, contratoHash: hash },
  });

  await logVenda({
    vendaId,
    action: 'CONTRATO_EDITADO',
    diff: { hash },
    userId: session.sub,
    userType: 'ADMIN',
  });

  revalidatePath(`/admin/vendas/${vendaId}`);
  return { ok: true as const, hash };
}

/**
 * Importa o template oficial do Parque Tucano (Lei 6.766/79) na loteadora atual.
 * Se já existir um template com o mesmo nome, ele é atualizado em vez de duplicado.
 */
export async function importarTemplateParqueTucano(opts?: { setDefault?: boolean }) {
  await requireAdmin();
  const tid = await tenantId();

  const existente = await prisma.contratoTemplate.findFirst({
    where: { loteadoraId: tid, nome: TEMPLATE_PARQUE_TUCANO_NOME },
  });

  const setDefault = opts?.setDefault ?? true;

  if (setDefault) {
    await prisma.contratoTemplate.updateMany({
      where: { loteadoraId: tid },
      data: { default: false },
    });
  }

  let templateId: string;
  if (existente) {
    await prisma.contratoTemplate.update({
      where: { id: existente.id },
      data: {
        conteudoHtml: TEMPLATE_PARQUE_TUCANO_HTML,
        ativo: true,
        default: setDefault,
      },
    });
    templateId = existente.id;
  } else {
    const novo = await prisma.contratoTemplate.create({
      data: {
        loteadoraId: tid,
        nome: TEMPLATE_PARQUE_TUCANO_NOME,
        descricao:
          'Compromisso de compra e venda de imóvel — lei 6.766/79, adaptado do contrato editado em uso no loteamento Parque Tucano.',
        conteudoHtml: TEMPLATE_PARQUE_TUCANO_HTML,
        ativo: true,
        default: setDefault,
      },
    });
    templateId = novo.id;
  }

  revalidatePath('/admin/contratos');
  return { ok: true, templateId, atualizado: !!existente };
}
