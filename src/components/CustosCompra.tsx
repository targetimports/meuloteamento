'use client';

/**
 * Estimativa de custos extras na compra: IPTU/ITR anual + cartório (ITBI + escritura).
 * Pode ser embedado no simulador ou na página do lote.
 *
 * Valores são ESTIMATIVAS — ajustar percentuais conforme município/cartório local.
 */

import { useState } from 'react';
import { formatBRL } from '@/lib/format';

interface Props {
  valorLote: number;
  /** ITBI em % (default 2%) - varia por município (geralmente 2-3%) */
  itbiPct?: number;
  /** Escritura/registro em % (default 1%) */
  escrituraPct?: number;
  /** IPTU/ITR anual estimado em % do valor venal (default 0.5%) */
  iptuAnualPct?: number;
  defaultOpen?: boolean;
}

export default function CustosCompra({
  valorLote,
  itbiPct = 2,
  escrituraPct = 1,
  iptuAnualPct = 0.5,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const itbi = valorLote * (itbiPct / 100);
  const escritura = valorLote * (escrituraPct / 100);
  const cartorioTotal = itbi + escritura;
  const iptuAnual = valorLote * (iptuAnualPct / 100);
  const iptuMensal = iptuAnual / 12;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
      >
        <span>Custos estimados além do lote (cartório + IPTU)</span>
        <span className="text-slate-500">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm text-slate-700 space-y-2">
          <div className="flex justify-between">
            <span>ITBI ({itbiPct}%)</span>
            <span className="font-medium">{formatBRL(itbi)}</span>
          </div>
          <div className="flex justify-between">
            <span>Escritura + registro ({escrituraPct}%)</span>
            <span className="font-medium">{formatBRL(escritura)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-medium">Total cartório (única vez)</span>
            <span className="font-semibold">{formatBRL(cartorioTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span>IPTU/ITR anual estimado ({iptuAnualPct}%)</span>
            <span className="font-medium">{formatBRL(iptuAnual)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>≈ por mês</span>
            <span>{formatBRL(iptuMensal)}</span>
          </div>
          <p className="text-xs text-slate-500 italic mt-3">
            * Valores aproximados. Confirme com cartório e prefeitura locais — taxas variam
            por município.
          </p>
        </div>
      )}
    </div>
  );
}
