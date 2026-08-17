import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { LotesReservados } from '@/components/vendas/LotesReservados';
import { formatBRL, formatDate } from '@/lib/format';
import { ReservaRapidaForm } from '@/components/ReservaRapidaForm';
import { LiberarReservaButton } from '@/components/LiberarReservaButton';
import { EditarReservaButton } from '@/components/EditarReservaButton';
import { reservarLoteAdmin, liberarReservaAdmin, editarReservaAdmin } from './reserva-actions';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, string> = {
  ATIVA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  INADIMPLENTE: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  QUITADA: 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
  CANCELADA: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  DISTRATADA: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default async function VendasPage({
  searchParams,
}: {
  searchParams: { status?: string; msg?: string };
}) {
  const tid = await tenantId();
  const status = searchParams.status;
  const msg = searchParams.msg;

  const tenantWhere = tid ? { lote: { loteamento: { loteadoraId: tid } } } : {};
  const where = {
    ...(status ? { status: status as 'ATIVA' } : {}),
    ...tenantWhere,
  };

  const tenantLoteWhere = tid ? { loteamento: { loteadoraId: tid } } : {};
  const [lotesDisponiveis, lotesReservados] = await Promise.all([
    prisma.lote.findMany({
      where: { ...tenantLoteWhere, status: 'DISPONIVEL' },
      orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
      take: 300,
      select: {
        id: true,
        codigo: true,
        quadra: true,
        area: true,
        preco: true,
        tipo: true,
        loteamento: { select: { nome: true } },
      },
    }),
    prisma.lote.findMany({
      where: { ...tenantLoteWhere, status: 'RESERVADO' },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        codigo: true,
        quadra: true,
        area: true,
        preco: true,
        tipo: true,
        updatedAt: true,
        loteamento: { select: { nome: true } },
        historico: {
          where: { statusDepois: 'RESERVADO' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            motivo: true,
            createdAt: true,
            userType: true,
            user: { select: { email: true, nome: true } },
          },
        },
      },
    }),
  ]);
  const lotesOpts = lotesDisponiveis.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    quadra: l.quadra,
    area: Number(l.area),
    preco: Number(l.preco),
    tipo: l.tipo,
    loteamentoNome: l.loteamento.nome,
  }));

  const [vendas, stats, vendasParaParciais] = await Promise.all([
    prisma.venda.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        cliente: { select: { id: true, nome: true, cpfCnpj: true } },
        lote: {
          select: {
            id: true,
            codigo: true,
            loteamento: { select: { nome: true } },
          },
        },
        vendaLotes: {
          select: { id: true, ordem: true, lote: { select: { codigo: true } } },
          orderBy: { ordem: 'asc' },
        },
        corretor: { select: { nome: true } },
        parcelas: { select: { status: true } },
      },
    }),
    prisma.venda.groupBy({
      by: ['status'],
      where: tenantWhere,
      _count: { _all: true },
      _sum: { valorTotal: true },
    }),
    /**
     * Vendas em andamento (ATIVA/INADIMPLENTE) com parcelas detalhadas,
     * para calcular "parcialmente quitadas" e "total já recebido nessas vendas".
     * Sem `take` — precisa contar todas para os KPIs serem corretos.
     */
    prisma.venda.findMany({
      where: {
        ...tenantWhere,
        status: { in: ['ATIVA', 'INADIMPLENTE'] },
      },
      select: {
        id: true,
        valorTotal: true,
        vendaLotes: { select: { id: true } },
        parcelas: {
          select: { status: true, valor: true, valorPago: true },
        },
      },
    }),
  ]);

  const totalGeral = stats.reduce(
    (acc, s) => acc + (Number(s._sum.valorTotal) || 0),
    0
  );
  const totalAtivas = stats.find((s) => s.status === 'ATIVA');
  const totalQuitadas = stats.find((s) => s.status === 'QUITADA');
  const totalInadimplente = stats.find((s) => s.status === 'INADIMPLENTE');

  // ===== Parcialmente quitados (entrada paga, mas ainda há parcelas em aberto) =====
  // Critério: venda ATIVA/INADIMPLENTE com pelo menos 1 parcela PAGO E
  // pelo menos 1 parcela ainda em aberto (PENDENTE/ATRASADO).
  let qtdLotesParciais = 0;
  let valorContratadoParciais = 0;
  let valorJaRecebidoParciais = 0;
  for (const v of vendasParaParciais) {
    const temPaga = v.parcelas.some((p) => p.status === 'PAGO');
    const temAberta = v.parcelas.some(
      (p) => p.status === 'PENDENTE' || p.status === 'ATRASADO'
    );
    if (temPaga && temAberta) {
      // Conta lotes da venda (multi-lote contado por venda, somando o # de lotes)
      qtdLotesParciais += Math.max(1, v.vendaLotes.length);
      valorContratadoParciais += Number(v.valorTotal);
      for (const p of v.parcelas) {
        if (p.status === 'PAGO') {
          valorJaRecebidoParciais += Number(p.valorPago ?? p.valor);
        }
      }
    }
  }

  const filtros = [
    { value: '', label: `Todas (${stats.reduce((a, s) => a + s._count._all, 0)})` },
    { value: 'ATIVA', label: `Ativas (${totalAtivas?._count._all ?? 0})` },
    { value: 'INADIMPLENTE', label: `Inadimplentes (${totalInadimplente?._count._all ?? 0})` },
    { value: 'QUITADA', label: `Quitadas (${totalQuitadas?._count._all ?? 0})` },
    { value: 'CANCELADA', label: 'Canceladas' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Contratos firmados e status de cada um.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Os cartões continuam montados no servidor: eles trazem server actions
              dentro (editar e liberar reserva), e mover isso para o cliente exigiria
              reescrever os três botões. O modal só os envolve. */}
          <LotesReservados quantidade={lotesReservados.length}>
                {lotesReservados.map((l) => {
                  const h = l.historico[0];
                  const motivo = h?.motivo ?? '—';
                  const desde = h?.createdAt ?? l.updatedAt;
                  const responsavel = h?.user?.nome ?? h?.user?.email ?? 'sistema';
                  const dias = Math.floor(
                    (Date.now() - new Date(desde).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={l.id}
                      className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {l.codigo}
                            {l.tipo === 'COMERCIAL' && (
                              <span className="ml-1.5 text-[9px] px-1 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded font-semibold align-middle">
                                COMERCIAL
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Quadra {l.quadra} · {Number(l.area).toFixed(0)}m² · {l.loteamento.nome}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {formatBRL(Number(l.preco))}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2 leading-snug">
                        <p>
                          <span className="font-semibold">
                            {dias === 0 ? 'Hoje' : `Há ${dias}d`}
                          </span>
                          {' · por '}
                          <span className="font-mono">{responsavel}</span>
                        </p>
                        {motivo && motivo !== '—' && (
                          <p className="text-slate-500 dark:text-slate-500 mt-0.5 italic truncate" title={motivo}>
                            &ldquo;{motivo}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <Link
                          href={`/admin/vendas/novo?lote=${l.id}`}
                          className="text-xs bg-primary-600 hover:bg-primary-700 text-white font-semibold px-2.5 py-1 rounded inline-flex items-center gap-1"
                        >
                          Criar venda
                        </Link>
                        <EditarReservaButton
                          action={editarReservaAdmin}
                          loteId={l.id}
                          loteCodigo={l.codigo}
                          motivoAtual={motivo === '—' ? null : motivo}
                        />
                        <LiberarReservaButton
                          action={liberarReservaAdmin}
                          loteId={l.id}
                          loteCodigo={l.codigo}
                        />
                      </div>
                    </div>
                  );
                })}
          </LotesReservados>
          <ReservaRapidaForm lotes={lotesOpts} action={reservarLoteAdmin} />
          <Link
            href="/admin/vendas/novo"
            className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-sm"
          >
            + Nova venda
          </Link>
        </div>
      </div>

      {msg === 'criada' && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <span>Venda criada com sucesso.</span>
        </div>
      )}

      {msg === 'distratada' && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <span>
            Venda distratada com sucesso. O lote foi liberado e as parcelas em aberto canceladas.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
        <KPI label="Total contratado" valor={formatBRL(totalGeral)} highlight />
        <KPI
          label="Ativas"
          valor={formatBRL(Number(totalAtivas?._sum.valorTotal) || 0)}
          tint="text-emerald-600 dark:text-emerald-400"
        />
        <KPI
          label="Quitadas"
          valor={formatBRL(Number(totalQuitadas?._sum.valorTotal) || 0)}
          tint="text-primary-700 dark:text-primary-400"
        />
        <KPI
          label="Inadimplentes"
          valor={formatBRL(Number(totalInadimplente?._sum.valorTotal) || 0)}
          tint="text-red-600 dark:text-red-400"
        />
      </div>

      {/* KPIs — parcialmente quitadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <KPI
          label={`Lotes parcialmente quitados (${qtdLotesParciais})`}
          valor={formatBRL(valorContratadoParciais)}
          tint="text-amber-600 dark:text-amber-400"
        />
        <KPI
          label="Total já recebido (parciais)"
          valor={formatBRL(valorJaRecebidoParciais)}
          tint="text-emerald-700 dark:text-emerald-300"
        />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filtros.map((f) => {
          const active = (status ?? '') === f.value;
          return (
            <Link
              key={f.value}
              href={f.value ? `/admin/vendas?status=${f.value}` : '/admin/vendas'}
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

      {vendas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400">
          {status
            ? 'Nenhuma venda neste filtro.'
            : 'Nenhuma venda registrada ainda. Vendas aparecem aqui quando uma reserva é convertida.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Contrato</th>
                <th className="text-left px-4 py-3 font-semibold">Lote</th>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Valor</th>
                <th className="text-left px-4 py-3 font-semibold">Parcelas</th>
                <th className="text-left px-4 py-3 font-semibold">Corretor</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {vendas.map((v) => {
                const pagas = v.parcelas.filter((p) => p.status === 'PAGO').length;
                const total = v.parcelas.length;
                return (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
                        #{v.numero}
                        {v.origem === 'CHECKOUT_ONLINE' && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded font-bold uppercase tracking-wider shadow-sm inline-flex items-center gap-1"
                            title="Venda feita pelo próprio cliente no site (checkout online — sem corretor)"
                          >
                            Online
                          </span>
                        )}
                        {v.origem === 'IMPORTACAO' && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-semibold uppercase tracking-wider"
                            title="Venda importada de planilha/migração"
                          >
                            Importada
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(v.dataContrato)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
                        {v.lote.codigo}
                        {v.vendaLotes.length > 1 && (
                          <span
                            className="text-[9px] px-1 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded font-semibold"
                            title={v.vendaLotes.map((vl) => vl.lote.codigo).join(', ')}
                          >
                            +{v.vendaLotes.length - 1} lote(s)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {v.lote.loteamento.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-100">{v.cliente.nome}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        CPF {v.cliente.cpfCnpj}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatBRL(Number(v.valorTotal))}
                      </div>
                      {Number(v.valorEntrada) > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          + {formatBRL(Number(v.valorEntrada))} entrada
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 dark:text-slate-300 text-xs">
                        {pagas}/{total}
                      </div>
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: total > 0 ? `${(pagas / total) * 100}%` : '0%' }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                      {v.corretor?.nome ?? (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          STATUS_STYLES[v.status] ?? 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/vendas/${v.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:opacity-80 font-medium"
                      >
                        Detalhes →
                      </Link>
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
  highlight,
  tint,
}: {
  label: string;
  valor: string;
  highlight?: boolean;
  tint?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        highlight
          ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
      }`}
    >
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
    </div>
  );
}
