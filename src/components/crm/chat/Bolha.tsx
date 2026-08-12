'use client';

import { useState, useTransition } from 'react';
import {
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Copy,
  Download,
  FileText,
  Forward,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Reply,
  Smile,
  Sticker,
  StickyNote,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { AudioMensagem } from './AudioMensagem';
import { reagirMensagem } from '@/app/admin/(dashboard)/whatsapp/chat-actions';
import type { MensagemUI } from '@/app/admin/(dashboard)/whatsapp/chat-actions';

/**
 * Rótulo de mídia que não pôde ser baixada.
 *
 * 🔴 Existe por causa de um defeito real no ERP: mídia sem arquivo e sem texto
 * renderizava uma bolha só com o horário — uma barra cinza sem explicação. As
 * 26 mensagens de mídia do sistema estavam assim.
 *
 * O download foi corrigido, mas o rótulo fica: a mídia pode falhar de novo
 * (arquivo expirado no WhatsApp, servidor fora do ar), e quando falhar é
 * preciso DIZER que falhou. Bolha vazia faz o atendente achar que o cliente
 * mandou uma mensagem em branco, quando na verdade mandou um áudio que nós
 * perdemos — e a diferença muda o que ele responde.
 */
const MIDIA_AUSENTE: Record<string, { Icone: typeof Mic; rotulo: string }> = {
  AUDIO: { Icone: Mic, rotulo: 'Áudio' },
  IMAGEM: { Icone: ImageIcon, rotulo: 'Imagem' },
  VIDEO: { Icone: ImageIcon, rotulo: 'Vídeo' },
  STICKER: { Icone: Sticker, rotulo: 'Figurinha' },
  DOCUMENTO: { Icone: FileText, rotulo: 'Documento' },
};

/** Reações que cobrem quase todo uso real; o resto vai pelo texto mesmo. */
const REACOES = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function MidiaIndisponivel({ tipo }: { tipo: string }) {
  const { Icone, rotulo } = MIDIA_AUSENTE[tipo] ?? { Icone: Paperclip, rotulo: 'Arquivo' };
  return (
    <div className="mb-1 flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-soft px-2.5 py-2">
      <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-body-sm leading-tight text-foreground">{rotulo} não baixado</p>
        <p className="text-caption leading-tight text-muted-foreground">
          Chegou, mas o arquivo não foi salvo
        </p>
      </div>
      <CircleAlert className="ml-auto h-3.5 w-3.5 shrink-0 text-warning-strong" aria-hidden />
    </div>
  );
}

/** Um tique = enviada, dois = entregue, dois azuis = lida. */
function StatusEnvio({ status }: { status: string }) {
  if (status === 'PENDENTE') return <Clock className="h-3 w-3" aria-label="Enviando" />;
  if (status === 'ERRO')
    return <CircleAlert className="h-3 w-3 text-destructive" aria-label="Falhou" />;
  if (status === 'LIDA') return <CheckCheck className="h-3 w-3 text-info" aria-label="Lida" />;
  if (status === 'ENTREGUE') return <CheckCheck className="h-3 w-3" aria-label="Entregue" />;
  return <Check className="h-3 w-3" aria-label="Enviada" />;
}

/**
 * Transcrição do áudio, embaixo do player.
 *
 * Áudio é a mensagem que não dá para varrer com o olho: quem tem quinze
 * conversas abertas precisaria ouvir uma por uma. Com o texto embaixo, o áudio
 * volta a ser um item que se lê em dois segundos.
 *
 * Aparece como citação, não como fala do balão: é máquina lendo, não o que o
 * cliente escreveu. Confundir as duas faria alguém copiar uma transcrição
 * errada para dentro de um contrato.
 */
function Transcricao({ mensagem }: { mensagem: MensagemUI }) {
  const status = mensagem.transcricaoStatus;
  if (status === 'pendente') {
    return (
      <p className="mt-1 flex items-center gap-1 text-caption italic text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> transcrevendo…
      </p>
    );
  }
  if (status?.startsWith('erro')) {
    return <p className="mt-1 text-caption italic text-muted-foreground">{status}</p>;
  }
  if (!mensagem.transcricao) return null;
  return (
    <blockquote className="mt-1 border-l-2 border-border pl-2 text-body-sm italic text-muted-foreground">
      {mensagem.transcricao}
    </blockquote>
  );
}

export function Bolha({
  mensagem: m,
  onApagar,
  onResponder,
  onEncaminhar,
  onAbrirMidia,
  onReagiu,
}: {
  mensagem: MensagemUI;
  onApagar?: (id: string) => void;
  onResponder?: () => void;
  onEncaminhar?: () => void;
  onAbrirMidia?: () => void;
  onReagiu?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [reagindo, iniciarReacao] = useTransition();

  const minha = m.daMim;
  const url = `/api/whatsapp/midia/${m.id}`;

  const hora = new Date(m.enviadaEm).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Num áudio, o que existe para copiar é a transcrição — é dela que sai o
  // trecho colado numa proposta ou repassado para outra pessoa.
  const textoCopiavel = m.texto || m.transcricao || '';

  // Nota interna não é mensagem do WhatsApp: é recado da equipe. Precisa ser
  // visivelmente OUTRA coisa, senão alguém confia que o cliente leu.
  if (m.notaInterna) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-md border border-warning/40 bg-warning/[0.12] px-3 py-2">
          <p className="mb-0.5 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-warning-strong">
            <StickyNote className="h-3 w-3" /> Nota interna — o cliente não vê
          </p>
          <p className="whitespace-pre-wrap text-body text-foreground">{m.texto}</p>
          <p className="mt-0.5 text-right text-caption text-muted-foreground">{hora}</p>
        </div>
      </div>
    );
  }

  if (m.tipo === 'SISTEMA') {
    return (
      <div className="flex justify-center">
        <span className="rounded-md border border-dashed border-border px-3 py-1 text-body-sm italic text-muted-foreground">
          {m.texto || 'Mensagem apagada'}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={cn('group flex', minha ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'relative max-w-[75%] rounded-lg px-3 py-2 shadow-xs',
            minha ? 'bg-primary/[0.16] text-foreground' : 'border border-border bg-card'
          )}
        >
          {/* Em grupo, quem falou. Sem isto dez pessoas viram uma só. */}
          {!minha && m.participanteNome && (
            <p className="mb-0.5 text-caption font-semibold text-primary-strong">
              {m.participanteNome}
            </p>
          )}

          {m.respondeATexto && (
            <div className="mb-1.5 rounded border-l-2 border-primary bg-background/40 px-2 py-1">
              <p className="text-caption font-medium text-primary-strong">
                {m.respondeADeMim ? 'Você' : 'Cliente'}
              </p>
              <p className="truncate text-caption text-muted-foreground">{m.respondeATexto}</p>
            </div>
          )}

          {m.temMidia ? (
            <>
              {m.tipo === 'IMAGEM' || m.tipo === 'STICKER' ? (
                <button onClick={onAbrirMidia} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={m.texto || 'Imagem recebida'}
                    className="mb-1 max-h-72 rounded-md object-contain"
                  />
                </button>
              ) : m.tipo === 'AUDIO' ? (
                <AudioMensagem src={url} id={m.id} />
              ) : m.tipo === 'VIDEO' ? (
                <button onClick={onAbrirMidia} className="block">
                  <video src={url} className="mb-1 max-h-72 rounded-md" />
                </button>
              ) : (
                <a
                  href={`${url}?download=1`}
                  className="mb-1 flex items-center gap-2 rounded-md border border-border bg-surface-soft px-2.5 py-2 transition-colors hover:bg-accent"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-body-sm">
                    {m.nomeArquivo || 'Documento'}
                  </span>
                  <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              )}
            </>
          ) : (
            m.tipo !== 'TEXTO' &&
            m.tipo !== 'LOCALIZACAO' &&
            m.tipo !== 'CONTATO' && <MidiaIndisponivel tipo={m.tipo} />
          )}

          {m.texto && <p className="whitespace-pre-wrap break-words text-body">{m.texto}</p>}

          {m.tipo === 'AUDIO' && <Transcricao mensagem={m} />}

          {m.reacao && (
            <span className="absolute -bottom-2 left-2 rounded-full border border-border bg-card px-1.5 text-body-sm shadow-xs">
              {m.reacao}
            </span>
          )}

          <div className="mt-0.5 flex items-center justify-end gap-1 text-caption text-muted-foreground">
            {m.editada && <span className="italic">editada</span>}
            <span>{hora}</span>
            {minha && <StatusEnvio status={m.status} />}

            <DropdownMenu>
              <DropdownMenuTrigger
                className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                aria-label="Ações da mensagem"
              >
                {reagindo ? <Loader2 className="h-3 w-3 animate-spin" /> : '⋯'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align={minha ? 'end' : 'start'}>
                {/* Reagir fica no topo e em linha: é a ação de um clique. */}
                <div className="flex gap-0.5 px-1 py-1">
                  {REACOES.map((e) => (
                    <button
                      key={e}
                      className="rounded px-1 text-lg transition-colors hover:bg-accent"
                      onClick={() =>
                        iniciarReacao(async () => {
                          await reagirMensagem(m.id, e);
                          onReagiu?.();
                        })
                      }
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <DropdownMenuSeparator />

                {onResponder && (
                  <DropdownMenuItem onClick={onResponder}>
                    <Reply /> Responder
                  </DropdownMenuItem>
                )}
                {onEncaminhar && (
                  <DropdownMenuItem onClick={onEncaminhar}>
                    <Forward /> Encaminhar
                  </DropdownMenuItem>
                )}
                {textoCopiavel && (
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard?.writeText(textoCopiavel);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 1500);
                    }}
                  >
                    <Copy /> {copiado ? 'Copiado' : m.texto ? 'Copiar texto' : 'Copiar transcrição'}
                  </DropdownMenuItem>
                )}
                {m.temMidia && (
                  <DropdownMenuItem asChild>
                    <a href={`${url}?download=1`}>
                      <Download /> Baixar arquivo
                    </a>
                  </DropdownMenuItem>
                )}
                {minha && onApagar && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destrutivo onClick={() => setConfirmandoApagar(true)}>
                      <Trash2 /> Apagar para todos
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/*
        Confirmação antes de apagar: a ação é irreversível e some da conversa
        dos dois lados. Um clique errado no menu não pode apagar a mensagem que
        o cliente ainda vai ler.
      */}
      <Dialog open={confirmandoApagar} onOpenChange={setConfirmandoApagar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar para todos?</DialogTitle>
            <DialogDescription>
              A mensagem some da sua conversa e da do cliente. Não há como desfazer.
            </DialogDescription>
          </DialogHeader>
          {m.texto && (
            <p className="truncate rounded-md bg-surface-soft px-3 py-2 text-body-sm text-muted-foreground">
              {m.texto}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoApagar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmandoApagar(false);
                onApagar?.(m.id);
              }}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
