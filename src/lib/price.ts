/**
 * Matemática do sistema Price — a mesma para o simulador público e para o
 * lançamento de venda no admin.
 *
 * Vive aqui porque as duas telas precisam concordar. Enquanto as funções eram
 * privadas do simulador, a tela de venda não tinha como mostrar a taxa que o
 * cliente viu na landing, e a única forma de comparar era refazer a conta à
 * mão. Duas cópias da mesma fórmula divergem no dia em que alguém ajusta uma.
 */

/** PMT do sistema Price: parcela fixa que amortiza `pv` em `n` vezes à taxa `i`. */
export function pmtPrice(pv: number, i: number, n: number): number {
  if (n <= 0) return 0;
  if (i === 0) return pv / n;
  return (pv * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

/**
 * Taxa mensal embutida numa condição, por bisseção.
 *
 * Não há fórmula fechada para isolar `i` no Price — daí a busca. O intervalo
 * começa em 0 porque taxa negativa não existe aqui: uma parcela que nem paga o
 * principal é erro de cadastro, não juro negativo, e devolver 0 deixa isso
 * visível em vez de inventar um número.
 */
export function descobrirTaxaPrice(pv: number, pmt: number, n: number): number {
  if (pv <= 0 || pmt <= 0 || n <= 0) return 0;
  if (pmt * n <= pv) return 0;

  let lo = 0;
  let hi = 0.5;
  let mid = 0;
  for (let k = 0; k < 200; k++) {
    mid = (lo + hi) / 2;
    if (pmtPrice(pv, mid, n) > pmt) hi = mid;
    else lo = mid;
  }
  return mid;
}
