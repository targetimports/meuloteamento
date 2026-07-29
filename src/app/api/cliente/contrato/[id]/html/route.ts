import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getClienteSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const venda = await prisma.venda.findFirst({
    where: { id: ctx.params.id, clienteId: session.sub },
    select: { contratoHtml: true },
  });
  if (!venda || !venda.contratoHtml) {
    return NextResponse.json({ error: 'contrato não disponível' }, { status: 404 });
  }
  return new NextResponse(venda.contratoHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
