import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { NovaTabelaForm, EditarTabelaForm } from '@/components/TabelaPrecoForms';
import { criarTabela, atualizarTabela, excluirTabela } from './actions';

export const dynamic = 'force-dynamic';

export default async function TabelasPrecoPage({ params }: { params: { id: string } }) {
  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    select: { id: true, nome: true },
  });
  if (!loteamento) notFound();

  const tabelas = await prisma.tabelaPreco.findMany({
    where: { loteamentoId: loteamento.id },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
  });

  const criarAction = criarTabela.bind(null, loteamento.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/loteamentos/${loteamento.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {loteamento.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Tabelas de preço</h1>
        <p className="text-sm text-slate-500">
          Condições de pagamento oferecidas neste loteamento. Mostradas no site público se ativas.
        </p>
      </div>

      <NovaTabelaForm action={criarAction} />

      {tabelas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma tabela cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {tabelas.map((tabela) => {
            const updateAction = atualizarTabela.bind(null, tabela.id);
            const deleteAction = async () => {
              'use server';
              await excluirTabela(tabela.id);
            };

            return (
              <div key={tabela.id}>
                <p className="text-xs font-semibold text-slate-600 mb-1 px-1">
                  {tabela.nome}
                  {!tabela.ativo && (
                    <span className="ml-2 text-slate-400 font-normal">(inativa)</span>
                  )}
                </p>
                <EditarTabelaForm
                  initial={{
                    nome: tabela.nome,
                    descricao: tabela.descricao,
                    descontoPct: tabela.descontoPct ? Number(tabela.descontoPct) : null,
                    entradaPct: tabela.entradaPct ? Number(tabela.entradaPct) : null,
                    parcelasMin: tabela.parcelasMin,
                    parcelasMax: tabela.parcelasMax,
                    ativo: tabela.ativo,
                    ordem: tabela.ordem,
                  }}
                  action={updateAction}
                  onDelete={deleteAction}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
