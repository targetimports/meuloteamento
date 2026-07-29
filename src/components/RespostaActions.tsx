'use client';

import { useState, useTransition } from 'react';

type Status = 'NOVA' | 'EM_ANALISE' | 'PROCESSADA' | 'ARQUIVADA';

interface Props {
  respostaId: string;
  statusAtual: Status;
  mudarStatusAction: (id: string, status: Status) => Promise<void>;
  deletarAction: (id: string) => Promise<void>;
}

const STATUS_LABEL: Record<Status, string> = {
  NOVA: 'Nova',
  EM_ANALISE: 'Em análise',
  PROCESSADA: 'Processada',
  ARQUIVADA: 'Arquivada',
};

export function RespostaActions({
  respostaId,
  statusAtual,
  mudarStatusAction,
  deletarAction,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(statusAtual);

  function mudarStatus(novo: Status) {
    setStatus(novo);
    startTransition(async () => {
      try {
        await mudarStatusAction(respostaId, novo);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Erro ao atualizar');
        setStatus(statusAtual);
      }
    });
  }

  function deletar() {
    if (!confirm('Apagar definitivamente esta resposta (incluindo os arquivos)?'))
      return;
    startTransition(async () => {
      try {
        await deletarAction(respostaId);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Erro ao apagar');
      }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={status}
        onChange={(e) => mudarStatus(e.target.value as Status)}
        disabled={pending}
        className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
      >
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <button
        onClick={deletar}
        disabled={pending}
        className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg disabled:opacity-50"
      >
        🗑 Apagar
      </button>
    </div>
  );
}
