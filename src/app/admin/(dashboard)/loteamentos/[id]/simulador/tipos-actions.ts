'use server';

/**
 * Tipos de lote do simulador — cada um com a condição inteira, não só o preço.
 *
 * O simulador nasceu com "Residencial" e "Comercial" fixos no código. Cada
 * loteamento tem os seus: esquina, premium, área maior. E a condição costuma
 * mudar junto com o preço — um lote de esquina não parcela igual ao padrão —
 * por isso cada tipo carrega entrada, prazo e valor da parcela próprios.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, canAccessLoteamento } from '@/lib/tenant';
import type { LoteTipo } from '@prisma/client';

export interface EstadoTipo {
  ok?: boolean;
  error?: string;
}

function paraNumero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function paraLista(v: FormDataEntryValue | null): number[] | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const nums = s
    .split(/[,;\n]/)
    .map((p) => Number(p.trim().replace(/\./g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? nums.sort((a, b) => a - b) : null;
}

/** Confere que o loteamento é acessível a quem está pedindo. */
async function autorizar(loteamentoId: string): Promise<string | null> {
  await requireAdmin();
  const l = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { loteadoraId: true },
  });
  if (!l) return 'Loteamento não encontrado.';
  if (!(await canAccessLoteamento(l.loteadoraId))) return 'Sem permissão para este loteamento.';
  return null;
}

export async function salvarTipoLote(
  loteamentoId: string,
  _prev: EstadoTipo,
  formData: FormData
): Promise<EstadoTipo> {
  const erroAuth = await autorizar(loteamentoId);
  if (erroAuth) return { error: erroAuth };

  const id = String(formData.get('id') ?? '').trim();
  const nome = String(formData.get('nome') ?? '').trim();
  if (!nome) return { error: 'Informe o nome do tipo (é o rótulo da aba).' };

  const simulavel = formData.get('simulavel') === 'on';
  const preco = paraNumero(formData.get('preco'));
  if (preco === null || preco <= 0) {
    return { error: 'Informe o preço do lote.' };
  }

  // Tipo não simulável só precisa de preço: ele mostra o valor e leva ao
  // contato, sem calcular parcela.
  let entradaMinima = paraNumero(formData.get('entradaMinima')) ?? 0;
  let parcelas = Number(String(formData.get('parcelas') ?? '').trim()) || 0;
  let valorParcela = paraNumero(formData.get('valorParcela')) ?? 0;

  if (simulavel) {
    if (entradaMinima >= preco) {
      return { error: 'A entrada mínima precisa ser menor que o preço do lote.' };
    }
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 240) {
      return { error: 'Informe o prazo entre 1 e 240 parcelas.' };
    }
    const saldo = preco - entradaMinima;
    if (valorParcela * parcelas < saldo) {
      const minimo = saldo / parcelas;
      return {
        error:
          `Com ${parcelas}x, a parcela precisa ser de pelo menos ` +
          `${minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ` +
          `para cobrir o saldo financiado.`,
      };
    }
  } else {
    // Zera o que não se aplica, em vez de guardar número que ninguém usa e
    // que confundiria quem reativar a simulação depois.
    entradaMinima = 0;
    parcelas = 0;
    valorParcela = 0;
  }

  const sugeridas = paraLista(formData.get('entradasSugeridas'));
  if (sugeridas && sugeridas.some((v) => v >= preco)) {
    return { error: 'Há atalho de entrada maior ou igual ao preço do lote.' };
  }

  // Em branco continua nulo: sem categoria o lote fica no default do banco,
  // que é o comportamento de quem nunca preencheu isso.
  const categoriaBruta = String(formData.get('categoria') ?? '').trim();
  const categoria: LoteTipo | null =
    categoriaBruta === 'RESIDENCIAL' || categoriaBruta === 'COMERCIAL' ? categoriaBruta : null;

  const dados = {
    nome,
    categoria,
    descricao: String(formData.get('descricao') ?? '').trim() || null,
    preco,
    entradaMinima,
    parcelas,
    valorParcela,
    entradasSugeridas: sugeridas ?? undefined,
    simulavel,
    ativo: formData.get('ativo') !== 'off',
  };

  if (id) {
    // where com loteamentoId junto: sem isso, um id de outro loteamento
    // passaria pela checagem de permissão feita sobre o loteamento errado.
    const alvo = await prisma.simuladorTipoLote.findFirst({
      where: { id, loteamentoId },
      select: { id: true },
    });
    if (!alvo) return { error: 'Tipo não encontrado neste loteamento.' };
    await prisma.simuladorTipoLote.update({ where: { id }, data: dados });
  } else {
    const total = await prisma.simuladorTipoLote.count({ where: { loteamentoId } });
    await prisma.simuladorTipoLote.create({
      data: { ...dados, loteamentoId, ordem: total },
    });
  }

  revalidar(loteamentoId);
  return { ok: true };
}

export async function excluirTipoLote(
  loteamentoId: string,
  tipoId: string
): Promise<void> {
  const erroAuth = await autorizar(loteamentoId);
  if (erroAuth) throw new Error(erroAuth);

  await prisma.simuladorTipoLote.deleteMany({
    where: { id: tipoId, loteamentoId },
  });
  revalidar(loteamentoId);
}

export async function alternarTipoAtivo(
  loteamentoId: string,
  tipoId: string
): Promise<void> {
  const erroAuth = await autorizar(loteamentoId);
  if (erroAuth) throw new Error(erroAuth);

  const t = await prisma.simuladorTipoLote.findFirst({
    where: { id: tipoId, loteamentoId },
    select: { ativo: true },
  });
  if (!t) return;

  await prisma.simuladorTipoLote.update({
    where: { id: tipoId },
    data: { ativo: !t.ativo },
  });
  revalidar(loteamentoId);
}

/** Move o tipo uma posição para cima ou para baixo — a ordem das abas. */
export async function moverTipoLote(
  loteamentoId: string,
  tipoId: string,
  direcao: 'cima' | 'baixo'
): Promise<void> {
  const erroAuth = await autorizar(loteamentoId);
  if (erroAuth) throw new Error(erroAuth);

  const tipos = await prisma.simuladorTipoLote.findMany({
    where: { loteamentoId },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  const i = tipos.findIndex((t) => t.id === tipoId);
  const j = direcao === 'cima' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= tipos.length) return;

  // Reescreve a ordem inteira em vez de trocar dois valores: registros antigos
  // podem ter ordem repetida ou vazia, e aí a troca simples não moveria nada.
  [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
  await prisma.$transaction(
    tipos.map((t, idx) =>
      prisma.simuladorTipoLote.update({ where: { id: t.id }, data: { ordem: idx } })
    )
  );

  revalidar(loteamentoId);
}

function revalidar(loteamentoId: string) {
  revalidatePath(`/admin/loteamentos/${loteamentoId}/simulador`);
  revalidatePath('/simulador/[slug]', 'page');
  revalidatePath('/[slug]', 'page');
}
