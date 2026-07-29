import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatDate } from '@/lib/format';
import { ComissaoActions } from '@/components/ComissaoActions';

export const dynamic = 'force-dynamic';

const STATUS_BG: Record<string, string> = {
  BLOQUEADA: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  LIBERADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PAGA: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  CANCELADA: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
};

const STATUS_ICON: Record<string, string> = {
  BLOQUEADA: '🔒',
  LIBERADA: '✓',
  PAGA: '💰',
  CANCELADA: '✕',
};

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: { status?: string; corretor?: string };
}) {
  const tid = await tenantId();
  const statusFiltro = searchParams.status;
  const corretorFiltro = searchParams.corretor;

  const tenantWhere = tid
    ? { venda: { lote: { loteamento: { loteadoraId: tid } } } }
    : {};

  const where = {
    ...tenantWhere,
    ...(statusFiltro
      ? { status: statusFiltro as 'BLOQUEADA' | 'LIBERADA' | 'PAGA' | 'CANCELADA' }
      : {}),
    ...(corretorFiltro ? { corretorId: corretorFiltro } : {}),
  };

  // Resumo (totalizadores por status)
  const totaisRaw = await prisma.comissaoParcela.groupBy({
    by: ['status'],
    where: tenantWhere,
    _sum: { valor: true },
    _count: true,
  });
  const totais = {
    BLOQUEADA: { count: 0, valor: 0 },
    LIBERADA: { count: 0, valor: 0 },
    PAGA: { count: 0, valor: 0 },
    CANCELADA: { count: 0, valor: 0 },
  };
  for (const t of totaisRaw) {
    totais[t.status] = { count: t._count, valor: Number(t._sum.valor ?? 0) };
  }

  // Lista detalhada
  const comissoes = await prisma.comissaoParcela.findMany({
    where,
    include: {
      corretor: { select: { id: true, nome: true } },
      conta: { select: { id: true, nome: true, tipo: true } },
      parcelaCliente: {
        select: { numero: true, tipo: true, status: true, vencimento: true, pagoEm: true },
      },
      venda: {
        select: {
          id: true,
          numero: true,
          status: true,
          cliente: { select: { nome: true } },
          lote: { select: { codigo: true, tipo: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  // Contas para os modais de pagamento
  const contas = await prisma.contaFinanceira.findMany({
    where: tid ? { loteadoraId: tid } : {},
    select: { id: true, nome: true, tipo: true },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
  });

  // Corretores únicos pra filtro
  const corretoresUnicos = Array.from(
    new Map(comissoes.map((c) => [c.corretor.id, c.corretor])).values()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Comissões
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pagamentos parcelados aos corretores (R$ 2.500/lote residencial em 4 parcelas).
          </p>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['BLOQUEADA', 'LIBERADA', 'PAGA', 'CANCELADA'] as const).map((s) => (
          <Link
            key={s}
            href={
              statusFiltro === s
                ? '/admin/comissoes'
                : `/admin/comissoes?status=${s}`
            }
            className={`p-4 rounded-lg border ${
              statusFiltro === s
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            } transition-colors`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {STATUS_ICON[s]} {s}
              </span>
              <span className="text-lg">{totais[s].count}</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatBRL(totais[s].valor)}
            </p>
          </Link>
        ))}
      </div>

      {/* Filtro por corretor */}
      {corretoresUnicos.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Corretor:
          </span>
          <Link
            href={`/admin/comissoes${statusFiltro ? `?status=${statusFiltro}` : ''}`}
            className={`px-3 py-1 text-xs rounded-full ${
              !corretorFiltro
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            Todos
          </Link>
          {corretoresUnicos.map((co) => (
            <Link
              key={co.id}
              href={`/admin/comissoes?corretor=${co.id}${statusFiltro ? `&status=${statusFiltro}` : ''}`}
              className={`px-3 py-1 text-xs rounded-full ${
                corretorFiltro === co.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              {co.nome}
            </Link>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {comissoes.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Nenhuma comissão{statusFiltro ? ` com status ${statusFiltro}` : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Corretor</th>
                  <th className="text-left px-3 py-2">Venda / Lote</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-center px-3 py-2">Parc.</th>
                  <th className="text-left px-3 py-2">Vínculo</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {comissoes.map((c) => (
                  <tr key={c.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {c.corretor.nome}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/vendas/${c.venda.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        #{c.venda.numero}
                      </Link>
                      <span className="text-slate-500 dark:text-slate-400 text-xs ml-1">
                        · {c.venda.lote.codigo}
                        {c.venda.lote.tipo === 'RESIDENCIAL' ? ' 🏠' : ' 🏢'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 text-xs">
                      {c.venda.cliente.nome}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">
                      {c.numero}/4
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                      {c.parcelaCliente ? (
                        <>
                          {c.parcelaCliente.tipo}
                          {c.parcelaCliente.tipo === 'MENSAL' &&
                            ` ${c.parcelaCliente.numero}`}
                          <br />
                          <span
                            className={
                              c.parcelaCliente.status === 'PAGO'
                                ? 'text-emerald-600'
                                : 'text-slate-500'
                            }
                          >
                            {c.parcelaCliente.status}
                            {c.parcelaCliente.pagoEm &&
                              ` em ${formatDate(c.parcelaCliente.pagoEm)}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatBRL(Number(c.valor))}
                      {c.valorPago && Number(c.valorPago) !== Number(c.valor) && (
                        <div className="text-xs text-slate-500">
                          pago: {formatBRL(Number(c.valorPago))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${STATUS_BG[c.status]}`}
                      >
                        {STATUS_ICON[c.status]} {c.status}
                      </span>
                      {c.pagaEm && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatDate(c.pagaEm)}
                        </div>
                      )}
                      {c.conta && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          via {c.conta.nome}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ComissaoActions
                        comissaoId={c.id}
                        status={c.status}
                        valorSugerido={Number(c.valor)}
                        contas={contas}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
