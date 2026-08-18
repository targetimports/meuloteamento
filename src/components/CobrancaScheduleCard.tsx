'use client';

import { useState } from 'react';
import { salvarAgendaCobranca } from '@/lib/cobranca-agenda-actions';

type Props = {
  loteadoraId: string;
  diasAntes: number[];
  noVencimento: boolean;
  atrasoDiario: boolean;
};

export default function CobrancaScheduleCard({
  loteadoraId,
  diasAntes,
  noVencimento,
  atrasoDiario,
}: Props) {
  const [dias, setDias] = useState(diasAntes.join(', '));
  const [noVenc, setNoVenc] = useState(noVencimento);
  const [diario, setDiario] = useState(atrasoDiario);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar() {
    setMsg(null);
    const parsed = dias
      .split(/[,\s]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    setBusy(true);
    const r = await salvarAgendaCobranca(loteadoraId, {
      diasAntes: parsed,
      noVencimento: noVenc,
      atrasoDiario: diario,
    });
    setBusy(false);
    setMsg(r.ok ? 'Agenda salva.' : (r.erro ?? 'Não foi possível salvar.'));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Quando cobrar</h2>
      <p className="text-xs text-slate-500 mt-0.5">
        Defina os dias dos lembretes. Toda mensagem vai com link de pagamento + Pix copia e cola.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Lembrar antes do vencimento (dias)
          </label>
          <input
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="5, 3"
            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-48"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Separe por vírgula. Ex: <code>5, 3</code> = avisa 5 e 3 dias antes.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={noVenc}
            onChange={(e) => setNoVenc(e.target.checked)}
            className="rounded border-slate-300"
          />
          Avisar também <strong>no dia do vencimento</strong>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={diario}
            onChange={(e) => setDiario(e.target.checked)}
            className="rounded border-slate-300"
          />
          Cobrar <strong>todo dia</strong> enquanto a parcela estiver vencida
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={salvar}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar agenda'}
          </button>
          {msg && <span className="text-xs text-slate-600">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
