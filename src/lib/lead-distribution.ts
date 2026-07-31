import { prisma } from './prisma';

/**
 * Round-robin entre corretores que aceitam leads automaticamente.
 * Respeita capacidade diária (leads recebidos hoje < capacidadeDiaria).
 * Se houver cidade no lead e o corretor declarar cidadesAtende, prioriza match.
 */
export async function distribuirLead(input: {
  leadId: string;
  loteadoraId?: string | null;
  cidade?: string | null;
}): Promise<{ corretorId: string | null }> {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const candidatos = await prisma.corretor.findMany({
    where: {
      ativo: true,
      aceitaLeadsAuto: true,
      // O parametro loteadoraId chegava aqui e era ignorado: o lead de uma
      // empresa podia cair para o corretor de outra.
      ...(input.loteadoraId ? { loteadoraId: input.loteadoraId } : {}),
    },
    select: {
      id: true,
      cidadesAtende: true,
      capacidadeDiaria: true,
      _count: {
        select: {
          leads: { where: { createdAt: { gte: inicioDia } } },
        },
      },
    },
  });

  if (!candidatos.length) return { corretorId: null };

  const cidadeNorm = (input.cidade ?? '').trim().toLowerCase();
  const elegiveis = candidatos.filter(
    (c) => c._count.leads < c.capacidadeDiaria
  );
  if (!elegiveis.length) return { corretorId: null };

  const preferidos = cidadeNorm
    ? elegiveis.filter((c) =>
        c.cidadesAtende.some((cid) => cid.toLowerCase() === cidadeNorm)
      )
    : [];

  const pool = preferidos.length ? preferidos : elegiveis;
  const escolhido = pool.reduce((min, c) =>
    c._count.leads < min._count.leads ? c : min
  );

  await prisma.lead.update({
    where: { id: input.leadId },
    data: { corretorId: escolhido.id },
  });

  return { corretorId: escolhido.id };
}

/**
 * Score automático simples baseado em sinais conhecidos.
 * Pode ser substituído por IA depois — interface estável.
 */
export function calcularScoreLead(input: {
  mensagem?: string | null;
  loteId?: string | null;
  origem?: string | null;
}): { score: number; obs: string } {
  let s = 50;
  const sinais: string[] = [];

  if (input.mensagem && input.mensagem.length > 40) {
    s += 10;
    sinais.push('+10 msg detalhada');
  }
  if (input.loteId) {
    s += 15;
    sinais.push('+15 selecionou lote');
  }
  const o = (input.origem ?? '').toLowerCase();
  if (o.includes('whatsapp')) {
    s += 10;
    sinais.push('+10 veio do whatsapp');
  }
  if (o.includes('facebook') || o.includes('meta')) {
    s += 5;
    sinais.push('+5 facebook ads');
  }
  if (o.includes('feira') || o.includes('evento')) {
    s += 20;
    sinais.push('+20 evento presencial');
  }

  s = Math.max(0, Math.min(100, s));
  return { score: s, obs: sinais.join(', ') };
}
