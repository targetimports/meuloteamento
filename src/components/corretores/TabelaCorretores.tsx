'use client';

/**
 * Corretores com filtro em modal, ordenação por coluna e paginação.
 *
 * A tabela não tinha recorte nenhum: para saber quem vendeu mais, ou quem
 * ainda está ativo numa equipe grande, era ler linha por linha. A lista já
 * está na tela, então filtrar e ordenar não custam ida ao servidor.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CorretorLinha {
  id: string;
  nome: string;
  creci: string | null;
  email: string;
  telefone: string;
  telefoneLabel: string;
  comissaoPadrao: number;
  vendas: number;
  leads: number;
  ativo: boolean;
}

interface Filtros {
  busca: string;
  situacao: string;
  vendas: string;
}

const FILTRO_VAZIO: Filtros = { busca: '', situacao: '', vendas: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'nome' | 'comissaoPadrao' | 'vendas' | 'leads' | 'ativo';

const campoClass =
  'w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

function semAcento(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{rotulo}</label>
      {children}
    </div>
  );
}

export function TabelaCorretores({ corretores }: { corretores: CorretorLinha[] }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  // Ativos primeiro e em ordem alfabética, que é como a lista já vinha.
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'nome',
    asc: true,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    const digitos = filtros.busca.replace(/\D/g, '');
    return corretores.filter((c) => {
      if (termo) {
        const casaTexto =
          semAcento(c.nome).includes(termo) ||
          semAcento(c.email).includes(termo) ||
          semAcento(c.creci ?? '').includes(termo);
        const casaTelefone = digitos.length > 0 && c.telefone.includes(digitos);
        if (!casaTexto && !casaTelefone) return false;
      }
      if (filtros.situacao === 'ativos' && !c.ativo) return false;
      if (filtros.situacao === 'inativos' && c.ativo) return false;
      if (filtros.vendas === 'com' && c.vendas === 0) return false;
      if (filtros.vendas === 'sem' && c.vendas > 0) return false;
      return true;
    });
  }, [corretores, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR') * sinal;
      if (campo === 'ativo') return (Number(a.ativo) - Number(b.ativo)) * sinal;
      return (a[campo] - b[campo]) * sinal;
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
          className="inline-flex items-center gap-1 transition-colors hover:text-slate-700"
          title={`Ordenar por ${rotulo.toLowerCase()}`}
        >
          {rotulo}
          <span className={ativa ? 'text-slate-600' : 'invisible'} aria-hidden>
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
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
            className="text-xs text-slate-500 transition hover:text-slate-800"
          >
            Limpar
          </button>
        )}
      </div>

      {ordenados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">
            {corretores.length === 0
              ? 'Nenhum corretor cadastrado.'
              : 'Nenhum corretor atende aos filtros.'}
          </p>
          {corretores.length === 0 && (
            <Link
              href="/admin/corretores/novo"
              className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Cadastrar o primeiro
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Cabecalho campo="nome" rotulo="Nome" />
                  <th className="px-4 py-3 text-left font-semibold">Contato</th>
                  <Cabecalho campo="comissaoPadrao" rotulo="Comissão" alinhamento="text-right" />
                  <Cabecalho campo="vendas" rotulo="Vendas" alinhamento="text-right" />
                  <Cabecalho campo="leads" rotulo="Leads" alinhamento="text-right" />
                  <Cabecalho campo="ativo" rotulo="Status" />
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daPagina.map((c) => (
                  <tr
                    key={c.id}
                    className={`transition-colors hover:bg-slate-50 ${c.ativo ? '' : 'opacity-60'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.nome}</div>
                      {c.creci && <div className="text-xs text-slate-500">CRECI {c.creci}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{c.email}</div>
                      {c.telefoneLabel && (
                        <div className="text-xs text-slate-500">{c.telefoneLabel}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {c.comissaoPadrao.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">{c.vendas}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.leads}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          c.ativo
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                        }`}
                      >
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/corretores/${c.id}`}
                        className="text-sm font-medium text-primary-600 hover:opacity-80"
                      >
                        Abrir →
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
          <p className="text-xs text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {ordenados.length}
            {ordenados.length !== corretores.length && ` (${corretores.length} no total)`}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-500">
                {paginaAtual} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
            <DialogTitle>Filtrar corretores</DialogTitle>
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
                <Campo rotulo="Nome, e-mail, CRECI ou telefone">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                    autoFocus
                  />
                </Campo>
              </div>
              <Campo rotulo="Situação">
                <select
                  value={rascunho.situacao}
                  onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </Campo>
              <Campo rotulo="Vendas">
                <select
                  value={rascunho.vendas}
                  onChange={(e) => setRascunho({ ...rascunho, vendas: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  <option value="com">Com venda</option>
                  <option value="sem">Sem venda</option>
                </select>
              </Campo>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => setRascunho(FILTRO_VAZIO)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
