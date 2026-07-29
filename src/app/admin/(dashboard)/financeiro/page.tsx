import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatDate } from '@/lib/format';
import { ParcelaActionButton } from '@/components/ParcelaActionButton';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { CobrancaPixRapida } from '@/components/CobrancaPixRapida';
import { RegerarPixButton } from '@/components/RegerarPixButton';
import { SincronizarAsaasButton } from '@/components/SincronizarAsaasButton';
import { msgCobrancaParcela } from '@/lib/whatsappMessages';
import { marcarParcelaPaga, reabrirParcela } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_BG: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  PAGO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ATRASADO: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  CANCELADO: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  ESTORNADO: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const tid = await tenantId();
  const statusFiltro = searchParams.status;

  const tenantWhere = tid
    ? { venda: { lote: { loteamento: { loteadoraId: tid } } } }
    : {};
  const where = {
    ...(statusFiltro ? { status: statusFiltro as 'PENDENTE' } : {}),
    ...tenantWhere,
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em30dias = new Date(hoje);
  em30dias.setDate(em30dias.getDate() + 30);

  const [parcelas, totaisPorStatus, totalAtrasadas, vencendoEm30dias] = await Promise.all([
    prisma.parcela.findMany({
      where,
      orderBy: [{ vencimento: 'asc' }],
      take: 200,
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

  const filtros = [
    {
      value: '',
      label: `Todas (${totaisPorStatus.reduce((a, s) => a + s._count._all, 0)})`,
    },
    { value: 'PENDENTE', label: `Pendentes (${totalPendente?._count._all ?? 0})` },
    { value: 'ATRASADO', label: `Atrasadas (${totalAtrasadas._count._all})` },
    { value: 'PAGO', label: `Pagas (${totalPago?._count._all ?? 0})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Financeiro</h1>
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
          icon="✓"
          highlight
        />
        <KPI
          label="A receber (pendentes)"
          valor={formatBRL(Number(totalPendente?._sum.valor) || 0)}
          tint="text-slate-700 dark:text-slate-200"
          icon="📅"
        />
        <KPI
          label="Atrasadas"
          valor={formatBRL(Number(totalAtrasadas._sum.valor) || 0)}
          sublabel={`${totalAtrasadas._count._all} parcela(s)`}
          tint="text-red-600 dark:text-red-400"
          icon="⚠"
        />
        <KPI
          label="Vencendo em 30 dias"
          valor={formatBRL(Number(vencendoEm30dias._sum.valor) || 0)}
          sublabel={`${vencendoEm30dias._count._all} parcela(s)`}
          tint="text-amber-600 dark:text-amber-400"
          icon="⏳"
        />
      </div>

      {/* Controle de cheques — só mostra se existir algum cheque cadastrado.
          Aguardando compensação = pré-datado pendente/atrasado (cai aqui na data do vencimento).
          Compensados = cheque que foi confirmado (status PAGO).
          Devolvidos = cheque que voltou (status ESTORNADO). */}
      {(chequesAguardando._count._all +
        chequesCompensados._count._all +
        chequesDevolvidos._count._all) > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 mb-6">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>🧾</span> Cheques
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Controle de cheques pré-datados — compensação, compensados e devoluções.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-bold">
                ⏳ Aguardando compensação
              </p>
              <p className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">
                {formatBRL(Number(chequesAguardando._sum.valor) || 0)}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {chequesAguardando._count._all} cheque(s) pré-datado(s)
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300 font-bold">
                ✓ Compensados
              </p>
              <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">
                {formatBRL(Number(chequesCompensados._sum.valor) || 0)}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {chequesCompensados._count._all} cheque(s) confirmados
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-red-700 dark:text-red-300 font-bold">
                ⚠ Devolvidos
              </p>
              <p className="text-2xl font-black text-red-900 dark:text-red-200 mt-1">
                {formatBRL(Number(chequesDevolvidos._sum.valor) || 0)}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                {chequesDevolvidos._count._all} cheque(s) sem fundos
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            💡 <strong>Como usar:</strong> Cheque pré-datado aparece no fluxo na <strong>data de vencimento</strong>.
            Para confirmar compensação, clique em <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded font-semibold">✓ Pago</span> na linha da parcela.
            Para devolução, abra a venda e estorne a parcela.
          </p>
        </section>
      )}

      {/* Saldos por conta */}
      {contas.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Saldos por conta</h2>
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
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {formatBRL(saldoTotalContas)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {contas.map((c) => {
              const mov = saldoMap.get(c.id) ?? 0;
              const saldo = Number(c.saldoInicial) + mov;
              const tipoIcon =
                c.tipo === 'ASAAS'
                  ? '⚡'
                  : c.tipo === 'CAIXA'
                    ? '💵'
                    : c.tipo === 'BANCO'
                      ? '🏦'
                      : '•';
              return (
                <div
                  key={c.id}
                  className={`bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border-t-4 ${
                    c.ativa ? '' : 'opacity-50'
                  }`}
                  style={{ borderTopColor: c.cor ?? '#94a3b8' }}
                >
                  <p
                    className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate"
                    title={c.nome}
                  >
                    {tipoIcon} {c.nome}
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
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

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filtros.map((f) => {
          const active = (statusFiltro ?? '') === f.value;
          return (
            <Link
              key={f.value}
              href={f.value ? `/admin/financeiro?status=${f.value}` : '/admin/financeiro'}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {parcelas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          {statusFiltro
            ? 'Nenhuma parcela neste filtro.'
            : 'Ainda não há parcelas geradas. Parcelas aparecem aqui quando uma venda é criada com financiamento.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                <th className="text-left px-4 py-3 font-semibold">Contrato / Lote</th>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Parcela</th>
                <th className="text-left px-4 py-3 font-semibold">Valor</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
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
                          className="mt-1 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 rounded inline-flex items-center gap-1 font-bold"
                          title={`Cheque${p.chequeNumero ? ' nº ' + p.chequeNumero : ''}${p.chequeBanco ? ' · ' + p.chequeBanco : ''}${p.chequeEmitente ? ' · emitente ' + p.chequeEmitente : ''}${p.chequePraca ? ' · ' + p.chequePraca : ''}`}
                        >
                          🧾 CHEQUE
                          {p.chequeNumero && <span>nº {p.chequeNumero}</span>}
                          {p.chequeBanco && <span>· {p.chequeBanco}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
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
                            label="✓ Pago"
                            confirmMsg={`Marcar parcela ${p.numero} (${formatBRL(Number(p.valor))}) como paga? Se for a última, a venda vira QUITADA.`}
                          />
                        )}
                        {p.status === 'PAGO' && (
                          <ParcelaActionButton
                            parcelaId={p.id}
                            action={reabrirParcela}
                            label="↺ Reabrir"
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
    </div>
  );
}

function KPI({
  label,
  valor,
  sublabel,
  tint,
  icon,
  highlight,
}: {
  label: string;
  valor: string;
  sublabel?: string;
  tint?: string;
  icon?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 relative overflow-hidden ${
        highlight
          ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
      }`}
    >
      {icon && <span className="absolute top-3 right-3 text-2xl opacity-50">{icon}</span>}
      <p
        className={`text-xs uppercase tracking-wider ${
          highlight ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {label}
      </p>
      <p
        className={`text-xl font-bold mt-1 ${
          highlight ? 'text-white' : tint ?? 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {valor}
      </p>
      {sublabel && (
        <p
          className={`text-xs mt-0.5 ${
            highlight ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}
