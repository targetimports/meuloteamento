'use client';

/**
 * Busca de lote com filtro, no lugar do select nativo.
 *
 * Com 221 lotes, o select virava uma lista rolável sem busca: achar o L142
 * exigia descer a lista inteira, e o navegador só ajuda quem digita o começo do
 * texto — que aqui é o nome do loteamento, igual em todas as opções.
 *
 * Aceita código, quadra, loteamento, área, preço e situação. Digitar "175" acha
 * pela metragem; "L01" acha pelo código; "disponivel" recorta pela situação.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { formatBRL } from '@/lib/format';

export interface LoteOpcao {
  id: string;
  codigo: string;
  preco: number;
  area: number;
  status: string;
  loteamentoNome: string;
}

/** Compara ignorando acento e caixa. */
function normalizar(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function ComboboxLote({
  lotes,
  onEscolher,
  placeholder,
  className,
}: {
  lotes: LoteOpcao[];
  onEscolher: (id: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return lotes.slice(0, 50);
    const termos = q.split(/\s+/);
    return lotes
      .filter((l) => {
        const alvo = normalizar(
          `${l.loteamentoNome} ${l.codigo} ${l.area} ${l.preco} ${l.status}`
        );
        return termos.every((t) => alvo.includes(t));
      })
      .slice(0, 50);
  }, [lotes, busca]);

  // Fecha ao clicar fora. Sem isto a lista fica aberta por cima do resto do
  // formulário depois que a pessoa desiste e vai preencher outro campo.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  useEffect(() => setDestaque(0), [busca]);

  function escolher(l: LoteOpcao) {
    onEscolher(l.id);
    setBusca('');
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setDestaque((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Sem o preventDefault o Enter enviaria o formulário da venda inteiro.
      e.preventDefault();
      const alvo = filtrados[destaque];
      if (alvo) escolher(alvo);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  }

  return (
    <div ref={raiz} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        placeholder={placeholder}
        className={className}
      />

      {aberto && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filtrados.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-slate-500">Nenhum lote encontrado.</li>
          )}
          {filtrados.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === destaque}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => escolher(l)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  i === destaque ? 'bg-primary-50 text-primary-900' : 'hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-slate-900">{l.codigo}</span>
                  <span className="text-slate-500"> · {l.loteamentoNome}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {l.area.toFixed(0)} m² · {formatBRL(l.preco)} · {l.status}
                </span>
              </button>
            </li>
          ))}
          {filtrados.length === 50 && (
            <li className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
              Mostrando os 50 primeiros — refine a busca.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
