'use client';

import { cn } from '@/lib/utils';

/**
 * Controle segmentado — a troca de visão que fica sempre à vista.
 *
 * Diferente de um menu: as opções são visíveis o tempo todo, e a atual é
 * evidente sem abrir nada. Para uma escolha de duas ou três alternativas que a
 * pessoa alterna várias vezes ao dia, esconder atrás de um clique é atrito puro.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md bg-surface-soft p-0.5',
        className
      )}
      role="tablist"
    >
      {options.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={ativo}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-body-sm' : 'px-3 py-1.5 text-body',
              ativo
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
