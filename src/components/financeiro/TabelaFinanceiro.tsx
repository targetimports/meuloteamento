'use client';

/**
 * Tabela de parcelas do financeiro.
 *
 * Ordenar, filtrar e virar página trocam só a tabela. Antes cada clique num
 * cabeçalho era uma navegação: a página inteira voltava do servidor com os
 * KPIs, os agregados de cheques, os saldos por conta e as listas do modal de
 * cobrança — tudo recalculado para reordenar 50 linhas, e a tela travava no
 * meio do caminho.
 *
 * O recorte continua sendo feito pelo banco, porque são milhares de parcelas.
 * O que mudou é quem espera: agora só esta tabela.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatBRL } from '@/lib/format';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { RegerarPixButton } from '@/components/RegerarPixButton';
import { ParcelaActionButton } from '@/components/ParcelaActionButton';
import { FiltroParcelas } from '@/components/financeiro/FiltroParcelas';
import {
  PARCELAS_POR_PAGINA,
  type CampoOrdemParcela,
  type FiltrosParcela,
  type LinhaParcela,
} from '@/lib/parcelas-consulta';
import { marcarParcelaPaga, reabrirParcela } from '@/app/admin/(dashboard)/financeiro/actions';

const STATUS_BG: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  PAGO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ATRASADO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  CANCELADO: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  ESTORNADO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

function paraQuery(
  filtros: FiltrosParcela,
  campo: CampoOrdemParcela,
  dir: 'asc' | 'desc',
  pagina: number
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) if (v) qs.set(k, v);
  if (campo !== 'vencimento') qs.set('ordem', campo);
  if (dir !== 'asc') qs.set('dir', dir);
  if (pagina > 1) qs.set('pagina', String(pagina));
  return qs.toString();
}

export function TabelaFinanceiro({
  inicial,
  totalInicial,
  filtrosIniciais,
  campoInicial,
  dirInicial,
  paginaInicial,
}: {
  inicial: LinhaParcela[];
  totalInicial: number;
  filtrosIniciais: FiltrosParcela;
  campoInicial: CampoOrdemParcela;
  dirInicial: 'asc' | 'desc';
  paginaInicial: number;
}) {
  const [linhas, setLinhas] = useState(inicial);
  const [total, setTotal] = useState(totalInicial);
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [campo, setCampo] = useState(campoInicial);
  const [dir, setDir] = useState(dirInicial);
  const [pagina, setPagina] = useState(paginaInicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // A primeira renderização já veio pronta do servidor: buscar de novo no
  // primeiro efeito seria uma consulta jogada fora a cada vez que a página abre.
  const primeira = useRef(true);
  // Respostas fora de ordem: quem clica em duas colunas seguidas pode receber
  // a resposta da primeira depois da segunda e ver a tabela ordenada pelo
  // clique que já abandonou.
  const pedido = useRef(0);

  const buscar = useCallback(
    async (f: FiltrosParcela, c: CampoOrdemParcela, d: 'asc' | 'desc', p: number) => {
      const meu = ++pedido.current;
      setCarregando(true);
      setErro(null);
      try {
        const qs = paraQuery(f, c, d, p);
        const res = await fetch(`/api/admin/financeiro/parcelas?${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('falha');
        const dados = (await res.json()) as { linhas: LinhaParcela[]; total: number };
        if (meu !== pedido.current) return;
        setLinhas(dados.linhas);
        setTotal(dados.total);
        // O endereço acompanha sem recarregar: o recorte continua sendo um
        // link que se guarda ou se manda para alguém.
        window.history.replaceState(null, '', qs ? `/admin/financeiro?${qs}` : '/admin/financeiro');
      } catch {
        if (meu === pedido.current) setErro('Não foi possível carregar as parcelas.');
      } finally {
        if (meu === pedido.current) setCarregando(false);
      }
    },
    []
  );

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    void buscar(filtros, campo, dir, pagina);
  }, [filtros, campo, dir, pagina, buscar]);

  /** Depois de dar baixa ou reabrir, a linha mudou: relê o que está à vista. */
  const recarregar = useCallback(
    () => buscar(filtros, campo, dir, pagina),
    [buscar, filtros, campo, dir, pagina]
  );

  function ordenarPor(novo: CampoOrdemParcela) {
    // Clicar na coluna já ordenada inverte; em outra, começa crescente. Volta
    // para a página 1 porque a linha procurada passa a estar no começo.
    setDir(campo === novo && dir === 'asc' ? 'desc' : 'asc');
    setCampo(novo);
    setPagina(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PARCELAS_POR_PAGINA));
  const primeiraDaPagina = total === 0 ? 0 : (pagina - 1) * PARCELAS_POR_PAGINA + 1;

  function Cabecalho({
    alvo,
    rotulo,
    alinhamento = 'text-left',
  }: {
    alvo: CampoOrdemParcela;
    rotulo: string;
    alinhamento?: string;
  }) {
    const ativa = campo === alvo;
    return (
      <th className={`${alinhamento} px-4 py-3 font-semibold`}>
        <button
          type="button"
          onClick={() => ordenarPor(alvo)}
          className="inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          title={`Ordenar por ${rotulo.toLowerCase()}`}
        >
          {rotulo}
          <span className={ativa ? 'text-slate-600 dark:text-slate-300' : 'invisible'} aria-hidden>
            {ativa && dir === 'desc' ? '▾' : '▴'}
          </span>
        </button>
      </th>
    );
  }

  const temFiltro = Object.values(filtros).some((v) => v);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FiltroParcelas
          atuais={filtros}
          onAplicar={(f) => {
            setFiltros(f);
            setPagina(1);
          }}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {carregando ? 'Carregando…' : `${total.toLocaleString('pt-BR')} parcela(s)`}
        </p>
      </div>

      {erro && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {erro}
        </p>
      )}

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {temFiltro
            ? 'Nenhuma parcela atende aos filtros.'
            : 'Ainda não há parcelas geradas. Parcelas aparecem aqui quando uma venda é criada com financiamento.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            {/* A opacidade durante a carga mantém a tabela no lugar: trocar as
                linhas por um vazio faria a página saltar a cada ordenação. */}
            <table
              className={`w-full text-sm transition-opacity ${carregando ? 'opacity-60' : ''}`}
            >
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <Cabecalho alvo="vencimento" rotulo="Vencimento" />
                  <Cabecalho alvo="contrato" rotulo="Contrato / Lote" />
                  <Cabecalho alvo="cliente" rotulo="Cliente" />
                  <th className="px-4 py-3 text-left font-semibold">Parcela</th>
                  <Cabecalho alvo="valor" rotulo="Valor" />
                  <Cabecalho alvo="status" rotulo="Status" />
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {linhas.map((p) => {
                  const emAberto = p.status === 'PENDENTE' || p.statusVisual === 'ATRASADO';
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {p.vencimentoLabel}
                        </div>
                        {p.pagoEmLabel && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">
                            pago em {p.pagoEmLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-900 dark:text-slate-100">
                          #{p.contratoNumero} · {p.loteCodigo}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {p.loteamentoNome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                        {p.clienteNome}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {p.numero}
                        <span className="text-slate-400 dark:text-slate-600"> · {p.tipo}</span>
                        {(p.formaPagamento === 'A_VISTA_CHEQUE' ||
                          p.formaPagamento === 'PARCELADO_CHEQUE') && (
                          <div
                            className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                            title={`Cheque${p.chequeNumero ? ' nº ' + p.chequeNumero : ''}${p.chequeBanco ? ' · ' + p.chequeBanco : ''}${p.chequeEmitente ? ' · emitente ' + p.chequeEmitente : ''}${p.chequePraca ? ' · ' + p.chequePraca : ''}`}
                          >
                            Cheque
                            {p.chequeNumero && <span>nº {p.chequeNumero}</span>}
                            {p.chequeBanco && <span>· {p.chequeBanco}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                          {formatBRL(p.valor)}
                        </div>
                        {p.valorPago !== null && p.valorPago !== p.valor && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">
                            pago {formatBRL(p.valorPago)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BG[p.statusVisual]}`}>
                          {p.statusVisual}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {emAberto && p.clienteTelefone && (
                            <WhatsAppButton
                              telefone={p.clienteTelefone}
                              label="Cobrar"
                              message={p.mensagem}
                            />
                          )}
                          {emAberto && (
                            <RegerarPixButton
                              parcelaId={p.id}
                              jaTinha={p.temCobranca}
                              clienteTelefone={p.clienteTelefone}
                              loteCodigo={p.loteCodigo}
                            />
                          )}
                          {emAberto && (
                            <ParcelaActionButton
                              parcelaId={p.id}
                              action={async (id) => {
                                await marcarParcelaPaga(id);
                                await recarregar();
                              }}
                              label="Pago"
                              confirmMsg={`Marcar parcela ${p.numero} (${formatBRL(p.valor)}) como paga? Se for a última, a venda vira QUITADA.`}
                            />
                          )}
                          {p.status === 'PAGO' && (
                            <ParcelaActionButton
                              parcelaId={p.id}
                              action={async (id) => {
                                await reabrirParcela(id);
                                await recarregar();
                              }}
                              label="Reabrir"
                              confirmMsg="Reabrir esta parcela (volta pra PENDENTE)?"
                              variant="subtle"
                            />
                          )}
                          {p.asaasInvoiceUrl && (
                            <a
                              href={p.asaasInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                            >
                              Asaas
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {primeiraDaPagina}–{primeiraDaPagina + linhas.length - 1} de{' '}
            {total.toLocaleString('pt-BR')}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1 || carregando}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">
                {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas || carregando}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
