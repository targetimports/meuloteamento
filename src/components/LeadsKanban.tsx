'use client';

/**
 * CRM Kanban de leads — 5 colunas (Novo, Em atendimento, Agendado, Convertido, Perdido).
 * Drag-and-drop nativo HTML5, optimistic update + revalidação.
 * Toggle Kanban/Lista, busca textual, filtros por corretor/origem/temperatura.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LeadDrawer } from './LeadDrawer';
import { moverLead } from '@/app/admin/(dashboard)/leads/actions';

export type LeadStatus = 'NOVO' | 'EM_ATENDIMENTO' | 'AGENDADO' | 'CONVERTIDO' | 'PERDIDO';
export type LeadTemperatura = 'FRIO' | 'MORNO' | 'QUENTE';

export interface LeadUI {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mensagem: string | null;
  status: LeadStatus;
  temperatura: LeadTemperatura;
  origem: string | null;
  ordem: number;
  proximaAcao: string | null;
  proximaAcaoData: string | null;
  tags: string[];
  corretor: { id: string; nome: string } | null;
  loteamento: { nome: string; slug: string } | null;
  lote: { codigo: string } | null;
  createdAt: string;
  updatedAt: string;
  observacoesInternas: string | null;
}

export interface CorretorOpt {
  id: string;
  nome: string;
}

interface Props {
  leads: LeadUI[];
  corretores: CorretorOpt[];
  origens: string[];
  isSuperAdmin?: boolean;
}

const COLUNAS: {
  status: LeadStatus;
  label: string;
  dot: string;
  headBg: string;
  headText: string;
}[] = [
  { status: 'NOVO', label: 'Novos', dot: 'bg-sky-500', headBg: 'bg-sky-50 dark:bg-sky-500/10', headText: 'text-sky-700 dark:text-sky-300' },
  { status: 'EM_ATENDIMENTO', label: 'Em atendimento', dot: 'bg-amber-500', headBg: 'bg-amber-50 dark:bg-amber-500/10', headText: 'text-amber-700 dark:text-amber-300' },
  { status: 'AGENDADO', label: 'Agendados', dot: 'bg-violet-500', headBg: 'bg-violet-50 dark:bg-violet-500/10', headText: 'text-violet-700 dark:text-violet-300' },
  { status: 'CONVERTIDO', label: 'Convertidos', dot: 'bg-emerald-500', headBg: 'bg-emerald-50 dark:bg-emerald-500/10', headText: 'text-emerald-700 dark:text-emerald-300' },
  { status: 'PERDIDO', label: 'Perdidos', dot: 'bg-slate-400', headBg: 'bg-slate-100 dark:bg-slate-800', headText: 'text-slate-600 dark:text-slate-400' },
];

const TEMP_CONFIG: Record<LeadTemperatura, { label: string; cor: string; emoji: string }> = {
  FRIO: { label: 'Frio', cor: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', emoji: '🧊' },
  MORNO: { label: 'Morno', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', emoji: '🌤️' },
  QUENTE: { label: 'Quente', cor: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', emoji: '🔥' },
};

const inputCls =
  'px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500';

function diffParaTexto(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias}d`;
  return d.toLocaleDateString('pt-BR');
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LeadsKanban({ leads, corretores, origens, isSuperAdmin }: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban');
  const [busca, setBusca] = useState('');
  const [filtroCorretor, setFiltroCorretor] = useState<string>('');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('');
  const [filtroTemperatura, setFiltroTemperatura] = useState<string>('');
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useState<LeadUI[] | null>(null);
  const leadsFinal = optimistic ?? leads;

  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<LeadStatus | null>(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leadsFinal.filter((l) => {
      if (q) {
        const blob = `${l.nome} ${l.email} ${l.telefone} ${l.mensagem ?? ''} ${
          l.lote?.codigo ?? ''
        }`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (filtroCorretor) {
        if (filtroCorretor === '__none__') {
          if (l.corretor) return false;
        } else if (l.corretor?.id !== filtroCorretor) return false;
      }
      if (filtroOrigem && (l.origem ?? '') !== filtroOrigem) return false;
      if (filtroTemperatura && l.temperatura !== filtroTemperatura) return false;
      return true;
    });
  }, [leadsFinal, busca, filtroCorretor, filtroOrigem, filtroTemperatura]);

  const porColuna = useMemo(() => {
    const m = new Map<LeadStatus, LeadUI[]>();
    for (const c of COLUNAS) m.set(c.status, []);
    for (const l of filtered) m.get(l.status)?.push(l);
    for (const arr of m.values()) arr.sort((a, b) => a.ordem - b.ordem);
    return m;
  }, [filtered]);

  function handleDrop(novoStatus: LeadStatus, indice: number) {
    if (!dragId) return;
    const moving = leadsFinal.find((l) => l.id === dragId);
    if (!moving) return;

    const colunaAtual = (porColuna.get(novoStatus) ?? []).filter((l) => l.id !== dragId);
    const antes = colunaAtual[indice - 1];
    const depois = colunaAtual[indice];
    const novaOrdem =
      antes && depois
        ? (antes.ordem + depois.ordem) / 2
        : antes
          ? antes.ordem + 1
          : depois
            ? depois.ordem - 1
            : 0;

    setOptimistic(
      leadsFinal.map((l) =>
        l.id === dragId ? { ...l, status: novoStatus, ordem: novaOrdem } : l
      )
    );

    startTransition(async () => {
      const r = await moverLead({ leadId: dragId, novoStatus, ordem: novaOrdem });
      if (!r.ok) {
        setOptimistic(null);
        alert(`Falha ao mover: ${r.error ?? 'erro desconhecido'}`);
      } else {
        router.refresh();
        setOptimistic(null);
      }
    });

    setDragId(null);
    setHoverCol(null);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap gap-3 items-center">
        <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setVista('kanban')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              vista === 'kanban'
                ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setVista('lista')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              vista === 'lista'
                ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Lista
          </button>
        </div>

        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome, email, telefone..."
          className={`flex-1 min-w-[200px] ${inputCls}`}
        />

        <select
          value={filtroCorretor}
          onChange={(e) => setFiltroCorretor(e.target.value)}
          className={inputCls}
        >
          <option value="">Todos os corretores</option>
          <option value="__none__">Sem corretor</option>
          {corretores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        {origens.length > 1 && (
          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value)}
            className={inputCls}
          >
            <option value="">Todas as origens</option>
            {origens.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}

        <select
          value={filtroTemperatura}
          onChange={(e) => setFiltroTemperatura(e.target.value)}
          className={inputCls}
        >
          <option value="">Temperatura: todas</option>
          <option value="QUENTE">🔥 Quente</option>
          <option value="MORNO">🌤️ Morno</option>
          <option value="FRIO">🧊 Frio</option>
        </select>

        <a
          href="/admin/leads/em-massa"
          className="text-xs font-medium bg-slate-900 dark:bg-slate-700 hover:opacity-90 text-white px-3 py-1.5 rounded-lg"
        >
          Ações em massa
        </a>

        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} de {leads.length}
        </span>
      </div>

      {pending && (
        <div className="text-xs text-slate-400 -mt-2 flex items-center gap-1.5">
          <span className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          Salvando…
        </div>
      )}

      {/* ============ KANBAN ============ */}
      {vista === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 min-h-[60vh]">
          {COLUNAS.map((col) => {
            const items = porColuna.get(col.status) ?? [];
            const isHover = hoverCol === col.status;
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHoverCol(col.status);
                }}
                onDragLeave={() => setHoverCol((c) => (c === col.status ? null : c))}
                onDrop={() => handleDrop(col.status, items.length)}
                className={`rounded-2xl p-2 border-2 transition ${
                  isHover
                    ? 'border-dashed border-primary-400 bg-primary-50/40 dark:bg-primary-500/5'
                    : 'border-transparent bg-slate-100/70 dark:bg-slate-900/60'
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-xl ${col.headBg} mb-2 flex items-center gap-2`}
                >
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className={`text-sm font-bold ${col.headText}`}>{col.label}</h3>
                  <span className={`ml-auto text-xs font-mono ${col.headText}`}>
                    {items.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-[40px]">
                  {items.map((lead, idx) => (
                    <div key={lead.id}>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleDrop(col.status, idx);
                        }}
                        className="h-1.5 -mb-0.5"
                      />
                      <LeadCard
                        lead={lead}
                        onOpen={() => setDrawerLeadId(lead.id)}
                        onDragStart={() => setDragId(lead.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setHoverCol(null);
                        }}
                        showLoteadora={!!isSuperAdmin}
                      />
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center text-xs text-slate-400 dark:text-slate-600 py-6 italic">
                      Arraste leads aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ LISTA ============ */}
      {vista === 'lista' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Quando</th>
                <th className="text-left px-4 py-3 font-semibold">Nome / contato</th>
                <th className="text-left px-4 py-3 font-semibold">Interesse</th>
                <th className="text-left px-4 py-3 font-semibold">Corretor</th>
                <th className="text-left px-4 py-3 font-semibold">Temp.</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((lead) => {
                const col = COLUNAS.find((c) => c.status === lead.status);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setDrawerLeadId(lead.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {diffParaTexto(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {lead.nome}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{lead.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{lead.telefone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {lead.lote ? `Lote ${lead.lote.codigo}` : lead.loteamento?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {lead.corretor?.nome ?? (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${TEMP_CONFIG[lead.temperatura].cor}`}
                      >
                        {TEMP_CONFIG[lead.temperatura].emoji} {TEMP_CONFIG[lead.temperatura].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full ${col?.headBg ?? ''} ${col?.headText ?? ''}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${col?.dot ?? ''}`} />
                        {col?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                        Abrir →
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-sm text-slate-500 dark:text-slate-400"
                  >
                    Nenhum lead encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {drawerLeadId && (
        <LeadDrawer
          leadId={drawerLeadId}
          corretores={corretores}
          onClose={() => setDrawerLeadId(null)}
        />
      )}
    </div>
  );
}

// =====================================================================
// LeadCard
// =====================================================================

function LeadCard({
  lead,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadUI;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  showLoteadora?: boolean;
}) {
  const temp = TEMP_CONFIG[lead.temperatura];

  const diasParado = Math.floor(
    (Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const alerta =
    diasParado >= 5 && lead.status !== 'CONVERTIDO' && lead.status !== 'PERDIDO';

  const acaoVencida =
    lead.proximaAcaoData && new Date(lead.proximaAcaoData).getTime() < Date.now();

  const initials = lead.nome
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const whatsappHref = lead.telefone
    ? `https://wa.me/55${lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Olá ${lead.nome.split(' ')[0]}!`
      )}`
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition border ${
        alerta
          ? 'border-red-200 dark:border-red-500/40'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">
            {lead.nome}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{lead.email}</p>
        </div>
        <span
          className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded ${temp.cor} font-bold`}
          title={temp.label}
        >
          {temp.emoji}
        </span>
      </div>

      {(lead.lote || lead.loteamento) && (
        <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-1.5">
          {lead.lote ? `Lote ${lead.lote.codigo}` : lead.loteamento?.nome}
        </p>
      )}

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {lead.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {lead.proximaAcao && (
        <div
          className={`text-[10px] flex items-center gap-1 px-1.5 py-1 rounded mb-1.5 ${
            acaoVencida
              ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
              : 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
          }`}
        >
          <span>📅</span>
          <span className="truncate">{lead.proximaAcao}</span>
          {lead.proximaAcaoData && (
            <span className="ml-auto font-mono">{formatarData(lead.proximaAcaoData)}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <span title={`Criado em ${new Date(lead.createdAt).toLocaleString('pt-BR')}`}>
          {diffParaTexto(lead.createdAt)}
        </span>
        <div className="flex items-center gap-1.5">
          {lead.corretor ? (
            <span
              className="text-slate-600 dark:text-slate-300 truncate max-w-[80px]"
              title={lead.corretor.nome}
            >
              {lead.corretor.nome.split(' ')[0]}
            </span>
          ) : (
            <span className="text-red-500 dark:text-red-400">sem corretor</span>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-emerald-600 dark:text-emerald-400 hover:opacity-80"
              title="Abrir WhatsApp"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {alerta && (
        <p className="text-[9px] text-red-600 dark:text-red-400 mt-1 font-medium">
          ⚠ Sem movimentação há {diasParado} dias
        </p>
      )}
    </div>
  );
}
