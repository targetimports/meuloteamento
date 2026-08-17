'use client';

/**
 * Parcelas da venda com filtro em modal, ordenação por coluna e paginação.
 *
 * Um carnê de 72x virava uma tabela de 72 linhas sem corte nenhum: achar a
 * parcela de setembro, ou as três que atrasaram, era rolar a tela procurando.
 * Aqui a lista já está no cliente, então filtrar e ordenar não custam ida ao
 * servidor — e a página abre mostrando as primeiras, não todas.
 */

import { useMemo, useState, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL } from '@/lib/format';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { GerarBoletoButton } from '@/components/GerarBoletoButton';
import { RegerarPixButton } from '@/components/RegerarPixButton';
import { ParcelaActionButton } from '@/components/ParcelaActionButton';
import { marcarParcelaPaga, reabrirParcela } from '@/app/admin/(dashboard)/financeiro/actions';

export interface ParcelaLinha {
  id: string;
  numero: number;
  tipo: string;
  /**
   * AAAA-MM-DD, só para filtrar e ordenar — nesse formato a ordem alfabética
   * já é a cronológica. O que aparece na tela é o rótulo pronto: formatar data
   * no navegador jogaria o vencimento para o dia anterior em quem está a
   * oeste de Greenwich.
   */
  vencimento: string;
  vencimentoLabel: string;
  valor: number;
  pagoEm: string | null;
  pagoEmLabel: string | null;
  status: string;
  /** Forma própria da parcela, quando difere da venda. */
  formaPropria: string | null;
  /** A que vale de fato: a da parcela, ou a da venda quando não tem própria. */
  formaEfetiva: string;
  chequeNumero: string | null;
  chequeBanco: string | null;
  chequeEmitente: string | null;
  chequePraca: string | null;
  asaasBoletoUrl: string | null;
  asaasInvoiceUrl: string | null;
  temCobranca: boolean;
  /** Texto de cobrança pronto, montado no servidor. */
  mensagem: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600',
  PAGO: 'bg-emerald-100 text-emerald-700',
  ATRASADO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-slate-100 text-slate-400',
  ESTORNADO: 'bg-amber-100 text-amber-700',
};

interface Filtros {
  status: string;
  tipo: string;
  de: string;
  ate: string;
  valorMin: string;
  valorMax: string;
}

const FILTRO_VAZIO: Filtros = {
  status: '',
  tipo: '',
  de: '',
  ate: '',
  valorMin: '',
  valorMax: '',
};

