'use client';

/**
 * Emite a cobrança de uma parcela de boleto e mostra o PDF na hora.
 *
 * Existe porque o botão vizinho, "Gerar PIX", força billingType Pix: depois de
 * trocar a parcela para boleto, ele recriava a cobrança como Pix e desfazia a
 * escolha. Este delega a decisão do tipo para quem já a tomava (a forma da
 * própria parcela), em vez de fixar outra.
 *
 * Sem isto, a única forma de emitir era esperar a régua de cobrança alcançar o
 * vencimento — o que pode levar semanas, e quem pediu o boleto normalmente
 * precisa dele hoje.
 */

import { useState, useTransition } from 'react';
import { emitirCobrancaParcela } from '@/app/admin/(dashboard)/financeiro/actions';

interface Props {
  parcelaId: string;
  /** Se já existe URL, o botão vira link direto — não reemite à toa. */
  boletoUrl?: string | null;
  invoiceUrl?: string | null;
}

export function GerarBoletoButton({ parcelaId, boletoUrl, invoiceUrl }: Props) {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{
    boletoUrl?: string | null;
    invoiceUrl?: string | null;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const jaTem = boletoUrl || invoiceUrl;
  const link =
    resultado?.boletoUrl ??
    resultado?.invoiceUrl ??
    boletoUrl ??
    invoiceUrl ??
    null;

  // Já emitida: só abre. Reemitir sem necessidade invalidaria o que o cliente
  // possa já ter recebido.
  if (jaTem && !resultado) {
    return (
      <a
        href={boletoUrl ?? invoiceUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition whitespace-nowrap"
        title={boletoUrl ? 'Abrir PDF do boleto' : 'Abrir página de pagamento'}
      >
        {boletoUrl ? 'Ver boleto' : 'Ver cobrança'}
      </a>
    );
  }

  function emitir() {
    setErro(null);
    startTransition(async () => {
      const r = await emitirCobrancaParcela(parcelaId);
      if (r.error) setErro(r.error);
      else setResultado({ boletoUrl: r.boletoUrl, invoiceUrl: r.invoiceUrl });
    });
  }

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition whitespace-nowrap"
      >
        {resultado?.boletoUrl ? 'Abrir boleto' : 'Abrir cobrança'}
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={emitir}
        disabled={pending}
        title="Emite a cobrança no Asaas conforme a forma de pagamento da parcela"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 text-xs font-medium transition whitespace-nowrap"
      >
        {pending ? 'Emitindo…' : 'Gerar boleto'}
      </button>
      {erro && (
        <span className="text-[10px] text-red-600 max-w-[200px]" title={erro}>
          {erro.length > 40 ? erro.slice(0, 40) + '…' : erro}
        </span>
      )}
    </span>
  );
}
