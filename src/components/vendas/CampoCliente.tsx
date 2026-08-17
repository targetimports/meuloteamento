'use client';

/**
 * Comprador da venda: busca entre os cadastrados ou cadastra na hora.
 *
 * Antes eram dois botões — "novo cliente" e "cliente existente" — e o
 * formulário mudava de cara conforme a escolha. Só que quem lança a venda
 * raramente sabe de antemão se aquele comprador já está no sistema: o caminho
 * natural é procurar, e só cadastrar quando não achar. É o que esta tela faz,
 * com o cadastro no fim da própria lista de resultados.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { criarClienteRapido } from '@/app/admin/(dashboard)/vendas/novo/actions';

export interface ClienteOpcao {
  id: string;
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone: string;
}

function normalizar(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function formatarCpf(v: string): string {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return v;
}

export function CampoCliente({
  clientes,
  inicialId,
  inputClass,
  prefill,
}: {
  clientes: ClienteOpcao[];
  inicialId?: string;
  inputClass: string;
  /**
   * Dados que vieram de uma resposta de formulário. Entram como valor inicial
   * do cadastro — quem chega por esse caminho já digitou tudo uma vez, e pedir
   * de novo seria o pior jeito de aproveitar um lead que se identificou.
   */
  prefill?: { nome?: string; cpfCnpj?: string; telefone?: string; email?: string };
}) {
  const [lista, setLista] = useState(clientes);
  const [escolhido, setEscolhido] = useState<ClienteOpcao | null>(
    () => clientes.find((c) => c.id === inicialId) ?? null
  );

  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  const [cadastrando, setCadastrando] = useState(false);
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    const digitos = busca.replace(/\D/g, '');
    if (!q) return lista.slice(0, 30);
    return lista
      .filter((c) => {
        if (normalizar(`${c.nome} ${c.email}`).includes(q)) return true;
        // Documento e telefone comparam só por dígitos: a máscara de quem
        // digita quase nunca é a mesma do que está gravado.
        if (digitos.length >= 3) {
          return (
            c.cpfCnpj.replace(/\D/g, '').includes(digitos) ||
            c.telefone.replace(/\D/g, '').includes(digitos)
          );
        }
        return false;
      })
      .slice(0, 30);
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

  function escolher(c: ClienteOpcao) {
    setEscolhido(c);
    setBusca('');
    setAberto(false);
  }

  function salvarNovo(formData: FormData) {
    setErroCadastro(null);
    iniciar(async () => {
      const r = await criarClienteRapido(formData);
      if (!r.ok || !r.cliente) {
        setErroCadastro(r.erro ?? 'Não foi possível cadastrar.');
        return;
      }
      // Entra na lista local e já fica escolhido: recarregar a página só para
      // ver o cliente novo perderia tudo que já foi preenchido na venda.
      setLista((l) => [r.cliente!, ...l.filter((c) => c.id !== r.cliente!.id)]);
      escolher(r.cliente);
      setCadastrando(false);
    });
  }

  return (
    <div className="md:col-span-2">
      {/* O que a action da venda lê. Com o cliente sempre criado antes, a venda
          recebe só o id — o caminho de "cliente novo pelo formulário da venda"
          deixou de ser usado por esta tela. */}
      <input type="hidden" name="clienteId" value={escolhido?.id ?? ''} />

      <label className="block text-sm font-medium text-slate-700 mb-1">
        Cliente comprador <span className="text-red-500">*</span>
      </label>

      {escolhido ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{escolhido.nome}</p>
            <p className="truncate text-xs text-slate-500">
              {formatarCpf(escolhido.cpfCnpj)} · {escolhido.telefone}
              {escolhido.email && !escolhido.email.endsWith('@semcontato.local')
                ? ` · ${escolhido.email}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEscolhido(null);
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
                // Sem isto o Enter enviaria o formulário da venda.
                e.preventDefault();
                const alvo = filtrados[destaque];
                if (alvo) escolher(alvo);
                else setCadastrando(true);
              } else if (e.key === 'Escape') {
                setAberto(false);
              }
            }}
            placeholder="Buscar por nome, CPF, telefone ou e-mail…"
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
                    onClick={() => escolher(c)}
                    className={`w-full px-3 py-2 text-left transition-colors ${
                      i === destaque ? 'bg-primary-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {c.nome}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {formatarCpf(c.cpfCnpj)} · {c.telefone}
                    </span>
                  </button>
                </li>
              ))}

              {filtrados.length === 0 && (
                <li className="px-3 py-2.5 text-sm text-slate-500">
                  Nenhum cliente encontrado.
                </li>
              )}

              {/* Fixo no fim da lista: é o caminho de quem procurou e não achou. */}
              <li className="sticky bottom-0 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setCadastrando(true)}
                  className="w-full px-3 py-2.5 text-left text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
                >
                  + Cadastrar cliente
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      {/* -------------------- Cadastro -------------------- */}
      <Dialog open={cadastrando} onOpenChange={(a) => !a && setCadastrando(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar cliente</DialogTitle>
          </DialogHeader>

          <form action={salvarNovo} className="space-y-3">
            {erroCadastro && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {erroCadastro}
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nome completo *
              </label>
              <input
                name="nome"
                required
                minLength={2}
                defaultValue={prefill?.nome ?? ''}
                className={inputClass}
                placeholder="João da Silva"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">CPF / CNPJ *</label>
                <input
                  name="cpfCnpj"
                  required
                  defaultValue={prefill?.cpfCnpj ?? ''}
                  className={inputClass}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Telefone *</label>
                <input
                  name="telefone"
                  required
                  defaultValue={prefill?.telefone ?? ''}
                  className={inputClass}
                  placeholder="(75) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">E-mail</label>
              <input
                name="email"
                type="email"
                defaultValue={prefill?.email ?? ''}
                className={inputClass}
                placeholder="joao@email.com (opcional)"
              />
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={salvando}
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

            <p className="text-[11px] text-slate-400">
              CPF já cadastrado reaproveita o cliente existente e atualiza nome e telefone.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
