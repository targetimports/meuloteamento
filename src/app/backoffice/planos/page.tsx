/**
 * Planos da plataforma.
 *
 * Hoje os planos vivem como texto na landing (page.tsx) e o Interessado
 * guarda o nome escolhido como string livre. Aqui eles passam a existir como
 * dado, para a assinatura poder apontar para um preço de verdade.
 *
 * Esta tela NÃO altera a landing — os dois coexistem até você decidir ligar
 * um no outro.
 */

import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl } from '@/lib/backoffice';
import { salvarPlano, alternarPlanoAtivo } from './actions';

export const dynamic = 'force-dynamic';

export default async function PlanosPage() {
  await requireBackoffice();

  const planos = await prisma.plano.findMany({
    orderBy: [{ ordem: 'asc' }, { valorMensal: 'asc' }],
    include: { _count: { select: { assinaturas: true } } },
  });

  const campo =
    'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Planos</h1>
      </header>

      <div className="p-8 space-y-6">
        {/* ---------------- Lista ---------------- */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {planos.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Nenhum plano cadastrado. Crie o primeiro no formulário abaixo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-5 py-3">Plano</th>
                    <th className="text-right font-medium px-5 py-3">Mensalidade</th>
                    <th className="text-right font-medium px-5 py-3">Limites</th>
                    <th className="text-right font-medium px-5 py-3">Assinantes</th>
                    <th className="text-right font-medium px-5 py-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {planos.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{p.nome}</p>
                        {p.descricao && (
                          <p className="text-xs text-slate-500">{p.descricao}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {brl(p.valorMensal)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500">
                        {[
                          p.maxLoteamentos != null ? `${p.maxLoteamentos} loteam.` : null,
                          p.maxLotes != null ? `${p.maxLotes} lotes` : null,
                          p.maxUsuarios != null ? `${p.maxUsuarios} usuários` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'sem limite'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {p._count.assinaturas}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <form
                          action={async () => {
                            'use server';
                            await alternarPlanoAtivo(p.id);
                          }}
                        >
                          <button
                            type="submit"
                            className={`text-xs px-2.5 py-1 rounded-full transition ${
                              p.ativo
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------------- Novo plano ---------------- */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Novo plano</h2>
          <form action={salvarPlano} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="nome" className="block text-xs font-medium text-slate-600 mb-1">
                Nome *
              </label>
              <input id="nome" name="nome" required placeholder="Profissional" className={campo} />
            </div>
            <div>
              <label htmlFor="valorMensal" className="block text-xs font-medium text-slate-600 mb-1">
                Mensalidade (R$) *
              </label>
              <input
                id="valorMensal"
                name="valorMensal"
                required
                inputMode="decimal"
                placeholder="590,00"
                className={campo}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="ativo" defaultChecked className="rounded" />
                Ativo
              </label>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="descricao" className="block text-xs font-medium text-slate-600 mb-1">
                Descrição
              </label>
              <input
                id="descricao"
                name="descricao"
                placeholder="O escolhido por quem leva a sério"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="maxLoteamentos" className="block text-xs font-medium text-slate-600 mb-1">
                Máx. loteamentos
              </label>
              <input
                id="maxLoteamentos"
                name="maxLoteamentos"
                inputMode="numeric"
                placeholder="vazio = ilimitado"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="maxLotes" className="block text-xs font-medium text-slate-600 mb-1">
                Máx. lotes
              </label>
              <input
                id="maxLotes"
                name="maxLotes"
                inputMode="numeric"
                placeholder="vazio = ilimitado"
                className={campo}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
              >
                Criar plano
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
