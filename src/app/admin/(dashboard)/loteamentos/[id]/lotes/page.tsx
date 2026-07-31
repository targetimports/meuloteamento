import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento } from '@/lib/tenant';
import { formatBRL, formatArea } from '@/lib/format';
import {
  NovoLoteForm,
  NovosLotesEmMassaForm,
  EditarLoteForm,
} from '@/components/LoteForms';
import { criarLote, criarLotesEmMassa, atualizarLote, excluirLote } from './actions';

export const dynamic = 'force-dynamic';

export default async function LotesPage({ params }: { params: { id: string } }) {
  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    select: { id: true, nome: true , loteadoraId: true },
  });
  if (!loteamento) notFound();
  // Sem esta checagem um admin abre o loteamento de outra empresa pelo id.
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) notFound();

  const lotes = await prisma.lote.findMany({
    where: { loteamentoId: loteamento.id },
    orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
  });

  const criarAction = criarLote.bind(null, loteamento.id);
  const bulkAction = criarLotesEmMassa.bind(null, loteamento.id);

  // Agrupa por quadra
  const porQuadra = lotes.reduce<Record<string, typeof lotes>>((acc, l) => {
    (acc[l.quadra] ||= []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/loteamentos/${loteamento.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {loteamento.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Gerenciar lotes</h1>
        <p className="text-sm text-slate-500">{lotes.length} lote(s) cadastrado(s)</p>
      </div>

      <NovosLotesEmMassaForm action={bulkAction} />
      <NovoLoteForm action={criarAction} />

      {/* Listagem agrupada por quadra */}
      {Object.entries(porQuadra).map(([quadra, items]) => (
        <section key={quadra}>
          <h2 className="font-semibold text-slate-900 mb-2">Quadra {quadra}</h2>
          <div className="space-y-3">
            {items.map((lote) => {
              const updateAction = atualizarLote.bind(null, lote.id);
              const deleteAction = async () => {
                'use server';
                await excluirLote(lote.id);
              };

              const vendavel = lote.status === 'DISPONIVEL' || lote.status === 'RESERVADO';

              return (
                <div key={lote.id}>
                  <div className="flex items-baseline justify-between mb-1 px-1 gap-2 flex-wrap">
                    <h3 className="font-mono text-sm font-semibold text-slate-700">
                      {lote.codigo}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {formatArea(Number(lote.area))} · {formatBRL(Number(lote.preco))}
                      </span>
                      {vendavel && (
                        <Link
                          href={`/admin/vendas/novo?lote=${lote.id}`}
                          className="bg-primary-600 hover:bg-primary-700 text-white text-xs px-2 py-0.5 rounded font-medium"
                        >
                          + Vender
                        </Link>
                      )}
                    </div>
                  </div>
                  <EditarLoteForm
                    loteId={lote.id}
                    initial={{
                      area: Number(lote.area),
                      preco: Number(lote.preco),
                      descricao: lote.descricao,
                      status: lote.status,
                      motivoBloqueio: lote.motivoBloqueio,
                      orientacaoSolar: lote.orientacaoSolar,
                      esquina: lote.esquina,
                      fronteAreaVerde: lote.fronteAreaVerde,
                      fotos: lote.fotos,
                    }}
                    action={updateAction}
                    onDelete={deleteAction}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
