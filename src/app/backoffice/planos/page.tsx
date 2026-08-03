/**
 * Planos da plataforma.
 *
 * Os planos vivem também como texto na landing, e o Interessado guarda o
 * nome escolhido como string livre. Aqui eles existem como dado, para a
 * assinatura poder apontar para um preço de verdade.
 *
 * Esta tela NÃO altera a landing — os dois coexistem até alguém decidir
 * ligar um no outro.
 */

import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl } from '@/lib/backoffice';
import { salvarPlano, alternarPlanoAtivo, criarPlanosDaLanding } from './actions';
import { ModalPlano } from './ModalPlano';

export const dynamic = 'force-dynamic';

export default async function PlanosPage() {
  await requireBackoffice();

  const planos = await prisma.plano.findMany({
    orderBy: [{ ordem: 'asc' }, { valorMensal: 'asc' }],
    include: { _count: { select: { assinaturas: true } } },
  });

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Planos</h1>
          {planos.length > 0 && (
            <span className="text-sm text-slate-500">
              {planos.length} cadastrado(s)
            </span>
          )}
        </div>
        <ModalPlano action={salvarPlano} />
      </header>

      <div className="p-8">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {planos.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">Nenhum plano cadastrado ainda.</p>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                Sem plano, a assinatura de uma empresa fica sem a que se vincular.
              </p>
              <form action={criarPlanosDaLanding}>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
                >
                  Criar os planos da landing (Profissional e Empresarial)
                </button>
              </form>
              <p className="text-[11px] text-slate-400 mt-3">
                Ou use “Cadastrar plano” acima para criar um do zero.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-5 py-3">Plano</th>
                    <th className="text-right font-medium px-5 py-3">Mensalidade</th>
                    <th className="text-left font-medium px-5 py-3">Limites</th>
                    <th className="text-right font-medium px-5 py-3">Assinantes</th>
                    <th className="text-center font-medium px-5 py-3">Situação</th>
                    <th className="text-right font-medium px-5 py-3 w-20">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {planos.map((p) => {
                    const limites = [
                      p.maxLoteamentos != null ? `${p.maxLoteamentos} loteamentos` : null,
                      p.maxLotes != null ? `${p.maxLotes} lotes` : null,
                      p.maxUsuarios != null ? `${p.maxUsuarios} usuários` : null,
                    ].filter(Boolean);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900">{p.nome}</p>
                          {p.descricao && (
                            <p className="text-xs text-slate-500 mt-0.5">{p.descricao}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {brl(p.valorMensal)}
                          </span>
                          <span className="text-xs text-slate-400">/mês</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {limites.length === 0 ? (
                            <span className="text-xs text-slate-400">Sem limite</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {limites.map((l) => (
                                <span
                                  key={l}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                                >
                                  {l}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">
                          {p._count.assinaturas}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {/* Clicar alterna: é a ação mais frequente aqui e não
                              merece um caminho de dois passos. */}
                          <form
                            action={async () => {
                              'use server';
                              await alternarPlanoAtivo(p.id);
                            }}
                          >
                            <button
                              type="submit"
                              title={
                                p.ativo
                                  ? 'Disponível para contratação — clique para ocultar'
                                  : 'Oculto — clique para disponibilizar'
                              }
                              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset transition ${
                                p.ativo
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 ring-slate-500/20 hover:bg-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  p.ativo ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              {p.ativo ? 'Ativo' : 'Inativo'}
                            </button>
                          </form>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <ModalPlano
                            action={salvarPlano}
                            variante="linha"
                            plano={{
                              id: p.id,
                              nome: p.nome,
                              descricao: p.descricao,
                              // Decimal do Prisma não atravessa para o cliente;
                              // vira string aqui, onde ainda é servidor.
                              valorMensal: String(p.valorMensal),
                              maxLoteamentos: p.maxLoteamentos,
                              maxLotes: p.maxLotes,
                              maxUsuarios: p.maxUsuarios,
                              ativo: p.ativo,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {planos.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">
            Plano inativo deixa de aparecer para novas contratações, mas as
            assinaturas que já o usam seguem intactas.
          </p>
        )}
      </div>
    </div>
  );
}
