'use client';

/**
 * Componentes client do Modo TV:
 *   - TvRelogio: relógio digital que atualiza a cada segundo
 *   - TvAutoRefresh: força refresh da página a cada N segundos (mantém os
 *     dados do server-render frescos sem ninguém apertar F5)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function TvRelogio() {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!agora) {
    return <p className="text-2xl font-mono font-bold tabular-nums">--:--:--</p>;
  }

  const hh = agora.getHours().toString().padStart(2, '0');
  const mm = agora.getMinutes().toString().padStart(2, '0');
  const ss = agora.getSeconds().toString().padStart(2, '0');
  const data = agora.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div className="text-right">
      <p className="text-2xl font-mono font-bold tabular-nums leading-none">
        {hh}:{mm}
        <span className="text-slate-400 text-base">:{ss}</span>
      </p>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">{data}</p>
    </div>
  );
}

export function TvAutoRefresh({ intervaloMs = 30_000 }: { intervaloMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs]);

  return null;
}
