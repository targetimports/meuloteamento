import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { loteadoraAlvoId } from '@/lib/tenant';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Régua de cobrança — Admin' };

export default async function ReguaCobrancaPage() {
  const tid = await loteadoraAlvoId();
  if (!tid) {
    return (
      <div className="text-sm text-slate-500">
        Escolha uma loteadora em <strong>Loteadoras</strong> para configurar a régua de cobrança.
      </div>
    );
  }

  const loteadora = await prisma.loteadora.findUnique({
    where: { id: tid },
    select: { reguaCobrancaId: true, nome: true },
  });

  const reguas = await prisma.reguaCobranca.findMany({
    where: { loteadoraId: tid },
    include: { passos: { orderBy: { ordem: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Régua de cobrança</h1>
          <p className="text-sm text-slate-500">
            Configura quando e como avisar seus clientes sobre parcelas a vencer e atrasadas.
          </p>
        </div>
        <Link
          href="/admin/regua-cobranca/nova"
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-3 py-2 rounded"
        >
          Nova régua
        </Link>
      </div>

      {reguas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
          Nenhuma régua cadastrada. Crie uma para começar a automatizar cobranças.
        </div>
      ) : (
        <div className="space-y-3">
          {reguas.map((r) => (
            <Link
              key={r.id}
              href={`/admin/regua-cobranca/${r.id}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    {r.nome}{' '}
                    {loteadora?.reguaCobrancaId === r.id && (
                      <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                        em uso
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.passos.length} passo{r.passos.length !== 1 ? 's' : ''} · atualizada em{' '}
                    {formatDate(r.updatedAt)}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    r.ativa ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.ativa ? 'ativa' : 'inativa'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
