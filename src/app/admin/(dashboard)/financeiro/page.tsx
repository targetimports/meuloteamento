import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId, whereClienteDaLoteadora } from '@/lib/tenant';
import { formatBRL, formatDate } from '@/lib/format';
import { ParcelaActionButton } from '@/components/ParcelaActionButton';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { CobrancaPixRapida } from '@/components/CobrancaPixRapida';
import { RegerarPixButton } from '@/components/RegerarPixButton';
import { SincronizarAsaasButton } from '@/components/SincronizarAsaasButton';
import { msgCobrancaParcela } from '@/lib/whatsappMessages';
import { FiltroParcelas, type FiltrosParcela } from '@/components/financeiro/FiltroParcelas';
import { marcarParcelaPaga, reabrirParcela } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_BG: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  PAGO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ATRASADO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  CANCELADO: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  ESTORNADO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

const POR_PAGINA = 50;

type CampoOrdem = 'vencimento' | 'contrato' | 'cliente' | 'valor' | 'status';

/**
 * Tradução do campo da URL para o `orderBy` do Prisma.
 *
 * Contrato e cliente moram em tabelas vizinhas — ordenar por eles é ordenar
 * pela relação, não por uma coluna da parcela.
 */
function ordenarPor(campo: CampoOrdem, dir: 'asc' | 'desc') {
  switch (campo) {
    case 'contrato':
      return { venda: { numero: dir } };
    case 'cliente':
      return { venda: { cliente: { nome: dir } } };
    case 'valor':
      return { valor: dir };
    case 'status':
      return { status: dir };
    default:
      return { vencimento: dir };
  }
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    cliente?: string;
    lote?: string;
    loteamento?: string;
    forma?: string;
    de?: string;
    ate?: string;
    valorMin?: string;
    valorMax?: string;
    ordem?: string;
    dir?: string;
    pagina?: string;
  };
}) {
  const tid = await tenantId();

  const filtros: FiltrosParcela = {
    status: searchParams.status ?? '',
    cliente: searchParams.cliente ?? '',
    lote: searchParams.lote ?? '',
    loteamento: searchParams.loteamento ?? '',
    forma: searchParams.forma ?? '',
    de: searchParams.de ?? '',
    ate: searchParams.ate ?? '',
    valorMin: searchParams.valorMin ?? '',
    valorMax: searchParams.valorMax ?? '',
  };

  const campoOrdem = (
    ['vencimento', 'contrato', 'cliente', 'valor', 'status'].includes(searchParams.ordem ?? '')
      ? searchParams.ordem
      : 'vencimento'
  ) as CampoOrdem;
  const dir: 'asc' | 'desc' = searchParams.dir === 'desc' ? 'desc' : 'asc';
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);

  const tenantWhere = tid
    ? { venda: { lote: { loteamento: { loteadoraId: tid } } } }
    : {};

  const numero = (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
  };
  // Datas do formulário vêm como AAAA-MM-DD, meia-noite local. O `ate` inclui
  // o dia inteiro: quem filtra "até 31/08" espera ver o que vence em 31/08.
  const dataDe = filtros.de ? new Date(`${filtros.de}T00:00:00`) : undefined;
  const dataAte = filtros.ate ? new Date(`${filtros.ate}T23:59:59`) : undefined;
  const vMin = numero(filtros.valorMin);
  const vMax = numero(filtros.valorMax);

  const where = {
    ...tenantWhere,
    ...(filtros.status ? { status: filtros.status as 'PENDENTE' } : {}),
    ...(filtros.forma ? { formaPagamento: filtros.forma as 'PARCELADO_PIX' } : {}),
    ...(dataDe || dataAte
      ? { vencimento: { ...(dataDe ? { gte: dataDe } : {}), ...(dataAte ? { lte: dataAte } : {}) } }
      : {}),
    ...(vMin !== undefined || vMax !== undefined
      ? { valor: { ...(vMin !== undefined ? { gte: vMin } : {}), ...(vMax !== undefined ? { lte: vMax } : {}) } }
      : {}),
    ...(filtros.cliente || filtros.lote || filtros.loteamento
      ? {
          venda: {
            ...(tid ? { lote: { loteamento: { loteadoraId: tid } } } : {}),
            ...(filtros.cliente
              ? {
                  cliente: {
                    OR: [
                      { nome: { contains: filtros.cliente, mode: 'insensitive' as const } },
                      // Só busca por CPF quando o que foi digitado tem dígito.
                      // `contains: ''` casa com todo mundo, e o OR devolveria a
                      // lista inteira em vez de nada.
                      ...(filtros.cliente.replace(/\D/g, '')
                        ? [{ cpfCnpj: { contains: filtros.cliente.replace(/\D/g, '') } }]
                        : []),
                    ],
                  },
                }
              : {}),
            ...(filtros.lote || filtros.loteamento
              ? {
                  lote: {
                    ...(tid ? { loteamento: { loteadoraId: tid } } : {}),
                    ...(filtros.lote
                      ? { codigo: { contains: filtros.lote, mode: 'insensitive' as const } }
                      : {}),
                    ...(filtros.loteamento
                      ? {
                          loteamento: {
                            ...(tid ? { loteadoraId: tid } : {}),
                            nome: { contains: filtros.loteamento, mode: 'insensitive' as const },
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em30dias = new Date(hoje);
  em30dias.setDate(em30dias.getDate() + 30);

  const [parcelas, totalFiltrado, totaisPorStatus, totalAtrasadas, vencendoEm30dias] =
    await Promise.all([
    prisma.parcela.findMany({
      where,
      orderBy: [ordenarPor(campoOrdem, dir)],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        venda: {
          select: {
            numero: true,
            cliente: { select: { nome: true, cpfCnpj: true, telefone: true } },
            lote: {
              select: {
                codigo: true,
                loteamento: {
                  select: { nome: true, loteadora: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.parcela.count({ where }),
    prisma.parcela.groupBy({
      by: ['status'],
      where: tenantWhere,
      _count: { _all: true },
      _sum: { valor: true },
    }),
    prisma.parcela.aggregate({
      where: { ...tenantWhere, status: 'ATRASADO' },
      _sum: { valor: true },
      _count: { _all: true },
    }),
    prisma.parcela.aggregate({
      where: {
        ...tenantWhere,
        status: 'PENDENTE',
        vencimento: { gte: hoje, lte: em30dias },
      },
      _sum: { valor: true },
      _count: { _all: true },
    }),
  ]);

  const totalPago = totaisPorStatus.find((s) => s.status === 'PAGO');
  const totalPendente = totaisPorStatus.find((s) => s.status === 'PENDENTE');

  // ===== Cheques: agregados pra dar visibilidade dedicada =====
  // Aguardando compensação = cheque pré-datado ainda PENDENTE/ATRASADO.
  // Compensado = cheque que já virou PAGO.
  // Devolvido = ESTORNADO.
  const [chequesAguardando, chequesCompensados, chequesDevolvidos] = await Promise.all([
    prisma.parcela.aggregate({
      where: {
        ...tenantWhere,
        formaPagamento: { in: ['A_VISTA_CHEQUE', 'PARCELADO_CHEQUE'] },
        status: { in: ['PENDENTE', 'ATRASADO'] },
      },
      _sum: { valor: true },
      _count: { _all: true },
    }),
    prisma.parcela.aggregate({
      where: {
        ...tenantWhere,
        formaPagamento: { in: ['A_VISTA_CHEQUE', 'PARCELADO_CHEQUE'] },
        status: 'PAGO',
      },
      _sum: { valor: true },
      _count: { _all: true },
    }),
    prisma.parcela.aggregate({
      where: {
        ...tenantWhere,
        formaPagamento: { in: ['A_VISTA_CHEQUE', 'PARCELADO_CHEQUE'] },
        status: 'ESTORNADO',
      },
      _sum: { valor: true },
      _count: { _all: true },
    }),
  ]);

  const tid2 = await tenantId();
  const contas = await prisma.contaFinanceira.findMany({
    where: tid2 ? { loteadoraId: tid2 } : {},
    orderBy: [{ ativa: 'desc' }, { ordem: 'asc' }],
    select: { id: true, nome: true, tipo: true, saldoInicial: true, cor: true, ativa: true },
  });

  // Dados para modal "Nova cobrança PIX"
  const [clientesAtivos, lotesDisponiveis, loteadoras] = await Promise.all([
    prisma.cliente.findMany({
      where: whereClienteDaLoteadora(tid2),
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cpfCnpj: true, telefone: true, email: true },
      take: 500,
    }),
    prisma.lote.findMany({
      where: tid2
        ? {
            loteamento: { loteadoraId: tid2 },
            status: { in: ['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO'] },
          }
        : { status: { in: ['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO'] } },
      orderBy: [{ loteamento: { nome: 'asc' } }, { codigo: 'asc' }],
      select: {
        id: true,
        codigo: true,
        preco: true,
        loteamento: { select: { nome: true } },
      },
      take: 500,
    }),
    tid2
      ? Promise.resolve([])
      : prisma.loteadora.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
        }),
  ]);
  const saldosPorConta = await prisma.parcela.groupBy({
    by: ['contaId'],
    where: { status: 'PAGO', contaId: { not: null } },
    _sum: { valorPago: true, valor: true },
  });
  const saldoMap = new Map<string, number>();
  for (const s of saldosPorConta) {
    if (s.contaId) saldoMap.set(s.contaId, Number(s._sum.valorPago ?? s._sum.valor ?? 0));
  }
  const saldoTotalContas = contas.reduce(
    (sum, c) => sum + Number(c.saldoInicial) + (saldoMap.get(c.id) ?? 0),
    0
  );

  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / POR_PAGINA));
  const primeiraDaPagina = totalFiltrado === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1;

  /**
   * Monta um link preservando o recorte atual.
   *
   * Ordenar ou virar página não pode apagar o filtro: quem recortou "atrasadas
   * do Parque Tucano" e clicou em Valor quer o mesmo recorte em outra ordem.
   */
  function comParametros(mudancas: Record<string, string | number | undefined>): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) qs.set(k, v);
    if (campoOrdem !== 'vencimento') qs.set('ordem', campoOrdem);
    if (dir !== 'asc') qs.set('dir', dir);
    if (pagina > 1) qs.set('pagina', String(pagina));
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === undefined || v === '') qs.delete(k);
      else qs.set(k, String(v));
    }
    return qs.size ? `/admin/financeiro?${qs}` : '/admin/financeiro';
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
    const ativa = campoOrdem === campo;
    // Clicar na coluna já ordenada inverte; clicar em outra começa crescente.
    // Trocar a ordem volta para a página 1: a linha procurada passa a estar no
    // começo, não na página em que se estava.
    const proximaDir = ativa && dir === 'asc' ? 'desc' : 'asc';
    return (
      <th className={`${alinhamento} px-4 py-3 font-semibold`}>
        <Link
          href={comParametros({ ordem: campo, dir: proximaDir, pagina: undefined })}
          className="inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          title={`Ordenar por ${rotulo.toLowerCase()}`}
        >
          {rotulo}
          <span className={ativa ? 'text-slate-600 dark:text-slate-300' : 'invisible'} aria-hidden>
            {ativa && dir === 'desc' ? '▾' : '▴'}
          </span>
        </Link>
      </th>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Financeiro</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Parcelas, recebimentos e inadimplência.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SincronizarAsaasButton />
          <CobrancaPixRapida
            clientes={clientesAtivos}
            lotes={lotesDisponiveis.map((l) => ({
              id: l.id,
              codigo: l.codigo,
              preco: Number(l.preco),
              loteamentoNome: l.loteamento.nome,
            }))}
            loteadoras={loteadoras}
          />
          <Link
            href="/admin/financeiro/conciliacao"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Conciliação
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI
          label="Total já recebido"
          valor={formatBRL(Number(totalPago?._sum.valor) || 0)}
          tint="text-emerald-600 dark:text-emerald-400"
        />
        <KPI
          label="A receber (pendentes)"
          valor={formatBRL(Number(totalPendente?._sum.valor) || 0)}
        />
        <KPI
          label="Atrasadas"
          valor={formatBRL(Number(totalAtrasadas._sum.valor) || 0)}
          sublabel={`${totalAtrasadas._count._all} parcela(s)`}
          tint="text-red-600 dark:text-red-400"
        />
        <KPI
          label="Vencendo em 30 dias"
          valor={formatBRL(Number(vencendoEm30dias._sum.valor) || 0)}
          sublabel={`${vencendoEm30dias._count._all} parcela(s)`}
          tint="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Controle de cheques — só mostra se existir algum cheque cadastrado.
          Aguardando compensação = pré-datado pendente/atrasado (cai aqui na data do vencimento).
          Compensados = cheque que foi confirmado (status PAGO).
          Devolvidos = cheque que voltou (status ESTORNADO). */}
      {(chequesAguardando._count._all +
        chequesCompensados._count._all +
        chequesDevolvidos._count._all) > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Cheques</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Controle de cheques pré-datados — compensação, compensados e devoluções.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-bold">
                Aguardando compensação
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                {formatBRL(Number(chequesAguardando._sum.valor) || 0)}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {chequesAguardando._count._all} cheque(s) pré-datado(s)
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300 font-bold">
                Compensados
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-200">
                {formatBRL(Number(chequesCompensados._sum.valor) || 0)}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {chequesCompensados._count._all} cheque(s) confirmados
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-red-700 dark:text-red-300 font-bold">
                Devolvidos
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-900 dark:text-red-200">
                {formatBRL(Number(chequesDevolvidos._sum.valor) || 0)}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                {chequesDevolvidos._count._all} cheque(s) sem fundos
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            <strong className="font-medium text-slate-600 dark:text-slate-300">Como usar:</strong>{' '}
            cheque pré-datado aparece no fluxo na data de vencimento. Para confirmar a
            compensação, clique em <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Pago</span> na
            linha da parcela. Para devolução, abra a venda e estorne a parcela.
          </p>
        </section>
      )}

      {/* Saldos por conta */}
      {contas.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Saldos por conta</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Onde caem os recebimentos.{' '}
                <Link
                  href="/admin/contas"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Gerenciar contas →
                </Link>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-semibold">
                Saldo consolidado
              </p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatBRL(saldoTotalContas)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {contas.map((c) => {
              const mov = saldoMap.get(c.id) ?? 0;
              const saldo = Number(c.saldoInicial) + mov;
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border border-slate-200 border-t-4 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 ${
                    c.ativa ? '' : 'opacity-50'
                  }`}
                  style={{ borderTopColor: c.cor ?? '#94a3b8' }}
                >
                  <p
                    className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate"
                    title={c.nome}
                  >
                    {c.nome}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatBRL(saldo)}
                  </p>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    + {formatBRL(mov)} recebido
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FiltroParcelas atuais={filtros} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {totalFiltrado.toLocaleString('pt-BR')} parcela(s)
        </p>
      </div>

      {parcelas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {Object.values(filtros).some((v) => v)
            ? 'Nenhuma parcela atende aos filtros.'
            : 'Ainda não há parcelas geradas. Parcelas aparecem aqui quando uma venda é criada com financiamento.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <Cabecalho campo="vencimento" rotulo="Vencimento" />
                <Cabecalho campo="contrato" rotulo="Contrato / Lote" />
                <Cabecalho campo="cliente" rotulo="Cliente" />
                <th className="px-4 py-3 text-left font-semibold">Parcela</th>
                <Cabecalho campo="valor" rotulo="Valor" />
                <Cabecalho campo="status" rotulo="Status" />
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {parcelas.map((p) => {
                const venc = new Date(p.vencimento);
                const isAtrasado =
                  p.status === 'PENDENTE' && venc.getTime() < hoje.getTime();
                const statusVisual = isAtrasado ? 'ATRASADO' : p.status;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {formatDate(p.vencimento)}
                      </div>
                      {p.pagoEm && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          pago em {formatDate(p.pagoEm)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-900 dark:text-slate-100">
                        #{p.venda.numero} · {p.venda.lote.codigo}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.venda.lote.loteamento.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-100">
                        {p.venda.cliente.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {p.numero}
                      <span className="text-slate-400 dark:text-slate-600"> · {p.tipo}</span>
                      {/* Badge cheque com nº/banco — destaca pra admin saber
                          que essa parcela precisa de compensação manual */}
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
                        {formatBRL(Number(p.valor))}
                      </div>
                      {p.valorPago && Number(p.valorPago) !== Number(p.valor) && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          pago {formatBRL(Number(p.valorPago))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${STATUS_BG[statusVisual]}`}>
                        {statusVisual}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5 items-center justify-end flex-wrap">
                        {(p.status === 'PENDENTE' || statusVisual === 'ATRASADO') &&
                          p.venda.cliente.telefone && (
                            <WhatsAppButton
                              telefone={p.venda.cliente.telefone}
                              label="Cobrar"
                              message={msgCobrancaParcela({
                                cliente: { nome: p.venda.cliente.nome },
                                venda: {
                                  numero: p.venda.numero,
                                  loteCodigo: p.venda.lote.codigo,
                                  loteamentoNome: p.venda.lote.loteamento.nome,
                                },
                                parcela: {
                                  numero: p.numero,
                                  vencimento: p.vencimento,
                                  valor: Number(p.valor),
                                  invoiceUrl: p.asaasInvoiceUrl ?? p.asaasBoletoUrl ?? null,
                                },
                                loteadora: {
                                  nome: p.venda.lote.loteamento.loteadora.nome,
                                },
                              })}
                            />
                          )}
                        {(p.status === 'PENDENTE' || statusVisual === 'ATRASADO') && (
                          <RegerarPixButton
                            parcelaId={p.id}
                            jaTinha={!!p.asaasPaymentId}
                            clienteTelefone={p.venda.cliente.telefone}
                            loteCodigo={p.venda.lote.codigo}
                          />
                        )}
                        {(p.status === 'PENDENTE' || statusVisual === 'ATRASADO') && (
                          <ParcelaActionButton
                            parcelaId={p.id}
                            action={marcarParcelaPaga}
                            label="Pago"
                            confirmMsg={`Marcar parcela ${p.numero} (${formatBRL(Number(p.valor))}) como paga? Se for a última, a venda vira QUITADA.`}
                          />
                        )}
                        {p.status === 'PAGO' && (
                          <ParcelaActionButton
                            parcelaId={p.id}
                            action={reabrirParcela}
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
                            className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-medium"
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
      )}

      {totalFiltrado > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {primeiraDaPagina}–{primeiraDaPagina + parcelas.length - 1} de{' '}
            {totalFiltrado.toLocaleString('pt-BR')}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <PaginaLink href={comParametros({ pagina: pagina - 1 })} desabilitado={pagina === 1}>
                Anterior
              </PaginaLink>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">
                {pagina} de {totalPaginas}
              </span>
              <PaginaLink
                href={comParametros({ pagina: pagina + 1 })}
                desabilitado={pagina >= totalPaginas}
              >
                Próxima
              </PaginaLink>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Botão de página.
 *
 * Nos extremos vira `<span>`, não um link cinza: link desabilitado continua
 * clicável pelo teclado e recarrega a mesma página.
 */
function PaginaLink({
  href,
  desabilitado,
  children,
}: {
  href: string;
  desabilitado: boolean;
  children: React.ReactNode;
}) {
  const base = 'rounded-lg border px-3 py-1.5 text-xs font-medium transition';
  if (desabilitado) {
    return (
      <span
        className={`${base} cursor-not-allowed border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
    >
      {children}
    </Link>
  );
}

function KPI({
  label,
  valor,
  sublabel,
  tint,
}: {
  label: string;
  valor: string;
  sublabel?: string;
  /** Cor do número quando ele carrega um alerta (atraso, vencimento). */
  tint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tint ?? 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {valor}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>
      )}
    </div>
  );
}
