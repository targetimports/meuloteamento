'use client';

/**
 * Clientes com filtro em modal, ordenação por coluna e paginação.
 *
 * A busca era um campo que recarregava a página a cada Enter e recortava por
 * um critério só — texto. Quem queria "quem comprou mais de uma vez" ou "quem
 * entrou este mês" não tinha por onde. A lista já vem inteira para a tela,
 * então filtrar e ordenar não custam ida ao servidor.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL } from '@/lib/format';

export interface ClienteLinha {
  id: string;
  nome: string;
  email: string;
  cpfCnpj: string;
  cpfLabel: string;
  telefone: string;
  telefoneLabel: string;
  vendas: number;
  reservas: number;
  totalComprado: number;
  /** AAAA-MM-DD para filtrar e ordenar. */
  cadastro: string;
  cadastroLabel: string;
}

interface Filtros {
  busca: string;
  situacao: string;
  de: string;
  ate: string;
}

const FILTRO_VAZIO: Filtros = { busca: '', situacao: '', de: '', ate: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'nome' | 'vendas' | 'totalComprado' | 'cadastro';

const campoClass =
  'w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function semAcento(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

export function TabelaClientes({ clientes }: { clientes: ClienteLinha[] }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'cadastro',
    asc: false,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    const digitos = filtros.busca.replace(/\D/g, '');
    return clientes.filter((c) => {
      if (termo) {
        // Nome e e-mail casam por texto; CPF e telefone, por dígito — quem
        // digita "75 99826" não deve depender de acertar a pontuação.
        const casaTexto =
          semAcento(c.nome).includes(termo) || semAcento(c.email).includes(termo);
        const casaNumero =
          digitos.length > 0 && (c.cpfCnpj.includes(digitos) || c.telefone.includes(digitos));
        if (!casaTexto && !casaNumero) return false;
      }
      if (filtros.situacao === 'compradores' && c.vendas === 0) return false;
      if (filtros.situacao === 'interessados' && c.vendas > 0) return false;
      if (filtros.situacao === 'recorrentes' && c.vendas < 2) return false;
      if (filtros.de && c.cadastro < filtros.de) return false;
      if (filtros.ate && c.cadastro > filtros.ate) return false;
      return true;
    });
  }, [clientes, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'vendas' || campo === 'totalComprado') return (a[campo] - b[campo]) * sinal;
      if (campo === 'cadastro') return a.cadastro.localeCompare(b.cadastro) * sinal;
      return a.nome.localeCompare(b.nome, 'pt-BR') * sinal;
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function ordenarPor(campo: CampoOrdem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
  }

  function Cabecalho({
    campo,
    rotulo,
    alinhamento = 'text-left',
  }: {
    campo: CampoOrdem;
    rotulo: string;
    alinhamento?: string;
  }) {
    const ativa = ordem.campo === campo;
    return (
      <th className={`${alinhamento} px-4 py-3 font-semibold`}>
        <button
          type="button"
          onClick={() => ordenarPor(campo)}
          className="inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          title={`Ordenar por ${rotulo.toLowerCase()}`}
        >
          {rotulo}
          <span className={ativa ? 'text-slate-600 dark:text-slate-300' : 'invisible'} aria-hidden>
            {ativa && !ordem.asc ? '▾' : '▴'}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRascunho(filtros);
            setFiltrando(true);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Filtrar
          {ativos > 0 && (
            <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-semibold text-white">
              {ativos}
            </span>
          )}
        </button>
        {ativos > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiltros(FILTRO_VAZIO);
              setPagina(1);
            }}
            className="text-xs text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
          >
            Limpar
          </button>
        )}
      </div>

      {ordenados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {clientes.length === 0
              ? 'Ainda não há clientes cadastrados.'
              : 'Nenhum cliente atende aos filtros.'}
          </p>
          {clientes.length === 0 && (
            <>
              <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500 dark:text-slate-400">
                Clientes aparecem sozinhos quando alguém preenche o formulário público, reserva um
                lote ou você lança uma venda. Também dá para cadastrar na mão.
              </p>
              <Link
                href="/admin/clientes/novo"
                className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Cadastrar primeiro cliente
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <Cabecalho campo="nome" rotulo="Cliente" />
                  <th className="px-4 py-3 text-left font-semibold">CPF / Contato</th>
                  <Cabecalho campo="vendas" rotulo="Vendas" alinhamento="text-right" />
                  <Cabecalho
                    campo="totalComprado"
                    rotulo="Total comprado"
                    alinhamento="text-right"
                  />
                  <Cabecalho campo="cadastro" rotulo="Cadastro" />
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daPagina.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{c.nome}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {c.cpfLabel}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {c.telefoneLabel}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {c.vendas}
                      </div>
                      {c.reservas > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {c.reservas} reserva(s)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {c.totalComprado > 0 ? formatBRL(c.totalComprado) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {c.cadastroLabel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="text-sm font-medium text-primary-600 hover:opacity-80 dark:text-primary-400"
                      >
                        Detalhes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {ordenados.length}
            {ordenados.length !== clientes.length && ` (${clientes.length} no total)`}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">
                {paginaAtual} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog open={filtrando} onOpenChange={setFiltrando}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Filtrar clientes</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros(rascunho);
              setPagina(1);
              setFiltrando(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo rotulo="Nome, e-mail, CPF ou telefone">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                    autoFocus
                  />
                </Campo>
              </div>
              <div className="sm:col-span-2">
                <Campo rotulo="Situação">
                  <select
                    value={rascunho.situacao}
                    onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
                    className={campoClass}
                  >
                    <option value="">Todos</option>
                    <option value="compradores">Com venda</option>
                    <option value="interessados">Sem venda</option>
                    <option value="recorrentes">Com mais de uma venda</option>
                  </select>
                </Campo>
              </div>
              <Campo rotulo="Cadastro de">
                <input
                  type="date"
                  value={rascunho.de}
                  onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Cadastro até">
                <input
                  type="date"
                  value={rascunho.ate}
                  onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })}
                  className={campoClass}
                />
              </Campo>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => setRascunho(FILTRO_VAZIO)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Limpar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
