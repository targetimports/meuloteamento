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
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={importar}
        disabled={busy}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-medium px-3 py-2 rounded"
      >
        {busy ? 'Importando...' : 'Importar modelo Parque Tucano'}
      </button>
      {msg && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            msg.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.texto}
        </div>
      )}
    </div>
  );
}
