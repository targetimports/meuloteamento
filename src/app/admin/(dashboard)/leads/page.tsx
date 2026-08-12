import { prisma } from '@/lib/prisma';
import { tenantId, isSuperAdmin } from '@/lib/tenant';
import { garantirEtapas, whereLeadsDoTenant, etapaEfetivaId } from '@/lib/pipeline';
import { FunilKanban, type LeadUI, type EtapaKanban } from '@/components/crm/FunilKanban';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const tid = await tenantId();
  const isSuper = await isSuperAdmin();
  const tenantWhere = whereLeadsDoTenant(tid);

  // As etapas primeiro: o funil padrão nasce aqui na primeira visita, e os
  // leads que já existiam são adotados pelas etapas equivalentes.
  const etapas = await garantirEtapas(tid);

  const [leads, corretores, origensRaw] = await Promise.all([
    prisma.lead.findMany({
      where: tenantWhere,
      orderBy: [{ ordem: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        corretor: { select: { id: true, nome: true } },
        loteamento: { select: { nome: true, slug: true } },
        lote: { select: { codigo: true } },
      },
    }),
    prisma.corretor.findMany({
      where: { ...(tid ? { loteadoraId: tid } : {}), ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
    prisma.lead.findMany({
      where: { ...tenantWhere, origem: { not: null } },
      distinct: ['origem'],
      select: { origem: true },
    }),
  ]);

  const leadsUI: LeadUI[] = leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    mensagem: l.mensagem,
    etapaId: etapaEfetivaId(l, etapas),
    temperatura: l.temperatura,
    origem: l.origem,
    ordem: l.ordem,
    statusDesde: l.statusDesde.toISOString(),
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

  const etapasUI: EtapaKanban[] = etapas.map((e) => ({
    id: e.id,
    nome: e.nome,
    cor: e.cor,
    slaHoras: e.slaHoras,
    ehFinal: e.ehFinal,
    ehGanho: e.ehGanho,
  }));

  // A conversão sai das etapas marcadas como ganho, não de um status fixo:
  // quem renomear ou trocar a etapa de ganho continua com o número certo.
  const idsGanho = new Set(etapas.filter((e) => e.ehGanho).map((e) => e.id));
  const total = leadsUI.length;
  const ganhos = leadsUI.filter((l) => l.etapaId && idsGanho.has(l.etapaId)).length;
  const taxa = total > 0 ? ((ganhos / total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funil de vendas</h1>
          <p className="text-body-sm text-muted-foreground">
            Arraste os cards entre as colunas para mover. Clique para ver os detalhes.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <Kpi label="Leads" valor={String(total)} />
          <Kpi label="Convertidos" valor={String(ganhos)} cor="text-success-strong" />
          <Kpi label="Taxa" valor={`${taxa}%`} cor="text-primary-strong" />
        </div>
      </div>

      <FunilKanban
        leads={leadsUI}
        etapas={etapasUI}
        corretores={corretores}
        origens={origensRaw.map((o) => o.origem).filter((o): o is string => !!o)}
        isSuperAdmin={isSuper}
      />
    </div>
  );
}

function Kpi({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div>
      <p className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`text-xl font-bold ${cor ?? 'text-foreground'}`}>{valor}</p>
    </div>
  );
}
