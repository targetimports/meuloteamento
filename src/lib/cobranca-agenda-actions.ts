'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { tplAntes, tplVencimento, tplAtraso } from '@/lib/cobranca-templates';

async function resolveLoteadoraComRegua(loteadoraId?: string) {
  const session = await requireAdmin();
  let id = session.loteadoraId;
  if (!id) {
    if (!loteadoraId) throw new Error('Selecione uma loteadora.');
    id = loteadoraId;
  } else if (loteadoraId && loteadoraId !== id) {
    throw new Error('Acesso negado a esta loteadora.');
  }
  const loteadora = await prisma.loteadora.findUnique({ where: { id } });
  if (!loteadora) throw new Error('Loteadora não encontrada.');
  return loteadora;
}

export interface AgendaCobranca {
  diasAntes: number[];
  noVencimento: boolean;
  atrasoDiario: boolean;
}

/**
 * Salva a agenda de cobrança (quais dias enviar). Regenera os passos da régua
 * a partir de uma config simples. Cria a régua se a loteadora ainda não tiver.
 */
export async function salvarAgendaCobranca(
  loteadoraId: string | undefined,
  cfg: AgendaCobranca
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const loteadora = await resolveLoteadoraComRegua(loteadoraId);

    // Garante uma régua vinculada
    let reguaId = loteadora.reguaCobrancaId;
    if (!reguaId) {
      const nova = await prisma.reguaCobranca.create({
        data: { loteadoraId: loteadora.id, nome: 'Régua padrão', ativa: false },
      });
      reguaId = nova.id;
      await prisma.loteadora.update({
        where: { id: loteadora.id },
        data: { reguaCobrancaId: reguaId },
      });
    }

    // Sanitiza dias-antes: inteiros 1..120, únicos, do maior pro menor, máx 8.
    const dias = Array.from(
      new Set(cfg.diasAntes.filter((d) => Number.isInteger(d) && d > 0 && d <= 120))
    )
      .sort((a, b) => b - a)
      .slice(0, 8);

    // Regenera todos os passos
    await prisma.reguaCobrancaPasso.deleteMany({ where: { reguaId } });

    let ordem = 0;
    const passos: {
      reguaId: string;
      ordem: number;
      diasOffset: number;
      canal: 'WHATSAPP';
      template: string;
      ativo: boolean;
    }[] = [];

    for (const d of dias) {
      passos.push({ reguaId, ordem: ordem++, diasOffset: -d, canal: 'WHATSAPP', template: tplAntes(d), ativo: true });
    }
    if (cfg.noVencimento) {
      passos.push({ reguaId, ordem: ordem++, diasOffset: 0, canal: 'WHATSAPP', template: tplVencimento(), ativo: true });
    }
    if (cfg.atrasoDiario) {
      passos.push({ reguaId, ordem: ordem++, diasOffset: 1, canal: 'WHATSAPP', template: tplAtraso(), ativo: true });
    }

    for (const p of passos) {
      await prisma.reguaCobrancaPasso.create({ data: p });
    }

    await prisma.reguaCobranca.update({
      where: { id: reguaId },
      data: { cobrarAtrasoDiario: cfg.atrasoDiario },
    });

    revalidatePath('/admin/envios');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
