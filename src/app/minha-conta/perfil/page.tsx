import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';
import PerfilForm from './PerfilForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Perfil — meuloteamento' };

export default async function PerfilPage() {
  const session = await getClienteSession();
  if (!session) redirect('/minha-conta/login');

  const cliente = await prisma.cliente.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      nome: true,
      cpfCnpj: true,
      telefone: true,
      aceitaEmail: true,
      aceitaWhatsApp: true,
    },
  });
  if (!cliente) redirect('/minha-conta/login');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Perfil</h1>
      <PerfilForm
        initial={{
          email: cliente.email,
          nome: cliente.nome,
          cpfCnpj: cliente.cpfCnpj,
          telefone: cliente.telefone,
          aceitaEmail: cliente.aceitaEmail,
          aceitaWhatsApp: cliente.aceitaWhatsApp,
        }}
      />
    </div>
  );
}
