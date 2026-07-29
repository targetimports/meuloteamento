import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await requireAdmin();
  const tid = await tenantId();

  const venda = await prisma.venda.findUnique({
    where: { id: ctx.params.id },
    select: {
      contratoHtml: true,
      lote: { select: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) return NextResponse.json({ error: 'venda não encontrada' }, { status: 404 });
  if (tid && venda.lote.loteamento.loteadoraId !== tid) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 });
  }
  if (!venda.contratoHtml) {
    return NextResponse.json({ error: 'contrato não gerado' }, { status: 404 });
  }
  return new NextResponse(venda.contratoHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
