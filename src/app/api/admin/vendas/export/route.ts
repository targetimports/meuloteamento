import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';
import { toCsv, csvHeaders } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await requireAdmin();
  const tid = await tenantId();
  const status = req.nextUrl.searchParams.get('status');

  const vendas = await prisma.venda.findMany({
    where: {
      ...(tid ? { lote: { loteamento: { loteadoraId: tid } } } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      lote: { include: { loteamento: true } },
      cliente: true,
      corretor: true,
    },
    orderBy: { dataContrato: 'desc' },
    take: 10000,
  });

  const rows = vendas.map((v) => ({
    numero: v.numero,
    status: v.status,
    cliente: v.cliente.nome,
    cpfCnpj: v.cliente.cpfCnpj,
    email: v.cliente.email,
    telefone: v.cliente.telefone,
    loteamento: v.lote.loteamento.nome,
    lote: v.lote.codigo,
    corretor: v.corretor?.nome ?? '',
    formaPagamento: v.formaPagamento,
    valorTotal: Number(v.valorTotal).toFixed(2),
    valorEntrada: Number(v.valorEntrada).toFixed(2),
    parcelas: v.numeroParcelas,
    valorParcela: Number(v.valorParcela).toFixed(2),
    dataContrato: v.dataContrato.toISOString().slice(0, 10),
    dataQuitacao: v.dataQuitacao?.toISOString().slice(0, 10) ?? '',
  }));

  const csv = toCsv(rows, [
    { key: 'numero', label: 'Número' },
    { key: 'status', label: 'Status' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'cpfCnpj', label: 'CPF/CNPJ' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'loteamento', label: 'Loteamento' },
    { key: 'lote', label: 'Lote' },
    { key: 'corretor', label: 'Corretor' },
    { key: 'formaPagamento', label: 'Forma' },
    { key: 'valorTotal', label: 'Valor total' },
    { key: 'valorEntrada', label: 'Entrada' },
    { key: 'parcelas', label: 'Parcelas' },
    { key: 'valorParcela', label: 'Parcela' },
    { key: 'dataContrato', label: 'Data contrato' },
    { key: 'dataQuitacao', label: 'Quitada em' },
  ]);

  return new NextResponse(csv, {
    headers: csvHeaders(`vendas-${new Date().toISOString().slice(0, 10)}.csv`),
  });
}
