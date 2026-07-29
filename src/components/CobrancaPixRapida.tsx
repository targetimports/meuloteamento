'use client';

import { useState, useTransition, useMemo } from 'react';
import { criarCobrancaPixAvulsa, type CobrancaPixResult } from '@/app/admin/(dashboard)/financeiro/actions';

interface ClienteOption {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
}

interface LoteOption {
  id: string;
  codigo: string;
  preco: number;
  loteamentoNome: string;
}

interface LoteadoraOption {
  id: string;
  nome: string;
}

interface Props {
  clientes: ClienteOption[];
  lotes: LoteOption[];
  loteadoras?: LoteadoraOption[]; // só usado em super-admin
  defaultEntradaPct?: number; // p/ sugerir entrada quando escolher lote
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CobrancaPixRapida({
  clientes,
  lotes,
  loteadoras,
  defaultEntradaPct = 20,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CobrancaPixResult | null>(null);

  const [clienteMode, setClienteMode] = useState<'existente' | 'adhoc'>('adhoc');
  const [clienteId, setClienteId] = useState('');
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');

  const [valorMode, setValorMode] = useState<'manual' | 'lote'>('manual');
  const [valor, setValor] = useState('');
  const [loteId, setLoteId] = useState('');
  const [entradaPct, setEntradaPct] = useState(defaultEntradaPct);

  // Forma de cobrança: PIX (só Pix) ou LINK (link completo: Pix + boleto + cartão)
  const [formaCobranca, setFormaCobranca] = useState<'PIX' | 'LINK'>('PIX');

  const [descricao, setDescricao] = useState('');
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [loteadoraId, setLoteadoraId] = useState('');

  const lote = useMemo(() => lotes.find((l) => l.id === loteId), [lotes, loteId]);
  const valorEntradaLote = lote ? Math.round(lote.preco * (entradaPct / 100) * 100) / 100 : 0;
  const valorFinal = valorMode === 'lote' ? valorEntradaLote : Number(valor) || 0;

  function abrir() {
    setError(null);
    setResult(null);
    setOpen(true);
  }

  function fechar() {
    setOpen(false);
    setError(null);
    setResult(null);
    // Reset form
    setClienteMode('adhoc');
    setClienteId('');
    setNome('');
    setCpfCnpj('');
    setEmail('');
    setTelefone('');
    setValorMode('manual');
    setValor('');
    setLoteId('');
    setDescricao('');
    setFormaCobranca('PIX');
    setLoteadoraId('');
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        clienteMode,
        clienteId: clienteMode === 'existente' ? clienteId : undefined,
        nome: clienteMode === 'adhoc' ? nome : undefined,
        cpfCnpj: clienteMode === 'adhoc' ? cpfCnpj : undefined,
        email: clienteMode === 'adhoc' ? email : undefined,
        telefone: clienteMode === 'adhoc' ? telefone : undefined,
        valor: valorFinal,
        loteId: valorMode === 'lote' ? loteId : undefined,
        descricao,
        vencimento,
        formaCobranca,
        loteadoraId: loteadoraId || undefined,
      };
      const res = await criarCobrancaPixAvulsa(payload);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback se clipboard API bloqueada
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <span className="text-base leading-none">⚡</span>
        Nova cobrança PIX
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl my-8">
            {/* HEADER */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Nova cobrança PIX
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gera QR code Asaas no valor da entrada do lote ou em valor manual.
                </p>
              </div>
              <button
                onClick={fechar}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl leading-none p-1"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {result?.ok ? (
                <ResultadoQrCode result={result} onCopy={copy} onClose={fechar} />
              ) : (
                <>
                  {error && (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
                      {error}
                    </div>
                  )}

                  {/* Loteadora (apenas super admin) */}
                  {loteadoras && loteadoras.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Loteadora <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={loteadoraId}
                        onChange={(e) => setLoteadoraId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      >
                        <option value="">— Selecione —</option>
                        {loteadoras.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Cliente */}
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                      Cliente
                    </p>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setClienteMode('adhoc')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                          clienteMode === 'adhoc'
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        ➕ Novo / sem cadastro
                      </button>
                      <button
                        type="button"
                        onClick={() => setClienteMode('existente')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                          clienteMode === 'existente'
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        🔍 Cliente cadastrado ({clientes.length})
                      </button>
                    </div>

                    {clienteMode === 'existente' ? (
                      <select
                        value={clienteId}
                        onChange={(e) => setClienteId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      >
                        <option value="">— Selecione cliente —</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome} · {c.cpfCnpj}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          placeholder="Nome completo *"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                        />
                        <input
                          placeholder="CPF/CNPJ *"
                          value={cpfCnpj}
                          onChange={(e) => setCpfCnpj(e.target.value)}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                        />
                        <input
                          placeholder="E-mail (opcional)"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                        />
                        <input
                          placeholder="Telefone (opcional)"
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Valor */}
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                      Valor
                    </p>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setValorMode('manual')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                          valorMode === 'manual'
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        💰 Valor manual
                      </button>
                      <button
                        type="button"
                        onClick={() => setValorMode('lote')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                          valorMode === 'lote'
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        🏠 Entrada de um lote
                      </button>
                    </div>

                    {valorMode === 'manual' ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      />
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={loteId}
                          onChange={(e) => setLoteId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                        >
                          <option value="">— Selecione lote —</option>
                          {lotes.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.loteamentoNome} · {l.codigo} · {formatBRL(l.preco)}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-600 dark:text-slate-400">
                            Entrada (%)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            value={entradaPct}
                            onChange={(e) => setEntradaPct(Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded text-sm"
                          />
                          {lote && (
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              = <strong className="text-slate-900 dark:text-slate-100">{formatBRL(valorEntradaLote)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Descrição + vencimento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Descrição (opcional)
                      </label>
                      <input
                        placeholder="Ex: Entrada do lote A05"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Vencimento
                      </label>
                      <input
                        type="date"
                        value={vencimento}
                        onChange={(e) => setVencimento(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* Forma de cobrança */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Forma de cobrança
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormaCobranca('PIX')}
                        className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          formaCobranca === 'PIX'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-semibold block">📲 Pix</span>
                        <span className="text-[11px] opacity-80">Copia e cola + QR (na hora)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormaCobranca('LINK')}
                        className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          formaCobranca === 'LINK'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-semibold block">🔗 Link de pagamento</span>
                        <span className="text-[11px] opacity-80">Pix + boleto + cartão</span>
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  {valorFinal > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        Valor da cobrança
                      </p>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                        {formatBRL(valorFinal)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* FOOTER */}
            {!result?.ok && (
              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={fechar}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={submit}
                  disabled={pending || valorFinal <= 0}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg inline-flex items-center gap-2"
                >
                  {pending ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Gerando…
                    </>
                  ) : formaCobranca === 'LINK' ? (
                    <>🔗 Gerar link de pagamento</>
                  ) : (
                    <>⚡ Gerar Pix</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultadoQrCode({
  result,
  onCopy,
  onClose,
}: {
  result: CobrancaPixResult;
  onCopy: (s: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  if (!result.qrCode && !result.invoiceUrl) return null;
  const { qrCode, invoiceUrl, valor, clienteNome, descricao } = result;
  const expira = qrCode?.expirationDate ? new Date(qrCode.expirationDate) : null;

  return (
    <div className="space-y-4 text-center">
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4">
        <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-semibold">
          ✓ Cobrança gerada
        </p>
        {clienteNome && (
          <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">{clienteNome}</p>
        )}
        {valor && (
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {formatBRL(valor)}
          </p>
        )}
        {descricao && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{descricao}</p>
        )}
      </div>

      {/* Link de pagamento (Pix + boleto + cartão) */}
      {invoiceUrl && (
        <div className="text-left">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            🔗 Link de pagamento
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={invoiceUrl}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={() => {
                onCopy(invoiceUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white rounded-lg whitespace-nowrap"
            >
              {copiedLink ? '✓ Copiado' : 'Copiar'}
            </button>
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg whitespace-nowrap"
            >
              Abrir →
            </a>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Aceita Pix, boleto e cartão.</p>
        </div>
      )}

      {/* Pix copia-e-cola + QR (quando disponível) */}
      {qrCode && (
        <>
          <div className="inline-block bg-white p-3 rounded-xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${qrCode.encodedImage}`}
              alt="QR Code PIX"
              className="w-64 h-64"
            />
          </div>

          <div className="text-left">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              📲 PIX copia e cola
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={qrCode.payload}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-xs font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={() => {
                  onCopy(qrCode.payload);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white rounded-lg whitespace-nowrap"
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            {expira && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                Expira em {expira.toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-center gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
        >
          Concluído
        </button>
      </div>
    </div>
  );
}
