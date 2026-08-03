import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { FormsPerfil } from './FormsPerfil';
import { atualizarMeuPerfil, trocarMinhaSenha } from './actions';

export const dynamic = 'force-dynamic';

export default async function MeuPerfilPage() {
  const sessao = await requireBackoffice();

  // Lê do banco em vez de usar a sessão: o cookie guarda o que era verdade no
  // login, e o formulário deve mostrar o que é verdade agora.
  const eu = await prisma.adminUser.findUnique({
    where: { id: sessao.sub },
    select: { nome: true, email: true, ultimoLogin: true, createdAt: true },
  });
  if (!eu) notFound();

  const dataHora = (d: Date | null) =>
    d ? new Date(d).toLocaleString('pt-BR') : '—';

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Meu perfil</h1>
      </header>

      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            Acesso desde <strong className="font-medium text-slate-700">{dataHora(eu.createdAt)}</strong>
          </span>
          <span>
            Último login <strong className="font-medium text-slate-700">{dataHora(eu.ultimoLogin)}</strong>
          </span>
        </div>

        <FormsPerfil
          atualizarAction={atualizarMeuPerfil}
          trocarSenhaAction={trocarMinhaSenha}
          inicial={{ nome: eu.nome, email: eu.email }}
        />
      </div>
    </div>
  );
}
