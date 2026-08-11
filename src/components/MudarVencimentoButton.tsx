'use client';

/**
 * Move o dia de vencimento das parcelas em aberto.
 *
 * Só o dia muda: mês e ano de cada parcela ficam onde estão. O cronograma
 * continua o mesmo, apenas desloca dentro do mês — que é o que se pede quando
 * o cliente troca a data do salário, não uma renegociação de prazo.
 *
 * Segue o padrão de TrocarFormaPagamento: a action devolve resultado, o modal
 * mostra o resumo e a tabela atualiza sozinha. Nada de redirect, que já
 * deixara um modal preso em "Alterando…".
 */

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

interface Resultado {
  ok?: boolean;
  error?: string;
  alteradas?: number;
  falharam?: number;
}

interface Props {
  vendaId: string;
  /** Dia predominante hoje, só para pré-preencher o campo. */
  diaAtual: number;
  emAberto: number;
  comCobranca: number;
  action: (vendaId: string, dia: number) => Promise<Resultado>;
}

export function MudarVencimentoButton({
  vendaId,
  diaAtual,
  emAberto,
  comCobranca,
  action,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [dia, setDia] = useState(String(diaAtual));
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setMontado(true), []);

  function fechar() {
    setAberto(false);
    setResultado(null);
    setErro(null);
  }

  useEffect(() => {
    if (!aberto) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) fechar();
    }
    document.addEventListener('keydown', onTecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = antes;
    };
  }, [aberto, enviando]);

  function confirmar() {
    const n = Number(dia);
    if (!Number.isInteger(n) || n < 1 || n > 28) {
      setErro('Escolha um dia entre 1 e 28.');
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await action(vendaId, n);
      if (r?.error) {
        setErro(r.error);
        return;
      }
      router.refresh();
      setResultado(r);
    });
  }

  if (emAberto === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition"
      >
        Mudar vencimento
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Mudar dia de vencimento"
          >
            <div
              className="modal-fundo absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              onClick={() => !enviando && fechar()}
              aria-hidden
            />

            <div
              className="modal-painel relative w-full sm:max-w-[440px] bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5"
              style={{
                boxShadow:
                  '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
              }}
            >
              {resultado ? (
                <div className="p-6">
                  <h2 className="text-[17px] font-semibold text-slate-900">
                    Vencimentos atualizados
                  </h2>
                  <p className="text-sm text-slate-600 mt-1.5">
                    {resultado.alteradas} parcela(s) passaram a vencer no dia{' '}
                    <strong>{dia}</strong>.
                  </p>
                  {(resultado.falharam ?? 0) > 0 && (
                    <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      {resultado.falharam} parcela(s) mantiveram a data anterior:
                      a cobrança no Asaas não pôde ser atualizada. Elas seguem
                      com a data que o cliente já tem em mãos.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={fechar}
                    className="mt-6 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <div className="p-6">
                  <h2 className="text-[17px] font-semibold text-slate-900">
                    Mudar o dia de vencimento
                  </h2>
                  <p className="text-sm text-slate-600 mt-1.5">
                    Vale para as <strong>{emAberto} parcela(s) em aberto</strong>.
                    Mês e ano de cada uma não mudam — só o dia.
                  </p>

                  <div className="mt-5">
                    <label htmlFor="dia-venc" className="block text-xs font-medium text-slate-600 mb-1.5">
                      Novo dia
                    </label>
                    <input
                      id="dia-venc"
                      type="number"
                      min={1}
                      max={28}
                      value={dia}
                      onChange={(e) => setDia(e.target.value)}
                      className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Entre 1 e 28. Dias 29 a 31 não existem em todos os meses.
                    </p>
                  </div>

                  {comCobranca > 0 && (
                    <p className="mt-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      {comCobranca} parcela(s) já têm cobrança emitida. A data é
                      atualizada no Asaas sem gerar cobrança nova, então o boleto
                      e o Pix que o cliente já recebeu continuam valendo.
                    </p>
                  )}

                  {erro && (
                    <p className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                      {erro}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={confirmar}
                      disabled={enviando}
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
                    >
                      {enviando ? 'Alterando…' : 'Aplicar'}
                    </button>
                    <button
                      type="button"
                      onClick={fechar}
                      disabled={enviando}
                      className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
