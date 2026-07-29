import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';
import { NovoUsuarioForm } from '@/components/NovoUsuarioForm';
import { ListaUsuariosLoteadora } from '@/components/ListaUsuariosLoteadora';
import {
  criarUsuarioLoteadora,
  resetarSenhaUsuario,
  toggleAtivoUsuario,
  excluirUsuarioLoteadora,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function UsuariosLoteadoraPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!(await canAccessLoteadora(params.id))) notFound();

  const loteadora = await prisma.loteadora.findUnique({
    where: { id: params.id },
    select: { id: true, nome: true, slug: true },
  });
  if (!loteadora) notFound();

  const usuarios = await prisma.adminUser.findMany({
    where: { loteadoraId: loteadora.id },
    orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true,
      ultimoLogin: true,
    },
  });

  const criarAction = criarUsuarioLoteadora.bind(null, loteadora.id);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link
          href={`/admin/loteadoras/${loteadora.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {loteadora.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Usuários — {loteadora.nome}</h1>
        <p className="text-sm text-slate-500">
          Usuários abaixo só conseguem ver e gerenciar o que pertence a esta loteadora.
        </p>
      </div>

      <NovoUsuarioForm action={criarAction} />

      <section>
        <h2 className="font-semibold text-slate-900 mb-3">
          Usuários cadastrados ({usuarios.length})
        </h2>
        <ListaUsuariosLoteadora
          loteadoraId={loteadora.id}
          usuarios={usuarios}
          meuId={session.sub}
          resetSenhaAction={resetarSenhaUsuario}
          toggleAtivoAction={toggleAtivoUsuario}
          excluirAction={excluirUsuarioLoteadora}
        />
      </section>

      <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900">
        <p className="font-semibold mb-1">💡 Como funciona o acesso</p>
        <ul className="space-y-1 text-blue-800 list-disc list-inside">
          <li>Usuários cadastrados aqui só enxergam dados desta loteadora</li>
          <li>Não veem outras loteadoras, configurações da plataforma ou usuários de outros tenants</li>
          <li>Papéis: <strong>Admin</strong> (tudo), <strong>Operador</strong> (operação) e <strong>Financeiro</strong> (vendas/parcelas)</li>
          <li>Resete a senha sempre que necessário — a nova só é mostrada uma vez</li>
        </ul>
      </section>
    </div>
  );
}
