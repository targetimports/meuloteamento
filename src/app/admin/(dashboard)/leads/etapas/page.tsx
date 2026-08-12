import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { garantirEtapas, whereLeadsDoTenant, etapaEfetivaId } from '@/lib/pipeline';
import { EtapasEditor, type EtapaUI } from '@/components/crm/EtapasEditor';

export const dynamic = 'force-dynamic';

export default async function EtapasPage() {
  const tid = await tenantId();
  const etapas = await garantirEtapas(tid);

  // A contagem passa pela mesma resolução que o kanban usa, senão a tela diria
  // "0 leads" numa etapa cheia de lead que ainda não tem `stageId` carimbado.
  const leads = await prisma.lead.findMany({
    where: whereLeadsDoTenant(tid),
    select: { stageId: true, status: true },
  });

  const contagem = new Map<string, number>();
  for (const lead of leads) {
    const id = etapaEfetivaId(lead, etapas);
    if (id) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  }

  const etapasUI: EtapaUI[] = etapas.map((e) => ({
    id: e.id,
    nome: e.nome,
    cor: e.cor,
    ordem: e.ordem,
    slaHoras: e.slaHoras,
    ehFinal: e.ehFinal,
    ehGanho: e.ehGanho,
    statusLegado: e.statusLegado,
    leads: contagem.get(e.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao funil
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Etapas do funil</h1>
      </div>

      <EtapasEditor etapas={etapasUI} />
    </div>
  );
}
