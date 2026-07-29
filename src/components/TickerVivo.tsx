'use client';

/**
 * TickerVivo — notificações flutuantes simuladas no canto inferior esquerdo
 * da landing de loteamento. Cria prova social + senso de "plataforma viva".
 *
 * Estratégia: mistura eventos REAIS (últimas vendas/reservas do banco) com
 * eventos sintéticos (números agregados, mensagens motivacionais). Eventos
 * reais ganham prioridade.
 *
 * Props:
 *   - eventosReais: lista pré-carregada do server (últimas reservas/vendas)
 *   - vgvHoje: VGV vendido nas últimas 24h (formatado)
 *   - leadsRecentes: nº de leads nas últimas 2h
 */

import { useEffect, useState, useMemo, useRef } from 'react';

export interface TickerEvento {
  /** "reservou" | "comprou" | "interesse" */
  tipo: 'reservou' | 'comprou' | 'interesse';
  /** Nome (primeiro nome do cliente, ou "Alguém" anônimo) */
  nome: string;
  /** Ex: "QD-12" ou "L045" */
  loteCodigo: string;
  /** Tempo relativo ("agora", "há 3 min", etc.) */
  quando: string;
}

interface Props {
  eventosReais: TickerEvento[];
  /** Valor numérico de VGV das últimas 24h, em R$ — pra formatar como "R$ 180k vendidos hoje" */
  vgvHoje?: number;
  /** Nº de leads nas últimas 2h */
  leadsRecentes?: number;
}

const ICONES: Record<TickerEvento['tipo'], string> = {
  reservou: '🔒',
  comprou: '✅',
  interesse: '👀',
};

const CORES: Record<TickerEvento['tipo'], string> = {
  reservou: 'border-amber-400/40 text-amber-300',
  comprou: 'border-emerald-400/40 text-emerald-300',
  interesse: 'border-sky-400/40 text-sky-300',
};

function formatBRLCompacto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n}`;
}

export function TickerVivo({ eventosReais, vgvHoje, leadsRecentes }: Props) {
  // Constrói pool de mensagens: reais + agregadas + sintéticas leves
  const pool = useMemo(() => {
    const out: Array<{ key: string; tipo: TickerEvento['tipo'] | 'stat'; texto: string }> = [];
    eventosReais.forEach((e, i) => {
      const verbo = e.tipo === 'reservou' ? 'reservou' : e.tipo === 'comprou' ? 'comprou' : 'visualizou';
      out.push({
        key: `real-${i}`,
        tipo: e.tipo,
        texto: `${e.nome} ${verbo} o lote ${e.loteCodigo}${e.quando ? ` · ${e.quando}` : ''}`,
      });
    });
    if (vgvHoje && vgvHoje > 0) {
      out.push({
        key: 'vgv',
        tipo: 'stat',
        texto: `${formatBRLCompacto(vgvHoje)} vendidos nas últimas 24h`,
      });
    }
    if (leadsRecentes && leadsRecentes > 0) {
      out.push({
        key: 'leads',
        tipo: 'stat',
        texto: `${leadsRecentes} novos interessados nas últimas 2h`,
      });
    }
    // Fallback se está tudo vazio
    if (out.length === 0) {
      out.push({
        key: 'fb',
        tipo: 'stat',
        texto: 'Plataforma ativa · vendendo agora',
      });
    }
    return out;
  }, [eventosReais, vgvHoje, leadsRecentes]);

  const [idx, setIdx] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const [fechado, setFechado] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aparece após 4s na página, esconde após 30s, alterna mensagem a cada 6s
  useEffect(() => {
    if (fechado) return;
    const t1 = setTimeout(() => setVisivel(true), 4000);
    const cycle = setInterval(() => {
      setVisivel(false);
      timerRef.current = setTimeout(() => {
        setIdx((i) => (i + 1) % pool.length);
        setVisivel(true);
      }, 500);
    }, 6500);
    return () => {
      clearTimeout(t1);
      clearInterval(cycle);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pool.length, fechado]);

  if (fechado || pool.length === 0) return null;
  const atual = pool[idx];

  return (
    <div
      className={`fixed bottom-4 left-4 z-30 max-w-xs transition-all duration-500 ${
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-start gap-3 bg-slate-900/95 backdrop-blur-md border-l-4 ${
          atual.tipo === 'stat'
            ? 'border-primary-400/60 text-primary-200'
            : CORES[atual.tipo as TickerEvento['tipo']]
        } rounded-r-xl rounded-l-sm shadow-2xl shadow-black/40 px-3.5 py-2.5 pr-8 relative`}
      >
        <span className="text-lg flex-shrink-0 mt-0.5">
          {atual.tipo === 'stat' ? '📊' : ICONES[atual.tipo as TickerEvento['tipo']]}
        </span>
        <p className="text-xs text-white leading-snug pt-0.5">{atual.texto}</p>
        <button
          onClick={() => setFechado(true)}
          aria-label="Fechar"
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white text-xs leading-none flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
