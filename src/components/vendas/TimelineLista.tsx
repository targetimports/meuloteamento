'use client';

/**
 * Lista paginada do histórico da venda.
 *
 * Uma venda antiga acumula dezenas de eventos — cada parcela paga entra aqui.
 * A lista inteira empurrava o resto da página para longe, então mostra 10 por
 * vez, do mais recente para o mais antigo.
 */

import { useState } from 'react';

export interface TimelineItem {
  tipo: 'criada' | 'pago' | 'reaberta' | 'reservada' | 'distratada' | 'quitada' | 'lote_status';
  titulo: string;
  descricao: string | null;
  /** Já formatada no servidor. */
  dataLabel: string;
}

/** Marcadores em SVG: o emoji mudava de desenho conforme o sistema de quem via. */
function Marcador({ tipo }: { tipo: TimelineItem['tipo'] }) {
  const traco = 'h-3.5 w-3.5';
  const svg = {
    criada: (
      <svg className={traco} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 13h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l4 4v12a2 2 0 0 1-2 2Z"
        />
      </svg>
    ),
    pago: (
      <svg className={traco} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
      </svg>
    ),
    reaberta: (
      <svg className={traco} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h5M20 20v-5h-5M20 9A8 8 0 0 0 6 6M4 15a8 8 0 0 0 14 3"
        />
      </svg>
    ),
    reservada: (
      <svg className={traco} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
      </svg>
    ),
    distratada: (
      <svg className={traco} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
      </svg>
    ),
    quitada: (
      <svg className={traco} fill="currentColor" viewBox="0 0 24 24">
        <path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8L12 3.5Z" />
      </svg>
    ),
    lote_status: (
      <svg className={traco} fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" />
      </svg>
    ),
  }[tipo];

  const cor = {
    criada: 'bg-primary-100 text-primary-700',
    pago: 'bg-emerald-100 text-emerald-700',
    reaberta: 'bg-amber-100 text-amber-700',
    reservada: 'bg-amber-100 text-amber-700',
    distratada: 'bg-red-100 text-red-700',
    quitada: 'bg-emerald-100 text-emerald-800',
    lote_status: 'bg-slate-100 text-slate-500',
  }[tipo];

  return (
    <span
      className={`absolute -start-[15px] flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${cor}`}
      aria-hidden
    >
      {svg}
    </span>
  );
}

const POR_PAGINA = 10;

export function TimelineLista({ itens }: { itens: TimelineItem[] }) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = itens.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div className="space-y-4">
      <ol className="relative ms-3 space-y-5 border-s-2 border-slate-200 pt-1">
        {daPagina.map((ev, i) => (
          <li key={`${paginaAtual}-${i}`} className="ms-6">
            <Marcador tipo={ev.tipo} />
            <div className="ml-1">
              <p className="text-sm font-medium text-slate-900">{ev.titulo}</p>
              {ev.descricao && <p className="mt-0.5 text-xs text-slate-600">{ev.descricao}</p>}
              <p className="mt-0.5 text-[11px] text-slate-400">{ev.dataLabel}</p>
            </div>
          </li>
        ))}
      </ol>

      {itens.length > POR_PAGINA && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {itens.length} eventos
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
    </div>
  );
}
