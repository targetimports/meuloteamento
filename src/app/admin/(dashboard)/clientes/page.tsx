import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatCpfCnpj, formatPhone, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tid = await tenantId();
  const q = (searchParams.q ?? '').trim();

  const tenantWhere = tid
    ? {
        OR: [
          { vendas: { some: { lote: { loteamento: { loteadoraId: tid } } } } },
          { reservas: { some: { lote: { loteamento: { loteadoraId: tid } } } } },
        ],
      }
    : {};

  const searchWhere = q
    ? {
        OR: [
          { nome: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { cpfCnpj: { contains: q.replace(/\D/g, '') } },
          { telefone: { contains: q.replace(/\D/g, '') } },
        ],
      }
    : {};

  const where = q && tid ? { AND: [tenantWhere, searchWhere] } : tid ? tenantWhere : searchWhere;

  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      _count: { select: { vendas: true, reservas: true } },
      vendas: {
        where: tid ? { lote: { loteamento: { loteadoraId: tid } } } : {},
        select: { valorTotal: true, status: true },
      },
    },
  });

  const total = await prisma.cliente.count({ where });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Compradores e interessados {tid ? 'da sua loteadora' : 'da plataforma'}
            {' · '}
            <strong className="text-slate-700 dark:text-slate-300">{total}</strong> cadastrado(s)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <form>
            <div className="relative">
              <svg
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome, CPF, email..."
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-72"
              />
            </div>
          </form>
          <Link
            href="/admin/clientes/novo"
            className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>+</span> Novo cliente
          </Link>
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-2">👥</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {q
              ? 'Nenhum cliente encontrado pra esta busca.'
              : 'Ainda não há clientes cadastrados.'}
          </p>
          {!q && (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Clientes são criados automaticamente quando alguém preenche o formulário público,
                reserva um lote ou você cria uma venda. Você também pode cadastrar manualmente:
              </p>
              <Link
                href="/admin/clientes/novo"
                className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                + Cadastrar primeiro cliente
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">CPF / Contato</th>
                <th className="text-left px-4 py-3 font-semibold">Vendas</th>
                <th className="text-left px-4 py-3 font-semibold">Total comprado</th>
                <th className="text-left px-4 py-3 font-semibold">Cadastro</th>
                <th className="text-right px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clientes.map((c) => {
                const totalComprado = c.vendas.reduce(
                  (acc, v) => acc + Number(v.valorTotal),
                  0
                );
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {c.nome}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {formatCpfCnpj(c.cpfCnpj)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatPhone(c.telefone)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-100 font-semibold">
                        {c._count.vendas}
                      </div>
                      {c._count.reservas > 0 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {c._count.reservas} reserva(s)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {totalComprado > 0 ? formatBRL(totalComprado) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:opacity-80 font-medium text-sm"
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
