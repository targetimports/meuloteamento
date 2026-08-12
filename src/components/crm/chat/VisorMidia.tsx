'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCw, X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ItemMidia {
  id: string;
  tipo: string;
  nomeArquivo: string | null;
  legenda: string | null;
  quando: string;
}

/**
 * Visor de mídia em tela cheia.
 *
 * Abrir a imagem em outra aba tira a pessoa da conversa e perde o contexto —
 * volta-se sem saber onde estava. Aqui a foto abre por cima, com as setas
 * andando pelas outras mídias da MESMA conversa, que é como se procura aquele
 * comprovante que o cliente mandou "semana passada".
 *
 * Esc fecha, setas navegam, + e − dão zoom: teclado antes de mouse, porque
 * quem está atendendo tem as duas mãos no teclado.
 */
export function VisorMidia({
  itens,
  indiceInicial,
  onFechar,
}: {
  itens: ItemMidia[];
  indiceInicial: number;
  onFechar: () => void;
}) {
  const [indice, setIndice] = useState(indiceInicial);
  const [zoom, setZoom] = useState(1);
  const [giro, setGiro] = useState(0);

  const item = itens[indice];

  const anterior = useCallback(() => {
    setIndice((i) => (i > 0 ? i - 1 : i));
    setZoom(1);
    setGiro(0);
  }, []);

  const proximo = useCallback(() => {
    setIndice((i) => (i < itens.length - 1 ? i + 1 : i));
    setZoom(1);
    setGiro(0);
  }, [itens.length]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'ArrowRight') proximo();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, z + 0.25));
      if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25));
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, anterior, proximo]);

  if (!item) return null;
  const url = `/api/whatsapp/midia/${item.id}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      // Clicar no fundo fecha; clicar na mídia, não.
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de mídia"
    >
      <div
        className="flex items-center gap-2 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-lg font-medium">
            {item.nomeArquivo || item.legenda || 'Mídia'}
          </p>
          <p className="text-caption opacity-70">
            {indice + 1} de {itens.length} · {item.quando}
          </p>
        </div>

        {item.tipo === 'IMAGEM' && (
          <>
            <BotaoVisor onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} rotulo="Diminuir">
              <Minus className="h-4 w-4" />
            </BotaoVisor>
            <span className="w-12 text-center text-caption tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <BotaoVisor onClick={() => setZoom((z) => Math.min(4, z + 0.25))} rotulo="Aumentar">
              <Plus className="h-4 w-4" />
            </BotaoVisor>
            <BotaoVisor onClick={() => setGiro((g) => (g + 90) % 360)} rotulo="Girar">
              <RotateCw className="h-4 w-4" />
            </BotaoVisor>
          </>
        )}

        <BotaoVisor href={`${url}?download=1`} rotulo="Baixar">
          <Download className="h-4 w-4" />
        </BotaoVisor>
        <BotaoVisor onClick={onFechar} rotulo="Fechar">
          <X className="h-5 w-5" />
        </BotaoVisor>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {indice > 0 && (
          <BotaoLateral lado="esquerda" onClick={anterior}>
            <ChevronLeft className="h-6 w-6" />
          </BotaoLateral>
        )}

        <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
          {item.tipo === 'VIDEO' ? (
            <video src={url} controls autoPlay className="max-h-[80vh] max-w-full rounded-md" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={item.legenda || 'Mídia da conversa'}
              className="max-h-[80vh] max-w-full rounded-md object-contain transition-transform"
              style={{ transform: `scale(${zoom}) rotate(${giro}deg)` }}
            />
          )}
        </div>

        {indice < itens.length - 1 && (
          <BotaoLateral lado="direita" onClick={proximo}>
            <ChevronRight className="h-6 w-6" />
          </BotaoLateral>
        )}
      </div>

      {item.legenda && (
        <p
          className="px-6 pb-5 text-center text-body text-white/90"
          onClick={(e) => e.stopPropagation()}
        >
          {item.legenda}
        </p>
      )}
    </div>
  );
}

function BotaoVisor({
  children,
  onClick,
  href,
  rotulo,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  rotulo: string;
}) {
  const classe =
    'flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15';
  if (href) {
    return (
      <a href={href} className={classe} aria-label={rotulo} title={rotulo}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={classe} aria-label={rotulo} title={rotulo}>
      {children}
    </button>
  );
}

function BotaoLateral({
  children,
  lado,
  onClick,
}: {
  children: React.ReactNode;
  lado: 'esquerda' | 'direita';
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70',
        lado === 'esquerda' ? 'left-3' : 'right-3'
      )}
      aria-label={lado === 'esquerda' ? 'Anterior' : 'Próxima'}
    >
      {children}
    </button>
  );
}
