import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function LoteamentosListPage() {
  const tid = await tenantId();
  const loteamentos = await prisma.loteamento.findMany({
    where: tid ? { loteadoraId: tid } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { lotes: true } },
      loteadora: { select: { id: true, nome: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Loteamentos</h1>
          <p className="text-sm text-slate-500">Gerencie os empreendimentos.</p>
        </div>
        <Link
          href="/admin/loteamentos/novo"
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Novo loteamento
        </Link>
      </div>

      {loteamentos.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">Nenhum loteamento cadastrado ainda.</p>
          <Link
            href="/admin/loteamentos/novo"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Loteadora</th>
                <th className="text-left px-4 py-3">Cidade/UF</th>
                <th className="text-left px-4 py-3">Lotes</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loteamentos.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{l.nome}</div>
                    <div className="text-xs text-slate-500 font-mono">{l.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l.loteadora.nome}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {l.cidade} / {l.estado}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l._count.lotes}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          l.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {l.ativo ? 'ativo' : 'inativo'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          l.publicado ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {l.publicado ? 'publicado' : 'rascunho'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/loteamentos/${l.id}`}
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
