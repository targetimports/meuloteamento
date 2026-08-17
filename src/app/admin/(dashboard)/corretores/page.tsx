import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { whereLoteadora } from '@/lib/tenant';
import { formatPhone } from '@/lib/format';
import { TabelaCorretores, type CorretorLinha } from '@/components/corretores/TabelaCorretores';

export const dynamic = 'force-dynamic';

export default async function CorretoresPage() {
  const corretores = await prisma.corretor.findMany({
    // Sem este filtro cada loteadora enxergava a equipe de vendas das outras.
    where: await whereLoteadora(),
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: { _count: { select: { vendas: true, leads: true } } },
  });

  const linhas: CorretorLinha[] = corretores.map((c) => ({
    id: c.id,
    nome: c.nome,
    creci: c.creci,
    email: c.email,
    telefone: c.telefone ?? '',
    telefoneLabel: c.telefone ? formatPhone(c.telefone) : '',
    comissaoPadrao: Number(c.comissaoPadrao),
    vendas: c._count.vendas,
    leads: c._count.leads,
    ativo: c.ativo,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Corretores</h1>
          <p className="text-sm text-slate-500">Equipe comercial e percentuais de comissão.</p>
        </div>
        <Link
          href="/admin/corretores/novo"
          className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Novo corretor
        </Link>
      </div>

      <TabelaCorretores corretores={linhas} />
    </div>
  );
}
