'use client';

import { useMemo } from 'react';
import { Check, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AvatarContato } from './AvatarContato';
import type { ConversaUI } from './CaixaDeEntrada';
import { rotuloConversa } from '@/lib/whatsapp-rotulo';

/**
 * A fila como QUADRO, em dois agrupamentos.
 *
 * ── Por espera (padrão) ─────────────────────────────────────────────────────
 * As colunas são calculadas do próprio histórico: há quanto tempo o cliente
 * está sem resposta. Não depende de ninguém manter status em dia — e é a
 * informação que a lista, ordenada por chegada, não mostra de relance: quem
 * espera há quatro horas fica visualmente junto de quem espera há dez minutos.
 *
 * ── Por status ──────────────────────────────────────────────────────────────
 * O agrupamento clássico, para quem organiza o atendimento por etapa.
 *
 * 🔴 Aqui NÃO se arrasta entre colunas no modo espera. A coluna é tempo
 * decorrido, e tempo não se muda por gesto — oferecer o arrasto seria prometer
 * um efeito que não existe. O que se faz é responder ou resolver, e isso tem
 * botão próprio no card.
 */

export type Agrupamento = 'espera' | 'status';

interface Coluna {
  chave: string;
  rotulo: string;
  classe: string;
  itens: ConversaUI[];
}

const FAIXAS_ESPERA = [
  { chave: 'agora', rotulo: 'Até 15 min', ate: 15, classe: 'text-success-strong' },
  { chave: 'uma_hora', rotulo: '15 min a 1h', ate: 60, classe: 'text-info-strong' },
  { chave: 'hoje', rotulo: '1h a 4h', ate: 240, classe: 'text-warning-strong' },
  { chave: 'atrasado', rotulo: 'Mais de 4h', ate: Infinity, classe: 'text-destructive' },
];

const COLUNAS_STATUS = [
  { chave: 'novo', rotulo: 'Novo', classe: 'text-info-strong' },
  { chave: 'em_atendimento', rotulo: 'Em atendimento', classe: 'text-warning-strong' },
  { chave: 'aguardando', rotulo: 'Aguardando cliente', classe: 'text-muted-foreground' },
  { chave: 'encerrado', rotulo: 'Encerrado', classe: 'text-success-strong' },
];

function minutosDesde(iso: string | null): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function tempoCurto(min: number): string {
  if (min < 60) return `${Math.round(min)}min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function QuadroConversas({
  conversas,
  agrupamento,
  selecionada,
  onAbrir,
  onResolver,
}: {
  conversas: ConversaUI[];
  agrupamento: Agrupamento;
  selecionada: string | null;
  onAbrir: (id: string) => void;
  onResolver?: (id: string) => void;
}) {
  const colunas: Coluna[] = useMemo(() => {
    if (agrupamento === 'status') {
      const ativas = conversas.filter((c) => !c.arquivada);
      return COLUNAS_STATUS.map((col) => ({
        chave: col.chave,
        rotulo: col.rotulo,
        classe: col.classe,
        itens: ativas
          .filter((c) => c.situacao === col.chave)
          .sort((a, b) => minutosDesde(b.ultimaEm) - minutosDesde(a.ultimaEm)),
      }));
    }

    /**
     * Só entram conversas em que o cliente falou por último — as outras não
     * estão esperando nada. Uma conversa que EU respondi por último não
     * pertence a um quadro de espera; incluí-la encheria as colunas de gente
     * que já foi atendida.
     */
    const aguardando = conversas.filter((c) => !c.arquivada && c.ultimaMinha === false);
    return FAIXAS_ESPERA.map((faixa, i) => {
      const minimo = i === 0 ? -Infinity : FAIXAS_ESPERA[i - 1].ate;
      return {
        chave: faixa.chave,
        rotulo: faixa.rotulo,
        classe: faixa.classe,
        itens: aguardando
          .filter((c) => {
            const m = minutosDesde(c.ultimaEm);
            return m > minimo && m <= faixa.ate;
          })
          .sort((a, b) => minutosDesde(b.ultimaEm) - minutosDesde(a.ultimaEm)),
      };
    });
  }, [conversas, agrupamento]);

  const total = colunas.reduce((a, c) => a + c.itens.length, 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-success-strong" />
          <p className="text-body-lg font-medium text-foreground">
            {agrupamento === 'espera' ? 'Ninguém esperando resposta' : 'Nenhuma conversa'}
          </p>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {agrupamento === 'espera'
              ? 'Toda conversa teve a sua resposta como última mensagem.'
              : 'As conversas aparecem aqui conforme chegam.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full gap-3 overflow-x-auto p-3 md:grid-cols-4">
      {colunas.map((col) => (
        <div key={col.chave} className="flex min-w-[240px] flex-col rounded-lg bg-surface-soft p-2">
          <div className="mb-2 flex items-center justify-between px-1.5">
            <h3 className={cn('text-body-sm font-semibold', col.classe)}>{col.rotulo}</h3>
            <span className="text-body-sm tabular-nums text-muted-foreground">
              {col.itens.length}
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto">
            {col.itens.map((c) => {
              const nome = rotuloConversa(c.nome, c.telefone);
              return (
                <div
                  key={c.id}
                  className={cn(
                    'group rounded-md border bg-card p-2 transition-colors hover:border-primary/40',
                    c.id === selecionada ? 'border-primary' : 'border-border'
                  )}
                >
                  <button onClick={() => onAbrir(c.id)} className="flex w-full items-start gap-2 text-left">
                    <AvatarContato
                      nome={nome}
                      fotoUrl={c.fotoUrl}
                      ehGrupo={c.ehGrupo}
                      tamanho="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-foreground">
                          {nome}
                        </span>
                        <span className={cn('shrink-0 text-caption tabular-nums', col.classe)}>
                          {tempoCurto(minutosDesde(c.ultimaEm))}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-caption text-muted-foreground">
                        {c.ultimaMinha ? 'Você: ' : ''}
                        {c.previa ?? ''}
                      </span>
                      {c.lead && (
                        <span className="mt-0.5 block truncate text-caption text-primary-strong">
                          {c.lead.nome}
                        </span>
                      )}
                      {c.etiquetas.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {c.etiquetas.slice(0, 2).map((e) => (
                            <span
                              key={e}
                              className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground"
                            >
                              {e}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>

                  {/* Resolver no próprio card: no quadro de espera, tirar da
                      fila é a ação que se quer fazer sem abrir a conversa. */}
                  {onResolver && c.situacao !== 'encerrado' && (
                    <button
                      onClick={() => onResolver(c.id)}
                      className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-border py-1 text-caption text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 focus:opacity-100"
                    >
                      <Check className="h-3 w-3" /> Resolver
                    </button>
                  )}
                </div>
              );
            })}
            {col.itens.length === 0 && (
              <p className="py-3 text-center text-caption text-muted-foreground">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
