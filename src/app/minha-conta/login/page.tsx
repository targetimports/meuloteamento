import Link from 'next/link';
import LoginCliente from './LoginCliente';

export const metadata = { title: 'Entrar — meuloteamento' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Entrar</h1>
        <p className="text-sm text-slate-500 mb-6">
          Acesse a área do cliente para acompanhar suas parcelas e contratos.
        </p>
        <LoginCliente />
        <div className="mt-6 text-sm text-slate-600 space-y-2">
          <p>
            Primeira vez aqui?{' '}
            <Link href="/minha-conta/cadastro" className="text-sky-600 hover:underline">
              Criar senha
            </Link>
          </p>
          <p>
            Esqueceu a senha?{' '}
            <Link href="/minha-conta/recuperar-senha" className="text-sky-600 hover:underline">
              Recuperar acesso
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
