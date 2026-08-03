import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatBRL, formatDate } from '@/lib/format';
import { tenantId, requireAdmin } from '@/lib/tenant';
import {
  GaugeVendidos,
  ReceitaMensalChart,
  AgingInadimplencia,
} from '@/components/DashboardCharts';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Este dashboard é de quem opera UM loteamento: velocímetro de lotes,
  // corretores, funil de leads. Para quem opera a plataforma ele nunca fez
  // sentido — mostrava a soma de todos os clientes num painel desenhado para
  // um só. O super admin vai para o backoffice, que é a casa dele.
  //
  // Só redireciona super admin: para as loteadoras-cliente esta página segue
  // idêntica ao que sempre foi.
  const sessao = await requireAdmin();
  if (sessao.loteadoraId === null && sessao.role === 'SUPER_ADMIN') {
    redirect('/backoffice');
  }

  const tid = await tenantId();
  const wLoteamento = tid ? { loteadoraId: tid } : {};
  const wLote = tid ? { loteamento: { loteadoraId: tid } } : {};
  const wVenda = tid ? { lote: { loteamento: { loteadoraId: tid } } } : {};
  const wParcela = tid ? { venda: { lote: { loteamento: { loteadoraId: tid } } } } : {};
  const wLead = tid ? { loteamento: { loteadoraId: tid } } : {};

  const loteadoraInfo = tid
    ? await prisma.loteadora.findUnique({
        where: { id: tid },
        select: { corPrimaria: true, nome: true },
      })
    : null;
  const corPrimaria = loteadoraInfo?.corPrimaria ?? '#6366f1';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio6m = new Date(hoje);
  inicio6m.setMonth(inicio6m.getMonth() - 5);
  inicio6m.setDate(1);
  const em7dias = new Date(hoje);
  em7dias.setDate(em7dias.getDate() + 7);

  const [
    loteamentosCount,
    lotesPorStatus,
    vendasAtivas,
    totalContratado,
    leadsPorStatus,
    parcelasPorStatus,
    proximosVencimentos,
    parcelasAtrasadas,
    parcelasUltimos6m,
    topCorretores,
    leadsRecentes,
    vendasRecentes,
  ] = await Promise.all([
    prisma.loteamento.count({ where: wLoteamento }),
    prisma.lote.groupBy({ by: ['status'], where: wLote, _count: { _all: true } }),
    prisma.venda.count({ where: { status: 'ATIVA', ...wVenda } }),
    prisma.venda.aggregate({
      where: { status: { in: ['ATIVA', 'QUITADA', 'INADIMPLENTE'] }, ...wVenda },
      _sum: { valorTotal: true },
    }),
    prisma.lead.groupBy({ by: ['status'], where: wLead, _count: { _all: true } }),
    prisma.parcela.groupBy({
      by: ['status'],
      where: wParcela,
      _count: { _all: true },
      _sum: { valor: true },
    }),
    prisma.parcela.findMany({
      where: { status: 'PENDENTE', vencimento: { gte: hoje, lte: em7dias }, ...wParcela },
      orderBy: { vencimento: 'asc' },
      take: 6,
      include: {
        venda: {
          select: {
            numero: true,
            cliente: { select: { nome: true } },
            lote: { select: { codigo: true } },
          },
        },
      },
    }),
    prisma.parcela.findMany({
      where: {
        OR: [{ status: 'ATRASADO' }, { status: 'PENDENTE', vencimento: { lt: hoje } }],
        ...wParcela,
      },
      select: { valor: true, vencimento: true },
    }),
    prisma.parcela.findMany({
      where: {
        OR: [
          { pagoEm: { gte: inicio6m } },
          { vencimento: { gte: inicio6m, lte: em7dias }, status: 'PENDENTE' },
        ],
        ...wParcela,
      },
      select: { valor: true, status: true, vencimento: true, pagoEm: true },
    }),
    prisma.venda.groupBy({
      by: ['corretorId'],
      where: { corretorId: { not: null }, status: { in: ['ATIVA', 'QUITADA'] }, ...wVenda },
      _count: { _all: true },
      _sum: { valorTotal: true, comissaoValor: true },
      orderBy: { _sum: { valorTotal: 'desc' } },
      take: 5,
    }),
    prisma.lead.findMany({
      where: wLead,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        nome: true,
        origem: true,
        temperatura: true,
        status: true,
        createdAt: true,
        loteamento: { select: { nome: true } },
      },
    }),
    prisma.venda.findMany({
      where: wVenda,
      orderBy: { dataContrato: 'desc' },
      take: 5,
      select: {
        id: true,
        numero: true,
        valorTotal: true,
        status: true,
        dataContrato: true,
        cliente: { select: { nome: true } },
        lote: { select: { codigo: true } },
      },
    }),
  ]);

  // ===== Processa =====
  const statusMap = Object.fromEntries(lotesPorStatus.map((s) => [s.status, s._count._all]));
  const totalLotes = lotesPorStatus.reduce((a, s) => a + s._count._all, 0);
  const vendidos = statusMap.VENDIDO ?? 0;
  const reservados = (statusMap.RESERVADO ?? 0) + (statusMap.EM_PAGAMENTO ?? 0);

  const parcStatusMap = Object.fromEntries(
    parcelasPorStatus.map((s) => [
      s.status,
      { count: s._count._all, total: Number(s._sum.valor) || 0 },
    ])
  );
  const recebido = parcStatusMap.PAGO?.total ?? 0;
  const aReceberPendente = parcStatusMap.PENDENTE?.total ?? 0;
  const totalAtrasado = parcelasAtrasadas.reduce((a, p) => a + Number(p.valor), 0);

  const leadStatusMap = Object.fromEntries(leadsPorStatus.map((s) => [s.status, s._count._all]));
  const leadsNovos = leadStatusMap.NOVO ?? 0;
  const leadsTotal = leadsPorStatus.reduce((a, s) => a + s._count._all, 0);
  const leadsConvertidos = leadStatusMap.CONVERTIDO ?? 0;
  const taxaConversao = leadsTotal > 0 ? (leadsConvertidos / leadsTotal) * 100 : 0;

  // Aging
  const aging = [
    { label: 'Em atraso até 30 dias', count: 0, total: 0 },
    { label: '31 a 60 dias', count: 0, total: 0 },
    { label: '61 a 90 dias', count: 0, total: 0 },
    { label: 'Mais de 90 dias', count: 0, total: 0 },
  ];
  for (const p of parcelasAtrasadas) {
    const dias = Math.floor(
      (hoje.getTime() - new Date(p.vencimento).getTime()) / (24 * 3600 * 1000)
    );
    let i = 0;
    if (dias > 90) i = 3;
    else if (dias > 60) i = 2;
    else if (dias > 30) i = 1;
    aging[i].count++;
    aging[i].total += Number(p.valor);
  }

  // Receita por mês
  const mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const meses: { label: string; recebido: number; pendente: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(hoje);
    ref.setMonth(ref.getMonth() - i);
    const ano = ref.getFullYear();
    const mes = ref.getMonth();
    let recebidoMes = 0;
    let pendenteMes = 0;
    for (const p of parcelasUltimos6m) {
      const data = p.status === 'PAGO' && p.pagoEm ? new Date(p.pagoEm) : new Date(p.vencimento);
      if (data.getFullYear() === ano && data.getMonth() === mes) {
        if (p.status === 'PAGO') recebidoMes += Number(p.valor);
        else pendenteMes += Number(p.valor);
      }
    }
    meses.push({ label: mesesLabels[mes], recebido: recebidoMes, pendente: pendenteMes });
  }
  // Tendência mês atual vs anterior
  const recebMesAtual = meses[5]?.recebido ?? 0;
  const recebMesAnterior = meses[4]?.recebido ?? 0;
  const trendReceb =
    recebMesAnterior > 0
      ? ((recebMesAtual - recebMesAnterior) / recebMesAnterior) * 100
      : recebMesAtual > 0
        ? 100
        : 0;

  // Top corretores
  const corretorIds = topCorretores.map((t) => t.corretorId).filter(Boolean) as string[];
  const corretores = await prisma.corretor.findMany({
    where: { id: { in: corretorIds } },
    select: { id: true, nome: true },
  });
  const corretorMap = new Map(corretores.map((c) => [c.id, c.nome]));
  const comissaoTotal = topCorretores.reduce(
    (a, t) => a + (Number(t._sum.comissaoValor) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visão geral {loteadoraInfo ? `de ${loteadoraInfo.nome}` : 'da plataforma'} ·{' '}
            {hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/leads"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Ver CRM
          </Link>
          <Link
            href="/admin/vendas/novo"
            className="text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-opacity hover:opacity-90"
            style={{ background: corPrimaria }}
          >
            + Nova venda
          </Link>
        </div>
      </div>

      {/* KPIs com tendência */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Recebido (mês atual)"
          valor={formatBRL(recebMesAtual)}
          trend={trendReceb}
          accent={corPrimaria}
          icon={
            <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
          }
        />
        <KpiCard
          label="A receber"
          valor={formatBRL(aReceberPendente)}
          sub={`${parcStatusMap.PENDENTE?.count ?? 0} parcelas pendentes`}
          icon={<path d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
        />
        <KpiCard
          label="Inadimplência"
          valor={formatBRL(totalAtrasado)}
          sub={`${parcelasAtrasadas.length} parcelas em atraso`}
          danger={totalAtrasado > 0}
          icon={<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />}
        />
        <KpiCard
          label="Conversão de leads"
          valor={`${taxaConversao.toFixed(1)}%`}
          sub={`${leadsConvertidos} de ${leadsTotal} leads`}
          icon={<path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3.13a4 4 0 100-8 4 4 0 000 8z" />}
        />
      </div>

      {/* Gauge + receita */}
      <div className="grid lg:grid-cols-2 gap-4">
        <GaugeVendidos
          totalLotes={totalLotes}
          vendidos={vendidos}
          reservados={reservados}
          corPrimaria={corPrimaria}
        />
        <ReceitaMensalChart meses={meses} corPrimaria={corPrimaria} />
      </div>

      {/* Aging + próximos vencimentos + top corretores */}
      <div className="grid lg:grid-cols-3 gap-4">
        <AgingInadimplencia buckets={aging} />

        <Card titulo="Próximos vencimentos" sub={`${proximosVencimentos.length} nos próximos 7 dias`}>
          {proximosVencimentos.length === 0 ? (
            <Empty texto="Nenhuma parcela vencendo essa semana." />
          ) : (
            <ul className="space-y-2.5">
              {proximosVencimentos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-900 dark:text-slate-100 truncate font-medium">
                      {p.venda.cliente.nome}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{p.venda.lote.codigo}</span> ·{' '}
                      {formatDate(p.vencimento)}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                    {formatBRL(Number(p.valor))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <CardLink href="/admin/financeiro" texto="Ver financeiro" />
        </Card>

        <Card titulo="Top corretores" sub="por valor de venda">
          {topCorretores.length === 0 ? (
            <Empty texto="Nenhuma venda atribuída a corretor." />
          ) : (
            <ul className="space-y-3">
              {topCorretores.map((t, i) => (
                <li key={t.corretorId ?? i} className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      i === 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        : i === 1
                          ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900 dark:text-slate-100 truncate font-medium">
                      {corretorMap.get(t.corretorId!) ?? '—'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t._count._all} venda(s)
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatBRL(Number(t._sum.valorTotal) || 0)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <CardLink href="/admin/corretores" texto="Ver corretores" />
        </Card>
      </div>

      {/* Atividade recente: leads + vendas */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card titulo="Leads recentes" sub={`${leadsNovos} novos aguardando atendimento`}>
          {leadsRecentes.length === 0 ? (
            <Empty texto="Nenhum lead ainda." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 -my-1">
              {leadsRecentes.map((l) => (
                <li key={l.id} className="py-2.5 flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      l.temperatura === 'QUENTE'
                        ? 'bg-red-500'
                        : l.temperatura === 'FRIO'
                          ? 'bg-sky-400'
                          : 'bg-amber-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900 dark:text-slate-100 truncate font-medium">
                      {l.nome}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {l.origem ?? 'site'}
                      {l.loteamento ? ` · ${l.loteamento.nome}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatDate(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <CardLink href="/admin/leads" texto="Abrir CRM" />
        </Card>

        <Card titulo="Vendas recentes" sub="últimos contratos">
          {vendasRecentes.length === 0 ? (
            <Empty texto="Nenhuma venda registrada." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 -my-1">
              {vendasRecentes.map((v) => (
                <li key={v.id} className="py-2.5 flex items-center gap-3">
                  <Link href={`/admin/vendas/${v.id}`} className="min-w-0 flex-1 group">
                    <p className="text-sm text-slate-900 dark:text-slate-100 truncate font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300">
                      #{v.numero} · {v.cliente.nome}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lote <span className="font-mono">{v.lote.codigo}</span> ·{' '}
                      {formatDate(v.dataContrato)}
                    </p>
                  </Link>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatBRL(Number(v.valorTotal))}
                    </p>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        v.status === 'QUITADA'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : v.status === 'INADIMPLENTE'
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                            : v.status === 'ATIVA'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <CardLink href="/admin/vendas" texto="Ver todas as vendas" />
        </Card>
      </div>

      {/* Inventário resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Loteamentos" value={loteamentosCount} />
        <MiniStat label="Lotes totais" value={totalLotes} />
        <MiniStat label="Vendas ativas" value={vendasAtivas} />
        <MiniStat
          label="Total contratado"
          value={formatBRL(Number(totalContratado._sum.valorTotal ?? 0))}
          isText
        />
      </div>

      {comissaoTotal > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Comissão prevista a pagar aos corretores:{' '}
          <strong className="text-slate-700 dark:text-slate-300">
            {formatBRL(comissaoTotal)}
          </strong>
        </p>
      )}
    </div>
  );
}

// ============ Componentes de apresentação ============

function KpiCard({
  label,
  valor,
  sub,
  trend,
  danger,
  accent,
  icon,
}: {
  label: string;
  valor: string;
  sub?: string;
  trend?: number;
  danger?: boolean;
  accent?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
          {label}
        </p>
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: danger ? 'rgba(220,38,38,0.12)' : `${accent ?? '#6366f1'}22` }}
        >
          <svg
            className="w-[18px] h-[18px]"
            fill="none"
            stroke={danger ? '#ef4444' : accent ?? '#6366f1'}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            {icon}
          </svg>
        </span>
      </div>
      <p
        className={`text-2xl font-bold mt-2 ${
          danger ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {valor}
      </p>
      {trend !== undefined ? (
        <p className="text-xs mt-1 flex items-center gap-1">
          <span
            className={`font-semibold ${
              trend >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-slate-400 dark:text-slate-500">vs mês anterior</span>
        </p>
      ) : (
        sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
      )}
    </div>
  );
}

function Card({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

function CardLink({ href, texto }: { href: string; texto: string }) {
  return (
    <Link
      href={href}
      className="block text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 transition-colors"
    >
      {texto} →
    </Link>
  );
}

function Empty({ texto }: { texto: string }) {
  return <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">{texto}</p>;
}

function MiniStat({
  label,
  value,
  isText,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p
        className={`font-bold text-slate-900 dark:text-slate-100 leading-none ${
          isText ? 'text-lg' : 'text-3xl'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{label}</p>
    </div>
  );
}
