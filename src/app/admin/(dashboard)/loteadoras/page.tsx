import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function LoteadorasListPage() {
  const tid = await tenantId();
  // Tenant admin: vai direto pro detalhe da sua loteadora
  if (tid) redirect(`/admin/loteadoras/${tid}`);

  const loteadoras = await prisma.loteadora.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: { _count: { select: { loteamentos: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Loteadoras</h1>
          <p className="text-sm text-slate-500">Clientes da plataforma — cada um com seus loteamentos e branding próprio.</p>
        </div>
        <Link
          href="/admin/loteadoras/novo"
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nova loteadora
        </Link>
      </div>

      {loteadoras.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">Nenhuma loteadora cadastrada.</p>
          <Link
            href="/admin/loteadoras/novo"
            className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Cadastrar a primeira
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-left px-4 py-3">Cidade/UF</th>
                <th className="text-left px-4 py-3">Loteamentos</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loteadoras.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {l.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.logo} alt="" className="w-8 h-8 rounded object-contain bg-slate-100" />
                      )}
                      <div>
                        <div className="font-medium text-slate-900">{l.nome}</div>
                        <div className="text-xs text-slate-500 font-mono">{l.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs font-mono">{l.cnpj ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {l.cidade && l.estado ? `${l.cidade} / ${l.estado}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l._count.loteamentos}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        l.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {l.ativo ? 'ativa' : 'inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/loteadoras/${l.id}`}
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
