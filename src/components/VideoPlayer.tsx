'use client';

import { useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  corPrimaria?: string;
  className?: string;
}

/**
 * Player de vídeo com poster, botão play centralizado e controles ao tocar.
 * Detecta orientação (landscape/portrait) ao carregar metadados e ajusta o container.
 * Quando clica em "Play", carrega o vídeo via preload="metadata" (poupa banda).
 */
export function VideoPlayer({ src, poster, corPrimaria = '#0ea5e9', className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  // 'auto' enquanto não tem metadata; depois vira 'landscape' ou 'portrait'
  const [orient, setOrient] = useState<'auto' | 'landscape' | 'portrait'>('auto');

  function play() {
    setStarted(true);
    setTimeout(() => {
      videoRef.current?.play().catch(() => {});
    }, 50);
  }

  function handleMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setOrient(v.videoHeight > v.videoWidth ? 'portrait' : 'landscape');
  }

  // Container responsivo conforme orientação
  // - landscape: aspect-video (16:9), largura total
  // - portrait: aspect-[9/16], centralizado e mais estreito (limite ~440px)
  // - auto (carregando): mantém 16:9 como placeholder neutro
  const containerClass =
    orient === 'portrait'
      ? 'aspect-[9/16] max-w-[440px] mx-auto'
      : 'aspect-video';

  return (
    <div
      className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl group ${containerClass} ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        controls={started}
        preload="metadata"
        playsInline
        onLoadedMetadata={handleMetadata}
        className="w-full h-full object-contain bg-black"
      />
      {!started && (
        <button
          onClick={play}
          className="absolute inset-0 flex items-center justify-center group/btn"
          aria-label="Reproduzir vídeo"
        >
          <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
          <span
            className="absolute w-28 h-28 rounded-full opacity-40 animate-ping"
            style={{ background: corPrimaria }}
          />
          <span
            className="relative flex items-center justify-center w-20 h-20 rounded-full shadow-2xl transition group-hover/btn:scale-110"
            style={{ background: corPrimaria }}
          >
            <svg className="w-9 h-9 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * Vídeo de fundo loopado, sem áudio. Pra hero, banner, etc.
 */
export function VideoBackground({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string | null;
  className?: string;
}) {
  return (
    <video
      src={src}
      poster={poster ?? undefined}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
      className={`absolute inset-0 w-full h-full object-cover ${className ?? ''}`}
    />
  );
}
