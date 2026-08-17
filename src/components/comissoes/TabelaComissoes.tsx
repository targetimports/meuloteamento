'use client';

/**
 * Comissões com filtro em modal, ordenação por coluna e paginação.
 *
 * Os recortes ficavam espalhados: os cards de status eram links que
 * recarregavam a página e havia uma fileira de pastilhas com o nome de cada
 * corretor — que crescia junto com a equipe e empurrava a tabela para baixo.
 * Agora tudo mora no mesmo modal, e a lista já está na tela.
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
import { ComissaoActions } from '@/components/ComissaoActions';

export interface ComissaoLinha {
  id: string;
  corretorId: string;
  corretorNome: string;
  vendaId: string;
  vendaNumero: number;
  loteCodigo: string;
  loteTipo: string;
  clienteNome: string;
  numero: number;
  valor: number;
  valorPago: number | null;
  status: 'BLOQUEADA' | 'LIBERADA' | 'PAGA' | 'CANCELADA';
  pagaEmLabel: string | null;
  contaNome: string | null;
  /** Parcela do cliente que destrava esta comissão. */
  vinculo: string | null;
  vinculoStatus: string | null;
  vinculoPago: boolean;
}

interface ContaOption {
  id: string;
  nome: string;
  tipo: string;
}

const STATUS_BG: Record<string, string> = {
  BLOQUEADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  LIBERADA: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PAGA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CANCELADA: 'bg-slate-100 text-slate-400 ring-slate-500/20',
};

interface Filtros {
  status: string;
  corretorId: string;
  busca: string;
}

const FILTRO_VAZIO: Filtros = { status: '', corretorId: '', busca: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'corretorNome' | 'vendaNumero' | 'clienteNome' | 'valor' | 'status';

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

export function TabelaComissoes({
  comissoes,
  corretores,
  contas,
}: {
  comissoes: ComissaoLinha[];
  corretores: Array<{ id: string; nome: string }>;
  contas: ContaOption[];
}) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'status',
    asc: true,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    return comissoes.filter((c) => {
      if (filtros.status && c.status !== filtros.status) return false;
      if (filtros.corretorId && c.corretorId !== filtros.corretorId) return false;
      if (termo) {
        const alvo = semAcento(`#${c.vendaNumero} ${c.loteCodigo} ${c.clienteNome}`);
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [comissoes, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'valor' || campo === 'vendaNumero') return (a[campo] - b[campo]) * sinal;
      return String(a[campo]).localeCompare(String(b[campo]), 'pt-BR') * sinal;
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const somaVisivel = ordenados.reduce((s, c) => s + c.valor, 0);

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
      <th className={`${alinhamento} px-3 py-3 font-semibold`}>
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
          <>
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
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {ordenados.length} comissão(ões) · {formatBRL(somaVisivel)}
            </span>
          </>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {comissoes.length === 0
            ? 'Nenhuma comissão registrada.'
            : 'Nenhuma comissão atende aos filtros.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <Cabecalho campo="corretorNome" rotulo="Corretor" />
                  <Cabecalho campo="vendaNumero" rotulo="Venda / Lote" />
                  <Cabecalho campo="clienteNome" rotulo="Cliente" />
                  <th className="px-3 py-3 text-center font-semibold">Parc.</th>
                  <th className="px-3 py-3 text-left font-semibold">Vínculo</th>
                  <Cabecalho campo="valor" rotulo="Valor" alinhamento="text-right" />
                  <Cabecalho campo="status" rotulo="Status" />
                  <th className="px-3 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daPagina.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {c.corretorNome}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/vendas/${c.vendaId}`}
                        className="font-mono text-primary-600 hover:underline dark:text-primary-400"
                      >
                        #{c.vendaNumero}
                      </Link>
                      <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                        · {c.loteCodigo}
                      </span>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                        {c.loteTipo}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300">
                      {c.clienteNome}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-slate-700 dark:text-slate-300">
                      {c.numero}/4
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {c.vinculo ? (
                        <>
                          {c.vinculo}
                          <span
                            className={`block ${
                              c.vinculoPago ? 'text-emerald-600 dark:text-emerald-400' : ''
                            }`}
                          >
                            {c.vinculoStatus}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {formatBRL(c.valor)}
                      </span>
                      {c.valorPago !== null && c.valorPago !== c.valor && (
                        <span className="block text-xs text-slate-500">
                          pago {formatBRL(c.valorPago)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_BG[c.status]}`}
                      >
                        {c.status}
                      </span>
                      {c.pagaEmLabel && (
                        <span className="mt-0.5 block text-xs text-slate-500">{c.pagaEmLabel}</span>
                      )}
                      {c.contaNome && (
                        <span className="mt-0.5 block text-[10px] text-slate-400">
                          via {c.contaNome}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <ComissaoActions
                        comissaoId={c.id}
                        status={c.status}
                        valorSugerido={c.valor}
                        contas={contas}
                      />
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
            {ordenados.length !== comissoes.length && ` (${comissoes.length} no total)`}
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
            <DialogTitle>Filtrar comissões</DialogTitle>
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
              <Campo rotulo="Status">
                <select
                  value={rascunho.status}
                  onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {['BLOQUEADA', 'LIBERADA', 'PAGA', 'CANCELADA'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Corretor">
                <select
                  value={rascunho.corretorId}
                  onChange={(e) => setRascunho({ ...rascunho, corretorId: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <div className="sm:col-span-2">
                <Campo rotulo="Contrato, lote ou cliente">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                  />
                </Campo>
              </div>
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
