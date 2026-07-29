'use client';

import { useState, useTransition } from 'react';
import {
  sincronizarPagamentosManual,
  type SyncManualResult,
} from '@/app/admin/(dashboard)/financeiro/actions';

export function SincronizarAsaasButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncManualResult | null>(null);
  const [modo, setModo] = useState<'quick' | 'full'>('quick');

  function rodar() {
    startTransition(async () => {
      const r = await sincronizarPagamentosManual(modo);
      setResult(r);
    });
  }

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <select
          value={modo}
          onChange={(e) => setModo(e.target.value as 'quick' | 'full')}
          disabled={pending}
          className="text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          title="Quick: só checa parcelas com paymentId. Full: também varre últimos 30 dias no Asaas."
        >
          <option value="quick">Quick (rápido)</option>
          <option value="full">Full (30 dias)</option>
        </select>
        <button
          type="button"
          onClick={rodar}
          disabled={pending}
          className="px-3 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg inline-flex items-center gap-1.5"
          title="Consulta o Asaas e detecta pagamentos que ainda não vieram pelo webhook"
        >
          {pending ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Sincronizando…
            </>
          ) : (
            <>🔄 Sincronizar Asaas</>
          )}
        </button>
      </div>

      {result && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-sky-600 dark:text-sky-400 font-semibold">
                    Sincronização Asaas
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {result.ok
                      ? `${result.totalAtualizacoes} atualização(ões) aplicada(s)`
                      : 'Falha na sincronização'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Modo: <strong>{modo}</strong> · Duração:{' '}
                    {(result.duracaoMs / 1000).toFixed(1)}s
                    {result.totalErros > 0 && (
                      <> · Erros: {result.totalErros}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  ✕
                </button>
              </div>

              {result.error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3 mb-3">
                  {result.error}
                </div>
              )}

              {result.resumo.length === 0 && result.ok && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Nada para atualizar. Tudo sincronizado.
                </p>
              )}

              {result.resumo.map((r, i) => (
                <div
                  key={i}
                  className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {r.loteadora}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {r.verificadas} verificadas · {r.atualizadas} atualizadas
                      {r.erros > 0 && (
                        <span className="text-red-600 dark:text-red-400 ml-1">
                          · {r.erros} erro(s)
                        </span>
                      )}
                    </span>
                  </div>
                  {r.detalhes.length > 0 && (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                      {r.detalhes.map((d, j) => (
                        <li
                          key={j}
                          className="px-3 py-1.5 flex items-center gap-2 font-mono"
                        >
                          <span
                            className={
                              d.acao === 'PAGO'
                                ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                : d.acao === 'REFUNDED'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {d.acao}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {d.statusLocal} → {d.statusAsaas}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 ml-auto">
                            {d.paymentId}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
