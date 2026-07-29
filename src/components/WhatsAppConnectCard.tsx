'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  iniciarConexaoWhatsApp,
  checarConexaoWhatsApp,
  desconectarWhatsApp,
  enviarTesteWhatsApp,
  ativarCobranca,
  desativarCobranca,
} from '@/lib/whatsapp-connect-actions';

type Props = {
  loteadoraId: string;
  connected: boolean;
  number: string | null;
  configured: boolean;
  cobrancaAtiva: boolean;
};

type Modo = 'idle' | 'loading' | 'qr' | 'connected' | 'error';

function formatNumber(n: string | null): string {
  if (!n) return '';
  const d = n.replace(/\D/g, '');
  const br = d.startsWith('55') ? d.slice(2) : d;
  if (br.length < 10) return `+${d}`;
  const ddd = br.slice(0, 2);
  const rest = br.slice(2);
  const meio = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
  const fim = rest.length === 9 ? rest.slice(5) : rest.slice(4);
  return `+55 (${ddd}) ${meio}-${fim}`;
}

export default function WhatsAppConnectCard({
  loteadoraId,
  connected,
  number,
  configured,
  cobrancaAtiva,
}: Props) {
  const [modo, setModo] = useState<Modo>(connected ? 'connected' : 'idle');
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [num, setNum] = useState<string | null>(number);
  const [erro, setErro] = useState<string | null>(null);
  const [testNum, setTestNum] = useState('');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ativa, setAtiva] = useState<boolean>(cobrancaAtiva);
  const [ativaErro, setAtivaErro] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (refreshRef.current) clearInterval(refreshRef.current);
    pollRef.current = null;
    refreshRef.current = null;
  }, []);

  useEffect(() => () => stopTimers(), [stopTimers]);

  const loadQr = useCallback(async () => {
    const r = await iniciarConexaoWhatsApp(loteadoraId);
    if (!r.ok) {
      setErro(r.erro || 'Falha ao gerar QR.');
      setModo('error');
      stopTimers();
      return;
    }
    setQr(r.qrBase64 || null);
    setPairing(r.pairingCode || null);
    setModo('qr');
  }, [loteadoraId, stopTimers]);

  async function startConnect() {
    setErro(null);
    setTestMsg(null);
    setModo('loading');
    await loadQr();
    pollRef.current = setInterval(async () => {
      const s = await checarConexaoWhatsApp(loteadoraId);
      if (s.ok && s.state === 'open') {
        stopTimers();
        setNum(s.number);
        setModo('connected');
      }
    }, 3000);
    refreshRef.current = setInterval(() => {
      loadQr().catch(() => {});
    }, 30000);
  }

  async function disconnect() {
    if (!confirm('Desconectar o WhatsApp? A cobrança automática será PAUSADA.')) return;
    stopTimers();
    setBusy(true);
    await desconectarWhatsApp(loteadoraId);
    setBusy(false);
    setQr(null);
    setPairing(null);
    setNum(null);
    setAtiva(false);
    setModo('idle');
  }

  async function sendTest() {
    setTestMsg(null);
    if (!testNum.trim()) {
      setTestMsg('Digite um número (com DDD).');
      return;
    }
    setBusy(true);
    const r = await enviarTesteWhatsApp(testNum, loteadoraId);
    setBusy(false);
    setTestMsg(r.ok ? '✅ Enviado! Confira o WhatsApp do número.' : `❌ ${r.erro}`);
  }

  async function toggleCobranca() {
    setAtivaErro(null);
    setBusy(true);
    const r = ativa
      ? await desativarCobranca(loteadoraId)
      : await ativarCobranca(loteadoraId);
    setBusy(false);
    if (!r.ok) {
      setAtivaErro(r.erro || 'Falha.');
      return;
    }
    setAtiva(Boolean(r.ativa));
  }

  const wrap = 'bg-white border rounded-lg p-4';

  if (!configured) {
    return (
      <div className={`${wrap} border-amber-200`}>
        <p className="text-sm text-amber-700">
          ⚠️ A integração de WhatsApp (Evolution) ainda não foi habilitada no servidor.
          Fale com o suporte da plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className={`${wrap} border-slate-200`}>
      {/* ===== Cabeçalho + status da conexão ===== */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span>📱</span> WhatsApp da cobrança
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Conecte um número e ative quando quiser que a régua comece a enviar.
          </p>
        </div>
        {modo === 'connected' ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ● Conectado {num ? `· ${formatNumber(num)}` : ''}
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            ○ Desconectado
          </span>
        )}
      </div>

      {/* ===== Bloco CONEXÃO ===== */}
      {(modo === 'idle' || modo === 'error') && (
        <div className="mt-3">
          {erro && <p className="text-xs text-red-600 mb-2 break-words">{erro}</p>}
          <button
            onClick={startConnect}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2"
          >
            Conectar WhatsApp
          </button>
        </div>
      )}

      {modo === 'loading' && <p className="mt-3 text-sm text-slate-500">Gerando QR code…</p>}

      {modo === 'qr' && (
        <div className="mt-3 flex flex-col sm:flex-row gap-5 items-start">
          <div className="shrink-0">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR Code WhatsApp"
                className="w-52 h-52 border border-slate-200 rounded-lg bg-white"
              />
            ) : (
              <div className="w-52 h-52 grid place-items-center text-xs text-slate-400 border rounded-lg">
                aguardando QR…
              </div>
            )}
          </div>
          <div className="text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-800">Como conectar:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Abra o <strong>WhatsApp</strong> no celular do número que vai cobrar</li>
              <li>Toque em <strong>⋮ → Aparelhos conectados</strong></li>
              <li><strong>Conectar um aparelho</strong> e aponte para este QR</li>
            </ol>
            {pairing && (
              <div className="mt-2 text-xs">
                <p className="text-slate-500">Ou use o código de pareamento:</p>
                <code className="inline-block mt-1 px-2 py-1 bg-slate-100 rounded font-mono tracking-widest text-slate-800">
                  {pairing}
                </code>
              </div>
            )}
            <p className="text-[11px] text-slate-400 pt-1">
              O QR atualiza sozinho. Assim que conectar, esta tela muda automaticamente.
            </p>
            <button
              onClick={() => {
                stopTimers();
                setModo('idle');
                setQr(null);
              }}
              className="text-xs text-slate-500 underline"
            >
              cancelar
            </button>
          </div>
        </div>
      )}

      {modo === 'connected' && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">
              Enviar teste para (número com DDD)
            </label>
            <input
              value={testNum}
              onChange={(e) => setTestNum(e.target.value)}
              placeholder="75999998888"
              className="border border-slate-300 rounded px-2 py-1.5 text-sm w-44"
            />
          </div>
          <button
            onClick={sendTest}
            disabled={busy}
            className="rounded-md bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm px-3 py-1.5"
          >
            Enviar teste
          </button>
          <button
            onClick={disconnect}
            disabled={busy}
            className="rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm px-3 py-1.5"
          >
            Desconectar
          </button>
          {testMsg && <p className="w-full text-xs text-slate-600">{testMsg}</p>}
        </div>
      )}

      {/* ===== Bloco COBRANÇA AUTOMÁTICA (ativar/desativar) ===== */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-slate-800">Cobrança automática</p>
            <p className="text-xs text-slate-500">
              {ativa
                ? 'Ativa — a régua envia 5 e 3 dias antes, no vencimento e em atraso.'
                : 'Pausada — nenhum lembrete é enviado.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                ativa
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {ativa ? '● Ativa' : '○ Pausada'}
            </span>
            <button
              onClick={toggleCobranca}
              disabled={busy || modo !== 'connected'}
              title={modo !== 'connected' ? 'Conecte o WhatsApp primeiro' : ''}
              className={`rounded-md text-sm font-medium px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                ativa
                  ? 'border border-amber-300 text-amber-700 hover:bg-amber-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {ativa ? 'Desativar' : 'Ativar cobrança'}
            </button>
          </div>
        </div>
        {modo !== 'connected' && (
          <p className="text-[11px] text-slate-400 mt-2">
            Conecte o WhatsApp acima para poder ativar a cobrança.
          </p>
        )}
        {ativaErro && <p className="text-xs text-red-600 mt-2">{ativaErro}</p>}
      </div>
    </div>
  );
}
