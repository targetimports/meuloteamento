'use client';

import { useState } from 'react';

interface Props {
  /** 'BOLETO' ou 'CARTAO' — define visual e mensagem */
  tipo: 'BOLETO' | 'CARTAO';
  valor: number;
  descricao?: string;
  /** Link da fatura no Asaas — onde cliente paga */
  invoiceUrl: string | null;
  /** Boleto: PDF do bankSlipUrl */
  boletoUrl?: string | null;
  telefoneCliente?: string | null;
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

const CONFIG = {
  BOLETO: {
    icon: '📄',
    titulo: 'Boleto da entrada gerado',
    sub: 'Compartilhe com o cliente — a parcela cai automaticamente quando o boleto for compensado.',
    bg: 'from-sky-50 to-sky-100/50',
    borda: 'border-sky-200',
    texto: 'text-sky-900',
    subtexto: 'text-sky-700',
    btnPrimario: 'bg-sky-600 hover:bg-sky-700',
    btnLabel: '📄 Ver/baixar boleto',
    msgWpp: (valor: string, desc: string, url: string | null) =>
      `Olá! Segue o boleto da entrada${desc ? ' — ' + desc : ''}.\n\nValor: ${valor}\n${
        url ? '\nLink: ' + url : ''
      }`,
  },
  CARTAO: {
    icon: '💳',
    titulo: 'Link de pagamento por cartão gerado',
    sub: 'Cliente abre o link e paga com cartão de crédito (até 12×). Recebimento cai em D+30.',
    bg: 'from-violet-50 to-violet-100/50',
    borda: 'border-violet-200',
    texto: 'text-violet-900',
    subtexto: 'text-violet-700',
    btnPrimario: 'bg-violet-600 hover:bg-violet-700',
    btnLabel: '💳 Abrir fatura',
    msgWpp: (valor: string, desc: string, url: string | null) =>
      `Olá! Pra pagar a entrada${desc ? ' do ' + desc : ''} com cartão de crédito (até 12×):\n\nValor: ${valor}\n${
        url ? '\nLink: ' + url : ''
      }`,
  },
} as const;

export function BoletoCartaoCard({
  tipo,
  valor,
  descricao,
  invoiceUrl,
  boletoUrl,
  telefoneCliente,
}: Props) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const cfg = CONFIG[tipo];
  // Boleto: usa bankSlipUrl se houver, senão cai no invoiceUrl
  const linkPrincipal = tipo === 'BOLETO' ? boletoUrl ?? invoiceUrl : invoiceUrl;

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
    setTimeout(() => setCopied(false), 2000);
  }

  const wppHref =
    telefoneCliente && linkPrincipal
      ? `https://wa.me/55${onlyDigits(telefoneCliente)}?text=${encodeURIComponent(
          cfg.msgWpp(formatBRL(valor), descricao ?? '', linkPrincipal),
        )}`
      : null;

  return (
    <section
      className={`bg-gradient-to-br ${cfg.bg} border ${cfg.borda} rounded-2xl p-5`}
    >
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className={`font-bold ${cfg.texto} flex items-center gap-1.5`}>
            <span>{cfg.icon}</span> {cfg.titulo}
          </h2>
          <p className={`text-xs ${cfg.subtexto}`}>{cfg.sub}</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className={`text-xs ${cfg.subtexto} hover:underline`}
        >
          {open ? 'Recolher ▲' : 'Expandir ▼'}
        </button>
      </div>

      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white/80 border border-white rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Valor
              </p>
              <p className="text-xl font-bold text-slate-900">{formatBRL(valor)}</p>
            </div>
            <div className="bg-white/80 border border-white rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Tipo
              </p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {tipo === 'BOLETO' ? 'Boleto bancário' : 'Cartão de crédito'}
              </p>
            </div>
          </div>

          {descricao && (
            <p className="text-xs text-slate-700">
              <strong>Referência:</strong> {descricao}
            </p>
          )}

          {linkPrincipal && (
            <div className="flex gap-2 flex-wrap">
              <a
                href={linkPrincipal}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2 ${cfg.btnPrimario} text-white text-sm font-semibold rounded-lg`}
              >
                {cfg.btnLabel}
              </a>
              <button
                onClick={() => copy(linkPrincipal)}
                type="button"
                className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                {copied ? '✓ Copiado' : '📋 Copiar link'}
              </button>
              {wppHref && (
                <a
                  href={wppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-[#25D366] hover:bg-[#1cb858] text-white text-xs font-semibold rounded-lg"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          )}

          {!linkPrincipal && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠ Link da cobrança não retornou do Asaas. Tente regenerar pela tabela de parcelas
              abaixo.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
