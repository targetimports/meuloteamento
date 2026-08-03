/**
 * Usuários do backoffice — quem opera a plataforma.
 *
 * Lista apenas os de loteadoraId nulo. Os usuários de empresas-cliente têm
 * tela própria, na ficha de cada empresa: misturar os dois aqui daria uma
 * lista onde a diferença que mais importa (enxerga tudo × enxerga uma
 * empresa) viraria uma coluna fácil de ignorar.
 */

import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { GerenciarUsuarios } from './GerenciarUsuarios';
import {
  criarUsuarioBackoffice,
  atualizarUsuarioBackoffice,
  resetarSenhaBackoffice,
  alternarAtivoBackoffice,
  excluirUsuarioBackoffice,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function UsuariosBackofficePage() {
  const sessao = await requireBackoffice();

  const usuarios = await prisma.adminUser.findMany({
    where: { loteadoraId: null },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      ultimoLogin: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Usuários do backoffice</h1>
      </header>

      <div className="p-8 space-y-6">
        <p className="text-sm text-slate-500">
          Quem administra a plataforma. Estes usuários enxergam todas as
          empresas-cliente, as assinaturas e o financeiro — diferente dos
          usuários de uma empresa, que ficam restritos a ela.
        </p>

        <GerenciarUsuarios
          usuarios={usuarios.map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            ativo: u.ativo,
            ultimoLogin: u.ultimoLogin,
            criadoEm: u.createdAt,
          }))}
          meuId={sessao.sub}
          criarAction={criarUsuarioBackoffice}
          atualizarAction={atualizarUsuarioBackoffice}
          resetarSenhaAction={resetarSenhaBackoffice}
          alternarAtivoAction={alternarAtivoBackoffice}
          excluirAction={excluirUsuarioBackoffice}
        />

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900 mb-1">
            Sobre o último acesso ao backoffice
          </h2>
          <p className="text-xs text-amber-800">
            O sistema impede desativar ou excluir o último super admin ativo.
            Sem essa trava, seria possível trancar todo mundo para fora — e não
            existe tela para desfazer isso, só acesso direto ao banco.
          </p>
        </section>
      </div>
    </div>
  );
}
