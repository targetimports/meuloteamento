import { prisma } from '@/lib/prisma';
import { tenantId, isSuperAdmin, whereLoteadora } from '@/lib/tenant';
import { LeadsKanban, type LeadUI } from '@/components/LeadsKanban';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const tid = await tenantId();
  const isSuper = await isSuperAdmin();
  const tenantWhere = tid ? { loteamento: { loteadoraId: tid } } : {};

  const [leads, corretores, origensRaw, stats] = await Promise.all([
    prisma.lead.findMany({
      where: tenantWhere,
      orderBy: [{ status: 'asc' }, { ordem: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        corretor: { select: { id: true, nome: true } },
        loteamento: { select: { nome: true, slug: true } },
        lote: { select: { codigo: true } },
      },
    }),
    prisma.corretor.findMany({
      where: { ...(await whereLoteadora()), ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
    prisma.lead.findMany({
      where: { ...tenantWhere, origem: { not: null } },
      distinct: ['origem'],
      select: { origem: true },
    }),
    prisma.lead.groupBy({
      where: tenantWhere,
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const leadsUI: LeadUI[] = leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    mensagem: l.mensagem,
    status: l.status,
    temperatura: l.temperatura,
    origem: l.origem,
    ordem: l.ordem,
    proximaAcao: l.proximaAcao,
    proximaAcaoData: l.proximaAcaoData?.toISOString() ?? null,
    tags: (l.tags as string[] | null) ?? [],
    corretor: l.corretor,
    loteamento: l.loteamento ? { nome: l.loteamento.nome, slug: l.loteamento.slug } : null,
    lote: l.lote,
    observacoesInternas: l.observacoesInternas,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  const origens = origensRaw
    .map((o) => o.origem)
    .filter((o): o is string => !!o);

  const total = stats.reduce((a, s) => a + s._count._all, 0);
  const conv = stats.find((s) => s.status === 'CONVERTIDO')?._count._all ?? 0;
  const taxa = total > 0 ? ((conv / total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM de Leads</h1>
          <p className="text-sm text-slate-500">
            Arraste os cards entre as colunas para mover. Clique para ver detalhes.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <KpiHeader label="Total" valor={String(total)} />
          <KpiHeader label="Convertidos" valor={String(conv)} cor="text-emerald-600" />
          <KpiHeader label="Taxa" valor={`${taxa}%`} cor="text-primary-600" />
          <a
            href="/admin/leads/em-massa"
            className="ml-2 inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3 py-2 rounded"
          >
            🎯 Ações em massa
          </a>
        </div>
      </div>

      <LeadsKanban
        leads={leadsUI}
        corretores={corretores}
        origens={origens}
        isSuperAdmin={isSuper}
      />
    </div>
  );
}

function KpiHeader({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: string;
  cor?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
        {label}
      </p>
      <p className={`text-xl font-bold ${cor ?? 'text-slate-900'}`}>{valor}</p>
    </div>
  );
}
