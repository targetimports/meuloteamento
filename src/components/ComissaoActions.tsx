'use client';

import { useState, useTransition } from 'react';
import {
  pagarComissao,
  estornarComissao,
  liberarManual,
} from '@/app/admin/(dashboard)/comissoes/actions';

interface ContaOption {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  comissaoId: string;
  status: 'BLOQUEADA' | 'LIBERADA' | 'PAGA' | 'CANCELADA';
  valorSugerido: number;
  contas: ContaOption[];
}

export function ComissaoActions({ comissaoId, status, valorSugerido, contas }: Props) {
  const [modal, setModal] = useState<null | 'pagar' | 'liberar'>(null);
  const [pending, startTransition] = useTransition();

  function submitPagar(formData: FormData) {
    startTransition(async () => {
      try {
        await pagarComissao(comissaoId, formData);
        setModal(null);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha ao pagar comissão');
      }
    });
  }

  function submitLiberar(formData: FormData) {
    formData.set('comissaoId', comissaoId);
    startTransition(async () => {
      try {
        await liberarManual(formData);
        setModal(null);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha ao liberar');
      }
    });
  }

  function estornar() {
    if (!confirm('Estornar esta comissão paga? Vai voltar para LIBERADA.')) return;
    startTransition(async () => {
      try {
        await estornarComissao(comissaoId);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha ao estornar');
      }
    });
  }

  return (
    <>
      <div className="inline-flex gap-1 items-center justify-end flex-wrap">
        {status === 'LIBERADA' && (
          <button
            type="button"
            onClick={() => setModal('pagar')}
            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
          >
            Pagar
          </button>
        )}
        {status === 'BLOQUEADA' && (
          <>
            <button
              type="button"
              onClick={() => setModal('liberar')}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Forçar liberação mesmo sem o cliente ter pagado"
            >
              Liberar
            </button>
            <button
              type="button"
              onClick={() => setModal('pagar')}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
              title="Pagar agora (libera + paga em um único passo)"
            >
              Pagar
            </button>
          </>
        )}
        {status === 'PAGA' && (
          <button
            type="button"
            onClick={estornar}
            disabled={pending}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Estornar
          </button>
        )}
      </div>

      {/* Modal Pagar */}
      {modal === 'pagar' && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !pending && setModal(null)}
        >
          <form
            action={submitPagar}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
              Pagar comissão ao corretor
            </h2>

            <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Conta de saída
            </label>
            <select
              name="contaId"
              required
              className="w-full px-3 py-2 mb-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
            >
              <option value="">Selecione…</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.tipo})
                </option>
              ))}
            </select>

            <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Valor pago (R$)
            </label>
            <input
              name="valorPago"
              type="number"
              step="0.01"
              min="0"
              defaultValue={valorSugerido.toFixed(2)}
              required
              className="w-full px-3 py-2 mb-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
            />

            <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Observação (opcional)
            </label>
            <textarea
              name="observacoes"
              rows={2}
              placeholder="Ex: pago em dinheiro no escritório"
              className="w-full px-3 py-2 mb-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
            />

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={pending}
                className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg"
              >
                {pending ? 'Salvando…' : 'Confirmar pagamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Liberar manual */}
      {modal === 'liberar' && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !pending && setModal(null)}
        >
          <form
            action={submitLiberar}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Forçar liberação
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Use quando precisar liberar a comissão antes do cliente pagar a parcela
              vinculada (ex: adiantamento ao corretor).
            </p>
            <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Motivo
            </label>
            <textarea
              name="motivo"
              rows={2}
              required
              placeholder="Ex: adiantamento acordado"
              className="w-full px-3 py-2 mb-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={pending}
                className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg"
              >
                {pending ? 'Liberando…' : 'Liberar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
