'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Archive,
  BellOff,
  BellRing,
  Pin,
  Link2,
  Loader2,
  Pencil,
  Tag,
  UserPlus,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { renomearConversa, vincularAoLead } from '@/app/admin/(dashboard)/whatsapp/chat-actions';
import {
  arquivarConversa,
  fixarConversa,
  silenciarConversa,
} from '@/app/admin/(dashboard)/whatsapp/modelo-actions';
import {
  alternarEtiqueta,
  criarLeadDaConversa,
  leadsParaVincular,
  marcarNaoLida,
  mudarSituacao,
  type LeadParaVincular,
} from '@/app/admin/(dashboard)/whatsapp/organizacao-actions';
import type { ConversaUI } from './CaixaDeEntrada';
import { formatarTelefone, rotuloConversa } from '@/lib/whatsapp-rotulo';

const SITUACOES = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'em_atendimento', rotulo: 'Em atendimento' },
  { valor: 'aguardando', rotulo: 'Aguardando cliente' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
];

/**
 * Painel do CRM ao lado da conversa.
 *
 * Existe para responder, sem sair do chat, a pergunta que decide o tom da
 * resposta: quem é essa pessoa no funil? Alternar entre chat e cadastro para
 * descobrir isso é o que faz o vendedor responder sem contexto — e responder
 * sem contexto é o que transforma um lead quente em mais uma conversa.
 */
export function PainelCrm({
  conversa,
  onFechar,
}: {
  conversa: ConversaUI;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(conversa.nome ?? '');
  const [etiqueta, setEtiqueta] = useState('');

  const [buscaLead, setBuscaLead] = useState('');
  const [leads, setLeads] = useState<LeadParaVincular[]>([]);
  const [buscandoLead, setBuscandoLead] = useState(false);

  // Busca o lead enquanto digita, com respiro para não consultar a cada tecla.
  useEffect(() => {
    if (conversa.lead) return;
    let vivo = true;
    setBuscandoLead(true);
    const t = setTimeout(async () => {
      const r = await leadsParaVincular(buscaLead);
      if (vivo) {
        setLeads(r);
        setBuscandoLead(false);
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [buscaLead, conversa.lead]);

  function acao(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.');
      router.refresh();
    });
  }

  const etiquetas = conversa.etiquetas ?? [];

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-body-lg font-semibold text-foreground">Sobre o contato</h2>
        <Button variant="ghost" size="icon-sm" onClick={onFechar} aria-label="Fechar painel">
          <X />
        </Button>
      </div>

      {/* Nome */}
      <div>
        <Label className="text-caption uppercase tracking-wide text-muted-foreground">Nome</Label>
        {renomeando ? (
          <div className="mt-1 flex gap-1.5">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-8 text-body-sm"
              autoFocus
            />
            <Button
              size="sm"
              disabled={pendente || !nome.trim()}
              onClick={() =>
                acao(async () => {
                  const r = await renomearConversa(conversa.id, nome);
                  if (r.ok) setRenomeando(false);
                  return r;
                })
              }
            >
              Salvar
            </Button>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-body text-foreground">
              {rotuloConversa(conversa.nome, conversa.telefone)}
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRenomeando(true)}
              aria-label="Renomear"
            >
              <Pencil />
            </Button>
          </div>
        )}
        <p className="text-body-sm text-muted-foreground">
          {formatarTelefone(conversa.telefone) || '—'}
        </p>
      </div>

      {/* Lead */}
      <div>
        <Label className="text-caption uppercase tracking-wide text-muted-foreground">
          Lead no funil
        </Label>
        {conversa.lead ? (
          <div className="mt-1 space-y-1.5">
            <Link
              href={`/admin/leads`}
              className="block truncate text-body font-medium text-primary-strong hover:underline"
            >
              {conversa.lead.nome}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              disabled={pendente}
              onClick={() => acao(() => vincularAoLead(conversa.id, null))}
            >
              Desvincular
            </Button>
          </div>
        ) : (
          <div className="mt-1 space-y-2">
            <Input
              value={buscaLead}
              onChange={(e) => setBuscaLead(e.target.value)}
              placeholder="Buscar lead por nome ou telefone"
              className="h-8 text-body-sm"
            />
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {buscandoLead ? (
                <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : leads.length === 0 ? (
                <p className="py-1 text-caption text-muted-foreground">Nenhum lead encontrado.</p>
              ) : (
                leads.map((l) => (
                  <button
                    key={l.id}
                    disabled={pendente}
                    onClick={() => acao(() => vincularAoLead(conversa.id, l.id))}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent"
                  >
                    <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-body-sm">{l.nome}</span>
                    {l.etapa && (
                      <span className="shrink-0 text-caption text-muted-foreground">{l.etapa}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            {!conversa.ehGrupo && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={pendente}
                onClick={() => acao(() => criarLeadDaConversa(conversa.id))}
              >
                <UserPlus /> Criar lead desta conversa
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Situação */}
      <div>
        <Label className="text-caption uppercase tracking-wide text-muted-foreground">
          Atendimento
        </Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              disabled={pendente}
              onClick={() => acao(() => mudarSituacao(conversa.id, s.valor))}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-body-sm transition-colors',
                conversa.situacao === s.valor
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Etiquetas */}
      <div>
        <Label className="text-caption uppercase tracking-wide text-muted-foreground">
          Etiquetas
        </Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {etiquetas.map((e) => (
            <button
              key={e}
              disabled={pendente}
              onClick={() => acao(() => alternarEtiqueta(conversa.id, e))}
              title="Remover etiqueta"
            >
              <Badge variant="primarySoft">{e} ×</Badge>
            </button>
          ))}
          {etiquetas.length === 0 && (
            <p className="text-caption text-muted-foreground">Nenhuma etiqueta.</p>
          )}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <Input
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && etiqueta.trim()) {
                acao(async () => {
                  const r = await alternarEtiqueta(conversa.id, etiqueta);
                  if (r.ok) setEtiqueta('');
                  return r;
                });
              }
            }}
            placeholder="nova etiqueta"
            className="h-8 text-body-sm"
          />
          <Button
            variant="outline"
            size="icon-sm"
            disabled={pendente || !etiqueta.trim()}
            onClick={() =>
              acao(async () => {
                const r = await alternarEtiqueta(conversa.id, etiqueta);
                if (r.ok) setEtiqueta('');
                return r;
              })
            }
            aria-label="Adicionar etiqueta"
          >
            <Tag />
          </Button>
        </div>
      </div>

      {/* Fila */}
      <div className="space-y-1.5 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={pendente}
          onClick={() => acao(() => marcarNaoLida(conversa.id))}
        >
          <BellOff /> Marcar como não lida
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={pendente}
          onClick={() => acao(() => fixarConversa(conversa.id))}
        >
          <Pin /> {conversa.fixada ? 'Desafixar' : 'Fixar no topo'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={pendente}
          onClick={() => acao(() => silenciarConversa(conversa.id))}
        >
          {conversa.silenciada ? <BellRing /> : <BellOff />}{' '}
          {conversa.silenciada ? 'Reativar avisos' : 'Silenciar'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={pendente}
          onClick={() => acao(() => arquivarConversa(conversa.id))}
        >
          <Archive /> {conversa.arquivada ? 'Desarquivar' : 'Arquivar'}
        </Button>
        <p className="px-1 text-caption text-muted-foreground">
          Fixar, silenciar e arquivar valem também no seu celular.
        </p>
      </div>

      {erro && <p className="text-body-sm text-destructive">{erro}</p>}
    </aside>
  );
}
