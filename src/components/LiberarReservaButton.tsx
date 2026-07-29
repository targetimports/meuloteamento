'use client';

import { useTransition } from 'react';

export function LiberarReservaButton({
  action,
  loteId,
  loteCodigo,
}: {
  action: (loteId: string, motivo?: string) => Promise<void>;
  loteId: string;
  loteCodigo: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Liberar a reserva do lote ${loteCodigo}? Ele volta para DISPONÍVEL.`))
      return;
    startTransition(async () => {
      try {
        await action(loteId);
      } catch (e) {
        alert((e as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium px-2.5 py-1 rounded disabled:opacity-50"
    >
      {pending ? '...' : '↺ Liberar'}
    </button>
  );
}
