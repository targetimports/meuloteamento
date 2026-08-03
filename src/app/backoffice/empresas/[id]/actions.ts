'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, competenciaAtual } from '@/lib/backoffice';

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

  const assinatura = await prisma.assinatura.upsert({
    where: { loteadoraId },
    create: { loteadoraId, ...dados },
    update: dados,
  });

  // Assinatura ativa sem cobrança nenhuma é contrato que ninguém vai pagar.
  // Gera a fatura da competência corrente na hora, para o cadastro já
  // aparecer em Cobranças — antes disso, salvar a assinatura não produzia
  // efeito visível em lugar nenhum.
  //
  // Idempotente: a unicidade (assinaturaId, competencia) vive no banco, então
  // salvar de novo no mesmo mês não duplica. TRIAL fica de fora — período de
  // teste é o que se prometeu de graça.
  if (assinatura.status === 'ATIVA' && Number(assinatura.valorMensal) > 0) {
    const comp = competenciaAtual();
    const jaTem = await prisma.assinaturaFatura.findFirst({
      where: { assinaturaId: assinatura.id, competencia: comp, status: { not: 'CANCELADA' } },
      select: { id: true },
    });

    if (!jaTem) {
      const [ano, mes] = comp.split('-').map(Number);
      await prisma.assinaturaFatura.create({
        data: {
          assinaturaId: assinatura.id,
          competencia: comp,
          valor: assinatura.valorMensal,
          // Meio-dia: evita que o fuso empurre a data para o dia anterior.
          vencimento: new Date(ano, mes - 1, assinatura.diaVencimento, 12, 0, 0),
          status: 'PENDENTE',
          origem: 'AUTOMATICA',
        },
      });
    }
  }

  revalidatePath(`/backoffice/empresas/${loteadoraId}`);
  revalidatePath('/backoffice/empresas');
  revalidatePath('/backoffice/cobrancas');
  revalidatePath('/backoffice');
}

/*
 * O bloqueio manual saiu junto com o botão que o acionava: action sem tela é
 * endpoint exposto sem ninguém olhando. Os campos bloqueioManual,
 * motivoBloqueio e bloqueadaEm continuam no schema, à espera da etapa de
 * bloqueio por inadimplência — apagá-los agora só daria trabalho de recriar.
 *
 * Para cortar o acesso de uma empresa hoje, o caminho é "Desativar empresa"
 * na ficha, que já impede o login de todos os usuários dela.
 */
