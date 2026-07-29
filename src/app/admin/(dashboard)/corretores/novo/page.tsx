import Link from 'next/link';
import { CorretorForm } from '@/components/CorretorForm';
import { criarCorretor } from '../actions';

export default function NovoCorretorPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/corretores" className="text-sm text-slate-500 hover:text-slate-700">
          ← Corretores
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Novo corretor</h1>
      </div>

      <CorretorForm action={criarCorretor} submitLabel="Cadastrar corretor" />
    </div>
  );
}
