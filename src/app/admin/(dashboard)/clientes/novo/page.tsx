import Link from 'next/link';
import { ClienteForm } from '@/components/ClienteForm';
import { criarCliente } from '../actions';

export const dynamic = 'force-dynamic';

export default function NovoClientePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/clientes"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Clientes
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          Novo cliente
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cadastre um cliente manualmente. Use isto para clientes prospectados offline (sem
          passar pelo formulário público).
        </p>
      </div>

      <ClienteForm action={criarCliente} submitLabel="Cadastrar cliente" />
    </div>
  );
}
