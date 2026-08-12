import type { LeadStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Funil de leads configurável.
 *
 * O kanban nasceu com cinco colunas fixas vindas do enum `LeadStatus`, e o
 * banco já previa o funil configurável (`pipelines_lead`, `pipeline_stages`)
 * sem que nada consumisse. Aqui as duas pontas se encontram: a etapa passa a
 * ser dado, e o enum vira compatibilidade.
 *
 * Duas leituras da mesma coisa é fonte de divergência garantida, então a regra
 * é única e vale para todo o sistema: **quem move o lead grava `stageId` e
 * `status` na mesma escrita** (`dadosDeMovimentacao`). Enquanto existir código
 * lendo `Lead.status` — dashboard, ações em massa, checkout, reservas — os dois
 * campos contam a mesma história.
 */

export interface EtapaPadrao {
  nome: string;
  cor: string;
  statusLegado: LeadStatus;
  slaHoras?: number;
  ehFinal?: boolean;
  ehGanho?: boolean;
}

/**
 * Etapas iniciais de um funil novo.
 *
 * Espelham o enum antigo de propósito: quem já usava o kanban encontra as
 * mesmas cinco colunas no primeiro acesso, e a migração dos leads existentes
 * vira um de-para exato, sem lead órfão nem etapa adivinhada. Renomear, somar
 * ou remover etapa é trabalho de quem usa, feito na tela — não nossa escolha
 * imposta na criação.
 *
 * Os SLAs são ponto de partida: 24h para responder um lead novo, 72h para não
 * abandonar quem está em atendimento, 48h para confirmar o que foi agendado.
 * Etapa final não tem SLA — não há o que cobrar de um lead fechado.
 */
export const ETAPAS_PADRAO: EtapaPadrao[] = [
  { nome: 'Novo', cor: '#64748b', statusLegado: 'NOVO', slaHoras: 24 },
  { nome: 'Em atendimento', cor: '#f59e0b', statusLegado: 'EM_ATENDIMENTO', slaHoras: 72 },
  { nome: 'Agendado', cor: '#3b82f6', statusLegado: 'AGENDADO', slaHoras: 48 },
  { nome: 'Convertido', cor: '#10b981', statusLegado: 'CONVERTIDO', ehFinal: true, ehGanho: true },
  { nome: 'Perdido', cor: '#ef4444', statusLegado: 'PERDIDO', ehFinal: true },
];

/** Filtro de leads da loteadora. Super admin (null) enxerga todos. */
export function whereLeadsDoTenant(loteadoraId: string | null): Prisma.LeadWhereInput {
  return loteadoraId ? { loteamento: { loteadoraId } } : {};
}

export type EtapaComContagem = {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  slaHoras: number | null;
  ehFinal: boolean;
  ehGanho: boolean;
  statusLegado: LeadStatus | null;
};

/**
 * Devolve as etapas do funil da loteadora, criando o funil padrão na primeira
 * vez. Idempotente: pode ser chamada a cada carregamento da página.
 *
 * A criação e a adoção dos leads existentes acontecem numa transação. Sem ela,
 * uma falha no meio deixaria o funil criado e os leads sem etapa — e o kanban
 * abriria vazio, dando a impressão de que os leads sumiram.
 */
export async function garantirEtapas(loteadoraId: string | null): Promise<EtapaComContagem[]> {
  const existente = await prisma.pipelineLead.findFirst({
    where: { loteadoraId, ativo: true },
    orderBy: [{ default: 'desc' }, { createdAt: 'asc' }],
    include: { stages: { orderBy: { ordem: 'asc' } } },
  });

  if (existente && existente.stages.length > 0) return existente.stages;

  return prisma.$transaction(async (tx) => {
    // Releitura dentro da transação: dois carregamentos simultâneos da página
    // chegariam aqui juntos e criariam dois funis para a mesma loteadora.
    const jaCriado = await tx.pipelineLead.findFirst({
      where: { loteadoraId, ativo: true },
      include: { stages: { orderBy: { ordem: 'asc' } } },
    });
    if (jaCriado && jaCriado.stages.length > 0) return jaCriado.stages;

    const pipeline =
      jaCriado ??
      (await tx.pipelineLead.create({
        data: {
          loteadoraId,
          nome: 'Funil de vendas',
          descricao: 'Etapas do atendimento a leads',
          default: true,
        },
      }));

    const criadas = [];
    for (const [i, etapa] of ETAPAS_PADRAO.entries()) {
      criadas.push(
        await tx.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            nome: etapa.nome,
            cor: etapa.cor,
            ordem: i,
            slaHoras: etapa.slaHoras ?? null,
            ehFinal: etapa.ehFinal ?? false,
            ehGanho: etapa.ehGanho ?? false,
            statusLegado: etapa.statusLegado,
          },
        })
      );
    }

    // Adota os leads que já existiam: cada um vai para a etapa equivalente ao
    // status que ele já tinha. `stageId: null` no filtro evita mexer em lead
    // que outra execução já classificou.
    for (const etapa of criadas) {
      if (!etapa.statusLegado) continue;
      await tx.lead.updateMany({
        where: {
          ...whereLeadsDoTenant(loteadoraId),
          stageId: null,
          status: etapa.statusLegado,
        },
        data: { stageId: etapa.id },
      });
    }

    return criadas;
  });
}

