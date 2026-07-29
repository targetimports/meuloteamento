import Link from 'next/link';
import { getClienteSession } from '@/lib/auth-cliente';

export const dynamic = 'force-dynamic';

export default async function MinhaContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClienteSession();

  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/minha-conta" className="font-semibold text-slate-900">
            Minha conta
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/minha-conta/parcelas" className="text-slate-600 hover:text-slate-900">
              Parcelas
            </Link>
            <Link href="/minha-conta/contratos" className="text-slate-600 hover:text-slate-900">
              Contratos
            </Link>
            <Link href="/minha-conta/perfil" className="text-slate-600 hover:text-slate-900">
              Perfil
            </Link>
            <form action="/api/cliente/auth/logout" method="POST">
              <button className="text-slate-600 hover:text-red-600">Sair</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
