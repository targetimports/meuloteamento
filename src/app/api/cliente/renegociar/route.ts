import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';
import { logParcela, logVenda } from '@/lib/audit';

const schema = z.object({
  vendaId: z.string(),
  novosVencimentos: z.array(z.object({ parcelaId: z.string(), novaData: z.string() })),
});

export async function POST(req: NextRequest) {
  const session = await getClienteSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'inválido' }, { status: 400 });

  const venda = await prisma.venda.findFirst({
    where: { id: parsed.data.vendaId, clienteId: session.sub },
    include: { parcelas: true },
  });
  if (!venda) return NextResponse.json({ error: 'venda não encontrada' }, { status: 404 });

  // Limite: não permitir renegociação se já houve nos últimos 30 dias
  const recente = await prisma.vendaHistorico.findFirst({
    where: {
      vendaId: venda.id,
      action: 'RENEGOCIADA',
      createdAt: { gt: new Date(Date.now() - 30 * 86400000) },
    },
  });
  if (recente) {
    return NextResponse.json(
      { error: 'Já houve renegociação nos últimos 30 dias. Fale com a loteadora.' },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const item of parsed.data.novosVencimentos) {
      const parc = venda.parcelas.find((p) => p.id === item.parcelaId);
      if (!parc) continue;
      const nova = new Date(item.novaData);
      if (isNaN(nova.getTime())) continue;
      if (parc.status === 'PAGO' || parc.status === 'CANCELADO') continue;

      await tx.parcela.update({
        where: { id: parc.id },
        data: { vencimento: nova, status: 'PENDENTE' },
      });
      await logParcela({
        parcelaId: parc.id,
        action: 'RENEGOCIACAO',
        diff: { vencimento: { antes: parc.vencimento, depois: nova } },
        motivo: 'Renegociação self-service do cliente',
        userId: session.sub,
        userType: 'CLIENTE',
        tx,
      });
    }
    await logVenda({
      vendaId: venda.id,
      action: 'RENEGOCIADA',
      diff: { parcelas: parsed.data.novosVencimentos },
      motivo: 'Renegociação self-service',
      userId: session.sub,
      userType: 'CLIENTE',
      tx,
    });
    if (venda.status === 'INADIMPLENTE') {
      await tx.venda.update({ where: { id: venda.id }, data: { status: 'ATIVA' } });
    }
  });

  return NextResponse.json({ ok: true });
}
