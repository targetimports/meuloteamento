/**
 * Componentes visuais do dashboard (SVG inline, server-friendly).
 */

import { formatBRL } from '@/lib/format';

// =====================================================================
// GAUGE — % vendido do loteamento (donut chart)
// =====================================================================

export function GaugeVendidos({
  totalLotes,
  vendidos,
  reservados,
  corPrimaria = '#0ea5e9',
}: {
  totalLotes: number;
  vendidos: number;
  reservados: number;
  corPrimaria?: string;
}) {
  const disponiveis = Math.max(0, totalLotes - vendidos - reservados);
  const pct = totalLotes > 0 ? (vendidos / totalLotes) * 100 : 0;

  const r = 70;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;

  // Segmentos (em ordem: vendidos, reservados, disponíveis)
  const fracVendidos = vendidos / Math.max(1, totalLotes);
  const fracReservados = reservados / Math.max(1, totalLotes);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
          Velocímetro do loteamento
        </p>
      </div>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 180 180" className="w-44 h-44 -rotate-90 flex-shrink-0">
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="18"
          />
          {/* vendidos */}
          {vendidos > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={corPrimaria}
              strokeWidth="18"
              strokeDasharray={`${fracVendidos * circ} ${circ}`}
              strokeLinecap="round"
            />
          )}
          {/* reservados */}
          {reservados > 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="18"
              strokeDasharray={`${fracReservados * circ} ${circ}`}
              strokeDashoffset={-fracVendidos * circ}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="flex-1">
          <p className="text-4xl font-bold" style={{ color: corPrimaria }}>
            {pct.toFixed(1)}%
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">vendidos</p>
          <div className="space-y-1.5 text-xs">
            <Legend dot={corPrimaria} label="Vendidos" value={vendidos} total={totalLotes} />
            <Legend dot="#f59e0b" label="Reservados" value={reservados} total={totalLotes} />
            <Legend dot="#cbd5e1" label="Disponíveis" value={disponiveis} total={totalLotes} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({
  dot,
  label,
  value,
  total,
}: {
  dot: string;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-semibold ml-auto">
        {value}
        <span className="text-slate-400 text-[10px] ml-1">{pct}%</span>
      </span>
    </div>
  );
}

// =====================================================================
// BAR CHART — receita mensal últimos 6 meses
// =====================================================================

interface BarMonth {
  label: string; // "Jan", "Fev"...
  recebido: number;
  pendente: number;
}

export function ReceitaMensalChart({
  meses,
  corPrimaria = '#0ea5e9',
}: {
  meses: BarMonth[];
  corPrimaria?: string;
}) {
  const max = Math.max(1, ...meses.map((m) => m.recebido + m.pendente));
  const totalRecebido = meses.reduce((a, m) => a + m.recebido, 0);

  const W = 600;
  const H = 200;
  const padL = 50;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slotW = innerW / Math.max(1, meses.length);
  const barW = slotW * 0.5;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Receita — últimos 6 meses
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {formatBRL(totalRecebido)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">recebido no período</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: corPrimaria }} />
            <span className="text-slate-600 dark:text-slate-300">Recebido</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700" />
            <span className="text-slate-600 dark:text-slate-300">Previsto</span>
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = padT + innerH * (1 - f);
          return (
            <g key={f}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text x={padL - 8} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
                {f === 0 ? '0' : `${((max * f) / 1000).toFixed(0)}k`}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {meses.map((m, i) => {
          const x = padL + slotW * i + (slotW - barW) / 2;
          const total = m.recebido + m.pendente;
          const totalH = (total / max) * innerH;
          const recebidoH = (m.recebido / max) * innerH;
          const yTotal = padT + innerH - totalH;
          const yRecebido = padT + innerH - recebidoH;
          return (
            <g key={i}>
              {/* previsto (pendente, em cinza) */}
              {m.pendente > 0 && (
                <rect
                  x={x}
                  y={yTotal}
                  width={barW}
                  height={totalH - recebidoH}
                  className="fill-slate-200 dark:fill-slate-700"
                  rx="3"
                />
              )}
              {/* recebido */}
              {m.recebido > 0 && (
                <rect x={x} y={yRecebido} width={barW} height={recebidoH} fill={corPrimaria} rx="3" />
              )}
              {/* label */}
              <text
                x={x + barW / 2}
                y={H - padB + 18}
                fontSize="11"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// =====================================================================
// AGING — Inadimplência por faixa
// =====================================================================

interface AgingBucket {
  label: string;
  count: number;
  total: number;
}

export function AgingInadimplencia({ buckets }: { buckets: AgingBucket[] }) {
  const totalGeral = buckets.reduce((a, b) => a + b.total, 0);
  const colors = ['#fbbf24', '#fb923c', '#f87171', '#dc2626'];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Aging de inadimplência
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-0.5">
            {formatBRL(totalGeral)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {buckets.reduce((a, b) => a + b.count, 0)} parcela(s) em atraso
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {buckets.map((b, i) => {
          const pct = totalGeral > 0 ? (b.total / totalGeral) * 100 : 0;
          return (
            <div key={b.label}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{b.label}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatBRL(b.total)}
                  </span>{' '}
                  · {b.count}
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: colors[i] ?? colors[colors.length - 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