const num = (v: string): number | null => {
  const n = Number(String(v).replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

const POR_PAGINA = 25;

type CampoOrdem = 'numero' | 'tipo' | 'vencimento' | 'valor' | 'pagoEm' | 'status';

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
    <th className={`${alinhamento} px-3 py-2 font-semibold`}>
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

export function TabelaParcelas({
  parcelas,
  clienteTelefone,
  loteCodigo,
}: {
  parcelas: ParcelaLinha[];
  clienteTelefone: string | null;
  loteCodigo: string;
}) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  // Ordem do carnê: a parcela 1 é a primeira a vencer, e é assim que quem
  // atende o cliente lê a tabela.
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'numero',
    asc: true,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const statusDisponiveis = useMemo(
    () => [...new Set(parcelas.map((p) => p.status))].sort(),
    [parcelas]
  );
  const tiposDisponiveis = useMemo(
    () => [...new Set(parcelas.map((p) => p.tipo))].sort(),
    [parcelas]
  );

  const visiveis = useMemo(() => {
    const f = filtros;
    const vMin = num(f.valorMin);
    const vMax = num(f.valorMax);
    return parcelas.filter((p) => {
      if (f.status && p.status !== f.status) return false;
      if (f.tipo && p.tipo !== f.tipo) return false;
      if (f.de && p.vencimento < f.de) return false;
      if (f.ate && p.vencimento > f.ate) return false;
      if (vMin !== null && p.valor < vMin) return false;
      if (vMax !== null && p.valor > vMax) return false;
      return true;
    });
  }, [parcelas, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'numero' || campo === 'valor') return (a[campo] - b[campo]) * sinal;
      // Sem data de pagamento vai sempre para o fim, nas duas direções: é
      // ausência, não uma data muito antiga nem muito recente.
      if (campo === 'pagoEm') {
        if (!a.pagoEm && !b.pagoEm) return 0;
        if (!a.pagoEm) return 1;
        if (!b.pagoEm) return -1;
        return a.pagoEm.localeCompare(b.pagoEm) * sinal;
      }
      return String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'pt-BR') * sinal;
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  // O total do que está à vista responde a pergunta que motiva o filtro:
  // "quanto o cliente deve em atraso?" é dois cliques, não uma soma na mão.
  const somaVisivel = ordenados.reduce((s, p) => s + p.valor, 0);

  function ordenarPor(campo: CampoOrdem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
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
        {ativos > 0 && ordenados.length > 0 && (
          <span className="text-xs text-slate-500">
            {ordenados.length} parcela(s) · {formatBRL(somaVisivel)}
          </span>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {parcelas.length === 0
            ? 'Nenhuma parcela gerada.'
            : 'Nenhuma parcela atende aos filtros.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <Cabecalho campo="numero" rotulo="#" ordem={ordem} aoOrdenar={ordenarPor} />
                <Cabecalho campo="tipo" rotulo="Tipo" ordem={ordem} aoOrdenar={ordenarPor} />
                <Cabecalho
                  campo="vencimento"
                  rotulo="Vencimento"
                  ordem={ordem}
                  aoOrdenar={ordenarPor}
                />
                <Cabecalho campo="valor" rotulo="Valor" ordem={ordem} aoOrdenar={ordenarPor} />
                <Cabecalho campo="pagoEm" rotulo="Pago em" ordem={ordem} aoOrdenar={ordenarPor} />
                <Cabecalho campo="status" rotulo="Status" ordem={ordem} aoOrdenar={ordenarPor} />
                <th className="px-3 py-2 text-left font-semibold">Asaas</th>
                <th className="px-3 py-2 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daPagina.map((p) => (
                <tr key={p.id} className="text-sm transition-colors hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono">{p.numero}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div>{p.tipo}</div>
                    {p.formaPropria && (
                      <div
                        className="text-[10px] font-semibold text-amber-700"
                        title="Forma de pagamento diferente da venda"
                      >
                        {p.formaPropria
                          .replace('PARCELADO_', '')
                          .replace('A_VISTA_', '')
                          .replace('_', ' ')}
                      </div>
                    )}
                    {(p.formaEfetiva === 'A_VISTA_CHEQUE' ||
                      p.formaEfetiva === 'PARCELADO_CHEQUE') && (
                      <div
                        className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                        title={`Cheque${p.chequeNumero ? ' nº ' + p.chequeNumero : ''}${p.chequeBanco ? ' · ' + p.chequeBanco : ''}${p.chequeEmitente ? ' · emitente ' + p.chequeEmitente : ''}${p.chequePraca ? ' · ' + p.chequePraca : ''}`}
                      >
                        Cheque
                        {p.chequeNumero && <span className="font-mono">nº {p.chequeNumero}</span>}
                        {p.chequeBanco && <span>· {p.chequeBanco}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{p.vencimentoLabel}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{formatBRL(p.valor)}</td>
                  <td className="px-3 py-2 text-xs">{p.pagoEmLabel ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {/* Rótulo honesto: "Boleto" só quando existe o PDF do
                        boleto. Antes, dizia Boleto e abria a página de
                        pagamento do Asaas — quem clicava esperando o documento
                        recebia uma tela de opções e achava que estava
                        quebrado. */}
                    {p.asaasBoletoUrl ? (
                      <a
                        href={p.asaasBoletoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                        title="PDF do boleto"
                      >
                        Boleto
                      </a>
                    ) : p.asaasInvoiceUrl ? (
                      <a
                        href={p.asaasInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                        title="Página de pagamento do Asaas (Pix, cartão e boleto)"
                      >
                        Pagamento
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {(p.status === 'PENDENTE' || p.status === 'ATRASADO') && clienteTelefone && (
                        <WhatsAppButton
                          telefone={clienteTelefone}
                          label="Cobrar"
                          message={p.mensagem}
                        />
                      )}
                      {/* O botão segue a forma efetiva da parcela. Mostrar
                          "Gerar Pix" numa parcela de boleto recriaria a
                          cobrança como Pix e desfaria a escolha. */}
                      {(p.status === 'PENDENTE' || p.status === 'ATRASADO') &&
                        (p.formaEfetiva === 'PARCELADO_BOLETO' ? (
                          <GerarBoletoButton
                            parcelaId={p.id}
                            boletoUrl={p.asaasBoletoUrl}
                            invoiceUrl={p.asaasInvoiceUrl}
                          />
                        ) : (
                          <RegerarPixButton
                            parcelaId={p.id}
                            jaTinha={p.temCobranca}
                            clienteTelefone={clienteTelefone}
                            loteCodigo={loteCodigo}
                          />
                        ))}
                      {(p.status === 'PENDENTE' || p.status === 'ATRASADO') && (
                        <ParcelaActionButton
                          parcelaId={p.id}
                          action={marcarParcelaPaga}
                          label="✓ Pago"
                          confirmMsg={`Marcar parcela ${p.numero} (${formatBRL(p.valor)}) como paga?`}
                        />
                      )}
                      {p.status === 'PAGO' && (
                        <ParcelaActionButton
                          parcelaId={p.id}
                          action={reabrirParcela}
                          label="↺ Reabrir"
                          confirmMsg="Reabrir esta parcela?"
                          variant="subtle"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {ordenados.length}
            {ordenados.length !== parcelas.length && ` (${parcelas.length} no total)`}
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
            <DialogTitle>Filtrar parcelas</DialogTitle>
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
              <Campo rotulo="Tipo">
                <select
                  value={rascunho.tipo}
                  onChange={(e) => setRascunho({ ...rascunho, tipo: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {tiposDisponiveis.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vence de">
                <input
                  type="date"
                  value={rascunho.de}
                  onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Vence até">
                <input
                  type="date"
                  value={rascunho.ate}
                  onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })}
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
