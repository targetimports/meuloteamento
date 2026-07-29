'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin, tenantId } from '@/lib/tenant';
import { slugify, type FormCampo } from '@/lib/formulario-tipos';

const campoSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum([
    'text',
    'textarea',
    'nome',
    'cpf',
    'email',
    'telefone',
    'numero',
    'data',
    'select',
    'radio',
    'checkbox',
    'sim_nao',
    'arquivo',
    'foto',
    'documento',
    'lote',
    'titulo',
    'paragrafo',
  ]),
  label: z.string().min(1),
  descricao: z.string().optional(),
  placeholder: z.string().optional(),
  obrigatorio: z.boolean().optional(),
  opcoes: z
    .array(z.object({ valor: z.string(), label: z.string() }))
    .optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  aceita: z.string().optional(),
  tamanhoMaxMb: z.number().min(1).max(50).optional(),
});

const schema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório'),
  slug: z.string().trim().min(2).optional(),
  descricao: z.string().trim().optional(),
  ativo: z.boolean().default(true),
  loteamentoId: z.string().optional(),
  loteadoraId: z.string().optional(),
  campos: z.array(campoSchema).min(1, 'Defina pelo menos 1 campo'),
  mensagemSucesso: z.string().trim().optional(),
  redirectUrl: z.string().trim().optional(),
  corPrimaria: z.string().optional(),
});

export interface ActionResult {
  error?: string;
  ok?: boolean;
  id?: string;
}

async function gerarSlugUnico(base: string, exceptId?: string): Promise<string> {
  let slug = slugify(base) || 'formulario';
  let i = 1;
  while (true) {
    const existe = await prisma.formulario.findFirst({
      where: { slug, NOT: exceptId ? { id: exceptId } : undefined },
      select: { id: true },
    });
    if (!existe) return slug;
    i++;
    slug = `${slugify(base)}-${i}`;
  }
}

export async function salvarFormulario(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = parsed.data;

  // Tenant scoping
  const tid = await tenantId();
  const loteadoraId = tid ?? data.loteadoraId ?? null;
  if (loteadoraId && !(await canAccessLoteadora(loteadoraId))) {
    return { error: 'Sem permissão para esta loteadora' };
  }

  // Valida loteamento se fornecido
  if (data.loteamentoId) {
    const lot = await prisma.loteamento.findUnique({
      where: { id: data.loteamentoId },
      select: { loteadoraId: true },
    });
    if (!lot) return { error: 'Loteamento não encontrado' };
    if (loteadoraId && lot.loteadoraId !== loteadoraId) {
      return { error: 'Loteamento não pertence a esta loteadora' };
    }
  }

  const slug = await gerarSlugUnico(data.slug || data.nome);

  const created = await prisma.formulario.create({
    data: {
      loteadoraId,
      slug,
      nome: data.nome,
      descricao: data.descricao || null,
      ativo: data.ativo,
      loteamentoId: data.loteamentoId || null,
      campos: data.campos as unknown as object,
      mensagemSucesso: data.mensagemSucesso || null,
      redirectUrl: data.redirectUrl || null,
      corPrimaria: data.corPrimaria || null,
    },
  });
  void session;

  revalidatePath('/admin/formularios');
  return { ok: true, id: created.id };
}

export async function atualizarFormulario(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = parsed.data;

  const atual = await prisma.formulario.findUnique({ where: { id } });
  if (!atual) return { error: 'Formulário não encontrado' };
  if (atual.loteadoraId && !(await canAccessLoteadora(atual.loteadoraId))) {
    return { error: 'Sem permissão' };
  }

  // Regera slug só se mudou explicitamente
  let slug = atual.slug;
  if (data.slug && data.slug !== atual.slug) {
    slug = await gerarSlugUnico(data.slug, id);
  }

  await prisma.formulario.update({
    where: { id },
    data: {
      slug,
      nome: data.nome,
      descricao: data.descricao || null,
      ativo: data.ativo,
      loteamentoId: data.loteamentoId || null,
      campos: data.campos as unknown as object,
      mensagemSucesso: data.mensagemSucesso || null,
      redirectUrl: data.redirectUrl || null,
      corPrimaria: data.corPrimaria || null,
    },
  });

  revalidatePath('/admin/formularios');
  revalidatePath(`/admin/formularios/${id}`);
  return { ok: true, id };
}

export async function deletarFormulario(id: string): Promise<void> {
  await requireAdmin();
  const f = await prisma.formulario.findUnique({ where: { id } });
  if (!f) return;
  if (f.loteadoraId && !(await canAccessLoteadora(f.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  await prisma.formulario.delete({ where: { id } });
  revalidatePath('/admin/formularios');
}

export async function toggleFormularioAtivo(id: string): Promise<void> {
  await requireAdmin();
  const f = await prisma.formulario.findUnique({ where: { id } });
  if (!f) return;
  if (f.loteadoraId && !(await canAccessLoteadora(f.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  await prisma.formulario.update({
    where: { id },
    data: { ativo: !f.ativo },
  });
  revalidatePath('/admin/formularios');
}

export async function marcarRespostaVista(respostaId: string): Promise<void> {
  const session = await requireAdmin();
  const r = await prisma.formularioResposta.findUnique({
    where: { id: respostaId },
    include: { formulario: { select: { loteadoraId: true, id: true } } },
  });
  if (!r) return;
  if (r.formulario.loteadoraId && !(await canAccessLoteadora(r.formulario.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  if (!r.vistaEm) {
    await prisma.formularioResposta.update({
      where: { id: respostaId },
      data: {
        vistaEm: new Date(),
        vistaPor: session.email,
        status: r.status === 'NOVA' ? 'EM_ANALISE' : r.status,
      },
    });
    revalidatePath(`/admin/formularios/${r.formulario.id}`);
  }
}

export async function mudarStatusResposta(
  respostaId: string,
  novoStatus: 'NOVA' | 'EM_ANALISE' | 'PROCESSADA' | 'ARQUIVADA'
): Promise<void> {
  await requireAdmin();
  const r = await prisma.formularioResposta.findUnique({
    where: { id: respostaId },
    include: { formulario: { select: { loteadoraId: true, id: true } } },
  });
  if (!r) return;
  if (r.formulario.loteadoraId && !(await canAccessLoteadora(r.formulario.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  await prisma.formularioResposta.update({
    where: { id: respostaId },
    data: { status: novoStatus },
  });
  revalidatePath(`/admin/formularios/${r.formulario.id}`);
  revalidatePath(`/admin/formularios/respostas/${respostaId}`);
}

export async function deletarResposta(respostaId: string): Promise<void> {
  await requireAdmin();
  const r = await prisma.formularioResposta.findUnique({
    where: { id: respostaId },
    include: { formulario: { select: { loteadoraId: true, id: true } } },
  });
  if (!r) return;
  if (r.formulario.loteadoraId && !(await canAccessLoteadora(r.formulario.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  await prisma.formularioResposta.delete({ where: { id: respostaId } });
  revalidatePath(`/admin/formularios/${r.formulario.id}`);
  redirect(`/admin/formularios/${r.formulario.id}`);
}

void slugify; // silencia lint
export type { FormCampo };
