import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId, whereClienteDaLoteadora } from '@/lib/tenant';
import { formatBRL } from '@/lib/format';
import { CobrancaPixRapida } from '@/components/CobrancaPixRapida';
import { SincronizarAsaasButton } from '@/components/SincronizarAsaasButton';
import { TabelaFinanceiro } from '@/components/financeiro/TabelaFinanceiro';
import { consultarParcelas, lerParametros } from '@/lib/parcelas-consulta';

export const dynamic = 'force-dynamic';

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

  // Mesma leitura que a rota da tabela usa: um só lugar decide o padrão de
  // ordenação e o que é filtro válido.
  const { filtros, campo: campoOrdem, dir, pagina } = lerParametros(
    (k) => (searchParams as Record<string, string | undefined>)[k] ?? null
  );

  const tenantWhere = tid
    ? { venda: { lote: { loteamento: { loteadoraId: tid } } } }
    : {};

  const { linhas, total: totalFiltrado } = await consultarParcelas({
    tid,
    filtros,
    campo: campoOrdem,
    dir,
    pagina,
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em30dias = new Date(hoje);
  em30dias.setDate(em30dias.getDate() + 30);

  const [totaisPorStatus, totalAtrasadas, vencendoEm30dias] = await Promise.all([
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

      <TabelaFinanceiro
        inicial={linhas}
        totalInicial={totalFiltrado}
        filtrosIniciais={filtros}
        campoInicial={campoOrdem}
        dirInicial={dir}
        paginaInicial={pagina}
      />
    </div>
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
