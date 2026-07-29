import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, tenantId } from '@/lib/tenant';
import { FormBuilder } from '@/components/FormBuilder';
import { parseCampos } from '@/lib/formulario-tipos';

export const dynamic = 'force-dynamic';

export default async function EditarFormularioPage({
  params,
}: {
  params: { id: string };
}) {
  const f = await prisma.formulario.findUnique({ where: { id: params.id } });
  if (!f) notFound();
  if (f.loteadoraId && !(await canAccessLoteadora(f.loteadoraId))) notFound();

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
          href={`/admin/formularios/${f.id}`}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← {f.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          Editar formulário
        </h1>
      </div>

      <FormBuilder
        modo="editar"
        formularioId={f.id}
        loteamentos={loteamentos.map((l) => ({
          id: l.id,
          nome: l.nome,
          loteadoraNome: l.loteadora?.nome,
        }))}
        initial={{
          nome: f.nome,
          slug: f.slug,
          descricao: f.descricao,
          ativo: f.ativo,
          loteamentoId: f.loteamentoId,
          campos: parseCampos(f.campos),
          mensagemSucesso: f.mensagemSucesso,
          redirectUrl: f.redirectUrl,
          corPrimaria: f.corPrimaria,
        }}
      />
    </div>
  );
}
