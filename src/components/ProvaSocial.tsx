'use client';

/**
 * Banner de prova social — mostra X lotes vendidos / Y a venda etc.
 * Animação de contagem ao entrar em vista.
 */

import { useEffect, useRef, useState } from 'react';

interface Item {
  numero: number;
  label: string;
  sufixo?: string;
  cor?: string;
}

interface Props {
  items: Item[];
  corPrimaria?: string;
}

export function ProvaSocial({ items, corPrimaria = '#0ea5e9' }: Props) {
  return (
    <section className="py-12 px-6 bg-white border-y border-slate-200">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((it, i) => (
          <CounterCard key={i} item={it} corPrimaria={it.cor ?? corPrimaria} />
        ))}
      </div>
    </section>
  );
}

function CounterCard({ item, corPrimaria }: { item: Item; corPrimaria: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const dur = 1400;
        const start = performance.now();
        const tick = (now: number) => {
          const pct = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - pct, 3);
          setVal(Math.round(item.numero * eased));
          if (pct < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [item.numero]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl md:text-5xl font-black" style={{ color: corPrimaria }}>
        {val}
        {item.sufixo && <span className="text-2xl ml-0.5">{item.sufixo}</span>}
      </p>
      <p className="text-sm text-slate-600 font-medium mt-1">{item.label}</p>
    </div>
  );
}
