/**
 * Usuários de acesso de uma empresa-cliente.
 *
 * A tela equivalente em /admin/loteadoras continua existindo, para o admin
 * da própria empresa gerir a equipe dele. Esta é a visão do provedor — daí
 * falar em "empresa" e não em "sua loteadora".
 *
 * O formulário e a tabela são componentes próprios desta rota, não os de
 * /components: aqueles são compartilhados com a tela da Germanos, e as
 * mudanças de visual pedidas aqui não devem chegar lá.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { FormNovoUsuario } from './FormNovoUsuario';
import { TabelaUsuarios } from './TabelaUsuarios';
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
  const ativos = usuarios.filter((u) => u.ativo).length;

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <Link
          href={`/backoffice/empresas/${empresa.id}`}
          className="text-xs text-slate-500 hover:underline"
        >
          ← {empresa.nome}
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 mt-1">Usuários de acesso</h1>
      </header>

      {/* Largura total, como as outras telas do backoffice. O max-w-5xl que
          havia aqui deixava o conteúdo boiando dentro de um cabeçalho que ia
          de ponta a ponta. */}
      <div className="p-8 space-y-6">
        <p className="text-sm text-slate-500">
          Quem entra no sistema por <strong className="font-medium text-slate-700">{empresa.nome}</strong>.
          Cada um enxerga apenas os dados desta empresa — nunca os de outra, nem
          o backoffice.
        </p>

        <FormNovoUsuario action={criarAction} />

        <section>
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Usuários cadastrados</h2>
            <p className="text-xs text-slate-500">
              {usuarios.length} no total · {ativos} ativo(s)
            </p>
          </div>

          <TabelaUsuarios
            loteadoraId={empresa.id}
            usuarios={usuarios}
            meuId={session.sub}
            resetSenhaAction={resetarSenha}
            alternarAtivoAction={alternarAtivo}
            excluirAction={excluirUsuario}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Sobre os papéis</h2>
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="font-medium text-slate-900">Admin</dt>
              <dd className="text-xs text-slate-500 mt-0.5">
                Acesso total aos dados da empresa, incluindo configurações.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Operador</dt>
              <dd className="text-xs text-slate-500 mt-0.5">
                Operação do dia a dia: lotes, reservas e atendimento.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Financeiro</dt>
              <dd className="text-xs text-slate-500 mt-0.5">
                Vendas, parcelas e cobrança.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
