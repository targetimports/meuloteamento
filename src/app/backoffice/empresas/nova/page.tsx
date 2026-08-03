import Link from 'next/link';
import { requireBackoffice } from '@/lib/backoffice';
import { EmpresaClienteForm } from '@/components/EmpresaClienteForm';
import { criarEmpresa } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NovaEmpresaPage() {
  await requireBackoffice();

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <Link href="/backoffice/empresas" className="text-xs text-slate-500 hover:underline">
          ← Empresas-cliente
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 mt-1">Nova empresa-cliente</h1>
      </header>

      <div className="p-8">
        <div className="max-w-3xl bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-sm text-slate-500 mb-6">
            Cadastro de identificação e contato. Chaves de pagamento, WhatsApp e
            branding são configurados depois, na conta da própria empresa.
          </p>
          <EmpresaClienteForm action={criarEmpresa} rotuloBotao="Cadastrar empresa" />
        </div>

        <p className="mt-4 text-xs text-slate-500 max-w-3xl">
          Depois de criar, você define a assinatura e cria o primeiro usuário de
          acesso na ficha da empresa.
        </p>
      </div>
    </div>
  );
}
