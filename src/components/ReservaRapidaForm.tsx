'use client';

/**
 * Modal de reserva rápida (admin) — segura um lote sem dados do cliente.
 *
 * Recebe lista pré-filtrada de lotes disponíveis e a action server-side.
 */

import { useMemo, useState, useTransition } from 'react';

export interface LoteOption {
  id: string;
  codigo: string;
  quadra: string;
  area: number;
  preco: number;
  tipo: 'RESIDENCIAL' | 'COMERCIAL';
  loteamentoNome: string;
}

interface Props {
  lotes: LoteOption[];
  action: (formData: FormData) => Promise<void>;
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function ReservaRapidaForm({ lotes, action }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [loteId, setLoteId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dias, setDias] = useState(7);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lotes.slice(0, 30);
    return lotes
      .filter((l) =>
        `${l.codigo} ${l.quadra} ${l.loteamentoNome}`.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [lotes, busca]);

  const selecionado = lotes.find((l) => l.id === loteId);

  function submit() {
    setErro(null);
    if (!loteId) {
      setErro('Selecione um lote');
      return;
    }
    const fd = new FormData();
    fd.append('loteId', loteId);
    fd.append('motivo', motivo);
    fd.append('dias', String(dias));
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
        setLoteId('');
        setMotivo('');
        setBusca('');
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
      >
        Reservar lote
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !pending && setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reserva interna do lote</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Marca o lote como RESERVADO sem precisar de dados do cliente. Use para segurar
              durante negociação offline.
            </p>
          </div>
          <button
            onClick={() => !pending && setOpen(false)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {erro && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300">
            {erro}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Buscar lote disponível
            </label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, quadra ou loteamento"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-60 overflow-y-auto bg-white dark:bg-slate-800">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">
                {busca ? 'Nenhum lote bate com a busca.' : 'Nenhum lote disponível.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((l) => {
                  const active = loteId === l.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setLoteId(l.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition flex items-center justify-between gap-2 ${
                          active ? 'bg-primary-50 dark:bg-primary-500/15' : ''
                        }`}
                      >
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {l.codigo}{' '}
                            {l.tipo === 'COMERCIAL' && (
                              <span className="text-[10px] px-1 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded font-semibold">
                                COMERCIAL
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Quadra {l.quadra} · {l.area.toFixed(0)}m² · {l.loteamentoNome}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{brl(l.preco)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selecionado && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-2 text-xs text-emerald-800 dark:text-emerald-300">
              Lote selecionado: <strong>{selecionado.codigo}</strong> ({brl(selecionado.preco)})
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Duração da reserva
            </label>
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className={`w-full px-3 py-2 text-sm border rounded-lg ${
                dias === 0
                  ? 'border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/15 font-semibold text-violet-800 dark:text-violet-200'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
              }`}
            >
              <option value={1}>1 dia</option>
              <option value={3}>3 dias</option>
              <option value={7}>7 dias (padrão)</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
              <option value={365}>1 ano</option>
              <option value={0}>Ilimitado / sem prazo</option>
            </select>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {dias === 0 ? (
                <span className="text-violet-700 dark:text-violet-300 font-medium">
                  O lote ficará RESERVADO indefinidamente até que você o libere manualmente
                  ou crie uma venda nele.
                </span>
              ) : (
                'O sistema não libera automaticamente — depois do prazo você precisa liberar manualmente ou criar a venda.'
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Motivo / observação (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex: Negociando com cliente João via WhatsApp. Confirmar até dia 20."
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={() => !pending && setOpen(false)}
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !loteId}
            className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reservando...
              </>
            ) : (
              <>Confirmar reserva</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
