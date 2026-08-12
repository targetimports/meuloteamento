'use client';

import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AvatarContato } from './AvatarContato';
import type { ConversaUI } from './CaixaDeEntrada';

/**
 * A fila como QUADRO, por tempo de espera.
 *
 * As colunas são calculadas do próprio histórico: há quanto tempo o cliente
 * está sem resposta. Não depende de ninguém manter status em dia — e é a
 * informação que a lista, ordenada por chegada, não mostra de relance: quem
 * espera há quatro horas fica visualmente junto de quem espera há dez minutos.
 *
 * 🔴 Aqui NÃO se arrasta entre colunas. A coluna é tempo decorrido, e tempo não
 * se muda por gesto — oferecer o arrasto seria prometer um efeito que não
 * existe. O que se faz é responder, e isso é clicar no card.
 */

interface Faixa {
  chave: string;
  rotulo: string;
  ateMinutos: number;
  classe: string;
}

const FAIXAS: Faixa[] = [
  { chave: 'agora', rotulo: 'Até 15 min', ateMinutos: 15, classe: 'text-success-strong' },
  { chave: 'uma_hora', rotulo: '15 min a 1h', ateMinutos: 60, classe: 'text-info-strong' },
  { chave: 'hoje', rotulo: '1h a 4h', ateMinutos: 240, classe: 'text-warning-strong' },
  { chave: 'atrasado', rotulo: 'Mais de 4h', ateMinutos: Infinity, classe: 'text-destructive' },
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
  selecionada,
  onAbrir,
}: {
  conversas: ConversaUI[];
  selecionada: string | null;
  onAbrir: (id: string) => void;
}) {
  /**
   * Só entram conversas em que o cliente falou por último — as outras não estão
   * esperando nada. Uma conversa que EU respondi por último não pertence a um
   * quadro de espera; incluí-la encheria as colunas de gente que já foi atendida.
   */
  const aguardando = useMemo(
    () => conversas.filter((c) => !c.arquivada && c.ultimaMinha === false),
    [conversas]
  );

  const colunas = useMemo(() => {
    return FAIXAS.map((faixa, i) => {
      const minimo = i === 0 ? -Infinity : FAIXAS[i - 1].ateMinutos;
      return {
        faixa,
        itens: aguardando
          .filter((c) => {
            const m = minutosDesde(c.ultimaEm);
            return m > minimo && m <= faixa.ateMinutos;
          })
          .sort((a, b) => minutosDesde(b.ultimaEm) - minutosDesde(a.ultimaEm)),
      };
    });
  }, [aguardando]);

  if (aguardando.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-success-strong" />
        <p className="text-body-lg font-medium text-foreground">Ninguém esperando resposta</p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Toda conversa teve a sua resposta como última mensagem.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {colunas.map(({ faixa, itens }) => (
        <div key={faixa.chave} className="flex flex-col rounded-lg bg-surface-soft p-2">
          <div className="mb-2 flex items-center justify-between px-1.5">
            <h3 className={cn('text-body-sm font-semibold', faixa.classe)}>{faixa.rotulo}</h3>
            <span className="text-body-sm tabular-nums text-muted-foreground">{itens.length}</span>
          </div>

          <div className="space-y-1.5">
            {itens.map((c) => {
              const nome = c.nome || c.telefone || 'Sem nome';
              return (
                <button
                  key={c.id}
                  onClick={() => onAbrir(c.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md border bg-card p-2 text-left transition-colors hover:border-primary/40',
                    c.id === selecionada ? 'border-primary' : 'border-border'
                  )}
                >
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
                      <span className={cn('shrink-0 text-caption tabular-nums', faixa.classe)}>
                        {tempoCurto(minutosDesde(c.ultimaEm))}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-caption text-muted-foreground">
                      {c.previa ?? ''}
                    </span>
                    {c.lead && (
                      <span className="mt-0.5 block truncate text-caption text-primary-strong">
                        {c.lead.nome}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {itens.length === 0 && (
              <p className="py-3 text-center text-caption text-muted-foreground">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
