'use client';

/**
 * Funil de leads — kanban com etapas configuráveis.
 *
 * As colunas vêm de `pipeline_stages`, não de um enum no código: renomear,
 * somar ou reordenar etapa é trabalho de quem usa, na tela de Etapas.
 *
 * O alerta de tempo parado sai do SLA da própria etapa. Um limiar fixo para
 * todas ("5 dias") acende em quase todo card de etapa lenta e em nenhum de
 * etapa rápida — e alerta que aparece sempre deixa de ser alerta.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Search, Settings2, Users } from 'lucide-react';

import { LeadDrawer } from '@/components/LeadDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { moverLeadParaEtapa } from '@/app/admin/(dashboard)/leads/actions';

export type LeadTemperatura = 'FRIO' | 'MORNO' | 'QUENTE';

export interface EtapaKanban {
  id: string;
  nome: string;
  cor: string | null;
  slaHoras: number | null;
  ehFinal: boolean;
  ehGanho: boolean;
}

export interface LeadUI {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mensagem: string | null;
  etapaId: string | null;
  temperatura: LeadTemperatura;
  origem: string | null;
  ordem: number;
  statusDesde: string;
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
  etapas: EtapaKanban[];
  corretores: CorretorOpt[];
  origens: string[];
  isSuperAdmin?: boolean;
}

const TEMP_CONFIG: Record<LeadTemperatura, { label: string; emoji: string; badge: 'infoSoft' | 'warningSoft' | 'errorSoft' }> = {
  FRIO: { label: 'Frio', emoji: '🧊', badge: 'infoSoft' },
  MORNO: { label: 'Morno', emoji: '🌤️', badge: 'warningSoft' },
  QUENTE: { label: 'Quente', emoji: '🔥', badge: 'errorSoft' },
};

const selectCls =
  'h-9 rounded-md border border-input bg-transparent px-3 text-body-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

function diffParaTexto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Tempo parado, em formato curto: `32d`, `6h`. Mais rápido de ler que a frase. */
function tempoParado(desde: string): string {
  const horas = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 3_600_000));
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

type Faixa = 'ok' | 'atencao' | 'estourado';

function faixaSla(etapa: EtapaKanban | undefined, desde: string): Faixa {
  if (!etapa || etapa.ehFinal || !etapa.slaHoras) return 'ok';
  const horas = (Date.now() - new Date(desde).getTime()) / 3_600_000;
  if (horas >= etapa.slaHoras) return 'estourado';
  if (horas >= etapa.slaHoras * 0.75) return 'atencao';
  return 'ok';
}

