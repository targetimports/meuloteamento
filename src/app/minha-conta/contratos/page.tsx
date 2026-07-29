import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contratos — meuloteamento' };

export default async function ContratosPage() {
  const session = await getClienteSession();
  if (!session) redirect('/minha-conta/login');

  const vendas = await prisma.venda.findMany({
    where: { clienteId: session.sub },
    include: { lote: { include: { loteamento: true } } },
    orderBy: { dataContrato: 'desc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Contratos</h1>
      {vendas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum contrato encontrado.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {vendas.map((v) => (
            <Link
              key={v.id}
              href={`/minha-conta/contratos/${v.id}`}
              className="block px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    Venda #{v.numero} — Lote {v.lote.codigo}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.lote.loteamento.nome} · {formatDate(v.dataContrato)}
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {v.contratoStatus}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
