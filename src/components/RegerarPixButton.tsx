'use client';

import { useState, useTransition } from 'react';
import {
  regerarPixParcela,
  type RegerarPixResult,
} from '@/app/admin/(dashboard)/financeiro/actions';
import { IconPix } from '@/components/icons';

interface Props {
  parcelaId: string;
  /** Se já tem asaasPaymentId, é "regenerar"; senão, é "gerar 1ª vez" */
  jaTinha: boolean;
  /** Telefone do cliente pra montar atalho WhatsApp */
  clienteTelefone?: string | null;
  /** Nome do lote para a mensagem WhatsApp */
  loteCodigo?: string;
  /** Variante visual */
  variant?: 'compact' | 'full';
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

export function RegerarPixButton({
  parcelaId,
  jaTinha,
  clienteTelefone,
  loteCodigo,
  variant = 'compact',
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegerarPixResult | null>(null);
  const [copied, setCopied] = useState(false);

  function regenerar() {
    if (
      jaTinha &&
      !confirm(
        'Regenerar PIX desta parcela? O PIX anterior será invalidado no Asaas.'
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await regerarPixParcela(parcelaId);
      setResult(res);
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // O raio era só decoração; a marca do Pix diz na hora do que se trata.
  const labelBtn = (
    <>
      <IconPix className={variant === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {jaTinha ? 'Regerar Pix' : 'Gerar Pix'}
    </>
  );

  return (
    <>
      <button
        onClick={regenerar}
        disabled={pending}
        className={
          variant === 'compact'
            ? 'inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            : 'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50'
        }
        title={jaTinha ? 'Regenerar QR PIX desta parcela' : 'Gerar QR PIX desta parcela'}
      >
        {pending ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            Gerando…
          </>
        ) : (
          labelBtn
        )}
      </button>

      {/* MODAL com novo QR */}
      {result && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold">
                    {result.ok ? (jaTinha ? 'Pix regenerado' : 'Pix gerado') : 'Erro'}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {result.ok
                      ? `Parcela ${result.parcelaNumero} — ${formatBRL(result.valor ?? 0)}`
                      : 'Falha'}
                  </h2>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xl"
                >
                  ✕
                </button>
              </div>

              {result.error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
                  {result.error}
                </div>
              )}

              {result.ok && result.qrCode && (
                <>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block mx-auto mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${result.qrCode.encodedImage}`}
                      alt="QR Code PIX"
                      className="w-64 h-64 mx-auto block"
                    />
                  </div>

                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
                    PIX copia e cola
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      readOnly
                      value={result.qrCode.payload}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-xs font-mono"
                    />
                    <button
                      onClick={() => copy(result.qrCode!.payload)}
                      className="px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg whitespace-nowrap"
                    >
                      {copied ? '✓ Copiado' : 'Copiar'}
                    </button>
                  </div>

                  {result.qrCode.expirationDate && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 text-center">
                      Expira em{' '}
                      {new Date(result.qrCode.expirationDate).toLocaleString('pt-BR')}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {clienteTelefone && (
                      <a
                        href={`https://wa.me/55${onlyDigits(clienteTelefone)}?text=${encodeURIComponent(
                          `Olá! Segue o PIX${loteCodigo ? ` da parcela do Lote ${loteCodigo}` : ''}:\n\nValor: ${formatBRL(result.valor ?? 0)}\n${result.invoiceUrl ? '\nLink: ' + result.invoiceUrl + '\n' : ''}\nPIX copia e cola:\n${result.qrCode.payload}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-3 py-2 text-xs font-semibold bg-[#25D366] hover:bg-[#1cb858] text-white rounded-lg"
                      >
                        Enviar no WhatsApp
                      </a>
                    )}
                    {result.invoiceUrl && (
                      <a
                        href={result.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
                      >
                        Fatura Asaas →
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
