import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CorretorForm } from '@/components/CorretorForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { atualizarCorretor, excluirCorretor } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditCorretorPage({ params }: { params: { id: string } }) {
  const corretor = await prisma.corretor.findUnique({
    where: { id: params.id },
    include: { _count: { select: { vendas: true, leads: true } } },
  });
  if (!corretor) notFound();

  const updateAction = atualizarCorretor.bind(null, corretor.id);
  const deleteAction = async () => {
    'use server';
    await excluirCorretor(corretor.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/corretores" className="text-sm text-slate-500 hover:text-slate-700">
          ← Corretores
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{corretor.nome}</h1>
        <p className="text-sm text-slate-500">
          {corretor._count.vendas} venda(s) · {corretor._count.leads} lead(s)
        </p>
      </div>

      <CorretorForm
        action={updateAction}
        submitLabel="Salvar alterações"
        initial={{
          nome: corretor.nome,
          email: corretor.email,
          telefone: corretor.telefone,
          cpfCnpj: corretor.cpfCnpj,
          creci: corretor.creci,
          comissaoPadrao: Number(corretor.comissaoPadrao),
          ativo: corretor.ativo,
          observacoes: corretor.observacoes,
        }}
      />

      {corretor._count.vendas === 0 && (
        <section className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="font-semibold text-red-900 mb-1">Zona perigosa</h2>
          <p className="text-sm text-red-700 mb-3">
            Excluir o corretor é irreversível. Se já houver vendas vinculadas, prefira inativar.
          </p>
          <form action={deleteAction}>
            <ConfirmButton
              message="Excluir o corretor?"
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Excluir corretor
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}
