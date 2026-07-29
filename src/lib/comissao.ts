/**
 * COMISSÕES DE CORRETOR — regras de cálculo e geração de parcelas.
 *
 * REGRA ATUAL (2026-05-20):
 *   - Lote RESIDENCIAL → comissão FIXA de R$ 2.500 por lote
 *   - Lote COMERCIAL   → mantém regra antiga (% sobre o valor total da venda)
 *   - Pagamento ao corretor em 4 parcelas iguais (valor / 4):
 *       comissão 1 → ENTRADA do cliente
 *       comissão 2 → 1ª mensal
 *       comissão 3 → 2ª mensal
 *       comissão 4 → 3ª mensal
 *   - Cada parcela nasce BLOQUEADA. Quando o cliente paga a parcela vinculada,
 *     vira LIBERADA. Admin paga ao corretor → PAGA.
 *
 * Centralizamos as constantes aqui para ser fácil mudar no futuro
 * (ex: virar configuração por loteadora).
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const COMISSAO_VALOR_FIXO_RESIDENCIAL = 2500;
export const COMISSAO_NUMERO_PARCELAS = 4;

export interface LoteParaComissao {
  id: string;
  tipo: 'RESIDENCIAL' | 'COMERCIAL';
  preco: number | Prisma.Decimal;
}

export interface ResultadoCalculo {
  valor: number;
  /** Pct calculado retroativamente (para retro-compat com Venda.comissaoPct). */
  pctEquivalente: number | null;
  /** Se ao menos 1 lote era residencial → usa regra fixa. */
  usaRegraFixa: boolean;
  qtdLotesResidenciais: number;
  qtdLotesComerciais: number;
}

/**
 * Calcula o VALOR total da comissão de uma venda.
 *
 * Misto (residencial + comercial na mesma venda) → soma o fixo dos residenciais
 * com o % do valor comercial.
 */
export function calcularComissaoVenda(input: {
  lotes: LoteParaComissao[];
  /** Soma dos valores atribuídos aos lotes (de VendaLote.valor), ou valorTotal. */
  valorTotalVenda: number;
  /** Distribuição valor-por-lote (mesma ordem de `lotes`). Se omitido, divide igualmente. */
  valoresPorLote?: number[];
  /** Comissão padrão do corretor (%) — usada para lotes COMERCIAIS. */
  pctCorretor?: number;
}): ResultadoCalculo {
  const { lotes, valorTotalVenda, valoresPorLote, pctCorretor = 0 } = input;

  const residenciais = lotes.filter((l) => l.tipo === 'RESIDENCIAL').length;
  const comerciais = lotes.filter((l) => l.tipo === 'COMERCIAL').length;

  const valorFixoTotal = residenciais * COMISSAO_VALOR_FIXO_RESIDENCIAL;

  // Para o trecho comercial usamos o % do corretor sobre a soma dos valores
  // dos lotes COMERCIAIS (ou proporcional se não passou valoresPorLote).
  let valorComercial = 0;
  if (comerciais > 0 && pctCorretor > 0) {
    if (valoresPorLote && valoresPorLote.length === lotes.length) {
      const somaComercial = lotes.reduce(
        (s, l, i) => (l.tipo === 'COMERCIAL' ? s + valoresPorLote[i] : s),
        0
      );
      valorComercial = (somaComercial * pctCorretor) / 100;
    } else {
      // Sem distribuição informada → proporcional ao número de lotes comerciais
      const fatia = valorTotalVenda * (comerciais / lotes.length);
      valorComercial = (fatia * pctCorretor) / 100;
    }
  }

  const valor = Math.round((valorFixoTotal + valorComercial) * 100) / 100;
  const pctEquivalente =
    valorTotalVenda > 0 ? Math.round((valor / valorTotalVenda) * 10000) / 100 : null;

  return {
    valor,
    pctEquivalente,
    usaRegraFixa: residenciais > 0,
    qtdLotesResidenciais: residenciais,
    qtdLotesComerciais: comerciais,
  };
}

/**
 * Distribui um valor em N parcelas iguais, ajustando centavos na ÚLTIMA.
 *
 * Ex: 2500 / 4 = 625.00, 625.00, 625.00, 625.00
 *     1000 / 3 = 333.33, 333.33, 333.34 (ajuste na última)
 */
export function dividirEmParcelasIguais(valor: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((valor * 100) / n) / 100;
  const parcelas = Array(n).fill(base);
  const somado = base * n;
  const diferenca = Math.round((valor - somado) * 100) / 100;
  if (diferenca !== 0) {
    parcelas[n - 1] = Math.round((parcelas[n - 1] + diferenca) * 100) / 100;
  }
  return parcelas;
}

/**
 * Dado o conjunto de parcelas do cliente, decide quais parcelas devem ancorar
 * cada uma das 4 comissões (entrada + 3 primeiras mensais).
 *
 * Se faltar alguma (venda muito curta ou sem entrada), retorna `null` no slot.
 */
/**
 * Quando uma PARCELA DO CLIENTE é marcada como PAGO, chama esta função para
 * destravar as comissões vinculadas (status BLOQUEADA → LIBERADA).
 *
 * Idempotente: chamar 2× não causa efeito colateral. Apenas comissões
 * BLOQUEADAS são afetadas (PAGA/CANCELADA são preservadas).
 */
export async function liberarComissoesDaParcela(parcelaId: string): Promise<number> {
  const r = await prisma.comissaoParcela.updateMany({
    where: {
      parcelaClienteId: parcelaId,
      status: 'BLOQUEADA',
    },
    data: {
      status: 'LIBERADA',
      liberadaEm: new Date(),
    },
  });
  return r.count;
}

/**
 * Quando uma parcela do cliente é REABERTA (PAGO → PENDENTE) — caso raro,
 * mas existe via reabrirParcela — devolve as comissões liberadas (mas não
 * ainda pagas) para BLOQUEADA.
 */
export async function rebloquearComissoesDaParcela(
  parcelaId: string
): Promise<number> {
  const r = await prisma.comissaoParcela.updateMany({
    where: {
      parcelaClienteId: parcelaId,
      status: 'LIBERADA', // não mexer em PAGA — admin já pagou ao corretor
    },
    data: {
      status: 'BLOQUEADA',
      liberadaEm: null,
    },
  });
  return r.count;
}

/**
 * Quando uma venda é CANCELADA/DISTRATADA, cancela todas as comissões
 * que ainda não foram pagas ao corretor.
 */
export async function cancelarComissoesDaVenda(vendaId: string): Promise<number> {
  const r = await prisma.comissaoParcela.updateMany({
    where: {
      vendaId,
      status: { in: ['BLOQUEADA', 'LIBERADA'] },
    },
    data: { status: 'CANCELADA' },
  });
  return r.count;
}

export function escolherParcelasAncora(parcelas: Array<{
  id: string;
  tipo: string;
  numero: number;
}>): Array<string | null> {
  const entrada = parcelas.find((p) => p.tipo === 'ENTRADA') ?? null;
  const mensais = parcelas
    .filter((p) => p.tipo === 'MENSAL')
    .sort((a, b) => a.numero - b.numero);

  return [
    entrada?.id ?? mensais[0]?.id ?? null, // 1ª comissão
    mensais[0]?.id ?? null,                // 2ª comissão (1ª mensal)
    mensais[1]?.id ?? null,                // 3ª comissão (2ª mensal)
    mensais[2]?.id ?? null,                // 4ª comissão (3ª mensal)
  ];
}
