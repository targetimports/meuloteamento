'use client';

/**
 * Escolha de cliente por busca, para filtros.
 *
 * Diferente do CampoCliente da tela de venda: aqui não existe cadastrar, só
 * escolher entre quem já aparece na lista — e a escolha pode ser desfeita,
 * porque "nenhum cliente" é um estado válido de filtro, não um campo vazio a
 * ser preenchido.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface ClienteFiltro {
  id: string;
  nome: string;
  cpf: string;
}

function normalizar(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function ComboboxCliente({
  clientes,
  valorId,
  onEscolher,
  className,
}: {
  clientes: ClienteFiltro[];
  valorId: string;
  onEscolher: (id: string) => void;
  className?: string;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  const escolhido = clientes.find((c) => c.id === valorId) ?? null;

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    const digitos = busca.replace(/\D/g, '');
    if (!q) return clientes.slice(0, 40);
    return clientes
      .filter((c) => {
        if (normalizar(c.nome).includes(q)) return true;
        if (digitos.length >= 3) return c.cpf.replace(/\D/g, '').includes(digitos);
        return false;
      })
      .slice(0, 40);
  }, [clientes, busca]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  useEffect(() => setDestaque(0), [busca]);

  if (escolhido) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
        <span className="min-w-0 truncate text-sm text-slate-900">{escolhido.nome}</span>
        <button
          type="button"
          onClick={() => {
            onEscolher('');
            setBusca('');
          }}
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Limpar
        </button>
      </div>
    );
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
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAberto(true);
            setDestaque((i) => Math.min(i + 1, filtrados.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestaque((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            // O modal de filtro é um form: sem isto o Enter aplicaria o filtro
            // antes de a pessoa ter escolhido o cliente.
            e.preventDefault();
            const alvo = filtrados[destaque];
            if (alvo) {
              onEscolher(alvo.id);
              setAberto(false);
            }
          } else if (e.key === 'Escape') {
            setAberto(false);
          }
        }}
        placeholder="Nome ou CPF…"
        className={className}
      />

      {aberto && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {filtrados.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === destaque}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => {
                  onEscolher(c.id);
                  setAberto(false);
                }}
                className={`w-full px-3 py-2 text-left transition-colors ${
                  i === destaque ? 'bg-primary-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="block truncate text-sm text-slate-900">{c.nome}</span>
                <span className="block truncate text-xs text-slate-500">CPF {c.cpf}</span>
              </button>
            </li>
          ))}
          {filtrados.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-slate-500">Nenhum cliente encontrado.</li>
          )}
        </ul>
      )}
    </div>
  );
}
