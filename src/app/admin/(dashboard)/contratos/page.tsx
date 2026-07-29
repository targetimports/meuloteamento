import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatDate } from '@/lib/format';
import ImportarParqueTucanoBtn from './ImportarParqueTucanoBtn';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contratos — Admin' };

export default async function ContratosAdminPage() {
  const tid = await tenantId();

  const templates = await prisma.contratoTemplate.findMany({
    where: tid ? { loteadoraId: tid } : {},
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Modelos de contrato</h1>
          <p className="text-sm text-slate-500 mt-1">
            Use variáveis como{' '}
            <code className="bg-slate-100 px-1 rounded">{`{{cliente.nome}}`}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{`{{lote.matricula}}`}</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">{`{{venda.valorTotalExtenso}}`}</code>{' '}
            no HTML.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Link
            href="/admin/contratos/novo"
            className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-3 py-2 rounded"
          >
            Novo modelo
          </Link>
          {tid && <ImportarParqueTucanoBtn />}
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500">
          Nenhum modelo cadastrado. Crie um modelo para gerar contratos automaticamente nas
          vendas.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/admin/contratos/${t.id}`}
              className="block px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    {t.nome}{' '}
                    {t.default && (
                      <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                        padrão
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Atualizado em {formatDate(t.updatedAt)}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    t.ativo
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.ativo ? 'ativo' : 'inativo'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
