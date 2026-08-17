'use client';

/**
 * Vendas do corretor e a comissão de cada uma.
 *
 * Antes, para saber o que um corretor tinha a receber era preciso abrir venda
 * por venda — e ajustar o valor de uma comissão só dava pela tela da venda,
 * que é onde ninguém vai quando a conversa é sobre o acerto do corretor.
 *
 * O ajuste segue a mesma regra da tela da venda: só as parcelas BLOQUEADAS
 * mudam. PAGA já saiu do caixa e LIBERADA é compromisso — o cliente pagou a
 * parcela que a destravou.
 */

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL } from '@/lib/format';
import { AjustarComissaoButton } from '@/components/AjustarComissaoButton';

export interface ComissaoParcelaLinha {
  id: string;
  numero: number;
  valor: number;
  status: string;
  liberadaEmLabel: string | null;
  pagaEmLabel: string | null;
  /** Falso quando a parcela ficou com o corretor anterior numa troca. */
  desteCorretor: boolean;
  corretorNome: string;
}

export interface VendaComissaoLinha {
  id: string;
  numero: number;
  dataLabel: string;
  data: string;
  loteCodigo: string;
  loteamentoNome: string;
  clienteNome: string;
  valorVenda: number;
  statusVenda: string;
  /** Comissão desta venda que é deste corretor. */
  comissaoDoCorretor: number;
  /** Total da venda, incluindo o que ficou com outro corretor. */
  comissaoTotal: number;
  /** Piso do ajuste: o que já foi pago ou liberado, de qualquer corretor. */
  comprometido: number;
  bloqueadas: number;
  liberadas: number;
  pagas: number;
  podeAjustar: boolean;
  parcelas: ComissaoParcelaLinha[];
}

const STATUS_COMISSAO: Record<string, string> = {
  BLOQUEADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  LIBERADA: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PAGA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CANCELADA: 'bg-slate-100 text-slate-400 ring-slate-500/20',
};

