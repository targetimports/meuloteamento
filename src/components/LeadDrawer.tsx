'use client';

/**
 * Drawer/modal de detalhe do lead.
 * Carrega dados completos via fetch e mostra:
 *  - cabeçalho com nome, contato, ações rápidas (WhatsApp, e-mail, telefone)
 *  - controles inline: status, temperatura, corretor, próxima ação, tags
 *  - timeline de interações (notas, ligações, etc) com formulário pra nova
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  atribuirCorretor,
  setTemperatura,
  adicionarInteracao,
  agendarProximaAcao,
  toggleTag,
  moverLead,
  excluirLead,
} from '@/app/admin/(dashboard)/leads/actions';

interface CorretorOpt {
  id: string;
  nome: string;
}

interface LeadFull {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mensagem: string | null;
  status: 'NOVO' | 'EM_ATENDIMENTO' | 'AGENDADO' | 'CONVERTIDO' | 'PERDIDO';
  temperatura: 'FRIO' | 'MORNO' | 'QUENTE';
  origem: string | null;
  ordem: number;
  proximaAcao: string | null;
  proximaAcaoData: string | null;
  tags: string[];
  corretor: { id: string; nome: string } | null;
  loteamento: { nome: string; slug: string } | null;
  lote: { codigo: string } | null;
  observacoesInternas: string | null;
  createdAt: string;
  updatedAt: string;
  interacoes: Array<{
    id: string;
    tipo: string;
    conteudo: string;
    resultado: string | null;
    user: { nome: string } | null;
    createdAt: string;
  }>;
}

const TIPO_INTERACAO_OPTS = [
  { value: 'NOTA', label: '📝 Nota' },
  { value: 'LIGACAO', label: '📞 Ligação' },
  { value: 'WHATSAPP', label: '💬 WhatsApp' },
  { value: 'EMAIL', label: '📧 E-mail' },
  { value: 'VISITA', label: '🚗 Visita' },
  { value: 'REUNIAO', label: '🤝 Reunião' },
  { value: 'PROPOSTA', label: '📄 Proposta' },
  { value: 'OUTRO', label: '… Outro' },
];

const STATUS_OPTS = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { value: 'AGENDADO', label: 'Agendado' },
  { value: 'CONVERTIDO', label: 'Convertido' },
  { value: 'PERDIDO', label: 'Perdido' },
];

export function LeadDrawer({
  leadId,
  corretores,
  onClose,
}: {
  leadId: string;
  corretores: CorretorOpt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // formulários
  const [novaInteracaoTipo, setNovaInteracaoTipo] = useState('NOTA');
  const [novaInteracaoTexto, setNovaInteracaoTexto] = useState('');
  const [novaAcaoTexto, setNovaAcaoTexto] = useState('');
  const [novaAcaoData, setNovaAcaoData] = useState('');
  const [novaTag, setNovaTag] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setLead(d.lead);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [leadId]);

  function recarregar() {
    return fetch(`/api/admin/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => d.lead && setLead(d.lead));
  }

  function exec<T>(fn: () => Promise<T>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        await recarregar();
        router.refresh();
        if (after) after();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  }

  // Fechar com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const whatsapp = lead?.telefone
    ? `https://wa.me/55${lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Olá ${lead.nome.split(' ')[0]}!`
      )}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col"
      >
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="p-6 text-red-700">
            <p className="font-bold">Erro: {error}</p>
            <button onClick={onClose} className="mt-3 underline">
              Fechar
            </button>
          </div>
        )}
        {lead && (
          <>
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-5 sticky top-0 z-10">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {lead.nome
                    .split(' ')
                    .map((n) => n.charAt(0))
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-slate-900 text-xl leading-tight truncate">
                    {lead.nome}
                  </h2>
                  <div className="text-xs text-slate-500 space-y-0.5 mt-1">
                    <p>📧 {lead.email}</p>
                    <p>📱 {lead.telefone}</p>
                    {(lead.lote || lead.loteamento) && (
                      <p>
                        🏠{' '}
                        {lead.lote ? `Lote ${lead.lote.codigo} · ` : ''}
                        {lead.loteamento?.nome}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-700 text-xl"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              {/* Ações rápidas */}
              <div className="flex gap-2 mt-4">
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg"
                  >
                    💬 WhatsApp
                  </a>
                )}
                <a
                  href={`mailto:${lead.email}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 rounded-lg"
                >
                  📧 E-mail
                </a>
                <a
                  href={`tel:${lead.telefone.replace(/\D/g, '')}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold py-2 rounded-lg"
                >
                  📞 Ligar
                </a>
              </div>
            </div>

            {/* Controles inline */}
            <div className="p-5 space-y-3">
              <ControlRow label="Status">
                <select
                  disabled={pending}
                  value={lead.status}
                  onChange={(e) =>
                    exec(() =>
                      moverLead({
                        leadId: lead.id,
                        novoStatus: e.target.value as LeadFull['status'],
                        ordem: lead.ordem,
                      })
                    )
                  }
                  className="text-sm font-semibold px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </ControlRow>

              <ControlRow label="Temperatura">
                <div className="flex gap-1">
                  {(['FRIO', 'MORNO', 'QUENTE'] as const).map((t) => (
                    <button
                      key={t}
                      disabled={pending}
                      onClick={() => exec(() => setTemperatura({ leadId: lead.id, temperatura: t }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        lead.temperatura === t
                          ? t === 'QUENTE'
                            ? 'bg-red-500 text-white'
                            : t === 'MORNO'
                              ? 'bg-amber-500 text-white'
                              : 'bg-blue-500 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'QUENTE' ? '🔥' : t === 'MORNO' ? '🌤️' : '🧊'} {t}
                    </button>
                  ))}
                </div>
              </ControlRow>

              <ControlRow label="Corretor">
                <select
                  disabled={pending}
                  value={lead.corretor?.id ?? ''}
                  onChange={(e) =>
                    exec(() =>
                      atribuirCorretor({
                        leadId: lead.id,
                        corretorId: e.target.value || null,
                      })
                    )
                  }
                  className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg bg-white min-w-[200px]"
                >
                  <option value="">— Sem corretor —</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </ControlRow>

              <ControlRow label="Tags">
                <div className="flex flex-wrap items-center gap-1">
                  {lead.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => exec(() => toggleTag({ leadId: lead.id, tag: t }))}
                      className="text-xs px-2 py-0.5 bg-slate-100 hover:bg-red-100 hover:text-red-700 text-slate-700 rounded transition"
                      title="Clique para remover"
                    >
                      {t} ×
                    </button>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!novaTag.trim()) return;
                      exec(
                        () => toggleTag({ leadId: lead.id, tag: novaTag }),
                        () => setNovaTag('')
                      );
                    }}
                    className="inline-flex"
                  >
                    <input
                      value={novaTag}
                      onChange={(e) => setNovaTag(e.target.value)}
                      placeholder="+ tag"
                      className="text-xs px-2 py-0.5 border border-slate-200 rounded w-20 focus:w-32 transition-all outline-none"
                    />
                  </form>
                </div>
              </ControlRow>

              {/* Próxima ação */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-700 mb-2">
                  📅 Próxima ação
                </p>
                {lead.proximaAcao ? (
                  <div className="mb-2 text-sm text-violet-900">
                    <strong>{lead.proximaAcao}</strong>
                    {lead.proximaAcaoData && (
                      <span className="ml-2 text-xs text-violet-600">
                        ({new Date(lead.proximaAcaoData).toLocaleString('pt-BR')})
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-violet-600 mb-2">Nada agendado.</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <input
                    value={novaAcaoTexto}
                    onChange={(e) => setNovaAcaoTexto(e.target.value)}
                    placeholder="ex: Ligar para apresentar lote 42"
                    className="flex-1 min-w-[180px] text-sm px-2 py-1 border border-violet-200 rounded-lg bg-white"
                  />
                  <input
                    type="datetime-local"
                    value={novaAcaoData}
                    onChange={(e) => setNovaAcaoData(e.target.value)}
                    className="text-sm px-2 py-1 border border-violet-200 rounded-lg bg-white"
                  />
                  <button
                    disabled={pending || !novaAcaoTexto.trim() || !novaAcaoData}
                    onClick={() =>
                      exec(
                        () =>
                          agendarProximaAcao({
                            leadId: lead.id,
                            acao: novaAcaoTexto,
                            data: novaAcaoData,
                          }),
                        () => {
                          setNovaAcaoTexto('');
                          setNovaAcaoData('');
                        }
                      )
                    }
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1 rounded-lg"
                  >
                    Agendar
                  </button>
                </div>
              </div>

              {/* Mensagem original */}
              {lead.mensagem && (
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    💬 Mensagem original
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.mensagem}</p>
                  {lead.origem && (
                    <p className="text-[10px] text-slate-400 mt-2">via {lead.origem}</p>
                  )}
                </div>
              )}

              {/* Nova interação */}
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  ✚ Adicionar interação
                </p>
                <div className="space-y-2">
                  <select
                    value={novaInteracaoTipo}
                    onChange={(e) => setNovaInteracaoTipo(e.target.value)}
                    className="text-sm px-2 py-1 border border-slate-300 rounded-lg w-full bg-white"
                  >
                    {TIPO_INTERACAO_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={novaInteracaoTexto}
                    onChange={(e) => setNovaInteracaoTexto(e.target.value)}
                    rows={3}
                    placeholder="Descreva o que aconteceu nesta interação..."
                    className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-lg"
                  />
                  <button
                    disabled={pending || !novaInteracaoTexto.trim()}
                    onClick={() =>
                      exec(
                        () =>
                          adicionarInteracao({
                            leadId: lead.id,
                            tipo: novaInteracaoTipo as 'NOTA',
                            conteudo: novaInteracaoTexto,
                          }),
                        () => setNovaInteracaoTexto('')
                      )
                    }
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold py-1.5 rounded-lg"
                  >
                    Salvar interação
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  📜 Histórico ({lead.interacoes.length})
                </p>
                {lead.interacoes.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Sem interações registradas.</p>
                ) : (
                  <ol className="relative ms-3 border-s-2 border-slate-200 space-y-3 pt-1">
                    {lead.interacoes.map((i) => {
                      const opt = TIPO_INTERACAO_OPTS.find((o) => o.value === i.tipo);
                      return (
                        <li key={i.id} className="ms-4 bg-white border border-slate-200 rounded-lg p-3">
                          <span className="absolute -start-[9px] mt-1 w-4 h-4 rounded-full bg-primary-500 ring-4 ring-slate-50" />
                          <div className="flex items-baseline justify-between mb-1">
                            <p className="text-xs font-bold text-slate-700">
                              {opt?.label ?? i.tipo}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {new Date(i.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{i.conteudo}</p>
                          {i.resultado && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Resultado: {i.resultado}
                            </p>
                          )}
                          {i.user && (
                            <p className="text-[10px] text-slate-400 mt-1">por {i.user.nome}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              {/* Excluir */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    if (!confirm('Tem certeza que deseja excluir este lead permanentemente?'))
                      return;
                    startTransition(async () => {
                      await excluirLead(lead.id);
                      onClose();
                      router.refresh();
                    });
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Excluir lead permanentemente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-28 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
