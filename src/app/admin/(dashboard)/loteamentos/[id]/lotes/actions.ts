'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertAcessoLoteamento, assertAcessoLote } from '@/lib/tenant';
import { mudarStatusLote } from '@/lib/lote-status';
import { getSession } from '@/lib/auth';
import type { LoteStatus, LoteTipo, OrientacaoSolar } from '@prisma/client';

type FormState = { error?: string; ok?: boolean; criados?: number };

/**
 * Categoria vinda do tipo de lote escolhido no formulário.
 *
 * Opcional em todos os schemas: o campo só é enviado quando o tipo declara a
 * categoria. Ausente, nada é gravado — na criação o lote fica no default do
 * banco e na edição a categoria atual é preservada, que é como sempre foi.
 */
const categoriaOpcional = z.enum(['RESIDENCIAL', 'COMERCIAL']).optional();
const comCategoria = (tipo?: string) => (tipo ? { tipo: tipo as LoteTipo } : {});

function parseLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

// =====================================================================
// CRIAR LOTE INDIVIDUAL
// =====================================================================

const loteSchema = z.object({
  quadra: z.string().trim().min(1, 'Quadra obrigatória'),
  numero: z.string().trim().min(1, 'Número obrigatório'),
  area: z.coerce.number().positive('Área deve ser positiva'),
  testada: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  fundo: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  preco: z.coerce.number().positive('Preço deve ser positivo'),
  descricao: z.string().trim().optional().nullable(),
  orientacaoSolar: z
    .enum(['NORTE', 'SUL', 'LESTE', 'OESTE', 'NORDESTE', 'NOROESTE', 'SUDESTE', 'SUDOESTE'])
    .optional()
    .or(z.literal('')),
  esquina: checkbox.default(false),
  fronteAreaVerde: checkbox.default(false),
  tipo: categoriaOpcional,
});

export async function criarLote(loteamentoId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await assertAcessoLoteamento(loteamentoId);
  const raw = Object.fromEntries(formData.entries());
  const parsed = loteSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const data = parsed.data;
  const codigo = `${data.quadra.toUpperCase()}-${data.numero}`;

  const existing = await prisma.lote.findUnique({
    where: { loteamentoId_codigo: { loteamentoId, codigo } },
  });
  if (existing) return { error: `Já existe um lote ${codigo} neste loteamento.` };

  await prisma.lote.create({
    data: {
      loteamentoId,
      quadra: data.quadra.toUpperCase(),
      numero: data.numero,
      codigo,
      area: data.area,
      testada: data.testada,
      fundo: data.fundo,
      preco: data.preco,
      descricao: data.descricao || null,
      orientacaoSolar: data.orientacaoSolar ? (data.orientacaoSolar as OrientacaoSolar) : null,
      esquina: data.esquina,
      fronteAreaVerde: data.fronteAreaVerde,
      ...comCategoria(data.tipo),
    },
  });

  revalidatePath(`/admin/loteamentos/${loteamentoId}/lotes`);
  revalidatePath(`/admin/loteamentos/${loteamentoId}`);
  return { ok: true };
}

// =====================================================================
// CRIAR LOTES EM MASSA
// =====================================================================

const lotesBulkSchema = z.object({
  quadra: z.string().trim().min(1),
  numeroInicial: z.coerce.number().int().min(1),
  quantidade: z.coerce.number().int().min(1).max(200),
  area: z.coerce.number().positive(),
  preco: z.coerce.number().positive(),
  tipo: categoriaOpcional,
});

