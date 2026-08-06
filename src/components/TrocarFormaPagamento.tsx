'use client';

/**
 * Troca a forma de pagamento das parcelas em aberto entre Pix e boleto.
 *
 * A confirmação existe por causa de um efeito que não dá para desfazer: as
 * parcelas que já têm cobrança no Asaas precisam tê-la refeita, e os links já
 * enviados ao cliente param de funcionar. Por isso o modal diz o número exato
 * de cobranças afetadas antes de confirmar — e não um aviso genérico.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  vendaId: string;
  formaAtual: string;
  /** Parcelas PENDENTE/ATRASADO — as únicas que serão alteradas. */
  emAberto: number;
  /** Dessas, quantas já têm cobrança emitida no Asaas. */
  comCobranca: number;
  action: (vendaId: string, formData: FormData) => Promise<void>;
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
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) setAberto(false);
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
              onClick={() => !enviando && setAberto(false)}
              aria-hidden
            />

            <div
              className="modal-painel relative w-full sm:max-w-[460px] bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5"
              style={{
                boxShadow:
                  '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
              }}
            >
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

              <form
                action={action.bind(null, vendaId)}
                onSubmit={() => setEnviando(true)}
                className="px-6 pb-6"
              >
                <input type="hidden" name="forma" value={destino} />
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={enviando}
                    className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
                  >
                    {enviando ? 'Alterando…' : `Mudar para ${nomeDestino}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    disabled={enviando}
                    className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
