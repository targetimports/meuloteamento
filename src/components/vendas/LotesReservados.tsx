'use client';

/**
 * Lotes reservados, atrás de um botão.
 *
 * Antes era um bloco expansível no topo da página, ocupando uma faixa inteira
 * para dizer que existiam 37 reservas — informação que interessa quando se vai
 * cuidar delas, não toda vez que se abre a lista de vendas. O botão mostra a
 * contagem; o resto fica no modal.
 *
 * As linhas chegam prontas do servidor: cada uma traz os botões de editar e
 * liberar, que são server actions. Paginar aqui é fatiar essa lista — daí o
 * Children.toArray, que dá um array estável mesmo quando o pai passa os filhos
 * como fragmento.
 */

import { Children, useState, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** A partir daqui a lista rola mais do que se lê. */
const POR_PAGINA = 20;

export function LotesReservados({
  quantidade,
  children,
}: {
  quantidade: number;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [pagina, setPagina] = useState(1);

  const linhas = Children.toArray(children);
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = linhas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  if (quantidade === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Lotes reservados
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
          {quantidade}
        </span>
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Lotes reservados ({quantidade})</DialogTitle>
          </DialogHeader>
          <p className="-mt-2 text-xs text-slate-500">
            Segurados internamente e fora da grade pública.
          </p>

          <div className="-mr-3 max-h-[65vh] overflow-y-auto overscroll-contain pr-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Lote</th>
                    <th className="px-4 py-2.5 text-left font-medium">Loteamento</th>
                    <th className="px-4 py-2.5 text-right font-medium">Preço</th>
                    <th className="px-4 py-2.5 text-left font-medium">Reservado</th>
                    <th className="px-4 py-2.5 text-left font-medium">Motivo</th>
                    <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visiveis}</tbody>
              </table>
            </div>
          </div>

          {totalPaginas > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500">
                {(paginaAtual - 1) * POR_PAGINA + 1}–
                {(paginaAtual - 1) * POR_PAGINA + visiveis.length} de {linhas.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual - 1)}
                  disabled={paginaAtual === 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-2 text-xs text-slate-500">
                  {paginaAtual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual + 1)}
                  disabled={paginaAtual === totalPaginas}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
