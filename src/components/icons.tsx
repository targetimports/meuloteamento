/**
 * Ícones SVG (stroke-based, Heroicons style) para as seções de feature.
 */

type Props = { className?: string };

const base = 'w-7 h-7 stroke-2';

export function IconLock({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V8a4 4 0 1 0-8 0v4m-2 0h12v8H6v-8Z" />
    </svg>
  );
}

export function IconBrand({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </svg>
  );
}

export function IconPayment({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="13" rx="2" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h4" />
    </svg>
  );
}

export function IconDashboard({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v8H4V4Zm10 0h6v5h-6V4ZM4 15h6v5H4v-5Zm10-4h6v9h-6v-9Z" />
    </svg>
  );
}

export function IconUsers({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 1 0-4-4m4 4a4 4 0 1 1-4 4m4-4H8m8 0v6M8 11a4 4 0 0 1 4-4m-4 4a4 4 0 0 0 4 4m-4-4v6m12 4H4v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2Z" />
    </svg>
  );
}

export function IconChart({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17V7m4 10v-6m4 6V9m4 8v-4m4 4V5" />
    </svg>
  );
}

export function IconMap({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 20-6-2V4l6 2 6-2 6 2v14l-6-2-6 2Zm0 0V6m6 14V6" />
    </svg>
  );
}

export function IconBolt({ className }: Props) {
  return (
    <svg className={`${base} ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function IconCheck({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconX({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function IconArrowRight({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0-5 5m5-5H6" />
    </svg>
  );
}

export function IconSpark({ className }: Props) {
  return (
    <svg className={`w-4 h-4 ${className ?? ''}`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2z" />
    </svg>
  );
}

// Ícones para as razões "Por que investir" e "Infraestrutura"

export function IconTrendingUp({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17 9 11l4 4 8-8m0 0h-5m5 0v5" />
    </svg>
  );
}

export function IconHomeTree({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12 12 4l9 8M5 10v10h6v-6h2v6h6V10" />
    </svg>
  );
}

export function IconShieldCheck({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconPeople({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconRoad({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l-2 18h18L19 3 M12 7v2M12 13v2M12 19v0" />
    </svg>
  );
}

export function IconLamp({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6m-3 0v3 M9 6a3 3 0 1 1 6 0c0 2-3 3-3 6h-0c0-3-3-4-3-6Z" />
    </svg>
  );
}

export function IconStore({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V7l2-4h14l2 4v2a3 3 0 1 1-6 0 3 3 0 1 1-6 0 3 3 0 1 1-6 0Z M5 12v9h14v-9 M10 21v-5h4v5" />
    </svg>
  );
}

export function IconPin({ className }: Props) {
  return (
    <svg className={`w-9 h-9 stroke-[1.6] ${className ?? ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-8 8-13a8 8 0 0 0-16 0c0 5 8 13 8 13Z M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  );
}

export function IconBadge({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4 M12 2 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
    </svg>
  );
}

export function IconInstagram({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ===========================================================================
// Ícones do painel admin (sidebar). Tamanho 5 e stroke 1.7 — leves, modernos.
// ===========================================================================

const navBase = 'w-5 h-5';

export function NavDashboard({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13a9 9 0 1 1 18 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 13l4-4" />
      <circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NavBuilding({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 9h3a2 2 0 0 1 2 2v10M4 21h16M8 7h3M8 11h3M8 15h3M17 13h0M17 17h0" />
    </svg>
  );
}

export function NavHomes({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11 9 6l5 4M3 11v9h6v-5h2v5h3v-9M14 10l5-4 3 4v8h-7" />
    </svg>
  );
}

export function NavUsers({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function NavBriefcase({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20" />
    </svg>
  );
}

export function NavInbox({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  );
}

/** Balao de conversa — o menu do WhatsApp. */
export function NavChat({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

/** Funil — o menu do CRM. */
export function NavFunil({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" />
    </svg>
  );
}

export function NavDoc({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M9 13h6M9 17h6M9 9h2" />
    </svg>
  );
}

export function NavMoney({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function NavSettings({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
    </svg>
  );
}

export function NavLogout({ className }: Props) {
  return (
    <svg className={`${navBase} ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconWhatsApp({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );
}

/** Marca do Pix (Banco Central). Herda a cor do texto para caber em qualquer botão. */
export function IconPix({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="currentColor" viewBox="0 0 512 512" aria-hidden>
      <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.4 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C256.1 224.4 247.9 224.5 242.4 218.9L165.7 142.2C151.5 128 132.6 120.2 112.6 120.2H103.4L200.8 22.8C231.1-7.6 280.3-7.6 310.6 22.8L407.8 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.6L149.7 353.3C139.1 363.1 126.4 368.7 112.6 368.7H80.9L22.8 310.6C-7.6 280.3-7.6 231.1 22.8 200.8L80.9 142.7H112.6z" />
    </svg>
  );
}

export function IconCalc({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h6" />
    </svg>
  );
}

export function IconClose({ className }: Props) {
  return (
    <svg className={`w-5 h-5 ${className ?? ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
