import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/** Janela de análise. Mais que isso vira relatório, não painel de operação. */
const DIAS = 30;

function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 0) return '—';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/**
 * Mediana, não média.
 *
 * 🔴 Uma única conversa respondida no dia seguinte joga a média para as alturas
 * e faz parecer que o atendimento inteiro é lento. A mediana diz o que acontece
 * no caso típico, que é o que se quer melhorar.
 */
function mediana(valores: number[]): number {
  if (valores.length === 0) return NaN;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export default async function DesempenhoPage() {
  const sessao = await requireAdmin();

  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true },
  });

  if (!instancia) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Desempenho do atendimento</h1>
        <p className="rounded-lg border border-border bg-surface-soft p-4 text-body text-muted-foreground">
          Você ainda não conectou um número.{' '}
          <Link href="/admin/whatsapp" className="font-medium text-primary-strong hover:underline">
            Conectar meu WhatsApp
          </Link>
        </p>
      </div>
    );
  }

  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);

  const mensagens = await prisma.whatsappMensagem.findMany({
    where: {
      conversa: { instanciaId: instancia.id },
      enviadaEm: { gte: desde },
      notaInterna: false,
    },
    orderBy: { enviadaEm: 'asc' },
    select: { conversaId: true, daMim: true, enviadaEm: true },
  });

  /**
   * Tempo de espera: de uma mensagem do cliente até a NOSSA resposta seguinte.
   *
   * Conversa que o cliente escreveu e ninguém respondeu ainda não entra na
   * conta de tempo — ela entra na conta de "sem resposta", que é outro número e
   * não pode ser diluído numa média.
   */
  const esperas: number[] = [];
  const semResposta = new Set<string>();
  const aguardando = new Map<string, Date>();

  for (const m of mensagens) {
    if (!m.daMim) {
      // Só a PRIMEIRA mensagem da rajada conta: cliente que manda cinco
      // seguidas não gerou cinco esperas.
      if (!aguardando.has(m.conversaId)) aguardando.set(m.conversaId, m.enviadaEm);
    } else {
      const desdeQuando = aguardando.get(m.conversaId);
      if (desdeQuando) {
        esperas.push((m.enviadaEm.getTime() - desdeQuando.getTime()) / 60000);
        aguardando.delete(m.conversaId);
      }
    }
  }
  for (const id of aguardando.keys()) semResposta.add(id);

  const recebidas = mensagens.filter((m) => !m.daMim).length;
  const enviadas = mensagens.filter((m) => m.daMim).length;
  const conversasAtivas = new Set(mensagens.map((m) => m.conversaId)).size;

  const medianaEspera = mediana(esperas);
  const ateUmaHora = esperas.filter((e) => e <= 60).length;
  const percentualRapido = esperas.length > 0 ? (ateUmaHora / esperas.length) * 100 : 0;

  // Distribuição por hora do dia: mostra quando a demanda chega, que é o dado
  // que decide escala de plantão.
  const porHora = new Array(24).fill(0);
  for (const m of mensagens) {
    if (!m.daMim) porHora[m.enviadaEm.getHours()]++;
  }
  const picoHora = porHora.indexOf(Math.max(...porHora));
  const maxHora = Math.max(...porHora, 1);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/whatsapp/chat"
          className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar às conversas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Desempenho do atendimento</h1>
        <p className="text-body-sm text-muted-foreground">Últimos {DIAS} dias do seu número.</p>
      </div>

      {mensagens.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-soft p-6 text-center text-body text-muted-foreground">
          Nenhuma mensagem no período. Os números aparecem conforme as conversas acontecem.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador
              titulo="Tempo até responder"
              valor={Number.isNaN(medianaEspera) ? '—' : formatarDuracao(medianaEspera)}
              nota={
                esperas.length > 0
                  ? `mediana de ${esperas.length} resposta(s)`
                  : 'ainda sem resposta medida'
              }
            />
            <Indicador
              titulo="Respondidas em até 1h"
              valor={esperas.length > 0 ? `${percentualRapido.toFixed(0)}%` : '—'}
              nota={`${ateUmaHora} de ${esperas.length}`}
              cor={percentualRapido >= 70 ? 'text-success-strong' : undefined}
            />
            <Indicador
              titulo="Sem resposta"
              valor={String(semResposta.size)}
              nota="conversas aguardando você"
              cor={semResposta.size > 0 ? 'text-destructive' : 'text-success-strong'}
            />
            <Indicador
              titulo="Conversas ativas"
              valor={String(conversasAtivas)}
              nota={`${recebidas} recebidas · ${enviadas} enviadas`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quando as mensagens chegam</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end gap-1">
                {porHora.map((n, h) => (
                  <div key={h} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${h === picoHora ? 'bg-primary' : 'bg-primary/30'}`}
                      style={{ height: `${(n / maxHora) * 100}%`, minHeight: n > 0 ? '2px' : '0' }}
                      title={`${h}h: ${n} mensagem(ns)`}
                    />
                    {h % 3 === 0 && (
                      <span className="text-caption text-muted-foreground">{h}h</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-body-sm text-muted-foreground">
                O pico é às <span className="font-medium text-foreground">{picoHora}h</span>, com{' '}
                {porHora[picoHora]} mensagem(ns) recebida(s) no período.
              </p>
            </CardContent>
          </Card>

          <p className="text-body-sm text-muted-foreground">
            A espera é medida da mensagem do cliente até a sua resposta seguinte. Conversa em que
            ele escreveu e ninguém respondeu não entra na mediana — ela aparece em “sem resposta”,
            porque diluir uma numa média da outra esconde as duas.
          </p>
        </>
      )}
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  nota,
  cor,
}: {
  titulo: string;
  valor: string;
  nota: string;
  cor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        <p className={`mt-1 text-2xl font-bold ${cor ?? 'text-foreground'}`}>{valor}</p>
        <p className="text-body-sm text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  );
}
