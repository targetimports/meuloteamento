import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function CorretoresPage() {
  const corretores = await prisma.corretor.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: { _count: { select: { vendas: true, leads: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Corretores</h1>
          <p className="text-sm text-slate-500">Equipe comercial e percentuais de comissão.</p>
        </div>
        <Link
          href="/admin/corretores/novo"
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Novo corretor
        </Link>
      </div>

      {corretores.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">Nenhum corretor cadastrado.</p>
          <Link
            href="/admin/corretores/novo"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Cadastrar o primeiro
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Contato</th>
                <th className="text-left px-4 py-3">Comissão</th>
                <th className="text-left px-4 py-3">Vendas</th>
                <th className="text-left px-4 py-3">Leads</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {corretores.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.nome}</div>
                    {c.creci && <div className="text-xs text-slate-500">CRECI: {c.creci}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{c.email}</div>
                    {c.telefone && <div className="text-xs text-slate-500">{c.telefone}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{Number(c.comissaoPadrao).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-slate-700">{c._count.vendas}</td>
                  <td className="px-4 py-3 text-slate-700">{c._count.leads}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        c.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.ativo ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/corretores/${c.id}`}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
