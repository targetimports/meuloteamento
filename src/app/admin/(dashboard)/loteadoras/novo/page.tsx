import Link from 'next/link';
import { LoteadoraForm } from '@/components/LoteadoraForm';
import { criarLoteadora } from '../actions';
import { requireSuperAdmin } from '@/lib/tenant';

export default async function NovaLoteadoraPage() {
  await requireSuperAdmin();
  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/loteadoras" className="text-sm text-slate-500 hover:text-slate-700">
          ← Loteadoras
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Nova loteadora</h1>
      </div>

      <LoteadoraForm action={criarLoteadora} submitLabel="Cadastrar loteadora" />
    </div>
  );
}
