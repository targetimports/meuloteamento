'use client';

/**
 * Corretor da venda: busca entre os cadastrados ou cadastra na hora.
 *
 * Mesmo desenho do campo de comprador, pelo mesmo motivo — e com um agravante
 * que existia antes: a seção inteira só aparecia quando já havia corretor
 * cadastrado. Quem fosse lançar a primeira venda com corretor precisava sair da
 * tela, cadastrar em outro lugar e voltar, perdendo o que já tinha preenchido.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { criarCorretorRapido } from '@/app/admin/(dashboard)/vendas/novo/actions';

export interface CorretorOpcao {
  id: string;
  nome: string;
  comissaoPadrao: number;
}

function normalizar(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function CampoCorretor({
  corretores,
  valorId,
  onEscolher,
  inputClass,
  loteamentoId,
}: {
  corretores: CorretorOpcao[];
  valorId: string;
  onEscolher: (id: string) => void;
  inputClass: string;
  /** Define a loteadora do corretor novo. Vazio enquanto nenhum lote foi escolhido. */
  loteamentoId?: string;
}) {
  const [lista, setLista] = useState(corretores);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const escolhido = lista.find((c) => c.id === valorId) ?? null;

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return lista;
    return lista.filter((c) => normalizar(c.nome).includes(q));
  }, [lista, busca]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  useEffect(() => setDestaque(0), [busca]);

  function salvarNovo(formData: FormData) {
    setErro(null);
    iniciar(async () => {
      const r = await criarCorretorRapido(formData);
      if (!r.ok || !r.corretor) {
        setErro(r.erro ?? 'Não foi possível cadastrar.');
        return;
      }
      setLista((l) => [r.corretor!, ...l]);
      onEscolher(r.corretor.id);
      setCadastrando(false);
      setAberto(false);
    });
  }

  return (
    <div>
      <input type="hidden" name="corretorId" value={valorId} />

      {escolhido ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{escolhido.nome}</p>
            <p className="text-xs text-slate-500">
              {escolhido.comissaoPadrao.toFixed(1)}% padrão para lotes comerciais
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onEscolher('');
              setAberto(true);
            }}
            className="text-xs font-medium text-primary-600 hover:underline"
          >
            Trocar
          </button>
        </div>
      ) : (
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
                e.preventDefault();
                const alvo = filtrados[destaque];
                if (alvo) {
                  onEscolher(alvo.id);
                  setBusca('');
                  setAberto(false);
                }
              } else if (e.key === 'Escape') {
                setAberto(false);
              }
            }}
            placeholder="Buscar corretor ou deixar em branco…"
            className={inputClass}
          />

          {aberto && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-lg"
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
                      setBusca('');
                      setAberto(false);
                    }}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition-colors ${
                      i === destaque ? 'bg-primary-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {c.nome}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {c.comissaoPadrao.toFixed(1)}%
                    </span>
                  </button>
                </li>
              ))}

              {filtrados.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-slate-500">
                  Nenhum corretor encontrado.
                </li>
              )}

              <li className="sticky bottom-0 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setCadastrando(true)}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
                >
                  + Cadastrar corretor
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      <Dialog open={cadastrando} onOpenChange={(a) => !a && setCadastrando(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar corretor</DialogTitle>
          </DialogHeader>

          <form action={salvarNovo} className="space-y-3">
            <input type="hidden" name="loteamentoId" value={loteamentoId ?? ''} />

            {!loteamentoId && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Escolha o lote primeiro — é ele que define a qual loteadora o corretor
                pertence.
              </p>
            )}
            {erro && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {erro}
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nome *</label>
              <input name="nome" required minLength={2} className={inputClass} placeholder="Maria Souza" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">E-mail *</label>
                <input name="email" type="email" required className={inputClass} placeholder="maria@imobiliaria.com" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Telefone</label>
                <input name="telefone" className={inputClass} placeholder="(75) 99999-9999" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Comissão padrão (%)
              </label>
              <input
                name="comissaoPadrao"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue="0"
                className={`${inputClass} max-w-[140px]`}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Vale para lotes comerciais. Residenciais usam a comissão fixa da loteadora.
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={salvando || !loteamentoId}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {salvando ? 'Cadastrando…' : 'Cadastrar e usar'}
              </button>
              <button
                type="button"
                onClick={() => setCadastrando(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
