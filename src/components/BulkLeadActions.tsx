'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  bulkMudarStatus,
  bulkAtribuirCorretor,
  bulkEnviarMensagem,
} from '@/app/admin/(dashboard)/leads/bulk-actions';

type Status = 'NOVO' | 'EM_ATENDIMENTO' | 'AGENDADO' | 'CONVERTIDO' | 'PERDIDO';

interface Props {
  leadIds: string[];
  corretores: { id: string; nome: string }[];
  onClear: () => void;
}

export default function BulkLeadActions({ leadIds, corretores, onClear }: Props) {
  const [tab, setTab] = useState<'status' | 'corretor' | 'mensagem'>('status');
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  const [status, setStatus] = useState<Status>('EM_ATENDIMENTO');
  const [corretorId, setCorretorId] = useState<string>('');
  const [canal, setCanal] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [assunto, setAssunto] = useState('');
  const [template, setTemplate] = useState(
    'Olá {{cliente.nome}}, vi seu interesse no nosso loteamento. Posso te ajudar?'
  );

  function done(text: string) {
    setMsg(text);
    router.refresh();
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-lg shadow-2xl px-4 py-3 w-full max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">
          {leadIds.length} selecionado{leadIds.length !== 1 ? 's' : ''}
        </div>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-white">
          Limpar
        </button>
      </div>

      <div className="flex gap-1 mb-3 text-xs">
        <button
          onClick={() => setTab('status')}
          className={`px-3 py-1.5 rounded ${tab === 'status' ? 'bg-white text-slate-900' : 'bg-slate-700'}`}
        >
          Mudar status
        </button>
        <button
          onClick={() => setTab('corretor')}
          className={`px-3 py-1.5 rounded ${tab === 'corretor' ? 'bg-white text-slate-900' : 'bg-slate-700'}`}
        >
          Atribuir corretor
        </button>
        <button
          onClick={() => setTab('mensagem')}
          className={`px-3 py-1.5 rounded ${tab === 'mensagem' ? 'bg-white text-slate-900' : 'bg-slate-700'}`}
        >
          Enviar mensagem
        </button>
      </div>

      {tab === 'status' && (
        <div className="flex gap-2 items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="bg-white text-slate-900 rounded px-2 py-1 text-sm"
          >
            <option value="NOVO">NOVO</option>
            <option value="EM_ATENDIMENTO">EM ATENDIMENTO</option>
            <option value="AGENDADO">AGENDADO</option>
            <option value="CONVERTIDO">CONVERTIDO</option>
            <option value="PERDIDO">PERDIDO</option>
          </select>
          <button
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await bulkMudarStatus({ leadIds, novoStatus: status });
                done(r.ok ? `${r.atualizados} atualizados` : 'Erro');
              })
            }
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium"
          >
            Aplicar
          </button>
        </div>
      )}

      {tab === 'corretor' && (
        <div className="flex gap-2 items-center">
          <select
            value={corretorId}
            onChange={(e) => setCorretorId(e.target.value)}
            className="bg-white text-slate-900 rounded px-2 py-1 text-sm flex-1"
          >
            <option value="">— Remover atribuição —</option>
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await bulkAtribuirCorretor({
                  leadIds,
                  corretorId: corretorId || null,
                });
                done(r.ok ? `${r.atualizados} atualizados` : 'Erro');
              })
            }
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium"
          >
            Aplicar
          </button>
        </div>
      )}

      {tab === 'mensagem' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as 'WHATSAPP' | 'EMAIL')}
              className="bg-white text-slate-900 rounded px-2 py-1 text-sm"
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
            </select>
            {canal === 'EMAIL' && (
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Assunto"
                className="bg-white text-slate-900 rounded px-2 py-1 text-sm flex-1"
              />
            )}
          </div>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="w-full bg-white text-slate-900 rounded px-2 py-1.5 text-sm"
          />
          <button
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const r = await bulkEnviarMensagem({
                  leadIds,
                  canal,
                  assunto: canal === 'EMAIL' ? assunto : undefined,
                  template,
                });
                done(r.ok ? `${r.criados} enfileirados` : 'Erro');
              })
            }
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium"
          >
            Enfileirar envio
          </button>
        </div>
      )}

      {msg && (
        <div className="mt-2 text-xs text-emerald-300">{msg}</div>
      )}
    </div>
  );
}
