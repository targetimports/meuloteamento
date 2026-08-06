'use client';

/**
 * Troca a forma de pagamento das parcelas em aberto entre Pix e boleto.
 *
 * A confirmação existe por causa de um efeito que não dá para desfazer: as
 * parcelas que já têm cobrança no Asaas precisam tê-la refeita, e os links já
 * enviados ao cliente param de funcionar. Por isso o modal diz o número exato
 * de cobranças afetadas antes de confirmar — e não um aviso genérico.
 */

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

interface Resultado {
  ok?: boolean;
  error?: string;
  alteradas?: number;
  mantidas?: number;
}

interface Props {
  vendaId: string;
  formaAtual: string;
  /** Parcelas PENDENTE/ATRASADO — as únicas que serão alteradas. */
  emAberto: number;
  /** Dessas, quantas já têm cobrança emitida no Asaas. */
  comCobranca: number;
  action: (vendaId: string, forma: string) => Promise<Resultado>;
}

export function TrocarFormaPagamento({
  vendaId,
  formaAtual,
  emAberto,
  comCobranca,
  action,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setMontado(true), []);

  /**
   * POR QUE NÃO USA <form action> COM REDIRECT: a primeira versão fazia isso, e
   * o modal ficava preso em "Alterando…" mesmo depois de a troca concluir no
   * banco. O redirect da server action navega para a mesma rota, então este
   * componente não desmonta — `aberto` e `enviando` continuavam de pé, e a
   * única saída era recarregar a página à mão.
   *
   * Aqui a action devolve o resultado, o modal fecha e o router.refresh()
   * busca os dados novos. A tela se atualiza sozinha.
   */
  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await action(vendaId, destino);
      if (r?.error) {
        setErro(r.error);
        return;
      }
      // Atualiza a tabela por baixo e troca o conteúdo do modal pelo resumo:
      // fechar direto esconderia o aviso de parcelas que ficaram para trás.
      router.refresh();
      setResultado(r);
    });
  }

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

  const ehPix = formaAtual === 'PARCELADO_PIX';
  const destino = ehPix ? 'PARCELADO_BOLETO' : 'PARCELADO_PIX';
  const nomeAtual = ehPix ? 'Pix' : 'Boleto';
  const nomeDestino = ehPix ? 'Boleto' : 'Pix';

  // Só faz sentido entre Pix e boleto: as demais formas (cheque, espécie,
  // cartão, misto) não têm equivalente direto no Asaas.
  const trocavel = formaAtual === 'PARCELADO_PIX' || formaAtual === 'PARCELADO_BOLETO';
  if (!trocavel || emAberto === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium transition"
      >
        Mudar para {nomeDestino}
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-troca-forma"
          >
            <div
              className="modal-fundo absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              onClick={() => !enviando && fechar()}
              aria-hidden
            />

            <div
              className="modal-painel relative w-full sm:max-w-[460px] bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5"
              style={{
                boxShadow:
                  '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
              }}
            >
              {resultado ? (
                <div className="p-6">
                  <h2 className="text-[17px] font-semibold text-slate-900">
                    Forma de pagamento alterada
                  </h2>
                  <p className="text-sm text-slate-600 mt-1.5">
                    {resultado.alteradas} parcela(s) agora são{' '}
                    <strong>{nomeDestino}</strong>. As cobranças são emitidas
                    conforme o vencimento se aproxima — ou na hora, pelo botão{' '}
                    <strong>
                      {destino === 'PARCELADO_BOLETO' ? 'Gerar boleto' : 'Gerar PIX'}
                    </strong>{' '}
                    de cada linha.
                  </p>

                  {(resultado.mantidas ?? 0) > 0 && (
                    <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      {resultado.mantidas} parcela(s) permaneceram na forma
                      anterior: a cobrança já emitida no Asaas não pôde ser
                      excluída (paga ou em processamento).
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
                <>
              <div className="px-6 pt-6 pb-4">
                <h2 id="titulo-troca-forma" className="text-[17px] font-semibold text-slate-900">
                  Mudar de {nomeAtual} para {nomeDestino}?
                </h2>
                <p className="text-sm text-slate-600 mt-1.5">
                  Vale para as <strong>{emAberto} parcela(s) em aberto</strong>. As
                  já pagas continuam como estão.
                </p>
              </div>

              {comCobranca > 0 && (
                <div className="mx-6 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900">
                    {comCobranca} cobrança(s) já emitida(s) serão refeitas
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    O tipo de cobrança não é editável no Asaas, então ela é
                    excluída e reemitida. Qualquer link ou Pix copia-e-cola já
                    enviado ao cliente dessas parcelas deixa de funcionar.
                  </p>
                </div>
              )}

              <div className="px-6 pb-6">
                {erro && (
                  <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {erro}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={enviando}
                    className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
                  >
                    {enviando ? 'Alterando…' : `Mudar para ${nomeDestino}`}
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
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
