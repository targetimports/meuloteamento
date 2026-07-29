'use client';

import { useMemo, useState, useTransition } from 'react';

interface Props {
  action: (formData: FormData) => Promise<void>;
  loteId: string;
  loteCodigo: string;
  /** Motivo bruto vindo do histórico mais recente (ex: "Reserva interna por X até 12/05/2026 — observação") */
  motivoAtual?: string | null;
}

/** Extrai dias restantes e observação a partir do motivo formatado da reserva. */
function parseMotivo(raw: string | null | undefined): { dias: number; observacao: string } {
  if (!raw) return { dias: 7, observacao: '' };

  // Remove prefixo [EDITADA] se houver
  const limpo = raw.replace(/^\[EDITADA\]\s*/, '').trim();

  // Tenta separar observação após " — "
  const partes = limpo.split(' — ');
  const cabecalho = partes[0] ?? '';
  const observacao = partes.slice(1).join(' — ').trim();

  // Detecta sem prazo
  if (/SEM\s+PRAZO/i.test(cabecalho)) {
    return { dias: 0, observacao };
  }

  // Extrai data "até dd/mm/aaaa"
  const m = cabecalho.match(/at[éeé]\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10) - 1;
    let ano = parseInt(m[3], 10);
    if (ano < 100) ano += 2000;
    const expira = new Date(ano, mes, dia, 23, 59, 59);
    const diff = Math.round((expira.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff > 0) {
      // Encaixa em uma das opções padrão se for próximo
      const opcoes = [1, 3, 7, 15, 30, 60, 90, 180, 365];
      const fit = opcoes.find((o) => Math.abs(o - diff) <= 1);
      return { dias: fit ?? diff, observacao };
    }
  }
  return { dias: 7, observacao };
}

export function EditarReservaButton({ action, loteId, loteCodigo, motivoAtual }: Props) {
  const [open, setOpen] = useState(false);
  const inicial = useMemo(() => parseMotivo(motivoAtual), [motivoAtual]);
  const [dias, setDias] = useState<number>(inicial.dias);
  const [motivo, setMotivo] = useState<string>(inicial.observacao);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function abrir() {
    // Sincroniza com motivo atual sempre que abre
    setDias(inicial.dias);
    setMotivo(inicial.observacao);
    setErro(null);
    setOpen(true);
  }

  function submit() {
    setErro(null);
    const fd = new FormData();
    fd.append('loteId', loteId);
    fd.append('motivo', motivo);
    fd.append('dias', String(dias));
    startTransition(async () => {
      try {
        await action(fd);
        setOpen(false);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="text-xs bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 font-medium px-2.5 py-1 rounded inline-flex items-center gap-1"
        title="Editar prazo e observação da reserva"
      >
        ✎ Editar
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
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Editar reserva — {loteCodigo}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Atualize o prazo e a observação. O lote continua reservado.
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
              Novo prazo
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
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
              <option value={365}>1 ano</option>
              <option value={0}>♾ Ilimitado / sem prazo</option>
            </select>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {dias === 0
                ? '⚠ Ficará reservado até liberação manual ou criação de venda.'
                : `Conta a partir de agora — vence em ${new Date(Date.now() + dias * 86400000).toLocaleDateString('pt-BR')}.`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observação
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: Cliente João confirmou via WhatsApp — vai trazer entrada dia 25"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {motivoAtual && (
            <details className="text-[11px] text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                Ver motivo atual no histórico
              </summary>
              <p className="mt-1 p-2 bg-slate-50 dark:bg-slate-800/40 rounded font-mono text-[10px] break-words">
                {motivoAtual}
              </p>
            </details>
          )}
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
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando…
              </>
            ) : (
              <>✓ Salvar alterações</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
