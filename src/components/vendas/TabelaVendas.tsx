'use client';

/**
 * Tabela de vendas com filtro em modal, ordenação por coluna e paginação.
 *
 * Substitui as pastilhas de status que recarregavam a página a cada clique e
 * só recortavam por um critério. Aqui os recortes convivem — status, cliente,
 * lote, corretor, faixa de valor e período — e a lista já está no cliente,
 * então filtrar e ordenar não custam ida ao servidor.
 */

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL } from '@/lib/format';
import { ComboboxCliente } from '@/components/vendas/ComboboxCliente';

export interface VendaLinha {
  id: string;
  numero: number;
  data: string;
  origem: string;
  loteCodigo: string;
  lotesExtras: number;
  lotesTitulo: string;
  loteamentoNome: string;
  clienteId: string;
  clienteNome: string;
  clienteCpf: string;
  valorTotal: number;
  valorEntrada: number;
  parcelasPagas: number;
  parcelasTotal: number;
  corretorNome: string | null;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  ATIVA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  INADIMPLENTE: 'bg-red-50 text-red-700 ring-red-600/20',
  QUITADA: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  CANCELADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  DISTRATADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

interface Filtros {
  status: string;
  /** Id, não texto: dois clientes podem se chamar "Maria Silva". */
  clienteId: string;
  lote: string;
  loteamento: string;
  corretor: string;
  valorMin: string;
  valorMax: string;
  de: string;
  ate: string;
}

const FILTRO_VAZIO: Filtros = {
  status: '',
  clienteId: '',
  lote: '',
  loteamento: '',
  corretor: '',
  valorMin: '',
  valorMax: '',
  de: '',
  ate: '',
};

function contarFiltros(f: Filtros): number {
  return Object.values(f).filter((v) => v !== '').length;
}

const num = (v: string): number | null => {
  const n = Number(String(v).replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

function semAcento(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const POR_PAGINA = 25;

type CampoOrdem = 'numero' | 'loteCodigo' | 'clienteNome' | 'valorTotal' | 'corretorNome' | 'status';

const campoClass =
  'w-full min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{rotulo}</label>
      {children}
    </div>
  );
}

function Cabecalho({
  campo,
  rotulo,
  ordem,
  aoOrdenar,
  alinhamento = 'text-left',
}: {
  campo: CampoOrdem;
  rotulo: string;
  ordem: { campo: CampoOrdem; asc: boolean };
  aoOrdenar: (c: CampoOrdem) => void;
  alinhamento?: string;
}) {
  const ativa = ordem.campo === campo;
  return (
    <th className={`${alinhamento} px-4 py-3 font-semibold`}>
      <button
        type="button"
        onClick={() => aoOrdenar(campo)}
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

export function TabelaVendas({
  vendas,
  statusDisponiveis,
}: {
  vendas: VendaLinha[];
  statusDisponiveis: string[];
}) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'numero',
    asc: false,
  });

  const ativos = contarFiltros(filtros);

  /**
   * Clientes que aparecem na tabela, sem repetir. Sai das próprias linhas em
   * vez de outra consulta: filtrar por alguém que não tem venda nenhuma não
   * mudaria a lista, então oferecer esse nome só faria perder o clique.
   */
  const clientesComVenda = useMemo(() => {
    const porId = new Map<string, { id: string; nome: string; cpf: string }>();
    for (const v of vendas) {
      if (!porId.has(v.clienteId)) {
        porId.set(v.clienteId, { id: v.clienteId, nome: v.clienteNome, cpf: v.clienteCpf });
      }
    }
    return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [vendas]);

  const visiveis = useMemo(() => {
    const f = filtros;
    const vMin = num(f.valorMin);
    const vMax = num(f.valorMax);
    const casa = (alvo: string, termo: string) =>
      !termo || semAcento(alvo).includes(semAcento(termo.trim()));

    return vendas.filter((v) => {
      if (f.status && v.status !== f.status) return false;
      if (f.clienteId && v.clienteId !== f.clienteId) return false;
      if (!casa(v.loteCodigo, f.lote)) return false;
      if (!casa(v.loteamentoNome, f.loteamento)) return false;
      if (f.corretor && !casa(v.corretorNome ?? '', f.corretor)) return false;
      if (vMin !== null && v.valorTotal < vMin) return false;
      if (vMax !== null && v.valorTotal > vMax) return false;
      // Datas comparam como texto ISO: o campo já entrega AAAA-MM-DD, e nesse
      // formato a ordem alfabética é a cronológica.
      if (f.de && v.data < f.de) return false;
      if (f.ate && v.data > f.ate) return false;
      return true;
    });
  }, [vendas, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'numero' || campo === 'valorTotal') {
        return (a[campo] - b[campo]) * sinal;
      }
      return String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'pt-BR', {
        numeric: true,
      }) * sinal;
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function ordenarPor(campo: CampoOrdem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {vendas.length === 0
            ? 'Nenhuma venda registrada ainda.'
            : 'Nenhuma venda atende aos filtros.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Cabecalho campo="numero" rotulo="Contrato" ordem={ordem} aoOrdenar={ordenarPor} />
                  <Cabecalho campo="loteCodigo" rotulo="Lote" ordem={ordem} aoOrdenar={ordenarPor} />
                  <Cabecalho
                    campo="clienteNome"
                    rotulo="Cliente"
                    ordem={ordem}
                    aoOrdenar={ordenarPor}
                  />
                  <Cabecalho campo="valorTotal" rotulo="Valor" ordem={ordem} aoOrdenar={ordenarPor} />
                  <th className="px-4 py-3 text-left font-semibold">Parcelas</th>
                  <Cabecalho
                    campo="corretorNome"
                    rotulo="Corretor"
                    ordem={ordem}
                    aoOrdenar={ordenarPor}
                  />
                  <Cabecalho campo="status" rotulo="Status" ordem={ordem} aoOrdenar={ordenarPor} />
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daPagina.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900">#{v.numero}</span>
                      {v.origem === 'CHECKOUT_ONLINE' && (
                        <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-sky-700">
                          Online
                        </span>
                      )}
                      {v.origem === 'IMPORTACAO' && (
                        <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wider text-slate-700">
                          Importada
                        </span>
                      )}
                      <span className="block text-xs text-slate-500">
                        {new Date(v.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-900">{v.loteCodigo}</span>
                      {v.lotesExtras > 0 && (
                        <span
                          className="ml-1.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-700"
                          title={v.lotesTitulo}
                        >
                          +{v.lotesExtras}
                        </span>
                      )}
                      <span className="block text-xs text-slate-500">{v.loteamentoNome}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-900">{v.clienteNome}</span>
                      <span className="block text-xs text-slate-500">CPF {v.clienteCpf}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="tabular-nums text-slate-900">{formatBRL(v.valorTotal)}</span>
                      {v.valorEntrada > 0 && (
                        <span className="block text-xs text-slate-500">
                          + {formatBRL(v.valorEntrada)} entrada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">
                        {v.parcelasPagas}/{v.parcelasTotal}
                      </span>
                      <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className="block h-full bg-emerald-500"
                          style={{
                            width:
                              v.parcelasTotal > 0
                                ? `${(v.parcelasPagas / v.parcelasTotal) * 100}%`
                                : '0%',
                          }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {v.corretorNome ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          STATUS_STYLES[v.status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/vendas/${v.id}`}
                        className="font-medium text-primary-600 hover:opacity-80"
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
          <p className="text-xs text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length} de{' '}
            {ordenados.length}
            {ordenados.length !== vendas.length && ` (${vendas.length} no total)`}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filtrar vendas</DialogTitle>
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
                  {statusDisponiveis.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Cliente">
                <ComboboxCliente
                  clientes={clientesComVenda}
                  valorId={rascunho.clienteId}
                  onEscolher={(id) => setRascunho({ ...rascunho, clienteId: id })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Lote">
                <input
                  value={rascunho.lote}
                  onChange={(e) => setRascunho({ ...rascunho, lote: e.target.value })}
                  placeholder="L077"
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Loteamento">
                <input
                  value={rascunho.loteamento}
                  onChange={(e) => setRascunho({ ...rascunho, loteamento: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Corretor">
                <input
                  value={rascunho.corretor}
                  onChange={(e) => setRascunho({ ...rascunho, corretor: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Valor (R$)">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={rascunho.valorMin}
                    onChange={(e) => setRascunho({ ...rascunho, valorMin: e.target.value })}
                    placeholder="mínimo"
                    className={campoClass}
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="number"
                    value={rascunho.valorMax}
                    onChange={(e) => setRascunho({ ...rascunho, valorMax: e.target.value })}
                    placeholder="máximo"
                    className={campoClass}
                  />
                </div>
              </Campo>
              <Campo rotulo="Contrato de">
                <input
                  type="date"
                  value={rascunho.de}
                  onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Contrato até">
                <input
                  type="date"
                  value={rascunho.ate}
                  onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })}
                  className={campoClass}
                />
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
