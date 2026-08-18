import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatDate } from '@/lib/format';
import ImportarParqueTucanoBtn from './ImportarParqueTucanoBtn';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contratos — Admin' };

/** Amostra do que dá para interpolar, para não abrir a documentação por isso. */
const VARIAVEIS = ['{{cliente.nome}}', '{{lote.matricula}}', '{{venda.valorTotalExtenso}}'];

export default async function ContratosAdminPage() {
  const tid = await tenantId();

  const templates = await prisma.contratoTemplate.findMany({
    where: tid ? { loteadoraId: tid } : {},
    orderBy: [{ default: 'desc' }, { updatedAt: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Modelos de contrato</h1>
          <p className="mt-1 text-sm text-slate-500">
            O HTML do modelo aceita variáveis, trocadas pelos dados da venda na hora de gerar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tid && <ImportarParqueTucanoBtn />}
          <Link
            href="/admin/contratos/novo"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Novo modelo
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-medium text-slate-500">Por exemplo:</span>
        {VARIAVEIS.map((v) => (
          <code
            key={v}
            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700"
          >
            {v}
          </code>
        ))}
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-medium text-slate-900">Nenhum modelo cadastrado</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            Com um modelo cadastrado, o contrato de cada venda sai pronto a partir dos dados já
            preenchidos — sem copiar e colar nome, CPF e valores.
          </p>
          <Link
            href="/admin/contratos/novo"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Modelo</th>
                  <th className="px-4 py-3 text-left font-semibold">Atualizado</th>
                  <th className="px-4 py-3 text-left font-semibold">Situação</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    className={`transition-colors hover:bg-slate-50 ${t.ativo ? '' : 'opacity-60'}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/contratos/${t.id}`}
                        className="font-medium text-slate-900 hover:text-primary-600"
                      >
                        {t.nome}
                      </Link>
                      {t.default && (
                        <span
                          className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                          title="Usado quando a venda não escolhe outro modelo"
                        >
                          Padrão
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          t.ativo
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                        }`}
                      >
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/contratos/${t.id}`}
                        className="text-sm font-medium text-primary-600 hover:opacity-80"
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
