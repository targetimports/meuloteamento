'use client';

import { useState, useTransition } from 'react';

interface Props {
  vendaId: string;
  action: (vendaId: string, formData: FormData) => Promise<void>;
  qtdParcelasAbertas: number;
}

const INDICES = [
  { value: 'IPCA', label: 'IPCA — Inflação oficial' },
  { value: 'INPC', label: 'INPC' },
  { value: 'IGPM', label: 'IGP-M — Aluguéis e construção civil' },
  { value: 'CUB', label: 'CUB — Construção' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

export function ReajusteForm({ vendaId, action, qtdParcelasAbertas }: Props) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState('4.50');
  const [indice, setIndice] = useState('IPCA');
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.append('percentual', pct);
    fd.append('indice', indice);
    startTransition(async () => {
      try {
        await action(vendaId, fd);
      } catch (e) {
        alert((e as Error).message || 'Erro ao aplicar reajuste');
      }
    });
  }

  const pctNum = parseFloat(pct.replace(',', '.')) || 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-white hover:bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-lg transition"
      >
        % Reajustar parcelas
      </button>
    );
  }

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">Reajuste de parcelas</h3>
          <p className="text-xs text-slate-600">
            Aplica um percentual sobre {qtdParcelasAbertas} parcela(s) ainda em aberto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmando(false);
          }}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          Cancelar
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Índice</label>
          <select
            value={indice}
            onChange={(e) => setIndice(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          >
            {INDICES.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Percentual de reajuste
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="w-full pr-8 px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">%</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Negativo = desconto (ex: -2.5)
          </p>
        </div>
        <div className="flex items-end">
          <div className="bg-white border border-slate-200 rounded-lg p-2 w-full text-center">
            <p className="text-[10px] text-slate-500 uppercase">Fator multiplicador</p>
            <p className="text-lg font-bold text-amber-700">
              × {(1 + pctNum / 100).toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={qtdParcelasAbertas === 0 || pctNum === 0}
          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          Revisar e aplicar →
        </button>
      ) : (
        <div className="bg-white border border-amber-300 rounded-lg p-3">
          <p className="text-sm text-slate-800 mb-2">
            Confirmar: aplicar <strong>{pctNum > 0 ? '+' : ''}{pctNum.toFixed(2)}%</strong> ({indice})
            em <strong>{qtdParcelasAbertas} parcela(s)</strong>?
          </p>
          <p className="text-xs text-slate-600 mb-3">
            Parcelas pagas e canceladas não serão afetadas. A ação será registrada no histórico.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {pending ? 'Aplicando...' : 'Sim, aplicar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pending}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
