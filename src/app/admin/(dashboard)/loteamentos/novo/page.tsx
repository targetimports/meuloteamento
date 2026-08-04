import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { LoteamentoForm } from '@/components/LoteamentoForm';
import { criarLoteamento } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NovoLoteamentoPage() {
  const session = await requireAdmin();

  // O select listava TODAS as loteadoras ativas. Com um cliente só isso não
  // aparecia; com dois, o admin de uma empresa passou a ver o nome da outra —
  // e podia escolhê-la. Aqui cada um vê apenas a própria; o super admin, que
  // não tem loteadoraId, continua vendo todas para poder operar por qualquer
  // uma.
  const loteadoras = await prisma.loteadora.findMany({
    where: {
      ativo: true,
      ...(session.loteadoraId ? { id: session.loteadoraId } : {}),
    },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });

  // Sem loteadoras → redireciona p/ cadastrá-las primeiro
  if (loteadoras.length === 0) {
    redirect('/admin/loteadoras/novo');
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/loteamentos" className="text-sm text-slate-500 hover:text-slate-700">
          ← Loteamentos
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Novo loteamento</h1>
      </div>

      <LoteamentoForm
        action={criarLoteamento}
        submitLabel="Criar loteamento"
        loteadoras={loteadoras}
      />
    </div>
  );
}
