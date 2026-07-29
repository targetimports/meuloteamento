import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatDate } from '@/lib/format';
import BulkLeadsPanel from './BulkLeadsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ações em massa — Leads' };

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo',
  EM_ATENDIMENTO: 'Em atendimento',
  AGENDADO: 'Agendado',
  CONVERTIDO: 'Convertido',
  PERDIDO: 'Perdido',
};

const STATUS_COR: Record<string, string> = {
  NOVO: 'bg-sky-100 text-sky-700',
  EM_ATENDIMENTO: 'bg-amber-100 text-amber-700',
  AGENDADO: 'bg-purple-100 text-purple-700',
  CONVERTIDO: 'bg-emerald-100 text-emerald-700',
  PERDIDO: 'bg-slate-100 text-slate-500',
};

export default async function LeadsBulkPage({
  searchParams,
}: {
  searchParams: { status?: string; corretor?: string; origem?: string; q?: string };
}) {
  const tid = await tenantId();
  const tenantWhere = tid ? { loteamento: { loteadoraId: tid } } : {};

  const [leads, corretores] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...tenantWhere,
        ...(searchParams.status ? { status: searchParams.status as any } : {}),
        ...(searchParams.corretor ? { corretorId: searchParams.corretor } : {}),
        ...(searchParams.origem ? { origem: searchParams.origem } : {}),
        ...(searchParams.q
          ? {
              OR: [
                { nome: { contains: searchParams.q, mode: 'insensitive' as const } },
                { email: { contains: searchParams.q, mode: 'insensitive' as const } },
                { telefone: { contains: searchParams.q } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        corretor: { select: { id: true, nome: true } },
        loteamento: { select: { nome: true } },
      },
    }),
    prisma.corretor.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <div className="space-y-4 pb-32">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <Link href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-700">
            ← CRM
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Ações em massa</h1>
          <p className="text-sm text-slate-500">
            Marque os leads e aplique mudança de status, atribuição de corretor ou envio de
            mensagem.
          </p>
        </div>
      </div>

      <form className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por nome, e-mail ou telefone"
          className="flex-1 min-w-[200px] border border-slate-300 rounded px-3 py-1.5 text-sm"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">Todos status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          name="corretor"
          defaultValue={searchParams.corretor ?? ''}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">Todos corretores</option>
          {corretores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <button className="bg-sky-600 hover:bg-sky-700 text-white text-sm px-3 py-1.5 rounded">
          Filtrar
        </button>
        <Link
          href={`/api/admin/leads/export${
            searchParams.status ? `?status=${searchParams.status}` : ''
          }`}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-3 py-1.5 rounded"
        >
          Exportar CSV
        </Link>
      </form>

      <BulkLeadsPanel
        leads={leads.map((l) => ({
          id: l.id,
          nome: l.nome,
          email: l.email,
          telefone: l.telefone,
          status: l.status,
          temperatura: l.temperatura,
          score: l.score,
          corretor: l.corretor?.nome ?? '',
          loteamento: l.loteamento?.nome ?? '',
          criado: formatDate(l.createdAt),
          STATUS_LABEL,
          STATUS_COR,
        }))}
        corretores={corretores}
      />
    </div>
  );
}
