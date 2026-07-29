'use client';

import { useState } from 'react';

interface Props {
  valor: number;
  descricao?: string;
  qrCodeBase64: string;
  payload: string;
  invoiceUrl?: string | null;
  telefoneCliente?: string | null;
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

export function PixCard({ valor, descricao, qrCodeBase64, payload, invoiceUrl, telefoneCliente }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const wppHref = telefoneCliente
    ? `https://wa.me/55${onlyDigits(telefoneCliente)}?text=${encodeURIComponent(
        `Olá! Segue o PIX da entrada${descricao ? ' — ' + descricao : ''}.\n\nValor: ${formatBRL(valor)}\n\n${
          invoiceUrl ? 'Link da fatura: ' + invoiceUrl + '\n\n' : ''
        }PIX copia e cola:\n${payload}`
      )}`
    : null;

  return (
    <section className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-emerald-900 flex items-center gap-1.5">
            <span>⚡</span> PIX da entrada gerado
          </h2>
          <p className="text-xs text-emerald-700">
            Compartilhe com o cliente — assim que pagar, a parcela cai automaticamente.
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-emerald-700 hover:underline"
        >
          {open ? 'Recolher ▲' : 'Expandir ▼'}
        </button>
      </div>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
          {/* QR */}
          <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm mx-auto md:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-52 h-52"
            />
          </div>

          {/* Detalhes + ações */}
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
                Valor
              </p>
              <p className="text-3xl font-black text-emerald-900">{formatBRL(valor)}</p>
            </div>
            {descricao && (
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
                  Descrição
                </p>
                <p className="text-sm text-emerald-900">{descricao}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-1">
                PIX copia e cola
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={payload}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 border border-emerald-300 bg-white rounded-lg text-xs font-mono text-slate-700"
                />
                <button
                  onClick={copy}
                  className="px-3 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg whitespace-nowrap"
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {wppHref && (
                <a
                  href={wppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium bg-[#25D366] hover:bg-[#1cb858] text-white rounded-lg inline-flex items-center gap-1.5"
                >
                  📱 Enviar por WhatsApp
                </a>
              )}
              {invoiceUrl && (
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 rounded-lg"
                >
                  Abrir fatura Asaas →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
