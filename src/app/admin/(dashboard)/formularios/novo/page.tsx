import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { FormBuilder } from '@/components/FormBuilder';

export const dynamic = 'force-dynamic';

export default async function NovoFormularioPage() {
  const tid = await tenantId();
  const loteamentos = await prisma.loteamento.findMany({
    where: tid ? { loteadoraId: tid } : {},
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      loteadora: { select: { nome: true } },
    },
  });

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/formularios"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Formulários
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          Novo formulário
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Defina os campos que o cliente vai preencher. Depois copie o link público
          e envie por WhatsApp.
        </p>
      </div>

      <FormBuilder
        modo="novo"
        loteamentos={loteamentos.map((l) => ({
          id: l.id,
          nome: l.nome,
          loteadoraNome: l.loteadora?.nome,
        }))}
      />
    </div>
  );
}
