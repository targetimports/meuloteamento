import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TemplateForm from '../TemplateForm';

export const dynamic = 'force-dynamic';

export default async function EditarTemplatePage({ params }: { params: { id: string } }) {
  const t = await prisma.contratoTemplate.findUnique({ where: { id: params.id } });
  if (!t) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Editar modelo</h1>
      <TemplateForm
        initial={{
          id: t.id,
          nome: t.nome,
          descricao: t.descricao ?? '',
          conteudoHtml: t.conteudoHtml,
          ativo: t.ativo,
          default: t.default,
        }}
      />
    </div>
  );
}
