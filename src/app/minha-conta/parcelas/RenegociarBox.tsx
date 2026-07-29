'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  vendaId: string;
  parcelas: { id: string; numero: number; valor: string; vencimento: string }[];
}

export default function RenegociarBox({ vendaId, parcelas }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [datas, setDatas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    const novosVencimentos = Object.entries(datas)
      .filter(([_id, d]) => d)
      .map(([parcelaId, novaData]) => ({ parcelaId, novaData }));
    if (!novosVencimentos.length) {
      setErro('Informe ao menos uma nova data');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/cliente/renegociar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendaId, novosVencimentos }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErro(data.error ?? 'Erro');
        return;
      }
      router.refresh();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-amber-900">Renegociar parcelas atrasadas</h3>
          <p className="text-sm text-amber-800 mt-1">
            Você pode propor novas datas para as parcelas em atraso. Sua loteadora será notificada.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded"
        >
          {open ? 'Cancelar' : 'Renegociar'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-2">
          {parcelas.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 bg-white rounded p-3 border border-amber-100">
              <div className="text-sm font-medium text-slate-900">
                Parcela {p.numero} · {p.valor}
              </div>
              <input
                type="date"
                value={datas[p.id] ?? ''}
                onChange={(e) => setDatas((d) => ({ ...d, [p.id]: e.target.value }))}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              />
            </div>
          ))}
          {erro && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {erro}
            </div>
          )}
          <button
            onClick={enviar}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-medium px-4 py-2 rounded"
          >
            {loading ? 'Enviando...' : 'Enviar proposta'}
          </button>
        </div>
      )}
    </div>
  );
}
