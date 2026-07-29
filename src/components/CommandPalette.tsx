'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchItem {
  href: string;
  title: string;
  subtitle?: string;
}

interface SearchGroup {
  label: string;
  items: SearchItem[];
}

/**
 * Comando global Cmd+K / Ctrl+K — busca clientes, lotes, vendas, leads.
 * Aparece como overlay modal, navegável com setas + enter.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Atalho global Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus quando abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setGroups([]);
      setActiveIdx(0);
    }
  }, [open]);

  // Busca debounced
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setGroups([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          signal: ac.signal,
        });
        const data = await r.json();
        setGroups(data.groups ?? []);
        setActiveIdx(0);
      } catch {
        // ignored
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const flat: SearchItem[] = groups.flatMap((g) => g.items);

  const go = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router]
  );

  const onKeyInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[activeIdx]);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition w-64"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <span>Buscar tudo...</span>
        <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">
          ⌘K
        </kbd>
      </button>
    );
  }

  let runningIdx = -1;
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyInput}
            placeholder="Buscar clientes, lotes, vendas, leads..."
            className="flex-1 outline-none text-base text-slate-900 placeholder:text-slate-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-500">
            esc
          </kbd>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto py-2">
          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              <p className="font-medium">Digite ao menos 2 caracteres.</p>
              <p className="text-xs mt-1">Busque por nome, CPF, telefone, código do lote, #venda...</p>
            </div>
          )}
          {query.length >= 2 && groups.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Nada encontrado para <span className="font-semibold">&ldquo;{query}&rdquo;</span>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label} className="mb-1">
              <p className="px-4 py-1 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                {g.label}
              </p>
              {g.items.map((item) => {
                runningIdx++;
                const active = runningIdx === activeIdx;
                return (
                  <button
                    key={item.href + item.title}
                    onClick={() => go(item)}
                    onMouseEnter={() => setActiveIdx(runningIdx)}
                    className={`w-full text-left px-4 py-2 flex flex-col gap-0.5 transition ${
                      active ? 'bg-primary-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${active ? 'text-primary-900' : 'text-slate-900'}`}>
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className="text-xs text-slate-500">{item.subtitle}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">↑↓</kbd> navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">↵</kbd> abrir
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono">esc</kbd> fechar
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}
