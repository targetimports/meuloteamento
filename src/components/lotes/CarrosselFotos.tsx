'use client';

/**
 * Visualizador das fotos do lote em tela cheia.
 *
 * Ele é aberto de dentro do modal de edição, e é daí que vêm as armadilhas:
 *
 * 1. Renderiza por portal no body, com z acima do modal (que usa z-50). Dentro
 *    da árvore do modal ele seria recortado pelo container que rola e ficaria
 *    do tamanho da miniatura.
 * 2. Trata o Escape na fase de captura e interrompe o evento. Sem isso a
 *    primeira tecla fecharia o modal inteiro por baixo, e o visualizador junto.
 * 3. Não mexe no overflow do body. O modal já o travou; restaurá-lo ao fechar
 *    o visualizador destravaria a rolagem da página com o modal ainda aberto.
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function CarrosselFotos({
  fotos,
  inicial,
  aoFechar,
}: {
  fotos: string[];
  /** Índice da foto clicada; null mantém o visualizador fechado. */
  inicial: number | null;
  aoFechar: () => void;
}) {
  const [idx, setIdx] = useState(inicial ?? 0);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (inicial !== null) setIdx(inicial);
  }, [inicial]);

  const anterior = useCallback(
    () => setIdx((i) => (i - 1 + fotos.length) % fotos.length),
    [fotos.length]
  );
  const proxima = useCallback(() => setIdx((i) => (i + 1) % fotos.length), [fotos.length]);

  useEffect(() => {
    if (inicial === null) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        aoFechar();
        return;
      }
      if (e.key === 'ArrowRight') proxima();
      if (e.key === 'ArrowLeft') anterior();
    }
    // Captura: chega antes do handler do modal, que também escuta Escape.
    window.addEventListener('keydown', onTecla, true);
    return () => window.removeEventListener('keydown', onTecla, true);
  }, [inicial, aoFechar, anterior, proxima]);

  if (!montado || inicial === null || fotos.length === 0) return null;

  const atual = fotos[Math.min(idx, fotos.length - 1)];

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Fotos do lote"
    >
      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              anterior();
            }}
            aria-label="Foto anterior"
            className="absolute left-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              proxima();
            }}
            aria-label="Próxima foto"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={atual}
        alt={`Foto ${idx + 1} de ${fotos.length}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      />

      {fotos.length > 1 && (
        <p className="absolute bottom-5 text-sm text-white/70">
          {idx + 1} de {fotos.length}
        </p>
      )}
    </div>,
    document.body
  );
}
