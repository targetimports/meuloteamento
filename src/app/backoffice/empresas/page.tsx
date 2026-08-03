/**
 * Empresas-cliente: quem usa a plataforma, em que plano, pagando quanto.
 *
 * A contagem de uso (loteamentos, lotes, usuários) vem junto porque é a
 * pergunta que sempre aparece na renovação: "esse cliente está usando o que
 * contratou?".
 */

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl } from '@/lib/backoffice';

export const dynamic = 'force-dynamic';

export default async function EmpresasPage() {
  await requireBackoffice();

  const empresas = await prisma.loteadora.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      cnpj: true,
      cidade: true,
      estado: true,
      ativo: true,
      createdAt: true,
      _count: { select: { loteamentos: true, adminUsers: true, corretores: true } },
      assinatura: {
        select: {
          status: true,
          valorMensal: true,
          diaVencimento: true,
          bloqueioManual: true,
          plano: { select: { nome: true } },
        },
      },
    },
  });

  // Uma query só para os lotes de todas as empresas, em vez de uma por linha.
  const lotesPorLoteadora = await prisma.lote.groupBy({
    by: ['loteamentoId'],
    _count: { _all: true },
  });
  const loteamentos = await prisma.loteamento.findMany({
    select: { id: true, loteadoraId: true },
  });
  const mapaLotes = new Map<string, number>();
  for (const l of loteamentos) {
    const qtd = lotesPorLoteadora.find((x) => x.loteamentoId === l.id)?._count._all ?? 0;
    mapaLotes.set(l.loteadoraId, (mapaLotes.get(l.loteadoraId) ?? 0) + qtd);
  }

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Empresas-cliente</h1>
          <span className="text-sm text-slate-500">{empresas.length} cadastrada(s)</span>
        </div>
        <Link
          href="/backoffice/empresas/nova"
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
        >
          + Nova empresa
        </Link>
      </header>

      <div className="p-8">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {empresas.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Nenhuma empresa cadastrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-5 py-3">Empresa</th>
                    <th className="text-left font-medium px-5 py-3">Plano</th>
                    <th className="text-right font-medium px-5 py-3">Mensalidade</th>
                    <th className="text-right font-medium px-5 py-3">Uso</th>
                    <th className="text-right font-medium px-5 py-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {empresas.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3">
                        <Link
                          href={`/backoffice/empresas/${e.id}`}
                          className="font-medium text-slate-900 hover:text-primary-600"
                        >
                          {e.nome}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {[e.cidade, e.estado].filter(Boolean).join('/') || 'sem cidade'}
                          {e.cnpj ? ` · ${e.cnpj}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {e.assinatura?.plano?.nome ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                        {e.assinatura ? (
                          <>
                            {brl(e.assinatura.valorMensal)}
                            <span className="block text-xs text-slate-400">
                              dia {e.assinatura.diaVencimento}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500">
                        {e._count.loteamentos} loteam. · {mapaLotes.get(e.id) ?? 0} lotes
                        <span className="block">
                          {e._count.adminUsers} usuário(s) · {e._count.corretores} corretor(es)
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Situacao assinatura={e.assinatura} empresaAtiva={e.ativo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-slate-500">
          Empresa sem assinatura cadastrada opera normalmente — nada é cobrado e
          nada é bloqueado.
        </p>
      </div>
    </div>
  );
}

function Situacao({
  assinatura,
  empresaAtiva,
}: {
  assinatura: { status: string; bloqueioManual: boolean } | null;
  empresaAtiva: boolean;
}) {
  if (!empresaAtiva) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-600">
        Empresa inativa
      </span>
    );
  }
  if (!assinatura) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
        Sem assinatura
      </span>
    );
  }
  if (assinatura.bloqueioManual) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
        Bloqueio manual
      </span>
    );
  }
  const mapa: Record<string, { txt: string; cls: string }> = {
    TRIAL: { txt: 'Em teste', cls: 'bg-sky-50 text-sky-700' },
    ATIVA: { txt: 'Ativo', cls: 'bg-emerald-50 text-emerald-700' },
    INADIMPLENTE: { txt: 'Em atraso', cls: 'bg-amber-50 text-amber-700' },
    BLOQUEADA: { txt: 'Bloqueado', cls: 'bg-red-50 text-red-700' },
    CANCELADA: { txt: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  };
  const s = mapa[assinatura.status] ?? {
    txt: assinatura.status,
    cls: 'bg-slate-100 text-slate-600',
  };
  return <span className={`text-xs px-2 py-1 rounded-full ${s.cls}`}>{s.txt}</span>;
}
