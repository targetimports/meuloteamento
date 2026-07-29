'use client';

interface Props {
  statusDesde: string | Date;
  slaHoras?: number | null;
}

function horasDesde(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
}

export default function LeadSLA({ statusDesde, slaHoras }: Props) {
  const desde = typeof statusDesde === 'string' ? new Date(statusDesde) : statusDesde;
  const h = horasDesde(desde);
  const limite = slaHoras ?? 24;

  let label: string;
  if (h < 1) label = 'agora';
  else if (h < 24) label = `${h}h`;
  else label = `${Math.floor(h / 24)}d`;

  const pct = Math.min(1, h / limite);
  const cor =
    pct < 0.5
      ? 'bg-emerald-500'
      : pct < 0.85
        ? 'bg-amber-500'
        : 'bg-red-500';

  const tooltip = `${h}h no status atual. SLA: ${limite}h.`;

  return (
    <div className="flex items-center gap-1.5" title={tooltip}>
      <span className={`w-1.5 h-1.5 rounded-full ${cor}`} />
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}
