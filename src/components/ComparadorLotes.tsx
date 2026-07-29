'use client';

/**
 * Comparador de lotes — até 3 lotes lado a lado.
 * Cliente escolhe os lotes através de checkboxes ou pelo mapa interativo
 * (via localStorage 'comparar:lotes' que é uma feature opt-in).
 */

import { useEffect, useState } from 'react';
import type { LoteUI } from './loteamento-interactive';
import { IconClose } from './icons';

const STORAGE_KEY = 'comparar:lotes';
const LIMIT = 3;

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

interface Props {
  lotes: LoteUI[];
  corPrimaria?: string;
}

export function ComparadorLotes({ lotes, corPrimaria = '#0ea5e9' }: Props) {
  const [ids, setIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  }, [ids]);

  // Listener global — outros componentes podem adicionar via window dispatch
  useEffect(() => {
    function add(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail?.id) return;
      setIds((prev) => {
        if (prev.includes(detail.id)) return prev;
        if (prev.length >= LIMIT) {
          alert(`Você só pode comparar até ${LIMIT} lotes. Remova um antes de adicionar outro.`);
          return prev;
        }
        const next = [...prev, detail.id];
        return next;
      });
      setOpen(true);
    }
    window.addEventListener('comparador:add', add);
    return () => window.removeEventListener('comparador:add', add);
  }, []);

  const selecionados = ids
    .map((id) => lotes.find((l) => l.id === id))
    .filter(Boolean) as LoteUI[];

  if (selecionados.length === 0) return null;

  const remove = (id: string) => setIds((prev) => prev.filter((x) => x !== id));
  const clear = () => setIds([]);

  const precoMin = selecionados.reduce((m, l) => Math.min(m, l.preco), Infinity);
  const precoMax = selecionados.reduce((m, l) => Math.max(m, l.preco), 0);
  const areaMax = selecionados.reduce((m, l) => Math.max(m, l.area), 0);

  return (
    <>
      {/* Botão flutuante — mostra contagem */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl text-white font-bold text-sm transition hover:scale-105"
        style={{
          background: corPrimaria,
        }}
        aria-label="Abrir comparador de lotes"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h12" />
        </svg>
        <span>Comparar ({selecionados.length})</span>
      </button>

      {/* Drawer / modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-2 md:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">
                  Comparar lotes ({selecionados.length}/{LIMIT})
                </h2>
                <p className="text-xs text-slate-500">
                  Veja área, preço e diferenciais lado a lado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clear}
                  className="text-xs text-slate-500 hover:text-red-600 font-medium"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Fechar"
                >
                  <IconClose className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 p-4">
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${selecionados.length}, minmax(220px, 1fr))` }}
              >
                {selecionados.map((l) => {
                  const isMaisBarato = l.preco === precoMin && precoMin !== precoMax;
                  const isMaisCaro = l.preco === precoMax && precoMin !== precoMax;
                  const isMaior = l.area === areaMax;

                  return (
                    <div
                      key={l.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative flex flex-col gap-3"
                    >
                      <button
                        onClick={() => remove(l.id)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-600"
                        aria-label="Remover do comparador"
                      >
                        <IconClose className="w-4 h-4" />
                      </button>

                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                          Lote
                        </p>
                        <p className="text-xl font-mono font-bold text-slate-900">{l.codigo}</p>
                        {(isMaisBarato || isMaisCaro || isMaior) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {isMaisBarato && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-semibold rounded">
                                MENOR PREÇO
                              </span>
                            )}
                            {isMaisCaro && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-semibold rounded">
                                PREMIUM
                              </span>
                            )}
                            {isMaior && selecionados.length > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded">
                                MAIOR ÁREA
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <Linha label="Preço" valor={brl(l.preco)} destaque={isMaisBarato} />
                      <Linha
                        label="Área"
                        valor={`${l.area.toFixed(0)} m²`}
                        destaque={isMaior}
                      />
                      <Linha label="Quadra" valor={l.quadra} />
                      <Linha
                        label="Testada"
                        valor={l.testada ? `${l.testada} m` : '—'}
                      />
                      <Linha label="Fundo" valor={l.fundo ? `${l.fundo} m` : '—'} />
                      <Linha
                        label="Orientação"
                        valor={l.orientacaoSolar ?? '—'}
                      />

                      <div className="text-xs space-y-1 pt-2 border-t border-slate-200">
                        <Checklist label="Esquina" ok={l.esquina} />
                        <Checklist label="Frente a área verde" ok={l.fronteAreaVerde} />
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1">
                        R$/m²:{' '}
                        <span className="font-bold text-slate-700">
                          {brl(l.preco / l.area)}
                        </span>
                      </p>

                      <a
                        href={`?lote=${l.codigo}#lotes`}
                        className="mt-auto block text-center text-xs font-semibold py-2 rounded-lg transition text-white"
                        style={{ background: corPrimaria }}
                        onClick={() => setOpen(false)}
                      >
                        Ver no mapa →
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
              Dica: clique em qualquer lote no mapa e use o botão{' '}
              <span className="font-semibold text-slate-700">&ldquo;+ Comparar&rdquo;</span> para adicioná-lo aqui.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Linha({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-slate-500 text-xs">{label}</span>
      <span
        className={`font-semibold ${destaque ? 'text-emerald-700' : 'text-slate-900'}`}
      >
        {valor}
      </span>
    </div>
  );
}

function Checklist({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
          ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
        }`}
      >
        {ok ? '✓' : '×'}
      </span>
      <span className={ok ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
    </div>
  );
}
