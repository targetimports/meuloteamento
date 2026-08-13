'use server';

/**
 * Parâmetros do simulador público de um loteamento.
 *
 * Antes esses números eram padrão fixo do componente e valiam para todos:
 * lote de 55.000, entrada de 5.000, 60x de 1.000. Uma loteadora que vendesse
 * lote de 50.000 mostrava ao visitante o preço de outro empreendimento.
 *
 * A CONDIÇÃO DE REFERÊNCIA (preço à vista + valor da parcela padrão) é o que
 * define a taxa de juros que o simulador embute. Não é um enfeite: mudar o
 * valor da parcela sem mexer no preço encarece ou barateia todas as
 * simulações do loteamento.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, canAccessLoteamento } from '@/lib/tenant';

export interface EstadoSimulador {
  ok?: boolean;
  error?: string;
}

/** Aceita "50.000", "50000", "1.234,56" — o que se digita na prática. */
function paraNumero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const limpo = s.replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function paraInteiro(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** "5000, 10000, 20000" -> [5000, 10000, 20000]. Vazio vira null. */
function paraLista(v: FormDataEntryValue | null): number[] | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const nums = s
    .split(/[,;\n]/)
    .map((p) => Number(p.trim().replace(/\./g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? nums.sort((a, b) => a - b) : null;
}

export async function salvarParametrosSimulador(
  loteamentoId: string,
  _prev: EstadoSimulador,
  formData: FormData
): Promise<EstadoSimulador> {
  await requireAdmin();

  const loteamento = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { loteadoraId: true },
  });
  if (!loteamento) return { error: 'Loteamento não encontrado.' };
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) {
    return { error: 'Sem permissão para este loteamento.' };
  }

  const preco = paraNumero(formData.get('simPrecoResidencial'));
  const entradaMin = paraNumero(formData.get('simEntradaMinima'));
  const parcelas = paraInteiro(formData.get('simParcelas'));
  const valorParcela = paraNumero(formData.get('simValorParcela'));
  const precoComercial = paraNumero(formData.get('simPrecoComercial'));
  const sugeridas = paraLista(formData.get('simEntradasSugeridas'));

  // Validações que evitam simulação absurda na cara do visitante.
  if (preco !== null && preco <= 0) {
    return { error: 'O preço do lote precisa ser maior que zero.' };
  }
  if (preco !== null && entradaMin !== null && entradaMin >= preco) {
    return { error: 'A entrada mínima precisa ser menor que o preço do lote.' };
  }
  if (parcelas !== null && parcelas > 240) {
    return { error: 'Máximo de 240 parcelas.' };
  }

  // A parcela padrão precisa cobrir ao menos o saldo dividido pelo prazo;
  // abaixo disso a taxa embutida fica negativa e o simulador passaria a
  // "pagar" o cliente para financiar.
  if (preco !== null && entradaMin !== null && parcelas !== null && valorParcela !== null) {
    const saldo = preco - entradaMin;
    const minimoPorParcela = saldo / parcelas;
    if (valorParcela < minimoPorParcela) {
      return {
        error:
          `Com ${parcelas}x, a parcela precisa ser de pelo menos ` +
          `${minimoPorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ` +
          `para cobrir o saldo de ${saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      };
    }
  }

  // Atalho fora da faixa confunde: o botão apareceria e seria recusado.
  if (sugeridas && preco !== null) {
    const foraDaFaixa = sugeridas.find((v) => v >= preco);
    if (foraDaFaixa) {
      return {
        error: `O atalho de entrada ${foraDaFaixa.toLocaleString('pt-BR')} é maior ou igual ao preço do lote.`,
      };
    }
  }

  await prisma.loteamento.update({
    where: { id: loteamentoId },
    data: {
      simPrecoResidencial: preco,
      simPrecoComercial: precoComercial,
      simEntradaMinima: entradaMin,
      simParcelas: parcelas,
      simValorParcela: valorParcela,
      simEntradasSugeridas: sugeridas ?? undefined,
    },
  });

  revalidatePath(`/admin/loteamentos/${loteamentoId}/simulador`);
  // O simulador é público e cacheado por rota — precisa cair também.
  revalidatePath('/simulador/[slug]', 'page');
  revalidatePath('/[slug]', 'page');

  return { ok: true };
}
