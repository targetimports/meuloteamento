import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';
import { toCsv, csvHeaders } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await requireAdmin();
  const tid = await tenantId();
  const status = req.nextUrl.searchParams.get('status');
  const desde = req.nextUrl.searchParams.get('desde');
  const ate = req.nextUrl.searchParams.get('ate');

  const parcelas = await prisma.parcela.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(desde || ate
        ? {
            vencimento: {
              ...(desde ? { gte: new Date(desde) } : {}),
              ...(ate ? { lte: new Date(ate) } : {}),
            },
          }
        : {}),
      venda: tid ? { lote: { loteamento: { loteadoraId: tid } } } : undefined,
    },
    include: {
      venda: { include: { cliente: true, lote: true } },
      conta: true,
    },
    orderBy: { vencimento: 'asc' },
    take: 10000,
  });

  const rows = parcelas.map((p) => ({
    venda: p.venda.numero,
    lote: p.venda.lote.codigo,
    cliente: p.venda.cliente.nome,
    numero: p.numero,
    valor: Number(p.valor).toFixed(2),
    vencimento: p.vencimento.toISOString().slice(0, 10),
    pagoEm: p.pagoEm?.toISOString().slice(0, 10) ?? '',
    valorPago: p.valorPago ? Number(p.valorPago).toFixed(2) : '',
    status: p.status,
    conta: p.conta?.nome ?? '',
    asaasPaymentId: p.asaasPaymentId ?? '',
  }));

  const csv = toCsv(rows, [
    { key: 'venda', label: 'Venda' },
    { key: 'lote', label: 'Lote' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'numero', label: 'Parcela' },
    { key: 'valor', label: 'Valor' },
    { key: 'vencimento', label: 'Vencimento' },
    { key: 'pagoEm', label: 'Pago em' },
    { key: 'valorPago', label: 'Valor pago' },
    { key: 'status', label: 'Status' },
    { key: 'conta', label: 'Conta' },
    { key: 'asaasPaymentId', label: 'Asaas ID' },
  ]);

  return new NextResponse(csv, {
    headers: csvHeaders(`parcelas-${new Date().toISOString().slice(0, 10)}.csv`),
  });
}
