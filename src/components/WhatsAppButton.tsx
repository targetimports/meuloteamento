'use client';

import { IconWhatsApp } from './icons';

interface Props {
  telefone: string;
  message: string;
  label?: string;
  variant?: 'icon' | 'pill' | 'full';
}

/**
 * Botão WhatsApp — abre wa.me com mensagem pré-pronta.
 * - 'icon': só o ícone redondo verde (atomic)
 * - 'pill': pílula verde compacta com texto
 * - 'full': botão CTA cheio
 */
export function WhatsAppButton({ telefone, message, label = 'WhatsApp', variant = 'pill' }: Props) {
  // Normaliza telefone — só dígitos, prefixa 55 se não tiver
  const digits = (telefone || '').replace(/\D/g, '');
  if (!digits) return null;
  const tel = digits.startsWith('55') ? digits : `55${digits}`;
  const href = `https://wa.me/${tel}?text=${encodeURIComponent(message)}`;

  if (variant === 'icon') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={`Abrir WhatsApp — ${label}`}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition"
        onClick={(e) => e.stopPropagation()}
      >
        <IconWhatsApp className="w-4 h-4" />
      </a>
    );
  }

  if (variant === 'full') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
      >
        <IconWhatsApp className="w-4 h-4" />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Enviar WhatsApp — ${label}`}
      className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded transition"
      onClick={(e) => e.stopPropagation()}
    >
      <IconWhatsApp className="w-3.5 h-3.5" />
      <span>{label}</span>
    </a>
  );
}
