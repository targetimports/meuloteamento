'use client';

import { useTransition } from 'react';

interface Props {
  parcelaId: string;
  action: (parcelaId: string) => Promise<void>;
  label: string;
  confirmMsg: string;
  variant?: 'primary' | 'subtle';
}

export function ParcelaActionButton({
  parcelaId,
  action,
  label,
  confirmMsg,
  variant = 'primary',
}: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(confirmMsg)) return;
    startTransition(async () => {
      try {
        await action(parcelaId);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Falha');
      }
    });
  }

  const base =
    variant === 'primary'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : 'bg-slate-100 hover:bg-slate-200 text-slate-700';

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`${base} disabled:opacity-50 text-xs font-medium px-2.5 py-1.5 rounded-md transition`}
    >
      {pending ? '...' : label}
    </button>
  );
}
