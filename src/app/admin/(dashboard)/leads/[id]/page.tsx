import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { whereLoteadora } from '@/lib/tenant';
import { ConfirmButton } from '@/components/ConfirmButton';
import { LeadAtualizarForm } from '@/components/LeadForm';
import { formatDateTime } from '@/lib/format';
import { atualizarLead, excluirLead } from '../actions';

export const dynamic = 'force-dynamic';

export default async function LeadDetalhe({ params }: { params: { id: string } }) {
  const [lead, corretores] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        loteamento: { select: { id: true, nome: true } },
        lote: { select: { id: true, codigo: true } },
        corretor: { select: { id: true, nome: true } },
      },
    }),
    prisma.corretor.findMany({
      where: { ...(await whereLoteadora()), ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ]);
  if (!lead) notFound();

  const updateAction = atualizarLead.bind(null, lead.id);
  const deleteAction = async () => {
    'use server';
    await excluirLead(lead.id);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-700">
          ← Leads
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{lead.nome}</h1>
        <p className="text-sm text-slate-500">
          Recebido em {formatDateTime(lead.createdAt)} · origem: {lead.origem ?? 'site'}
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Dados do contato</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Item label="E-mail" value={lead.email} />
          <Item label="Telefone" value={lead.telefone} />
          <Item label="Loteamento de interesse" value={lead.loteamento?.nome ?? '—'} />
          <Item label="Lote específico" value={lead.lote?.codigo ?? '—'} />
        </dl>
        {lead.mensagem && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Mensagem</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.mensagem}</p>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Atendimento</h2>
        <LeadAtualizarForm
          initial={{
            status: lead.status,
            corretorId: lead.corretorId,
            observacoesInternas: lead.observacoesInternas,
          }}
          corretores={corretores}
          action={updateAction}
        />
      </section>

      <section className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-sm text-red-700 mb-3">Excluir o lead remove o registro permanentemente.</p>
        <form action={deleteAction}>
          <ConfirmButton
            message="Excluir este lead?"
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Excluir lead
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-900">{value}</p>
    </div>
  );
}
