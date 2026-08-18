'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { importarTemplateParqueTucano } from './actions';

export default function ImportarParqueTucanoBtn() {
  const [busy, start] = useTransition();
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  function importar() {
    if (!confirm('Importar o modelo oficial Parque Tucano? Será marcado como padrão da loteadora.')) return;
    start(async () => {
      try {
        const r = await importarTemplateParqueTucano({ setDefault: true });
        setMsg({
          tipo: 'ok',
          texto: r.atualizado ? 'Modelo atualizado' : 'Modelo importado e marcado como padrão',
        });
        router.push(`/admin/contratos/${r.templateId}`);
      } catch (e) {
        setMsg({ tipo: 'erro', texto: (e as Error).message });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={importar}
        disabled={busy}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? 'Importando…' : 'Importar modelo Parque Tucano'}
      </button>
      {msg && (
        <div
          className={`rounded-lg border px-2 py-1 text-xs ${
            msg.tipo === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.texto}
        </div>
      )}
    </div>
  );
}
