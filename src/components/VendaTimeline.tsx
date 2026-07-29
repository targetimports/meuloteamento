/**
 * Timeline visual de eventos de uma venda.
 * Server component — recebe eventos já calculados.
 */

import { formatDateTime } from '@/lib/format';

export interface TimelineEvent {
  data: Date;
  tipo: 'criada' | 'pago' | 'reaberta' | 'reservada' | 'distratada' | 'quitada' | 'lote_status';
  titulo: string;
  descricao?: string;
}

const TIPO_CONFIG: Record<TimelineEvent['tipo'], { cor: string; bg: string; icone: string }> = {
  criada: {
    cor: 'text-primary-700',
    bg: 'bg-primary-100',
    icone: '📝',
  },
  pago: {
    cor: 'text-emerald-700',
    bg: 'bg-emerald-100',
    icone: '✓',
  },
  reaberta: {
    cor: 'text-amber-700',
    bg: 'bg-amber-100',
    icone: '↺',
  },
  reservada: {
    cor: 'text-amber-700',
    bg: 'bg-amber-100',
    icone: '⏳',
  },
  distratada: {
    cor: 'text-red-700',
    bg: 'bg-red-100',
    icone: '✕',
  },
  quitada: {
    cor: 'text-emerald-800',
    bg: 'bg-emerald-200',
    icone: '★',
  },
  lote_status: {
    cor: 'text-slate-600',
    bg: 'bg-slate-100',
    icone: '◉',
  },
};

export function VendaTimeline({ eventos }: { eventos: TimelineEvent[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">Sem eventos registrados ainda.</p>
    );
  }

  // Ordem cronológica decrescente — mais recente em cima
  const ordenados = [...eventos].sort((a, b) => b.data.getTime() - a.data.getTime());

  return (
    <ol className="relative ms-3 border-s-2 border-slate-200 space-y-5 pt-1">
      {ordenados.map((ev, i) => {
        const cfg = TIPO_CONFIG[ev.tipo];
        return (
          <li key={i} className="ms-6">
            <span
              className={`absolute -start-[14px] flex items-center justify-center w-7 h-7 rounded-full ring-4 ring-white ${cfg.bg} ${cfg.cor} font-bold text-sm`}
            >
              {cfg.icone}
            </span>
            <div className="ml-1">
              <p className="text-sm font-semibold text-slate-900">{ev.titulo}</p>
              {ev.descricao && (
                <p className="text-xs text-slate-600 mt-0.5">{ev.descricao}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(ev.data)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
