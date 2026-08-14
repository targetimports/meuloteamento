import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento } from '@/lib/tenant';
import { GerenciarLotes, type LoteLinha } from '@/components/lotes/GerenciarLotes';

export const dynamic = 'force-dynamic';

export default async function LotesPage({ params }: { params: { id: string } }) {
  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    select: { id: true, nome: true, loteadoraId: true },
  });
  if (!loteamento) notFound();
  // Sem esta checagem um admin abre o loteamento de outra empresa pelo id.
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) notFound();

  const lotes = await prisma.lote.findMany({
    where: { loteamentoId: loteamento.id },
    orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
  });

  /**
   * Tipos do simulador viram opções de preço nos formulários. Empresa que não
   * cadastrou nenhum recebe lista vazia e os formulários ficam como sempre
   * foram — o preço segue digitado à mão.
   */
  const tipos = (
    await prisma.simuladorTipoLote.findMany({
      where: { loteamentoId: loteamento.id, ativo: true },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nome: true, preco: true, categoria: true },
    })
  ).map((t) => ({
    id: t.id,
    nome: t.nome,
    preco: Number(t.preco),
    categoria: t.categoria ?? ('' as const),
  }));

  // Decimal do Prisma não atravessa para Client Component; vira number aqui.
  const linhas: LoteLinha[] = lotes.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    quadra: l.quadra,
    area: Number(l.area),
    preco: Number(l.preco),
    status: l.status,
    tipo: l.tipo,
    descricao: l.descricao,
    motivoBloqueio: l.motivoBloqueio,
    orientacaoSolar: l.orientacaoSolar,
    esquina: l.esquina,
    fronteAreaVerde: l.fronteAreaVerde,
    fotos: l.fotos,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/admin/loteamentos/${loteamento.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {loteamento.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Gerenciar lotes</h1>
      </div>

      <GerenciarLotes loteamentoId={loteamento.id} lotes={linhas} tipos={tipos} />
    </div>
  );
}
