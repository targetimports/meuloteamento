'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowDown,
  Columns3,
  Contact,
  Forward,
  History,
  Info,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Smartphone,
  BarChart3,
  Maximize2,
  MoreHorizontal,
  Minimize2,
  Smile,
  StickyNote,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Segmented } from '@/components/ui/segmented';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Bolha } from './Bolha';
import { PainelCrm } from './PainelCrm';
import { AvatarContato } from './AvatarContato';
import { VisorMidia, type ItemMidia } from './VisorMidia';
import { Modelos } from './Modelos';
import { QuadroConversas, type Agrupamento } from './QuadroConversas';
import { Duplicadas } from './Duplicadas';
import {
  apagarParaTodos,
  enviarMensagem,
  marcarConversaLida,
  mensagensDaConversa,
  sincronizarHistorico,
  vincularConversasAosLeads,
  type MensagemUI,
} from '@/app/admin/(dashboard)/whatsapp/chat-actions';
import {
  adicionarNotaInterna,
  encaminharMensagem,
  enviarArquivo,
  responderMensagem,
} from '@/app/admin/(dashboard)/whatsapp/midia-actions';
import {
  buscarNasMensagens,
  mudarSituacao,
  novaConversa,
  sincronizarContatos,
  type AchadoBusca,
} from '@/app/admin/(dashboard)/whatsapp/organizacao-actions';

/**
 * Aviso da sincronia. Mostra os telefones recuperados separado dos nomes:
 * conversa em modo LID precisa primeiro ganhar um número, e sem essa distinção
 * "0 nome(s) atualizado(s)" não diz se faltou telefone ou faltou cadastro.
 */
function avisoDaSincronia(r: {
  ok: boolean;
  erro?: string;
  atualizados?: number;
  telefonesRecuperados?: number;
}): string {
  if (!r.ok) return r.erro ?? 'Não foi possível sincronizar.';
  const partes = [`${r.atualizados ?? 0} nome(s) atualizado(s)`];
  if (r.telefonesRecuperados) partes.push(`${r.telefonesRecuperados} telefone(s) recuperado(s)`);
  return partes.join(', ') + '.';
}

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
  situacao: string;
  etiquetas: string[];
  arquivada: boolean;
  fixada: boolean;
  silenciada: boolean;
  lead: { id: string; nome: string } | null;
}

/** Sem evento de servidor: a fila se atualiza sozinha em intervalo curto. */
const INTERVALO_ATUALIZACAO_MS = 12_000;

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '✅', '❌'];

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
  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Agrupa as mensagens por dia — o separador de data que todo chat tem.
 *
 * Sem ele, uma conversa de semanas vira um bloco contínuo e a pessoa perde a
 * noção de quando cada coisa foi dita, que é metade do contexto ao retomar um
 * atendimento parado.
 */
function agruparPorDia(mensagens: MensagemUI[]): Array<{ dia: string; itens: MensagemUI[] }> {
  const grupos: Array<{ dia: string; itens: MensagemUI[] }> = [];
  let atual: { dia: string; itens: MensagemUI[] } | null = null;
  for (const m of mensagens) {
    const dia = m.enviadaEm.slice(0, 10);
    if (!atual || atual.dia !== dia) {
      atual = { dia, itens: [] };
      grupos.push(atual);
    }
    atual.itens.push(m);
  }
  return grupos;
}

function rotuloDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** 5575984904920 → +55 75 98490-4920 */
function formatarTelefone(v: string | null): string {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length < 12) return v;
  const resto = d.slice(4);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${meio}-${resto.slice(meio.length)}`;
}

/** Recortes da fila — o mesmo vocabulario do ERP. */
type Recorte = 'ativas' | 'nao_lidas' | 'arquivadas';

export function CaixaDeEntrada({ conversas }: { conversas: ConversaUI[] }) {
  const router = useRouter();
  const [recorte, setRecorte] = useState<Recorte>('ativas');
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemUI[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();
  const [sincronizando, startSync] = useTransition();

  const [citando, setCitando] = useState<MensagemUI | null>(null);
  const [encaminhando, setEncaminhando] = useState<MensagemUI | null>(null);
  const [modoNota, setModoNota] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);
  const [emojisAbertos, setEmojisAbertos] = useState(false);
  const [novoNumero, setNovoNumero] = useState('');
  const [abrindoNova, setAbrindoNova] = useState(false);

  const [visorEm, setVisorEm] = useState<number | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [visao, setVisaoTela] = useState<'lista' | 'quadro'>('lista');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('espera');
  const [longeDoFim, setLongeDoFim] = useState(false);
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [buscaMsg, setBuscaMsg] = useState('');
  const [achados, setAchados] = useState<AchadoBusca[] | null>(null);

  const fimDaLista = useRef<HTMLDivElement>(null);
  const areaMensagens = useRef<HTMLDivElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const visiveis = useMemo(() => {
    let lista = conversas;
    if (recorte === 'arquivadas') lista = lista.filter((c) => c.arquivada);
    else if (recorte === 'nao_lidas') lista = lista.filter((c) => !c.arquivada && c.naoLidas > 0);
    else lista = lista.filter((c) => !c.arquivada);

    if (filtroSituacao) lista = lista.filter((c) => c.situacao === filtroSituacao);
    if (filtroEtiqueta) lista = lista.filter((c) => c.etiquetas.includes(filtroEtiqueta));

    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter((c) =>
        `${c.nome ?? ''} ${c.telefone ?? ''} ${c.previa ?? ''} ${c.etiquetas.join(' ')}`
          .toLowerCase()
          .includes(q)
      );
    }
    // Fixadas sobem: é o que "fixar" significa.
    return [...lista].sort((a, b) => Number(b.fixada) - Number(a.fixada));
  }, [conversas, busca, recorte, filtroSituacao, filtroEtiqueta]);

  /** Etiquetas que existem de fato, para o filtro não oferecer o que não há. */
  const etiquetasExistentes = useMemo(
    () => Array.from(new Set(conversas.flatMap((c) => c.etiquetas))).sort(),
    [conversas]
  );

  // A seleção acompanha a lista: se a conversa aberta sai do filtro, abre a
  // primeira disponível em vez de deixar o painel vazio sem explicação.
  useEffect(() => {
    if (selecionada && visiveis.some((c) => c.id === selecionada)) return;
    setSelecionada(visiveis[0]?.id ?? null);
  }, [visiveis, selecionada]);

  const conversa = conversas.find((c) => c.id === selecionada) ?? null;

  const naoLidasTotal = useMemo(
    () => conversas.filter((c) => !c.arquivada).reduce((a, c) => a + c.naoLidas, 0),
    [conversas]
  );
  /** Quem falou por ultimo foi o cliente: esta esperando resposta. */
  const esperando = useMemo(
    () => conversas.filter((c) => !c.arquivada && c.ultimaMinha === false).length,
    [conversas]
  );

  // Só imagem e vídeo entram no visor: documento baixa, áudio toca na bolha.
  const midias: ItemMidia[] = useMemo(
    () =>
      mensagens
        .filter((m) => m.temMidia && (m.tipo === 'IMAGEM' || m.tipo === 'VIDEO' || m.tipo === 'STICKER'))
        .map((m) => ({
          id: m.id,
          tipo: m.tipo,
          nomeArquivo: m.nomeArquivo,
          legenda: m.texto,
          quando: new Date(m.enviadaEm).toLocaleString('pt-BR'),
        })),
    [mensagens]
  );

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
    setCitando(null);
    void carregarMensagens(selecionada);
    void marcarConversaLida(selecionada).then(() => router.refresh());
  }, [selecionada, carregarMensagens, router]);

  useEffect(() => {
    const t = setInterval(() => {
      if (selecionada) void carregarMensagens(selecionada, false);
      router.refresh();
    }, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(t);
  }, [selecionada, carregarMensagens, router]);

  /**
   * Rola para o fim só se a pessoa JÁ estava no fim.
   *
   * Puxar a tela de volta enquanto alguém lê uma mensagem antiga é a forma mais
   * rápida de fazer perder o que estava lendo — e acontece justo quando a
   * conversa está movimentada.
   */
  useEffect(() => {
    if (!longeDoFim) fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens.length, longeDoFim]);

  function aoRolar(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setLongeDoFim(el.scrollHeight - el.scrollTop - el.clientHeight > 250);
  }

  // Busca nas mensagens, com respiro para não consultar a cada tecla.
  useEffect(() => {
    const q = buscaMsg.trim();
    if (q.length < 2) {
      setAchados(null);
      return;
    }
    let vivo = true;
    const t = setTimeout(async () => {
      const r = await buscarNasMensagens(q);
      if (vivo) setAchados(r);
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [buscaMsg]);

  function limparComposer() {
    setRascunho('');
    setCitando(null);
    setModoNota(false);
    setEmojisAbertos(false);
  }

  function enviar() {
    const texto = rascunho.trim();
    if (!texto || !selecionada) return;
    setErro(null);
    const citada = citando;
    const nota = modoNota;
    // Limpa na hora: campo que continua cheio faz mandar duas vezes.
    limparComposer();

    startEnvio(async () => {
      const r = nota
        ? await adicionarNotaInterna(selecionada, texto)
        : citada
          ? await responderMensagem(selecionada, texto, citada.id)
          : await enviarMensagem(selecionada, texto);

      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível enviar.');
        setRascunho(texto); // devolve o que não saiu
        return;
      }
      await carregarMensagens(selecionada, false);
      router.refresh();
    });
  }

  function mandarArquivo(arquivo: File) {
    if (!selecionada) return;
    setErro(null);
    const legenda = rascunho.trim();
    limparComposer();

    startEnvio(async () => {
      const form = new FormData();
      form.set('arquivo', arquivo);
      if (legenda) form.set('legenda', legenda);
      const r = await enviarArquivo(selecionada, form);
      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível enviar o arquivo.');
        return;
      }
      await carregarMensagens(selecionada, false);
      router.refresh();
    });
  }

  if (conversas.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-body-lg font-medium text-foreground">Nenhuma conversa ainda</p>
          <p className="mt-1 text-body-sm text-muted-foreground">
            As conversas aparecem assim que alguém mandar mensagem para o seu número — ou você pode
            começar uma.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => setAbrindoNova(true)}>
              <Plus /> Nova conversa
            </Button>
            <Button
              variant="outline"
              disabled={sincronizando}
              onClick={() =>
                startSync(async () => {
                  const r = await sincronizarHistorico();
                  setAviso(r.ok ? 'Histórico pedido. As conversas antigas chegam em instantes.' : (r.erro ?? ''));
                  router.refresh();
                })
              }
            >
              {sincronizando ? <Loader2 className="animate-spin" /> : <History />} Puxar histórico
            </Button>
          </div>
          {aviso && <p className="mt-3 text-body-sm text-muted-foreground">{aviso}</p>}
        </div>
        <DialogNovaConversa
          aberto={abrindoNova}
          onFechar={() => setAbrindoNova(false)}
          numero={novoNumero}
          setNumero={setNovoNumero}
          onCriada={(id) => {
            setAbrindoNova(false);
            setSelecionada(id);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        // 9rem cobre o padding do main mais o cabecalho ja encolhido. Antes
        // eram 12rem, e a folga sobrava como espaco morto embaixo da caixa.
        telaCheia ? 'fixed inset-0 z-50 bg-background p-3' : 'h-[calc(100vh-9rem)]'
      )}
    >
      {/* Barra de comando: contadores a esquerda, troca de visao a direita.
          O agrupamento so aparece no quadro — na lista ele nao teria o que
          agrupar, e controle que nao faz nada ensina a duvidar dos outros. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        {naoLidasTotal > 0 && <Badge variant="errorSoft">{naoLidasTotal} nao lidas</Badge>}
        {esperando > 0 && <Badge variant="warningSoft">{esperando} esperando resposta</Badge>}
        {naoLidasTotal === 0 && esperando === 0 && (
          <Badge variant="successSoft">Tudo respondido</Badge>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {visao === 'quadro' && (
            <Segmented
              size="sm"
              value={agrupamento}
              onChange={setAgrupamento}
              options={[
                { value: 'espera', label: 'Por espera' },
                { value: 'status', label: 'Por status' },
              ]}
            />
          )}
          <Segmented
            size="sm"
            value={visao}
            onChange={setVisaoTela}
            options={[
              { value: 'lista', label: 'Lista' },
              { value: 'quadro', label: 'Quadro' },
            ]}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Acoes">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  startSync(async () => {
                    const r = await sincronizarHistorico();
                    setAviso(r.ok ? 'Historico pedido.' : (r.erro ?? ''));
                    router.refresh();
                  })
                }
              >
                <History /> Puxar historico
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  startSync(async () => {
                    setAviso(avisoDaSincronia(await sincronizarContatos()));
                    router.refresh();
                  })
                }
              >
                <Contact /> Atualizar contatos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  startSync(async () => {
                    const r = await vincularConversasAosLeads();
                    setAviso(r.ok ? (r.vinculadas ?? 0) + ' conversa(s) ligada(s) a leads.' : (r.erro ?? ''));
                    router.refresh();
                  })
                }
              >
                <Link2 /> Ligar conversas aos leads
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAbrindoNova(true)}>
                <Plus /> Nova conversa
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/admin/whatsapp/desempenho">
                  <BarChart3 /> Desempenho
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/admin/whatsapp">
                  <Smartphone /> Meu numero
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {aviso && (
        <p className="rounded-md bg-surface-soft px-3 py-1.5 text-body-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
      {/* Fila */}
      <div className="flex w-[320px] shrink-0 flex-col rounded-lg border border-border bg-card">
        <div className="space-y-2 border-b border-border p-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conversa…"
                className="h-9 pl-9 text-body-sm"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setAbrindoNova(true)}
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <Plus />
            </Button>
          </div>

          <Tabs value={recorte} onValueChange={(v) => setRecorte(v as Recorte)}>
            <TabsList className="w-full">
              <TabsTrigger value="ativas" className="flex-1">
                Ativas
              </TabsTrigger>
              <TabsTrigger value="nao_lidas" className="flex-1">
                Não lidas
              </TabsTrigger>
              <TabsTrigger value="arquivadas" className="flex-1">
                <Archive className="h-3 w-3" />
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={sincronizando}
              title="Pedir as mensagens antigas ao WhatsApp"
              onClick={() =>
                startSync(async () => {
                  setAviso(null);
                  const r = await sincronizarHistorico();
                  setAviso(
                    r.ok
                      ? `Histórico pedido para ${r.pedidos ?? 0} conversa(s).`
                      : (r.erro ?? 'Falha ao sincronizar.')
                  );
                  router.refresh();
                })
              }
            >
              {sincronizando ? <Loader2 className="animate-spin" /> : <History />} Histórico
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={sincronizando}
              title="Puxar nomes da agenda do WhatsApp"
              onClick={() =>
                startSync(async () => {
                  setAviso(avisoDaSincronia(await sincronizarContatos()));
                  router.refresh();
                })
              }
            >
              <Contact />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={sincronizando}
              title="Ligar conversas aos leads do funil"
              onClick={() =>
                startSync(async () => {
                  const r = await vincularConversasAosLeads();
                  setAviso(r.ok ? `${r.vinculadas ?? 0} conversa(s) ligada(s) a leads.` : (r.erro ?? ''));
                  router.refresh();
                })
              }
            >
              <Link2 />
            </Button>
          </div>

          <div className="flex justify-end">
            <Duplicadas />
          </div>

          <div className="flex gap-1.5">
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-body-sm text-foreground"
              aria-label="Filtrar por situação"
            >
              <option value="">Toda situação</option>
              <option value="novo">Novo</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="aguardando">Aguardando cliente</option>
              <option value="encerrado">Encerrado</option>
            </select>
            {etiquetasExistentes.length > 0 && (
              <select
                value={filtroEtiqueta}
                onChange={(e) => setFiltroEtiqueta(e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-body-sm text-foreground"
                aria-label="Filtrar por etiqueta"
              >
                <option value="">Toda etiqueta</option>
                {etiquetasExistentes.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            )}
          </div>

          {aviso && <p className="px-1 text-caption text-muted-foreground">{aviso}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visiveis.map((c) => {
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
                <AvatarContato nome={nome} fotoUrl={c.fotoUrl} ehGrupo={c.ehGrupo} />
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
                  {c.etiquetas.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.etiquetas.slice(0, 3).map((e) => (
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
            );
          })}
          {visiveis.length === 0 && (
            <p className="p-6 text-center text-body-sm text-muted-foreground">
              Nenhuma conversa nesta visão.
            </p>
          )}
        </div>
      </div>

      {/* Conversa (ou o quadro por espera) */}
      {visao === 'quadro' ? (
        /* O quadro usa a MESMA lista ja filtrada pela busca e pelos recortes:
           alternar a visao nao pode alternar tambem o conjunto, senao os
           numeros deixam de bater entre uma e outra. */
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <QuadroConversas
            conversas={visiveis}
            agrupamento={agrupamento}
            selecionada={selecionada}
            onAbrir={(id) => {
              setSelecionada(id);
              setVisaoTela('lista');
            }}
            onResolver={(id) =>
              startSync(async () => {
                await mudarSituacao(id, 'encerrado');
                router.refresh();
              })
            }
          />
        </div>
      ) : (
      <div className="relative flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface-soft">
        {conversa ? (
          <>
            <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
              <AvatarContato
                nome={conversa.nome || formatarTelefone(conversa.telefone) || '?'}
                fotoUrl={conversa.fotoUrl}
                ehGrupo={conversa.ehGrupo}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-lg font-medium text-foreground">
                  {conversa.nome || formatarTelefone(conversa.telefone) || 'Sem nome'}
                </p>
                <p className="truncate text-caption text-muted-foreground">
                  {conversa.ehGrupo ? 'Grupo' : formatarTelefone(conversa.telefone)}
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={buscaMsg}
                  onChange={(e) => setBuscaMsg(e.target.value)}
                  placeholder="Buscar nas mensagens"
                  className="h-8 w-48 pl-8 text-body-sm"
                />
              </div>

              {conversa.lead ? (
                <Badge variant="primarySoft">{conversa.lead.nome}</Badge>
              ) : (
                <Badge variant="neutralSoft">Sem lead</Badge>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTelaCheia((v) => !v)}
                aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
                title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {telaCheia ? <Minimize2 /> : <Maximize2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPainelAberto((v) => !v)}
                aria-label="Painel do contato"
                title="Painel do contato"
              >
                <Info />
              </Button>
            </div>

            {/* Resultados da busca substituem a timeline enquanto durarem */}
            {achados ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-body-sm text-muted-foreground">
                    {achados.length} resultado(s) para “{buscaMsg}”
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setBuscaMsg('')}>
                    <X /> Fechar busca
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {achados.map((a) => (
                    <button
                      key={a.mensagemId}
                      onClick={() => {
                        setSelecionada(a.conversaId);
                        setBuscaMsg('');
                      }}
                      className="w-full rounded-md border border-border bg-card p-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <p className="flex items-baseline justify-between gap-2 text-body-sm font-medium text-foreground">
                        <span className="truncate">{a.conversaNome}</span>
                        <span className="shrink-0 text-caption text-muted-foreground">
                          {quando(a.enviadaEm)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-body-sm text-muted-foreground">
                        {a.daMim ? 'Você: ' : ''}
                        {a.trecho}
                      </p>
                    </button>
                  ))}
                  {achados.length === 0 && (
                    <p className="py-6 text-center text-body-sm text-muted-foreground">
                      Nada encontrado.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div
                ref={areaMensagens}
                onScroll={aoRolar}
                className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) mandarArquivo(f);
                }}
              >
                {carregando ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : mensagens.length === 0 ? (
                  <p className="py-8 text-center text-body-sm text-muted-foreground">
                    Nenhuma mensagem. Use “Histórico” para puxar as antigas.
                  </p>
                ) : (
                  agruparPorDia(mensagens).map((grupo) => (
                    <div key={grupo.dia} className="space-y-2">
                      <div className="sticky top-0 z-10 flex justify-center py-1">
                        <span className="rounded-full bg-surface-strong px-3 py-0.5 text-caption font-medium text-muted-foreground shadow-xs">
                          {rotuloDia(grupo.dia)}
                        </span>
                      </div>
                      {grupo.itens.map((m) => (
                        <Bolha
                          key={m.id}
                          mensagem={m}
                          onResponder={() => setCitando(m)}
                          onEncaminhar={() => setEncaminhando(m)}
                          onReagiu={() => selecionada && carregarMensagens(selecionada, false)}
                          onAbrirMidia={() => {
                            const i = midias.findIndex((x) => x.id === m.id);
                            if (i >= 0) setVisorEm(i);
                          }}
                          onApagar={async (id) => {
                            const r = await apagarParaTodos(id);
                            if (!r.ok) setErro(r.erro ?? 'Não foi possível apagar.');
                            if (selecionada) await carregarMensagens(selecionada, false);
                          }}
                        />
                      ))}
                    </div>
                  ))
                )}
                <div ref={fimDaLista} />
              </div>
            )}

            {longeDoFim && !achados && (
              <button
                onClick={() => fimDaLista.current?.scrollIntoView({ behavior: 'smooth' })}
                className="absolute bottom-24 right-8 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md transition-colors hover:bg-accent"
                aria-label="Ir para a última mensagem"
                title="Ir para a última mensagem"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}

            <div className="border-t border-border bg-card p-2">
              {erro && <p className="mb-1.5 px-1 text-body-sm text-destructive">{erro}</p>}

              {citando && (
                <div className="mb-1.5 flex items-start gap-2 rounded-md border-l-2 border-primary bg-surface-soft px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-medium text-primary-strong">
                      {citando.daMim ? 'Você' : 'Cliente'}
                    </p>
                    <p className="truncate text-body-sm text-muted-foreground">
                      {citando.texto || citando.tipo}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setCitando(null)}>
                    <X />
                  </Button>
                </div>
              )}

              {modoNota && (
                <p className="mb-1.5 flex items-center gap-1.5 rounded-md bg-warning/[0.16] px-2.5 py-1.5 text-body-sm text-warning-strong">
                  <StickyNote className="h-3.5 w-3.5" />
                  Nota interna — o cliente não vê isto.
                </p>
              )}

              {emojisAbertos && (
                <div className="mb-1.5 flex flex-wrap gap-1 rounded-md border border-border bg-surface-soft p-1.5">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setRascunho((r) => r + e)}
                      className="rounded px-1.5 py-0.5 text-lg transition-colors hover:bg-accent"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-1.5">
                <input
                  ref={inputArquivo}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) mandarArquivo(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => inputArquivo.current?.click()}
                  disabled={enviando}
                  aria-label="Anexar arquivo"
                  title="Anexar arquivo"
                >
                  <Paperclip />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEmojisAbertos((v) => !v)}
                  aria-label="Emojis"
                >
                  <Smile />
                </Button>
                {selecionada && (
                  <Modelos
                    conversaId={selecionada}
                    onEscolher={(t) => setRascunho((r) => (r ? `${r}
