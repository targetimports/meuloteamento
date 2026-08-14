'use client';

/**
 * Menu de contexto da conversa — botão direito na linha da fila.
 *
 * As mesmas ações existem no painel do contato, mas lá exigem abrir a conversa
 * primeiro. Fixar, silenciar e arquivar são decisões que se tomam olhando a
 * fila, sobre uma conversa que não se quer abrir — abrir marca como lida, que é
 * justamente o contrário de "deixo para depois".
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, BellOff, BellRing, Mail, MailOpen, Pin, PinOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ConversaUI } from './CaixaDeEntrada';

export interface AlvoMenu {
  conversa: ConversaUI;
  x: number;
  y: number;
}

/** Largura e altura estimadas, para o menu não nascer fora da tela. */
const LARGURA = 208;
const ALTURA = 168;

export function MenuConversa({
  alvo,
  aoFechar,
  aoEscolher,
  pendente,
}: {
  alvo: AlvoMenu | null;
  aoFechar: () => void;
  aoEscolher: (acao: 'alternarLida' | 'fixar' | 'silenciar' | 'arquivar', conversa: ConversaUI) => void;
  pendente: boolean;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // Fecha no Escape, no scroll e ao redimensionar: em qualquer um desses o menu
  // ficaria ancorado num ponto que não corresponde mais à linha clicada.
  useEffect(() => {
    if (!alvo) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar();
    }
    window.addEventListener('keydown', onTecla);
    window.addEventListener('resize', aoFechar);
    window.addEventListener('scroll', aoFechar, true);
    return () => {
      window.removeEventListener('keydown', onTecla);
      window.removeEventListener('resize', aoFechar);
      window.removeEventListener('scroll', aoFechar, true);
    };
  }, [alvo, aoFechar]);

  if (!montado || !alvo) return null;

  const { conversa: c } = alvo;
  const x = Math.min(alvo.x, window.innerWidth - LARGURA - 8);
  const y = Math.min(alvo.y, window.innerHeight - ALTURA - 8);

  const temNaoLidas = c.naoLidas > 0;

  const itens = [
    {
      // Um item só, que alterna: com não-lidas ele zera; sem elas, devolve a
      // conversa à fila. Oferecer "marcar como não lida" a quem já tem não
      // lidas era um comando sem efeito possível.
      chave: 'alternarLida' as const,
      Icone: temNaoLidas ? MailOpen : Mail,
      rotulo: temNaoLidas ? 'Marcar como lida' : 'Marcar como não lida',
    },
    {
      chave: 'fixar' as const,
      Icone: c.fixada ? PinOff : Pin,
      rotulo: c.fixada ? 'Desafixar' : 'Fixar no topo',
    },
    {
      chave: 'silenciar' as const,
      Icone: c.silenciada ? BellRing : BellOff,
      rotulo: c.silenciada ? 'Reativar avisos' : 'Silenciar',
    },
    {
      chave: 'arquivar' as const,
      Icone: Archive,
      rotulo: c.arquivada ? 'Desarquivar' : 'Arquivar',
    },
  ];

  return createPortal(
    <>
      {/* Captura o clique fora, inclusive o direito: sem isto, o botão direito
          em outra linha abriria um segundo menu por cima do primeiro. */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={aoFechar}
        onContextMenu={(e) => {
          e.preventDefault();
          aoFechar();
        }}
      />
      <div
        role="menu"
        aria-label={`Ações de ${c.nome ?? 'conversa'}`}
        className="modal-painel fixed z-[61] w-52 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        style={{ left: x, top: y }}
      >
        {itens.map(({ chave, Icone, rotulo }) => (
          <button
            key={chave}
            type="button"
            role="menuitem"
            disabled={pendente}
            onClick={() => {
              aoEscolher(chave, c);
              aoFechar();
            }}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-body-sm text-foreground transition-colors',
              'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{rotulo}</span>
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}
