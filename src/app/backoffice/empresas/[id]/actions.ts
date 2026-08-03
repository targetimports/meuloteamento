'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';

function paraNumero(v: FormDataEntryValue | null): number {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Vencimento limitado a 28: dia 29-31 não existe em todo mês. */
function paraDia(v: FormDataEntryValue | null, padrao: number): number {
  const n = Number(String(v ?? '').trim());
  if (!Number.isInteger(n)) return padrao;
  return Math.min(28, Math.max(1, n));
}

/**
 * Cria ou atualiza a assinatura da empresa.
 *
 * O valor nasce do plano mas fica gravado na assinatura: desconto negociado
 * com um cliente não pode alterar o preço dos demais.
 */
export async function salvarAssinatura(formData: FormData): Promise<void> {
  await requireBackoffice();

  const loteadoraId = String(formData.get('loteadoraId') ?? '').trim();
  if (!loteadoraId) throw new Error('Empresa não informada.');

  const planoId = String(formData.get('planoId') ?? '').trim() || null;

  // Valor em branco = herda o do plano. Digitado = manda o digitado.
  let valorMensal = paraNumero(formData.get('valorMensal'));
  if (!valorMensal && planoId) {
    const p = await prisma.plano.findUnique({
      where: { id: planoId },
      select: { valorMensal: true },
    });
    valorMensal = Number(p?.valorMensal ?? 0);
  }

  const trialAteRaw = String(formData.get('trialAte') ?? '').trim();

  const dados = {
    planoId,
    valorMensal,
    status: String(formData.get('status') ?? 'TRIAL') as
      | 'TRIAL'
      | 'ATIVA'
      | 'INADIMPLENTE'
      | 'BLOQUEADA'
      | 'CANCELADA',
    diaVencimento: paraDia(formData.get('diaVencimento'), 10),
    diasTolerancia: Math.max(0, Number(formData.get('diasTolerancia') ?? 10) || 10),
    trialAte: trialAteRaw ? new Date(`${trialAteRaw}T12:00:00`) : null,
    observacoes: String(formData.get('observacoes') ?? '').trim() || null,
  };

  await prisma.assinatura.upsert({
    where: { loteadoraId },
    create: { loteadoraId, ...dados },
    update: dados,
  });

  revalidatePath(`/backoffice/empresas/${loteadoraId}`);
  revalidatePath('/backoffice/empresas');
  revalidatePath('/backoffice');
}

/**
 * Liga/desliga o bloqueio manual — a chave que tem prioridade sobre qualquer
 * cálculo de atraso. Enquanto o bloqueio automático não existir, é por aqui
 * que se corta o acesso.
 */
export async function alternarBloqueioManual(
  loteadoraId: string,
  motivo: string | null
): Promise<void> {
  await requireBackoffice();

  const atual = await prisma.assinatura.findUnique({
    where: { loteadoraId },
    select: { bloqueioManual: true },
  });
  if (!atual) throw new Error('Esta empresa não tem assinatura cadastrada.');

  const ligando = !atual.bloqueioManual;
  await prisma.assinatura.update({
    where: { loteadoraId },
    data: {
      bloqueioManual: ligando,
      motivoBloqueio: ligando ? motivo || 'Bloqueado pelo provedor.' : null,
      bloqueadaEm: ligando ? new Date() : null,
    },
  });

  revalidatePath(`/backoffice/empresas/${loteadoraId}`);
  revalidatePath('/backoffice/empresas');
}
