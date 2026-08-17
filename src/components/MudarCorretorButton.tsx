'use client';

/**
 * Botão pra trocar/adicionar/remover corretor de uma venda já finalizada.
 *
 * - Se a venda JÁ tem corretor, mostra "Trocar corretor"
 * - Se NÃO tem, mostra "Adicionar corretor"
 * - Opção pra REMOVER (deixar sem corretor)
 *
 * Comissões BLOQUEADAS são reatribuídas; LIBERADAS/PAGAS preservadas.
 */

import { useState, useTransition } from 'react';
import { mudarCorretorVenda } from '@/app/admin/(dashboard)/vendas/[id]/actions';
import { CampoCorretor, type CorretorOpcao } from '@/components/vendas/CampoCorretor';

interface Props {
  vendaId: string;
  corretorAtualId: string | null;
  corretorAtualNome: string | null;
  /** Corretores ativos disponíveis */
  corretores: CorretorOpcao[];
  /** Define a loteadora de um corretor cadastrado aqui mesmo. */
  loteamentoId: string;
  /** Comissões da venda agrupadas por status (pra mostrar warning) */
  comissoesPagas?: number;
  comissoesLiberadas?: number;
  comissoesBloqueadas?: number;
}

export function MudarCorretorButton({
  vendaId,
  corretorAtualId,
  corretorAtualNome,
  corretores,
  loteamentoId,
  comissoesPagas = 0,
  comissoesLiberadas = 0,
  comissoesBloqueadas = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [novoId, setNovoId] = useState<string>(corretorAtualId ?? '');
  const [remover, setRemover] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNovoId(corretorAtualId ?? '');
    setRemover(false);
    setMotivo('');
    setError(null);
  }

  function abrir() {
    reset();
    setOpen(true);
  }

  function submit() {
    setError(null);
    // Remover é escolha explícita: campo vazio aqui só quer dizer "ainda não
    // escolheu", e tratar os dois como a mesma coisa já tirou corretor de venda
    // sem ninguém pedir.
    const finalId = remover ? null : novoId.trim() === '' ? '' : novoId.trim();
    if (finalId === '') {
      setError('Escolha um corretor ou marque a opção de deixar a venda sem corretor.');
      return;
    }
    if (finalId === (corretorAtualId ?? null)) {
      setError('Você precisa escolher um corretor diferente do atual.');
      return;
    }
    startTransition(async () => {
      try {
        await mudarCorretorVenda(vendaId, finalId, motivo.trim() || undefined);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao trocar corretor');
      }
    });
  }

  const labelBotao = corretorAtualId ? '↔ Trocar corretor' : '+ Adicionar corretor';

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-xs font-semibold px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition inline-flex items-center gap-1.5"
        title="Trocar/adicionar/remover corretor desta venda"
      >
        {labelBotao}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-primary-600 dark:text-primary-400 font-bold">
                  Gestão de corretor
                </p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {corretorAtualId ? 'Trocar corretor da venda' : 'Adicionar corretor'}
                </h2>
                {corretorAtualNome && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Atual: <strong>{corretorAtualNome}</strong>
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 text-xl leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {/* Warning sobre comissões */}
            {(comissoesPagas > 0 || comissoesLiberadas > 0 || comissoesBloqueadas > 0) && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 mb-3 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-bold mb-1.5">⚠ Esta venda já tem comissões</p>
                <ul className="space-y-0.5 leading-relaxed">
                  {comissoesPagas > 0 && (
                    <li>
                      • <strong>{comissoesPagas}</strong> comissão(ões) PAGA(s) ao corretor atual —{' '}
                      <strong>preservadas</strong> (não retroage dinheiro).
                    </li>
                  )}
                  {comissoesLiberadas > 0 && (
                    <li>
                      • <strong>{comissoesLiberadas}</strong> LIBERADA(s) — ficam atribuídas ao
                      corretor atual (compromisso pendente).
                    </li>
                  )}
                  {comissoesBloqueadas > 0 && (
                    <li>
                      • <strong>{comissoesBloqueadas}</strong> BLOQUEADA(s) —{' '}
                      <strong>serão transferidas</strong> ao novo corretor (ou canceladas se você
                      remover).
                    </li>
                  )}
                </ul>
              </div>
            )}

            <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Novo corretor
            </label>
            <div className={remover ? 'pointer-events-none opacity-50' : ''}>
              <CampoCorretor
                corretores={corretores}
                valorId={novoId}
                onEscolher={setNovoId}
                loteamentoId={loteamentoId}
                inputClass="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
              />
            </div>

            {corretorAtualId && (
              <label className="mt-2 mb-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={remover}
                  onChange={(e) => setRemover(e.target.checked)}
                  disabled={pending}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Deixar esta venda sem corretor
              </label>
            )}
            {!corretorAtualId && <div className="mb-3" />}

            <label className="block text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
              Motivo (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex: transferência de carteira, corretor desligado, etc."
              disabled={pending}
              className="w-full px-3 py-2 mb-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
            />

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-2.5 mb-3">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || (!remover && novoId === (corretorAtualId ?? ''))}
                className="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg"
              >
                {pending ? 'Salvando…' : 'Confirmar troca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
