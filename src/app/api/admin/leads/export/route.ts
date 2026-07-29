import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, tenantId } from '@/lib/tenant';
import { toCsv, csvHeaders } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await requireAdmin();
  const tid = await tenantId();
  const url = req.nextUrl;
  const status = url.searchParams.get('status');
  const desde = url.searchParams.get('desde');

  const leads = await prisma.lead.findMany({
    where: {
      ...(tid ? { loteamento: { loteadoraId: tid } } : {}),
      ...(status ? { status: status as any } : {}),
      ...(desde ? { createdAt: { gte: new Date(desde) } } : {}),
    },
    include: { corretor: true, loteamento: true, lote: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const rows = leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    status: l.status,
    temperatura: l.temperatura,
    score: l.score,
    corretor: l.corretor?.nome ?? '',
    loteamento: l.loteamento?.nome ?? '',
    lote: l.lote?.codigo ?? '',
    origem: l.origem ?? '',
    utmSource: l.utmSource ?? '',
    utmCampaign: l.utmCampaign ?? '',
    mensagem: (l.mensagem ?? '').slice(0, 500),
    criado: l.createdAt.toISOString(),
  }));

  const csv = toCsv(rows, [
    { key: 'id', label: 'ID' },
    { key: 'nome', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'status', label: 'Status' },
    { key: 'temperatura', label: 'Temperatura' },
    { key: 'score', label: 'Score' },
    { key: 'corretor', label: 'Corretor' },
    { key: 'loteamento', label: 'Loteamento' },
    { key: 'lote', label: 'Lote' },
    { key: 'origem', label: 'Origem' },
    { key: 'utmSource', label: 'UTM Source' },
    { key: 'utmCampaign', label: 'UTM Campaign' },
    { key: 'mensagem', label: 'Mensagem' },
    { key: 'criado', label: 'Criado em' },
  ]);

  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, { headers: csvHeaders(filename) });
}
