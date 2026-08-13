/**
 * Converte os parâmetros do simulador guardados no loteamento em props do
 * componente.
 *
 * Vive aqui, e não dentro de uma das páginas, porque o simulador aparece em
 * DOIS lugares: a landing do loteamento (/[slug]) e a página dedicada
 * (/simulador/[slug]). Na primeira versão liguei só a segunda — a loteadora
 * configurou os tipos, abriu a landing e não viu mudança nenhuma. Com a
 * conversão em um lugar só, esquecer uma das pontas passa a ser esquecer de
 * chamar uma função, não de repetir vinte linhas.
 */

/** Campos que as duas páginas precisam selecionar do loteamento. */
export const SELECT_SIMULADOR = {
  simPrecoResidencial: true,
  simPrecoComercial: true,
  simEntradaMinima: true,
  simParcelas: true,
  simValorParcela: true,
  simEntradasSugeridas: true,
  simuladorTipos: {
    where: { ativo: true },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
  },
} as const;

interface LoteamentoComSimulador {
  simPrecoResidencial?: unknown;
  simPrecoComercial?: unknown;
  simEntradaMinima?: unknown;
  simParcelas?: number | null;
  simValorParcela?: unknown;
  simEntradasSugeridas?: unknown;
  simuladorTipos?: unknown[];
}

export function paramsSimulador(l: LoteamentoComSimulador) {
  // Decimal do Prisma não atravessa para Client Component; vira number aqui,
  // onde ainda é servidor.
  const n = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

  return {
    tiposLote: l.simuladorTipos?.map((t) => {
      const x = t as Record<string, unknown>;
      return {
        id: String(x.id),
        nome: String(x.nome),
        descricao: (x.descricao as string | null) ?? null,
        preco: Number(x.preco),
        entradaMinima: Number(x.entradaMinima),
        parcelas: Number(x.parcelas),
        valorParcela: Number(x.valorParcela),
        entradasSugeridas: Array.isArray(x.entradasSugeridas)
          ? (x.entradasSugeridas as number[])
          : null,
        simulavel: Boolean(x.simulavel),
        ativo: Boolean(x.ativo),
      };
    }),
    precoResidencial: n(l.simPrecoResidencial),
    precoComercial: n(l.simPrecoComercial),
    entradaMinima: n(l.simEntradaMinima),
    parcelas: l.simParcelas ?? undefined,
    valorParcelaPadrao: n(l.simValorParcela),
    entradasSugeridas: Array.isArray(l.simEntradasSugeridas)
      ? (l.simEntradasSugeridas as number[])
      : undefined,
  };
}
