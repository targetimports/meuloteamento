'use client';

import { useState } from 'react';

type ParcelaStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO' | 'ESTORNADO';

const STATUS_LABEL: Record<ParcelaStatus, string> = {
  PENDENTE: 'Aberta',
  PAGO: 'Paga',
  ATRASADO: 'Atrasada',
  CANCELADO: 'Cancelada',
  ESTORNADO: 'Estornada',
};

const STATUS_COLOR: Record<ParcelaStatus, string> = {
  PENDENTE: 'bg-sky-50 text-sky-700 border-sky-200',
  PAGO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ATRASADO: 'bg-amber-50 text-amber-700 border-amber-200',
  CANCELADO: 'bg-slate-100 text-slate-500 border-slate-200',
  ESTORNADO: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface Props {
  parcela: {
    id: string;
    numero: number;
    valor: string;
    vencimento: string;
    status: string;
    pixCode: string | null;
    boletoUrl: string | null;
    invoiceUrl: string | null;
  };
  lote: string;
  vendaNumero: number;
}

export default function ParcelaCard({ parcela, lote, vendaNumero }: Props) {
  const [pixOpen, setPixOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const status = parcela.status as ParcelaStatus;

  async function copiarPix() {
    if (!parcela.pixCode) return;
    await navigator.clipboard.writeText(parcela.pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500">Venda #{vendaNumero} · Lote {lote}</div>
          <div className="font-medium text-slate-900">
            Parcela {parcela.numero} — {parcela.valor}
          </div>
          <div className="text-sm text-slate-600">Vence em {parcela.vencimento}</div>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${STATUS_COLOR[status]}`}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {(status === 'PENDENTE' || status === 'ATRASADO') && (
        <div className="mt-3 flex flex-wrap gap-2">
          {parcela.pixCode && (
            <button
              onClick={() => setPixOpen((v) => !v)}
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
            >
              {pixOpen ? 'Fechar PIX' : 'Pagar com PIX'}
            </button>
          )}
          {parcela.boletoUrl && (
            <a
              href={parcela.boletoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded"
            >
              Baixar boleto
            </a>
          )}
          {parcela.invoiceUrl && (
            <a
              href={parcela.invoiceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded"
            >
              Fatura completa
            </a>
          )}
        </div>
      )}

      {pixOpen && parcela.pixCode && (
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 mb-1">PIX copia-e-cola:</div>
          <div className="text-xs font-mono break-all bg-white border border-slate-200 rounded p-2">
            {parcela.pixCode}
          </div>
          <button
            onClick={copiarPix}
            className="mt-2 text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded"
          >
            {copied ? 'Copiado ✓' : 'Copiar código'}
          </button>
        </div>
      )}
    </div>
  );
}
