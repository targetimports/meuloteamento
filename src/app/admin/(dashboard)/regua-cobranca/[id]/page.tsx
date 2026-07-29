import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import ReguaEditor from './ReguaEditor';

export const dynamic = 'force-dynamic';

export default async function ReguaDetalhePage({ params }: { params: { id: string } }) {
  const tid = await tenantId();
  const regua = await prisma.reguaCobranca.findUnique({
    where: { id: params.id },
    include: { passos: { orderBy: { ordem: 'asc' } } },
  });
  if (!regua) notFound();
  if (tid && regua.loteadoraId !== tid) notFound();

  const loteadora = tid
    ? await prisma.loteadora.findUnique({
        where: { id: tid },
        select: { reguaCobrancaId: true },
      })
    : null;

  return (
    <ReguaEditor
      regua={{
        id: regua.id,
        nome: regua.nome,
        descricao: regua.descricao ?? '',
        ativa: regua.ativa,
        passos: regua.passos.map((p) => ({
          id: p.id,
          diasOffset: p.diasOffset,
          canal: p.canal,
          template: p.template,
          ativo: p.ativo,
        })),
      }}
      emUso={loteadora?.reguaCobrancaId === regua.id}
    />
  );
}