/**
 * Em que etapa este lead está, de fato.
 *
 * Lead nasce em seis lugares — formulário público, checkout, reserva,
 * distribuição automática e dois webhooks de campanha — e nenhum deles conhece
 * o funil. Exigir `stageId` na criação significaria alterar os seis e torcer
 * para o sétimo lembrar; quem esquecesse criaria um lead invisível no kanban,
 * que é a pior falha possível aqui (o lead existe, ninguém vê, ninguém atende).
 *
 * Então a etapa é resolvida na LEITURA: vale o `stageId` quando houver e, na
 * falta dele, a etapa equivalente ao `status` com que o lead nasceu. O carimbo
 * de `stageId` acontece quando alguém move o card.
 */
export function etapaEfetivaId(
  lead: { stageId: string | null; status: LeadStatus },
  etapas: EtapaComContagem[]
): string | null {
  if (lead.stageId && etapas.some((e) => e.id === lead.stageId)) return lead.stageId;
  const porStatus = etapas.find((e) => e.statusLegado === lead.status);
  // Sem equivalente (status removido do funil): cai na primeira etapa, para
  // aparecer em algum lugar em vez de desaparecer.
  return porStatus?.id ?? etapas[0]?.id ?? null;
}

/**
 * O que gravar no lead ao movê-lo para uma etapa.
 *
 * `statusDesde` é o relógio do SLA: reiniciá-lo é o que faz "parado há 3 dias"
 * significar tempo NA ETAPA, e não idade do lead. Etapa sem equivalente antigo
 * preserva o status atual — melhor um valor defasado que um chute.
 */
export function dadosDeMovimentacao(etapa: {
  id: string;
  statusLegado: LeadStatus | null;
}): Prisma.LeadUpdateInput {
  return {
    stage: { connect: { id: etapa.id } },
    ...(etapa.statusLegado ? { status: etapa.statusLegado } : {}),
    statusDesde: new Date(),
  };
}

/** Horas que o lead está parado na etapa atual. */
export function horasParado(statusDesde: Date, agora: Date = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - statusDesde.getTime()) / 3_600_000));
}

export type FaixaSla = 'ok' | 'atencao' | 'estourado';

/**
 * Em que faixa de SLA o lead está.
 *
 * Os limiares saem do SLA da própria etapa, nunca de número fixo: "parado há
 * 30 dias" é normal em etapa de longo prazo e é abandono em etapa de resposta
 * rápida. Etapa sem SLA e etapa final não cobram nada — alerta que aparece em
 * todo card deixa de ser alerta.
 */
export function faixaSla(
  etapa: { slaHoras: number | null; ehFinal: boolean },
  statusDesde: Date,
  agora: Date = new Date()
): FaixaSla {
  if (etapa.ehFinal || !etapa.slaHoras) return 'ok';
  const horas = horasParado(statusDesde, agora);
  if (horas >= etapa.slaHoras) return 'estourado';
  if (horas >= etapa.slaHoras * 0.75) return 'atencao';
  return 'ok';
}