export function FunilKanban({ leads, etapas, corretores, origens, isSuperAdmin }: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban');
  const [busca, setBusca] = useState('');
  const [filtroCorretor, setFiltroCorretor] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroTemperatura, setFiltroTemperatura] = useState('');
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useState<LeadUI[] | null>(null);
  const leadsFinal = optimistic ?? leads;

  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  const filtrados = useMemo(() => {
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

  const porEtapa = useMemo(() => {
    const m = new Map<string, LeadUI[]>();
    for (const e of etapas) m.set(e.id, []);
    for (const l of filtrados) if (l.etapaId) m.get(l.etapaId)?.push(l);
    for (const arr of m.values()) arr.sort((a, b) => a.ordem - b.ordem);
    return m;
  }, [filtrados, etapas]);

  const parados = useMemo(
    () => filtrados.filter((l) => faixaSla(etapaPorId.get(l.etapaId ?? ''), l.statusDesde) === 'estourado').length,
    [filtrados, etapaPorId]
  );

  function handleDrop(etapaId: string, indice: number) {
    if (!dragId) return;
    const movendo = leadsFinal.find((l) => l.id === dragId);
    if (!movendo) return;

    const coluna = (porEtapa.get(etapaId) ?? []).filter((l) => l.id !== dragId);
    const antes = coluna[indice - 1];
    const depois = coluna[indice];
    const novaOrdem =
      antes && depois
        ? (antes.ordem + depois.ordem) / 2
        : antes
          ? antes.ordem + 1
          : depois
            ? depois.ordem - 1
            : 0;

    const mudouDeEtapa = movendo.etapaId !== etapaId;
    setOptimistic(
      leadsFinal.map((l) =>
        l.id === dragId
          ? {
              ...l,
              etapaId,
              ordem: novaOrdem,
              // Reordenar dentro da coluna não reinicia o relógio do SLA — só
              // a troca de etapa reinicia, igual ao que o servidor faz.
              statusDesde: mudouDeEtapa ? new Date().toISOString() : l.statusDesde,
            }
          : l
      )
    );

    const leadId = dragId;
    startTransition(async () => {
      const r = await moverLeadParaEtapa({ leadId, etapaId, ordem: novaOrdem });
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
      {/* Barra de comando */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Tabs value={vista} onValueChange={(v) => setVista(v as 'kanban' | 'lista')}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, e-mail, telefone…"
            className="h-9 pl-9 text-body-sm"
          />
        </div>

        <select
          value={filtroCorretor}
          onChange={(e) => setFiltroCorretor(e.target.value)}
          className={selectCls}
          aria-label="Filtrar por corretor"
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
            className={selectCls}
            aria-label="Filtrar por origem"
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
          className={selectCls}
          aria-label="Filtrar por temperatura"
        >
          <option value="">Temperatura: todas</option>
          <option value="QUENTE">🔥 Quente</option>
          <option value="MORNO">🌤️ Morno</option>
          <option value="FRIO">🧊 Frio</option>
        </select>

        <Button variant="outline" size="sm" asChild>
          <a href="/admin/leads/em-massa">
            <Users /> Em massa
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href="/admin/leads/etapas">
            <Settings2 /> Etapas
          </a>
        </Button>
      </div>

      {/* Resumo: só conta o que existe. */}
      <p className="-mt-1 text-body-sm text-muted-foreground">
        {filtrados.length} de {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
        {parados > 0 && (
          <>
            {' · '}
            <span className="font-medium text-destructive">{parados} parados além do prazo</span>
          </>
        )}
        {pendente && ' · salvando…'}
      </p>

      {vista === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {etapas.map((etapa) => {
            const itens = porEtapa.get(etapa.id) ?? [];
            const arrastandoSobre = hoverCol === etapa.id;
            return (
              <div
                key={etapa.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHoverCol(etapa.id);
                }}
                onDragLeave={() => setHoverCol((c) => (c === etapa.id ? null : c))}
                onDrop={() => handleDrop(etapa.id, itens.length)}
                className={cn(
                  'flex w-[290px] shrink-0 flex-col rounded-lg border-2 p-2 transition-colors',
                  arrastandoSobre
                    ? 'border-dashed border-primary bg-primary/5'
                    : 'border-transparent bg-surface-soft',
                  // Coluna vazia não precisa ocupar a altura inteira sem conteúdo.
                  itens.length === 0 ? 'self-start' : 'min-h-[60vh]'
                )}
              >
                <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: etapa.cor ?? '#64748b' }}
                    aria-hidden
                  />
                  <h3 className="truncate text-body-sm font-semibold text-foreground" title={etapa.nome}>
                    {etapa.nome}
                  </h3>
                  <span className="ml-auto text-body-sm tabular-nums text-muted-foreground">
                    {itens.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {itens.map((lead, idx) => (
                    <div key={lead.id}>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleDrop(etapa.id, idx);
                        }}
                        className="-mb-0.5 h-1.5"
                      />
                      <LeadCard
                        lead={lead}
                        faixa={faixaSla(etapa, lead.statusDesde)}
                        onOpen={() => setDrawerLeadId(lead.id)}
                        onDragStart={() => setDragId(lead.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setHoverCol(null);
                        }}
                      />
                    </div>
                  ))}
                  {itens.length === 0 && (
                    <p className="py-3 text-center text-body-sm text-muted-foreground">
                      Arraste leads aqui
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === 'lista' && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-body-sm">
            <thead className="bg-surface-soft text-caption uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Quando</th>
                <th className="px-4 py-3 text-left font-semibold">Nome / contato</th>
                <th className="px-4 py-3 text-left font-semibold">Interesse</th>
                <th className="px-4 py-3 text-left font-semibold">Corretor</th>
                <th className="px-4 py-3 text-left font-semibold">Temp.</th>
                <th className="px-4 py-3 text-left font-semibold">Etapa</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((lead) => {
                const etapa = etapaPorId.get(lead.etapaId ?? '');
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setDrawerLeadId(lead.id)}
                    className="cursor-pointer transition-colors hover:bg-accent/40"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{diffParaTexto(lead.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{lead.nome}</p>
                      <p className="text-caption text-muted-foreground">{lead.email}</p>
                      <p className="text-caption text-muted-foreground">{lead.telefone}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.lote ? `Lote ${lead.lote.codigo}` : (lead.loteamento?.nome ?? '—')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.corretor?.nome ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={TEMP_CONFIG[lead.temperatura].badge}>
                        {TEMP_CONFIG[lead.temperatura].emoji} {TEMP_CONFIG[lead.temperatura].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: etapa?.cor ?? '#64748b' }}
                          aria-hidden
                        />
                        {etapa?.nome ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-primary-strong">Abrir →</td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
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

function LeadCard({
  lead,
  faixa,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadUI;
  faixa: Faixa;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const temp = TEMP_CONFIG[lead.temperatura];
  const acaoVencida = lead.proximaAcaoData && new Date(lead.proximaAcaoData).getTime() < Date.now();

  const iniciais = lead.nome
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
      className={cn(
        'group cursor-grab rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 active:cursor-grabbing',
        faixa === 'estourado' ? 'border-destructive/50' : 'border-border'
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-primary-foreground">
          {iniciais}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold leading-tight text-foreground">
            {lead.nome}
          </p>
          <p className="truncate text-caption text-muted-foreground">{lead.email}</p>
        </div>
        <span className="shrink-0 text-body-sm" title={temp.label} aria-label={temp.label}>
          {temp.emoji}
        </span>
      </div>

      {(lead.lote || lead.loteamento) && (
        <p className="mb-1.5 text-caption text-muted-foreground">
          {lead.lote ? `Lote ${lead.lote.codigo}` : lead.loteamento?.nome}
        </p>
      )}

      {lead.tags.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      {lead.proximaAcao && (
        <div
          className={cn(
            'mb-1.5 flex items-center gap-1 rounded px-1.5 py-1 text-caption',
            acaoVencida ? 'bg-destructive/[0.12] text-destructive' : 'bg-info/[0.12] text-info-strong'
          )}
        >
          <span aria-hidden>📅</span>
          <span className="truncate">{lead.proximaAcao}</span>
          {lead.proximaAcaoData && (
            <span className="ml-auto shrink-0 tabular-nums">{formatarData(lead.proximaAcaoData)}</span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-caption text-muted-foreground">
        <span
          className={cn(
            'tabular-nums',
            faixa === 'estourado' && 'font-semibold text-destructive',
            faixa === 'atencao' && 'font-medium text-warning-strong'
          )}
          title={
            faixa === 'ok'
              ? `Nesta etapa ${diffParaTexto(lead.statusDesde).replace('há ', 'há ')}`
              : 'Parado além do prazo desta etapa'
          }
        >
          {tempoParado(lead.statusDesde)} na etapa
        </span>
        <div className="flex items-center gap-2">
          {lead.corretor ? (
            <span className="max-w-[80px] truncate" title={lead.corretor.nome}>
              {lead.corretor.nome.split(' ')[0]}
            </span>
          ) : (
            <span className="text-destructive">sem corretor</span>
          )}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-success-strong transition-opacity hover:opacity-80"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