${t}` : t))}
                  />
                )}
                <Button
                  variant={modoNota ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setModoNota((v) => !v)}
                  aria-label="Nota interna"
                  title="Nota interna (o cliente não vê)"
                >
                  <StickyNote />
                </Button>

                <Textarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  onPaste={(e) => {
                    // Colar imagem da área de transferência manda como anexo —
                    // é como se manda print no WhatsApp.
                    const arquivo = Array.from(e.clipboardData.files)[0];
                    if (arquivo) {
                      e.preventDefault();
                      mandarArquivo(arquivo);
                    }
                  }}
                  placeholder={modoNota ? 'Escreva a nota interna…' : 'Escreva uma mensagem…'}
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

      )}

      {conversa && painelAberto && visao === 'lista' && (
        <PainelCrm conversa={conversa} onFechar={() => setPainelAberto(false)} />
      )}

      {/* Encaminhar */}
      <Dialog open={encaminhando !== null} onOpenChange={(a) => !a && setEncaminhando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaminhar mensagem</DialogTitle>
            <DialogDescription>Escolha para qual conversa enviar.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {conversas
              .filter((c) => c.id !== selecionada)
              .map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                  onClick={() => {
                    const msg = encaminhando;
                    setEncaminhando(null);
                    if (!msg) return;
                    startEnvio(async () => {
                      const r = await encaminharMensagem(msg.id, c.id);
                      if (!r.ok) setErro(r.erro ?? 'Não foi possível encaminhar.');
                      else setAviso(`Encaminhada para ${c.nome || c.telefone}.`);
                      router.refresh();
                    });
                  }}
                >
                  <Forward className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-body-sm">
                    {c.nome || formatarTelefone(c.telefone)}
                  </span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {visorEm !== null && midias.length > 0 && (
        <VisorMidia itens={midias} indiceInicial={visorEm} onFechar={() => setVisorEm(null)} />
      )}

      <DialogNovaConversa
        aberto={abrindoNova}
        onFechar={() => setAbrindoNova(false)}
        numero={novoNumero}
        setNumero={setNovoNumero}
        onCriada={(id) => {
          setAbrindoNova(false);
          setSelecionada(id);
          router.refresh();
        }}
      />
      </div>
    </div>
  );
}

function DialogNovaConversa({
  aberto,
  onFechar,
  numero,
  setNumero,
  onCriada,
}: {
  aberto: boolean;
  onFechar: () => void;
  numero: string;
  setNumero: (v: string) => void;
  onCriada: (id: string) => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Digite o número com DDD. Sem DDI, assumimos Brasil.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="(75) 98490-4920"
          autoFocus
        />
        {erro && <p className="text-body-sm text-destructive">{erro}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={pendente}>
            Cancelar
          </Button>
          <Button
            disabled={pendente || numero.replace(/\D/g, '').length < 10}
            onClick={() =>
              iniciar(async () => {
                setErro(null);
                const r = await novaConversa(numero);
                if (!r.ok || !r.conversaId) {
                  setErro(r.erro ?? 'Não foi possível abrir.');
                  return;
                }
                setNumero('');
                onCriada(r.conversaId);
              })
            }
          >
            {pendente ? 'Abrindo…' : 'Abrir conversa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