export async function criarLotesEmMassa(
  loteamentoId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await assertAcessoLoteamento(loteamentoId);
  const raw = Object.fromEntries(formData.entries());
  const parsed = lotesBulkSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const { quadra, numeroInicial, quantidade, area, preco, tipo } = parsed.data;
  const quadraNorm = quadra.toUpperCase();

  const planejados: { numero: string; codigo: string }[] = [];
  for (let i = 0; i < quantidade; i++) {
    const numero = String(numeroInicial + i).padStart(2, '0');
    planejados.push({ numero, codigo: `${quadraNorm}-${numero}` });
  }

  const codigos = planejados.map((p) => p.codigo);
  const existentes = await prisma.lote.findMany({
    where: { loteamentoId, codigo: { in: codigos } },
    select: { codigo: true },
  });
  if (existentes.length > 0) {
    return {
      error: `Conflito: já existem os códigos ${existentes.map((e) => e.codigo).join(', ')}.`,
    };
  }

  await prisma.lote.createMany({
    data: planejados.map((p) => ({
      loteamentoId,
      quadra: quadraNorm,
      numero: p.numero,
      codigo: p.codigo,
      area,
      preco,
      ...comCategoria(tipo),
    })),
  });

  revalidatePath(`/admin/loteamentos/${loteamentoId}/lotes`);
  revalidatePath(`/admin/loteamentos/${loteamentoId}`);
  return { ok: true, criados: quantidade };
}

// =====================================================================
// ATUALIZAR LOTE
// =====================================================================

const atualizarSchema = z.object({
  area: z.coerce.number().positive(),
  preco: z.coerce.number().positive(),
  descricao: z.string().trim().optional().nullable(),
  status: z.enum(['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO', 'BLOQUEADO']),
  motivoBloqueio: z.string().trim().optional().nullable(),
  orientacaoSolar: z
    .enum(['NORTE', 'SUL', 'LESTE', 'OESTE', 'NORDESTE', 'NOROESTE', 'SUDESTE', 'SUDOESTE'])
    .optional()
    .or(z.literal('')),
  esquina: checkbox.default(false),
  fronteAreaVerde: checkbox.default(false),
  fotos: z.string().optional(),
  tipo: categoriaOpcional,
});

export async function atualizarLote(loteId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await assertAcessoLote(loteId);
  const raw = Object.fromEntries(formData.entries());
  const parsed = atualizarSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const data = parsed.data;
  const session = await getSession();

  const lote = await prisma.lote.findUnique({ where: { id: loteId } });
  if (!lote) return { error: 'Lote não encontrado' };

  // Mudança de status passa pelo helper que registra histórico
  if (data.status !== lote.status) {
    await mudarStatusLote({
      loteId,
      novoStatus: data.status as LoteStatus,
      motivo: data.motivoBloqueio || null,
      userId: session?.sub ?? null,
      userType: 'ADMIN',
    });
  }

  await prisma.lote.update({
    where: { id: loteId },
    data: {
      area: data.area,
      preco: data.preco,
      descricao: data.descricao || null,
      motivoBloqueio: data.status === 'BLOQUEADO' ? data.motivoBloqueio || null : null,
      orientacaoSolar: data.orientacaoSolar ? (data.orientacaoSolar as OrientacaoSolar) : null,
      esquina: data.esquina,
      fronteAreaVerde: data.fronteAreaVerde,
      fotos: parseLines(data.fotos),
      ...comCategoria(data.tipo),
    },
  });

  revalidatePath(`/admin/loteamentos/${lote.loteamentoId}/lotes`);
  revalidatePath(`/admin/loteamentos/${lote.loteamentoId}`);
  return { ok: true };
}

// =====================================================================
// EXCLUIR LOTE
// =====================================================================

export async function excluirLote(loteId: string): Promise<void> {
  await assertAcessoLote(loteId);
  const vendas = await prisma.venda.count({ where: { loteId } });
  if (vendas > 0) {
    throw new Error('Não é possível excluir: lote já possui venda associada.');
  }
  const lote = await prisma.lote.delete({ where: { id: loteId } });
  revalidatePath(`/admin/loteamentos/${lote.loteamentoId}/lotes`);
  revalidatePath(`/admin/loteamentos/${lote.loteamentoId}`);
}
