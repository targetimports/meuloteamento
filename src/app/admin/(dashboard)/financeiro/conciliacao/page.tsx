import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conciliação — Financeiro' };

interface Search {
  desde?: string;
  ate?: string;
  conta?: string;
}

export default async function ConciliacaoPage({ searchParams }: { searchParams: Search }) {
  const tid = await tenantId();

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const desde = searchParams.desde ? new Date(searchParams.desde) : inicioMes;
  const ate = searchParams.ate ? new Date(searchParams.ate) : hoje;

  const contas = tid
    ? await prisma.contaFinanceira.findMany({
        where: { loteadoraId: tid, ativa: true },
        orderBy: { ordem: 'asc' },
      })
    : [];

  const where = {
    pagoEm: { gte: desde, lte: ate },
    status: 'PAGO' as const,
    ...(tid ? { venda: { lote: { loteamento: { loteadoraId: tid } } } } : {}),
    ...(searchParams.conta ? { contaId: searchParams.conta } : {}),
  };

  const parcelas = await prisma.parcela.findMany({
    where,
    include: {
      conta: true,
      venda: { include: { cliente: true, lote: true } },
    },
    orderBy: { pagoEm: 'desc' },
  });

  const totalPorConta = parcelas.reduce<Record<string, number>>((acc, p) => {
    const key = p.conta?.nome ?? '(sem conta)';
    acc[key] = (acc[key] ?? 0) + Number(p.valorPago ?? p.valor);
    return acc;
  }, {});

  const totalGeral = Object.values(totalPorConta).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Conciliação financeira</h1>
        <p className="text-sm text-slate-500">
          Total recebido por conta em um período.
        </p>
      </div>

      <form className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">De</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde.toISOString().slice(0, 10)}
            className="border border-slate-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Até</label>
          <input
            type="date"
            name="ate"
            defaultValue={ate.toISOString().slice(0, 10)}
            className="border border-slate-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Conta</label>
          <select
            name="conta"
            defaultValue={searchParams.conta ?? ''}
            className="border border-slate-300 rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <button className="bg-sky-600 hover:bg-sky-700 text-white text-sm px-3 py-1.5 rounded">
          Filtrar
        </button>
        <Link
          href={`/api/admin/parcelas/export?status=PAGO&desde=${desde.toISOString().slice(0, 10)}&ate=${ate.toISOString().slice(0, 10)}`}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-3 py-1.5 rounded"
        >
          Exportar CSV
        </Link>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="text-xs uppercase text-emerald-700 font-semibold">Total recebido</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{formatBRL(totalGeral)}</div>
          <div className="text-xs text-emerald-700 mt-1">
            {parcelas.length} parcela{parcelas.length !== 1 ? 's' : ''}
          </div>
        </div>
        {Object.entries(totalPorConta).map(([nome, valor]) => (
          <div key={nome} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs uppercase text-slate-500">{nome}</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{formatBRL(valor)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Pago em</th>
              <th className="px-3 py-2">Venda</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Lote</th>
              <th className="px-3 py-2">Parcela</th>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parcelas.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-xs">{p.pagoEm ? formatDate(p.pagoEm) : '—'}</td>
                <td className="px-3 py-2 text-xs">
                  <Link
                    href={`/admin/vendas/${p.venda.id}`}
                    className="text-sky-600 hover:underline"
                  >
                    #{p.venda.numero}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">{p.venda.cliente.nome}</td>
                <td className="px-3 py-2 text-xs">{p.venda.lote.codigo}</td>
                <td className="px-3 py-2 text-xs">{p.numero}</td>
                <td className="px-3 py-2 text-xs">{p.conta?.nome ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-right font-medium">
                  {formatBRL(Number(p.valorPago ?? p.valor))}
                </td>
              </tr>
            ))}
            {parcelas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500 text-sm">
                  Nenhum recebimento no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
