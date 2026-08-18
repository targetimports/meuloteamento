'use client';

/**
 * Respostas de um formulário, com filtro em modal e paginação.
 *
 * As pastilhas de status recarregavam a página a cada clique e recortavam por
 * um critério só. Quem procurava uma pessoa pelo nome, ou queria ver só quem
 * mandou documento, não tinha por onde — e a lista parava em 200 sem avisar.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface RespostaLinha {
  id: string;
  /** AAAA-MM-DD para filtrar e ordenar. */
  data: string;
  dataLabel: string;
  vista: boolean;
  nome: string | null;
  cpfCnpj: string | null;
  email: string | null;
  telefone: string | null;
  loteCodigo: string | null;
  arquivos: number;
  status: string;
}

const STATUS_BG: Record<string, string> = {
  NOVA: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  EM_ANALISE: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  PROCESSADA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ARQUIVADA: 'bg-slate-100 text-slate-500 ring-slate-500/20',
};

const STATUS = ['NOVA', 'EM_ANALISE', 'PROCESSADA', 'ARQUIVADA'];

interface Filtros {
  busca: string;
  status: string;
  anexos: string;
  de: string;
  ate: string;
}

const FILTRO_VAZIO: Filtros = { busca: '', status: '', anexos: '', de: '', ate: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'data' | 'nome' | 'loteCodigo' | 'arquivos' | 'status';

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

export function TabelaRespostas({ respostas }: { respostas: RespostaLinha[] }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'data',
    asc: false,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    const digitos = filtros.busca.replace(/\D/g, '');
    return respostas.filter((r) => {
      if (termo) {
        const texto = semAcento(`${r.nome ?? ''} ${r.email ?? ''} ${r.loteCodigo ?? ''}`);
        const numero =
          digitos.length > 0 &&
          ((r.cpfCnpj ?? '').includes(digitos) || (r.telefone ?? '').replace(/\D/g, '').includes(digitos));
        if (!texto.includes(termo) && !numero) return false;
      }
      if (filtros.status && r.status !== filtros.status) return false;
      if (filtros.anexos === 'com' && r.arquivos === 0) return false;
      if (filtros.anexos === 'sem' && r.arquivos > 0) return false;
      if (filtros.de && r.data < filtros.de) return false;
      if (filtros.ate && r.data > filtros.ate) return false;
      return true;
    });
  }, [respostas, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'arquivos') return (a.arquivos - b.arquivos) * sinal;
      return String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'pt-BR') * sinal;
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {respostas.length === 0
              ? 'Nenhuma resposta ainda.'
              : 'Nenhuma resposta atende aos filtros.'}
          </p>
          {respostas.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Compartilhe o link público acima para receber respostas.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <Cabecalho campo="data" rotulo="Recebido em" />
                  <Cabecalho campo="nome" rotulo="Nome" />
                  <th className="px-4 py-3 text-left font-semibold">CPF / CNPJ</th>
                  <th className="px-4 py-3 text-left font-semibold">Contato</th>
                  <Cabecalho campo="loteCodigo" rotulo="Lote" />
                  <Cabecalho campo="arquivos" rotulo="Anexos" alinhamento="text-right" />
                  <Cabecalho campo="status" rotulo="Status" />
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daPagina.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        {/* O ponto marca o que ninguém abriu ainda. Antes a linha
                            inteira ficava em negrito, o que competia com o nome. */}
                        {!r.vista && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                            title="Ainda não vista"
                          />
                        )}
                        {r.dataLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {r.nome ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {r.cpfCnpj ?? <span className="font-sans text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.email && <span className="block text-slate-700 dark:text-slate-300">{r.email}</span>}
                      {r.telefone && (
                        <span className="block text-slate-500 dark:text-slate-400">{r.telefone}</span>
                      )}
                      {!r.email && !r.telefone && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {r.loteCodigo ?? <span className="font-sans text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={r.arquivos > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
                        {r.arquivos}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          STATUS_BG[r.status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
                        }`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/vendas/novo?fromForm=${r.id}`}
                          title="Abre o lançamento de venda já preenchido com estes dados"
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Criar venda
                        </Link>
                        <Link
                          href={`/admin/formularios/respostas/${r.id}`}
                          className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >
                          Detalhes →
                        </Link>
                      </div>
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
            {ordenados.length !== respostas.length && ` (${respostas.length} no total)`}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
            <DialogTitle>Filtrar respostas</DialogTitle>
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
                <Campo rotulo="Nome, e-mail, CPF, telefone ou lote">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                    autoFocus
                  />
                </Campo>
              </div>
              <Campo rotulo="Status">
                <select
                  value={rascunho.status}
                  onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Anexos">
                <select
                  value={rascunho.anexos}
                  onChange={(e) => setRascunho({ ...rascunho, anexos: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  <option value="com">Com anexo</option>
                  <option value="sem">Sem anexo</option>
                </select>
              </Campo>
              <Campo rotulo="Recebida de">
                <input
                  type="date"
                  value={rascunho.de}
                  onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Recebida até">
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
