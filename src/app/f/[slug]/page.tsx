import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseCampos } from '@/lib/formulario-tipos';
import { FormularioPublico } from '@/components/FormularioPublico';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const f = await prisma.formulario.findUnique({
    where: { slug: params.slug },
    select: { nome: true, descricao: true },
  });
  return {
    title: f?.nome ?? 'Formulário',
    description: f?.descricao ?? undefined,
  };
}

export default async function FormularioPublicoPage({
  params,
}: {
  params: { slug: string };
}) {
  const formulario = await prisma.formulario.findUnique({
    where: { slug: params.slug },
    include: {
      loteamento: {
        select: {
          id: true,
          nome: true,
          slug: true,
          loteadora: { select: { nome: true, logo: true } },
          lotes: {
            where: { status: { in: ['DISPONIVEL', 'RESERVADO'] } },
            select: { id: true, codigo: true, quadra: true, area: true, preco: true },
            orderBy: [{ quadra: 'asc' }, { codigo: 'asc' }],
          },
        },
      },
    },
  });

  if (!formulario) notFound();

  if (!formulario.ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
          <p className="text-5xl mb-3">⏸</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Formulário pausado
          </h1>
          <p className="text-sm text-slate-600">
            Este formulário não está aceitando respostas no momento. Entre em contato
            com o atendente.
          </p>
        </div>
      </div>
    );
  }

  const campos = parseCampos(formulario.campos);
  const lotes =
    formulario.loteamento?.lotes.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      quadra: l.quadra,
      area: Number(l.area),
      preco: Number(l.preco),
    })) ?? [];

  return (
    <FormularioPublico
      slug={formulario.slug}
      nome={formulario.nome}
      descricao={formulario.descricao}
      campos={campos}
      lotes={lotes}
      mensagemSucesso={formulario.mensagemSucesso}
      redirectUrl={formulario.redirectUrl}
      corPrimaria={formulario.corPrimaria}
      loteadoraNome={formulario.loteamento?.loteadora.nome}
      loteadoraLogo={formulario.loteamento?.loteadora.logo}
      loteamentoNome={formulario.loteamento?.nome}
    />
  );
}
