'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Áudio de mensagem, no vocabulário de mensageiro.
 *
 * 🔴 Por que existe: o `<audio controls>` nativo é uma barra escura com os
 * controles do sistema operacional, larga demais e com desenho que muda entre
 * Chrome, Firefox e Safari. Numa conversa de WhatsApp ele grita "isto aqui é
 * uma página web genérica" — é o elemento que mais destoa da tela.
 *
 * O desenho segue o que qualquer mensageiro faz, porque quem atende passa o dia
 * entre o aparelho e o sistema: botão redondo, onda, tempo, velocidade.
 *
 * 🔴 Nenhuma cor fixa. A onda usa `currentColor` e a bolha já define a cor do
 * texto, então o player se adapta a mensagem recebida e enviada, no tema claro
 * e no escuro, sem saber em qual está.
 */

/**
 * Onda estática, derivada do id da mensagem.
 *
 * Desenhar a forma real exigiria decodificar o arquivo com Web Audio — baixar e
 * processar cada áudio da conversa para um enfeite. A onda aqui é sinal visual
 * de "isto é voz", não análise do conteúdo: o que a pessoa precisa é achar o
 * áudio e saber onde está a reprodução.
 *
 * Derivada do id, e não aleatória, para não mudar a cada render — barra
 * dançando sozinha chamaria atenção para o lugar errado.
 */
function ondaDe(semente: string, barras = 34): number[] {
  let h = 0;
  const s = String(semente || 'x');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Array.from({ length: barras }, () => {
    h = (h * 1103515245 + 12345) >>> 0;
    // 25% a 100% da altura: barra muito curta lê como falha de carregamento.
    return 0.25 + ((h >>> 8) % 76) / 100;
  });
}

function mmss(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const VELOCIDADES = [1, 1.5, 2];

export function AudioMensagem({ src, id }: { src: string; id: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [vel, setVel] = useState(1);

  const onda = useMemo(() => ondaDe(id || src), [id, src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const aoTempo = () => setPos(el.currentTime);
    const aoCarregar = () => setDur(el.duration);
    const aoFim = () => {
      setTocando(false);
      setPos(0);
    };
    el.addEventListener('timeupdate', aoTempo);
    el.addEventListener('loadedmetadata', aoCarregar);
    el.addEventListener('ended', aoFim);
    return () => {
      el.removeEventListener('timeupdate', aoTempo);
      el.removeEventListener('loadedmetadata', aoCarregar);
      el.removeEventListener('ended', aoFim);
    };
  }, []);

  function alternar() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setTocando(true);
    } else {
      el.pause();
      setTocando(false);
    }
  }

  function trocarVelocidade() {
    const proxima = VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length];
    setVel(proxima);
    if (ref.current) ref.current.playbackRate = proxima;
  }

  /** Clicar na onda pula para aquele ponto — é o que se espera de uma barra. */
  function irPara(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    const fracao = Math.min(1, Math.max(0, (e.clientX - caixa.left) / caixa.width));
    el.currentTime = fracao * el.duration;
    setPos(el.currentTime);
  }

  const progresso = dur > 0 ? pos / dur : 0;

  return (
    <div className="mb-1 flex items-center gap-2">
      <audio ref={ref} src={src} preload="metadata" className="hidden" />

      <button
        onClick={alternar}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-current/10 transition-opacity hover:opacity-80"
        aria-label={tocando ? 'Pausar' : 'Tocar'}
      >
        {tocando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <div
        className="flex h-8 flex-1 cursor-pointer items-center gap-[2px]"
        onClick={irPara}
        role="slider"
        aria-label="Posição do áudio"
        aria-valuenow={Math.round(progresso * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        {onda.map((altura, i) => (
          <span
            key={i}
            className={cn(
              'w-[2px] shrink-0 rounded-full bg-current transition-opacity',
              i / onda.length <= progresso ? 'opacity-90' : 'opacity-30'
            )}
            style={{ height: `${altura * 100}%` }}
          />
        ))}
      </div>

      <span className="shrink-0 text-caption tabular-nums opacity-70">
        {mmss(tocando || pos > 0 ? pos : dur)}
      </span>

      <button
        onClick={trocarVelocidade}
        className="shrink-0 rounded px-1 text-caption font-semibold opacity-70 transition-opacity hover:opacity-100"
        aria-label="Velocidade de reprodução"
      >
        {vel}×
      </button>
    </div>
  );
}
