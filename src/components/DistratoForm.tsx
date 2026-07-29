'use client';

import { useState, useTransition } from 'react';

interface Props {
  vendaId: string;
  vendaNumero: number;
  loteCodigo: string;
  parcelasPendentes: number;
  action: (vendaId: string, formData: FormData) => Promise<void>;
}

export function DistratoForm({
  vendaId,
  vendaNumero,
  loteCodigo,
  parcelasPendentes,
  action,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState('');
  const [tipoStatus, setTipoStatus] = useState<'DISTRATADA' | 'CANCELADA'>('DISTRATADA');
  const [novoStatusLote, setNovoStatusLote] = useState<'DISPONIVEL' | 'RESERVADO' | 'BLOQUEADO'>(
    'DISPONIVEL'
  );

  function submit() {
    if (
      !confirm(
        `Confirmar ${tipoStatus.toLowerCase()} do contrato #${vendaNumero}?\n\n` +
          `- ${parcelasPendentes} parcela(s) em aberto serão CANCELADAS\n` +
          `- Lote ${loteCodigo} ficará ${novoStatusLote.toLowerCase()}\n` +
          `- Ação é registrada na auditoria`
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set('motivo', motivo);
    fd.set('tipoStatus', tipoStatus);
    fd.set('novoStatusLote', novoStatusLote);
    startTransition(() => action(vendaId, fd));
  }

  if (!open) {
    return (
      <section className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="font-semibold text-red-900 mb-1">Encerrar este contrato</h2>
        <p className="text-sm text-red-700 mb-3">
          Distrato libera o lote e cancela as parcelas em aberto. Não apaga histórico — fica registrado.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Distratar / Cancelar venda
        </button>
      </section>
    );
  }

  return (
    <section className="bg-red-50 border-2 border-red-300 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-bold text-red-900 mb-1">Distrato / Cancelamento</h2>
        <p className="text-sm text-red-800">
          Contrato <strong>#{vendaNumero}</strong> · Lote{' '}
          <strong>{loteCodigo}</strong> · <strong>{parcelasPendentes}</strong> parcela(s) em aberto
          serão canceladas.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-red-900 mb-2">
            Tipo
          </label>
          <select
            value={tipoStatus}
            onChange={(e) => setTipoStatus(e.target.value as 'DISTRATADA' | 'CANCELADA')}
            className="w-full px-3 py-2 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="DISTRATADA">Distratada — cliente desistiu</option>
            <option value="CANCELADA">Cancelada — erro de cadastro / outro motivo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-red-900 mb-2">
            Lote ficará
          </label>
          <select
            value={novoStatusLote}
            onChange={(e) => setNovoStatusLote(e.target.value as 'DISPONIVEL' | 'RESERVADO' | 'BLOQUEADO')}
            className="w-full px-3 py-2 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="DISPONIVEL">Disponível — volta pra venda</option>
            <option value="RESERVADO">Reservado — você vai negociar com outro cliente</option>
            <option value="BLOQUEADO">Bloqueado — não fica visível no site público</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-red-900 mb-2">
          Motivo (registrado na auditoria)
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Ex: Cliente solicitou distrato por motivos pessoais — devolução conforme contrato"
          className="w-full px-3 py-2 text-sm bg-white border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg"
        >
          {pending ? 'Processando...' : `Confirmar ${tipoStatus.toLowerCase()}`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-lg"
        >
          Voltar
        </button>
      </div>
    </section>
  );
}