const STATUS_VENDA: Record<string, string> = {
  ATIVA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  INADIMPLENTE: 'bg-red-50 text-red-700 ring-red-600/20',
  QUITADA: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  CANCELADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  DISTRATADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

interface Filtros {
  busca: string;
  statusVenda: string;
  situacaoComissao: string;
}

const FILTRO_VAZIO: Filtros = { busca: '', statusVenda: '', situacaoComissao: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'numero' | 'data' | 'valorVenda' | 'comissaoDoCorretor' | 'statusVenda';

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

export function ComissoesDoCorretor({ vendas }: { vendas: VendaComissaoLinha[] }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'data',
    asc: false,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    return vendas.filter((v) => {
      if (termo) {
        const alvo = semAcento(`${v.loteCodigo} ${v.clienteNome} ${v.loteamentoNome} #${v.numero}`);
        if (!alvo.includes(termo)) return false;
      }
      if (filtros.statusVenda && v.statusVenda !== filtros.statusVenda) return false;
      if (filtros.situacaoComissao === 'bloqueadas' && v.bloqueadas === 0) return false;
      if (filtros.situacaoComissao === 'liberadas' && v.liberadas === 0) return false;
      if (filtros.situacaoComissao === 'quitadas' && (v.bloqueadas > 0 || v.liberadas > 0)) {
        return false;
      }
      return true;
    });
  }, [vendas, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'numero' || campo === 'valorVenda' || campo === 'comissaoDoCorretor') {
        return (a[campo] - b[campo]) * sinal;
      }
      return String(a[campo]).localeCompare(String(b[campo]), 'pt-BR') * sinal;
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  // Somas do que está à vista: é a pergunta que se faz na frente do corretor.
  const resumo = useMemo(() => {
    let aReceber = 0;
    let recebido = 0;
    let futuro = 0;
    for (const v of ordenados) {
      for (const p of v.parcelas) {
        if (!p.desteCorretor) continue;
        if (p.status === 'PAGA') recebido += p.valor;
        else if (p.status === 'LIBERADA') aReceber += p.valor;
        else if (p.status === 'BLOQUEADA') futuro += p.valor;
      }
    }
    return { aReceber, recebido, futuro };
  }, [ordenados]);

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

  if (vendas.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Vendas e comissões</h2>
        <p className="mt-2 text-sm text-slate-500">
          Este corretor ainda não tem venda vinculada.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Vendas e comissões</h2>
          <p className="text-sm text-slate-500">
            {formatBRL(resumo.aReceber)} a repassar · {formatBRL(resumo.recebido)} já pago ·{' '}
            {formatBRL(resumo.futuro)} preso a parcela do cliente
          </p>
        </div>
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
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Nenhuma venda atende aos filtros.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Cabecalho campo="numero" rotulo="Contrato" />
                  <th className="px-4 py-3 text-left font-semibold">Lote / Cliente</th>
                  <Cabecalho campo="valorVenda" rotulo="Venda" alinhamento="text-right" />
                  <Cabecalho
                    campo="comissaoDoCorretor"
                    rotulo="Comissão"
                    alinhamento="text-right"
                  />
                  <th className="px-4 py-3 text-left font-semibold">Parcelas</th>
                  <Cabecalho campo="statusVenda" rotulo="Venda" />
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daPagina.map((v) => (
                  // Fragment com chave: a linha de detalhe é irmã da linha da
                  // venda, e `<tr>` não pode viver dentro de outro `<tr>`.
                  <Fragment key={v.id}>
                    <tr className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-900">#{v.numero}</span>
                        <span className="block text-xs text-slate-500">{v.dataLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-900">{v.loteCodigo}</span>
                        <span className="block text-xs text-slate-500">{v.clienteNome}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatBRL(v.valorVenda)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium tabular-nums text-slate-900">
                          {formatBRL(v.comissaoDoCorretor)}
                        </span>
                        {v.comissaoTotal !== v.comissaoDoCorretor && (
                          <span
                            className="block text-xs text-slate-500"
                            title="A diferença ficou com o corretor anterior desta venda."
                          >
                            de {formatBRL(v.comissaoTotal)} na venda
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setAberta(aberta === v.id ? null : v.id)}
                          className="text-xs text-slate-600 transition hover:text-slate-900"
                        >
                          {v.pagas} paga(s) · {v.liberadas} liberada(s) · {v.bloqueadas}{' '}
                          bloqueada(s)
                          <span className="ml-1 text-slate-400" aria-hidden>
                            {aberta === v.id ? '▾' : '▸'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                            STATUS_VENDA[v.statusVenda] ??
                            'bg-slate-100 text-slate-600 ring-slate-500/20'
                          }`}
                        >
                          {v.statusVenda}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-3">
                          {v.podeAjustar && (
                            <AjustarComissaoButton
                              vendaId={v.id}
                              valorAtual={v.comissaoTotal}
                              comprometido={v.comprometido}
                              bloqueadas={v.bloqueadas}
                            />
                          )}
                          <Link
                            href={`/admin/vendas/${v.id}`}
                            className="text-sm font-medium text-primary-600 hover:opacity-80"
                          >
                            Abrir →
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {aberta === v.id && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50 px-4 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="py-1 text-left font-medium">Parcela</th>
                                <th className="py-1 text-right font-medium">Valor</th>
                                <th className="py-1 text-left font-medium">Status</th>
                                <th className="py-1 text-left font-medium">Liberada</th>
                                <th className="py-1 text-left font-medium">Paga</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.parcelas.map((p) => (
                                <tr key={p.id} className="border-t border-slate-200">
                                  <td className="py-1.5 font-mono text-slate-700">
                                    {p.numero}
                                    {!p.desteCorretor && (
                                      <span
                                        className="ml-1.5 text-[10px] text-slate-500"
                                        title="Ficou com quem vendeu antes da troca de corretor"
                                      >
                                        ({p.corretorNome})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums text-slate-700">
                                    {formatBRL(p.valor)}
                                  </td>
                                  <td className="py-1.5">
                                    <span
                                      className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${
                                        STATUS_COMISSAO[p.status] ??
                                        'bg-slate-100 text-slate-600 ring-slate-500/20'
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-slate-500">
                                    {p.liberadaEmLabel ?? '—'}
                                  </td>
                                  <td className="py-1.5 text-slate-500">{p.pagaEmLabel ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="mt-2 text-[11px] text-slate-500">
                            Liberar e pagar comissão é feito em{' '}
                            <Link
                              href="/admin/comissoes"
                              className="font-medium text-primary-600 hover:underline"
                            >
                              Comissões
                            </Link>
                            , onde entra a conta de onde o dinheiro sai.
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
        <DialogContent className="max-w-lg">
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
              <div className="sm:col-span-2">
                <Campo rotulo="Contrato, lote, cliente ou loteamento">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                    autoFocus
                  />
                </Campo>
              </div>
              <Campo rotulo="Situação da venda">
                <select
                  value={rascunho.statusVenda}
                  onChange={(e) => setRascunho({ ...rascunho, statusVenda: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  {Object.keys(STATUS_VENDA).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Comissão">
                <select
                  value={rascunho.situacaoComissao}
                  onChange={(e) => setRascunho({ ...rascunho, situacaoComissao: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  <option value="liberadas">Com valor a repassar</option>
                  <option value="bloqueadas">Com parcela bloqueada</option>
                  <option value="quitadas">Já acertadas</option>
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
    </section>
  );
}
