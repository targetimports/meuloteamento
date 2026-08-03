'use server';

/**
 * Geração das mensalidades das empresas-cliente.
 *
 * IDEMPOTENTE POR CONSTRUÇÃO: a unicidade (assinaturaId, competencia) vive no
 * banco. Rodar duas vezes no mesmo mês não duplica nada — a segunda tentativa
 * esbarra na constraint, não numa checagem em memória que alguém possa
 * esquecer de fazer.
 *
 * QUEM FICA DE FORA, e por quê:
 *   - CANCELADA e BLOQUEADA: contrato encerrado ou suspenso, não se cobra
 *   - TRIAL: período de teste é o que se prometeu de graça
 *   - valor zero: geraria fatura de R$ 0,00, que só polui a lista
 *   - já lançada na competência: é o que torna a operação repetível
 *
 * Nada é emitido no Asaas aqui. Esta etapa cria o registro da fatura; a
 * emissão da cobrança é passo separado, para que gerar a competência não
 * dispare dezenas de chamadas externas de uma vez.
 */

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, competenciaAtual } from '@/lib/backoffice';

export interface ResultadoGeracao {
  competencia: string;
  criadas: number;
  fora: {
    cancelada: number;
    bloqueada: number;
    trial: number;
    semValor: number;
    jaLancada: number;
  };
}

/** Vencimento da competência: "2026-08" + dia 10 -> 10/08/2026, meio-dia. */
function dataVencimento(competencia: string, dia: number): Date {
  const [ano, mes] = competencia.split('-').map(Number);
  // Meio-dia evita que fuso horário empurre a data para o dia anterior.
  return new Date(ano, mes - 1, Math.min(28, Math.max(1, dia)), 12, 0, 0);
}

export async function gerarFaturas(competencia?: string): Promise<ResultadoGeracao> {
  await requireBackoffice();

  const comp = competencia?.match(/^\d{4}-\d{2}$/)
    ? competencia
    : competenciaAtual();

  const assinaturas = await prisma.assinatura.findMany({
    select: {
      id: true,
      status: true,
      valorMensal: true,
      diaVencimento: true,
      faturas: { where: { competencia: comp }, select: { id: true, status: true } },
    },
  });

  const fora = { cancelada: 0, bloqueada: 0, trial: 0, semValor: 0, jaLancada: 0 };
  let criadas = 0;

  for (const a of assinaturas) {
    if (a.status === 'CANCELADA') { fora.cancelada++; continue; }
    if (a.status === 'BLOQUEADA') { fora.bloqueada++; continue; }
    if (a.status === 'TRIAL') { fora.trial++; continue; }

    // Fatura cancelada não conta como lançada: permite refazer a competência
    // depois de um cancelamento sem precisar mexer no banco.
    const viva = a.faturas.some((f) => f.status !== 'CANCELADA');
    if (viva) { fora.jaLancada++; continue; }

    const valor = Number(a.valorMensal);
    if (!(valor > 0)) { fora.semValor++; continue; }

    await prisma.assinaturaFatura.create({
      data: {
        assinaturaId: a.id,
        competencia: comp,
        valor: a.valorMensal,
        vencimento: dataVencimento(comp, a.diaVencimento),
        status: 'PENDENTE',
        origem: 'AUTOMATICA',
      },
    });
    criadas++;
  }

  revalidatePath('/backoffice/cobrancas');
  revalidatePath('/backoffice');
  revalidatePath('/backoffice/empresas');

  return { competencia: comp, criadas, fora };
}

/** Baixa manual: usada enquanto a emissão no Asaas não estiver ligada. */
export async function marcarFaturaPaga(id: string): Promise<void> {
  await requireBackoffice();

  const fatura = await prisma.assinaturaFatura.findUnique({
    where: { id },
    select: { valor: true, status: true },
  });
  if (!fatura || fatura.status === 'PAGA') return;

  await prisma.assinaturaFatura.update({
    where: { id },
    data: { status: 'PAGA', pagoEm: new Date(), valorPago: fatura.valor },
  });

  revalidatePath('/backoffice/cobrancas');
  revalidatePath('/backoffice');
}

export async function cancelarFatura(id: string): Promise<void> {
  await requireBackoffice();
  await prisma.assinaturaFatura.update({
    where: { id },
    data: { status: 'CANCELADA' },
  });
  revalidatePath('/backoffice/cobrancas');
  revalidatePath('/backoffice');
}
