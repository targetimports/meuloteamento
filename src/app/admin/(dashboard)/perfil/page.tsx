import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { PerfilForms } from '@/components/PerfilForms';
import { atualizarPerfil, trocarSenha } from './actions';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Meu perfil</h1>
      <p className="text-sm text-slate-500 mb-6">Dados pessoais e senha.</p>

      <PerfilForms
        initial={{ nome: session.nome, email: session.email, role: session.role }}
        atualizarPerfilAction={atualizarPerfil}
        trocarSenhaAction={trocarSenha}
      />
    </div>
  );
}
