'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { History, Link2, Loader2, MessageSquare, Search, Send, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Bolha } from './Bolha';
import {
  apagarParaTodos,
  enviarMensagem,
  marcarConversaLida,
  mensagensDaConversa,
  sincronizarHistorico,
  vincularConversasAosLeads,
  type MensagemUI,
} from '@/app/admin/(dashboard)/whatsapp/chat-actions';

export interface ConversaUI {
  id: string;
  nome: string | null;
  telefone: string | null;
  ehGrupo: boolean;
  naoLidas: number;
  previa: string | null;
  ultimaMinha: boolean | null;
  ultimaEm: string | null;
  fotoUrl: string | null;
  lead: { id: string; nome: string } | null;
}

/** Sem evento de servidor: a fila se atualiza sozinha em intervalo curto. */
const INTERVALO_ATUALIZACAO_MS = 12_000;

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function quando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Telefone legível: 5575984904920 → +55 75 98490-4920 */
function formatarTelefone(v: string | null): string {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length < 12) return v;
  const ddi = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  const resto = d.slice(4);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `+${ddi} ${ddd} ${meio}-${resto.slice(meio.length)}`;
}

export function CaixaDeEntrada({ conversas }: { conversas: ConversaUI[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<string | null>(conversas[0]?.id ?? null);
  const [mensagens, setMensagens] = useState<MensagemUI[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();
  const [sincronizando, startSync] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const fimDaLista = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter((c) =>
      `${c.nome ?? ''} ${c.telefone ?? ''} ${c.previa ?? ''}`.toLowerCase().includes(q)
    );
  }, [conversas, busca]);

  const conversa = conversas.find((c) => c.id === selecionada) ?? null;

  const carregarMensagens = useCallback(async (id: string, comSpinner = true) => {
    if (comSpinner) setCarregando(true);
    try {
      setMensagens(await mensagensDaConversa(id));
    } finally {
      if (comSpinner) setCarregando(false);
    }
  }, []);

  // Abrir a conversa carrega o histórico e zera o não-lidas — abrir É ler.
  useEffect(() => {
    if (!selecionada) return;
    void carregarMensagens(selecionada);
    void marcarConversaLida(selecionada).then(() => router.refresh());
  }, [selecionada, carregarMensagens, router]);

  // Não há evento de servidor: a conversa aberta e a fila se atualizam em laço.
  useEffect(() => {
    const t = setInterval(() => {
      if (selecionada) void carregarMensagens(selecionada, false);
      router.refresh();
    }, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(t);
  }, [selecionada, carregarMensagens, router]);

  // Toda mensagem nova rola para o fim: numa conversa, o que importa é o final.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length]);

  function enviar() {
    const texto = rascunho.trim();
    if (!texto || !selecionada) return;
    setErro(null);
    // Limpa o campo imediatamente: quem escreveu já mandou, e um campo que
    // continua cheio faz a pessoa mandar duas vezes.
    setRascunho('');
    startEnvio(async () => {
      const r = await enviarMensagem(selecionada, texto);
      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível enviar.');
        setRascunho(texto); // devolve o que não saiu
        return;
      }
      await carregarMensagens(selecionada, false);
      router.refresh();
    });
  }

  if (conversas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-body-lg font-medium text-foreground">Nenhuma conversa ainda</p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          As conversas aparecem aqui assim que alguém mandar mensagem para o seu número.
        </p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-3 md:grid-cols-[320px_1fr]">
      {/* Fila */}
      <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
        <div className="space-y-2 border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa…"
              className="h-9 pl-9 text-body-sm"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={sincronizando}
              onClick={() =>
                startSync(async () => {
                  setAviso(null);
                  const r = await sincronizarHistorico();
                  setAviso(
                    r.ok
                      ? `Histórico pedido para ${r.pedidos ?? 0} conversa(s). As mensagens antigas chegam em instantes.`
                      : (r.erro ?? 'Falha ao sincronizar.')
                  );
                  router.refresh();
                })
              }
            >
              {sincronizando ? <Loader2 className="animate-spin" /> : <History />}
              Puxar histórico
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={sincronizando}
              title="Ligar conversas aos leads do funil pelo telefone"
              onClick={() =>
                startSync(async () => {
                  setAviso(null);
                  const r = await vincularConversasAosLeads();
                  setAviso(
                    r.ok
                      ? `${r.vinculadas ?? 0} conversa(s) ligada(s) a leads.`
                      : (r.erro ?? 'Falha ao vincular.')
                  );
                  router.refresh();
                })
              }
            >
              <Link2 />
            </Button>
          </div>
          {aviso && <p className="px-1 text-caption text-muted-foreground">{aviso}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtradas.map((c) => {
            const ativa = c.id === selecionada;
            const nome = c.nome || formatarTelefone(c.telefone) || 'Sem nome';
            return (
              <button
                key={c.id}
                onClick={() => setSelecionada(c.id)}
                className={cn(
                  'flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors',
                  ativa ? 'bg-accent' : 'hover:bg-accent/40'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-primary-foreground">
                  {c.ehGrupo ? <Users className="h-4 w-4" /> : iniciais(nome)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-foreground">
                      {nome}
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {quando(c.ultimaEm)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
                      {c.ultimaMinha ? 'Você: ' : ''}
                      {c.previa ?? ''}
                    </span>
                    {c.naoLidas > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold text-success-foreground">
                        {c.naoLidas}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          {filtradas.length === 0 && (
            <p className="p-6 text-center text-body-sm text-muted-foreground">
              Nenhuma conversa com esse termo.
            </p>
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="flex min-h-0 flex-col rounded-lg border border-border bg-surface-soft">
        {conversa ? (
          <>
            <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-bold text-primary-foreground">
                {conversa.ehGrupo ? (
                  <Users className="h-4 w-4" />
                ) : (
                  iniciais(conversa.nome || formatarTelefone(conversa.telefone) || '?')
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-lg font-medium text-foreground">
                  {conversa.nome || formatarTelefone(conversa.telefone) || 'Sem nome'}
                </p>
                <p className="truncate text-caption text-muted-foreground">
                  {conversa.ehGrupo ? 'Grupo' : formatarTelefone(conversa.telefone)}
                </p>
              </div>
              {conversa.lead ? (
                <Badge variant="primarySoft" title="Lead vinculado no funil">
                  {conversa.lead.nome}
                </Badge>
              ) : (
                <Badge variant="neutralSoft">Sem lead</Badge>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {carregando ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : mensagens.length === 0 ? (
                <p className="py-8 text-center text-body-sm text-muted-foreground">
                  Nenhuma mensagem nesta conversa.
                </p>
              ) : (
                mensagens.map((m) => (
                  <Bolha
                    key={m.id}
                    mensagem={m}
                    onApagar={async (id) => {
                      const r = await apagarParaTodos(id);
                      if (!r.ok) setErro(r.erro ?? 'Não foi possível apagar.');
                      if (selecionada) await carregarMensagens(selecionada, false);
                    }}
                  />
                ))
              )}
              <div ref={fimDaLista} />
            </div>

            <div className="border-t border-border bg-card p-2">
              {erro && <p className="mb-1.5 px-1 text-body-sm text-destructive">{erro}</p>}
              <div className="flex items-end gap-2">
                <Textarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter envia, Shift+Enter quebra linha — como no WhatsApp.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  placeholder="Escreva uma mensagem…"
                  rows={1}
                  className="max-h-32 min-h-[40px] flex-1 resize-none py-2.5 text-body"
                />
                <Button
                  onClick={enviar}
                  disabled={enviando || !rascunho.trim()}
                  size="icon"
                  aria-label="Enviar"
                >
                  {enviando ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-body-sm text-muted-foreground">Escolha uma conversa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
