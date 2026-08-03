/**
 * Usuários de acesso de uma empresa-cliente.
 *
 * Mesma capacidade da tela equivalente em /admin/loteadoras, que continua lá
 * para o admin da própria empresa gerir a equipe dele. Esta é a visão do
 * provedor — daí o texto falar em "empresa" e não em "sua loteadora".
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { NovoUsuarioForm } from '@/components/NovoUsuarioForm';
import { ListaUsuariosLoteadora } from '@/components/ListaUsuariosLoteadora';
import { criarUsuario, resetarSenha, alternarAtivo, excluirUsuario } from './actions';

export const dynamic = 'force-dynamic';

export default async function UsuariosEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireBackoffice();
  const { id } = await params;

  const empresa = await prisma.loteadora.findUnique({
    where: { id },
    select: { id: true, nome: true },
  });
  if (!empresa) notFound();

  const usuarios = await prisma.adminUser.findMany({
    where: { loteadoraId: empresa.id },
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

  const criarAction = criarUsuario.bind(null, empresa.id);

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <Link
          href={`/backoffice/empresas/${empresa.id}`}
          className="text-xs text-slate-500 hover:underline"
        >
          ← {empresa.nome}
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 mt-1">
          Usuários — {empresa.nome}
        </h1>
      </header>

      <div className="p-8 space-y-6 max-w-5xl">
        <p className="text-sm text-slate-500">
          Quem pode entrar no sistema por esta empresa. Cada um enxerga apenas
          os dados dela.
        </p>

        <NovoUsuarioForm action={criarAction} />

        <section>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Usuários cadastrados ({usuarios.length})
          </h2>
          <ListaUsuariosLoteadora
            loteadoraId={empresa.id}
            usuarios={usuarios}
            meuId={session.sub}
            resetSenhaAction={resetarSenha}
            toggleAtivoAction={alternarAtivo}
            excluirAction={excluirUsuario}
          />
        </section>

        <section className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900 mb-1">Sobre o acesso</p>
          <ul className="space-y-1 list-disc list-inside text-slate-600">
            <li>Estes usuários só enxergam dados desta empresa</li>
            <li>Não veem outras empresas, o backoffice, nem a configuração da plataforma</li>
            <li>
              Papéis: <strong>Admin</strong> (tudo), <strong>Operador</strong>{' '}
              (operação) e <strong>Financeiro</strong> (vendas e parcelas)
            </li>
            <li>A senha gerada aparece uma única vez — copie na hora</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
