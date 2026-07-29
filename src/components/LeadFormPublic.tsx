'use client';

import { useState } from 'react';

interface Props {
  loteamentoId?: string;
  loteId?: string;
  origem?: string;
  hideTitle?: boolean;
}

export function LeadFormPublic({ loteamentoId, loteId, origem = 'site', hideTitle }: Props) {
  const [status, setStatus] = useState<'idle' | 'enviando' | 'ok' | 'erro'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('enviando');
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, loteamentoId, loteId, origem }),
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      setStatus('ok');
      e.currentTarget.reset();
    } catch (err) {
      setStatus('erro');
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }

  if (status === 'ok') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <p className="font-semibold text-emerald-900 mb-1">Mensagem enviada!</p>
        <p className="text-sm text-emerald-700">Em breve um consultor entrará em contato.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
    >
      {!hideTitle && (
        <div>
          <h3 className="font-semibold text-slate-900">Tenho interesse</h3>
          <p className="text-xs text-slate-500">Deixe seu contato e retornaremos.</p>
        </div>
      )}

      {/* honeypot — invisível para humanos */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: 'absolute', left: '-9999px', height: 0, width: 0 }}
        aria-hidden
      />

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Nome *</label>
        <input
          name="nome"
          required
          minLength={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">E-mail *</label>
          <input
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Telefone *</label>
          <input
            name="telefone"
            required
            minLength={8}
            placeholder="(11) 99999-9999"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Mensagem</label>
        <textarea
          name="mensagem"
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Conte um pouco sobre seu interesse..."
        />
      </div>

      {status === 'erro' && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {error ?? 'Falha ao enviar. Tente novamente.'}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'enviando'}
        className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg"
      >
        {status === 'enviando' ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
}
