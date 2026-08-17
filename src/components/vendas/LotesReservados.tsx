'use client';

/**
 * Lotes reservados, atrás de um botão.
 *
 * Antes era um bloco expansível no topo da página, ocupando uma faixa inteira
 * para dizer que existiam 37 reservas — informação que interessa quando se vai
 * cuidar delas, não toda vez que se abre a lista de vendas. O botão mostra a
 * contagem; o resto fica no modal.
 */

import { useState, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function LotesReservados({
  quantidade,
  children,
}: {
  quantidade: number;
  /** Os cartões, montados no servidor — eles carregam server actions dentro. */
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Lotes reservados ({quantidade})</DialogTitle>
          </DialogHeader>
          <p className="-mt-2 text-xs text-slate-500">
            Segurados internamente e fora da grade pública.
          </p>

          <div className="-mr-3 max-h-[70vh] overflow-y-auto overscroll-contain pr-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
