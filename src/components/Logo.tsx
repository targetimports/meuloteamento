/**
 * Logo do meuloteamento.
 * Grid 3x3 de "lotes" — um deles destacado (o lote escolhido pelo cliente).
 * A diagonal de tonalidades dá profundidade. Funciona em fundo claro e escuro.
 */
export function LogoMark({
  size = 32,
  variant = 'auto',
  className,
}: {
  size?: number;
  variant?: 'auto' | 'light' | 'dark';
  className?: string;
}) {
  const baseColor =
    variant === 'light' ? '#ffffff' : variant === 'dark' ? '#0c4a6e' : 'currentColor';
  const accentColor = '#38bdf8';

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-label="meuloteamento"
      role="img"
    >
      <defs>
        <linearGradient id="lm-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* primeira linha */}
      <rect x="3" y="3" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.35" />
      <rect x="18" y="3" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.55" />
      <rect x="33" y="3" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.35" />
      {/* segunda linha (centro destacado) */}
      <rect x="3" y="18" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.55" />
      <rect
        x="17"
        y="17"
        width="14"
        height="14"
        rx="3"
        fill="url(#lm-accent)"
      />
      <rect x="33" y="18" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.55" />
      {/* terceira linha */}
      <rect x="3" y="33" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.35" />
      <rect x="18" y="33" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.55" />
      <rect x="33" y="33" width="12" height="12" rx="2.5" fill={baseColor} opacity="0.35" />
    </svg>
  );
}

export function Logo({
  variant = 'dark',
  size = 28,
  className,
}: {
  variant?: 'light' | 'dark';
  size?: number;
  className?: string;
}) {
  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  return (
    <div className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} variant={variant} />
      <span className={`font-bold tracking-tight ${textColor}`} style={{ fontSize: size * 0.7 }}>
        meu<span className="text-primary-500">loteamento</span>
      </span>
    </div>
  );
}
