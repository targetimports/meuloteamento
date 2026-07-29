import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Busca global admin — clientes, lotes, vendas, leads.
 * Resultado agrupado, top 5 de cada categoria, escopado por tenant.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ groups: [] });

  const tid = session.loteadoraId;
  const onlyTenant = (cond: object) => (tid ? { ...cond, ...{ loteadoraId: tid } } : cond);
  const onlyTenantLoteamento = (cond: object) =>
    tid ? { ...cond, lote: { loteamento: { loteadoraId: tid } } } : cond;
  const onlyTenantLote = (cond: object) =>
    tid ? { ...cond, loteamento: { loteadoraId: tid } } : cond;

  const [clientes, lotes, vendas, leads] = await Promise.all([
    prisma.cliente.findMany({
      where: onlyTenant({
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { cpfCnpj: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
          { telefone: { contains: q } },
        ],
      }),
      take: 5,
      select: { id: true, nome: true, cpfCnpj: true, telefone: true },
    }),
    prisma.lote.findMany({
      where: onlyTenantLote({
        OR: [
          { codigo: { contains: q, mode: 'insensitive' } },
          { quadra: { contains: q, mode: 'insensitive' } },
          { numero: { contains: q, mode: 'insensitive' } },
        ],
      }),
      take: 5,
      select: {
        id: true,
        codigo: true,
        status: true,
        loteamento: { select: { id: true, nome: true, slug: true } },
      },
    }),
    prisma.venda.findMany({
      where: onlyTenantLoteamento({
        OR: [
          { cliente: { nome: { contains: q, mode: 'insensitive' } } },
          { cliente: { cpfCnpj: { contains: q } } },
        ],
      }),
      take: 5,
      select: {
        id: true,
        numero: true,
        valorTotal: true,
        status: true,
        cliente: { select: { nome: true } },
        lote: { select: { codigo: true } },
      },
    }),
    prisma.lead.findMany({
      where: onlyTenantLoteamento({
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { telefone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }),
      take: 5,
      select: { id: true, nome: true, telefone: true, status: true },
    }),
  ]);

  return NextResponse.json({
    groups: [
      {
        label: 'Clientes',
        items: clientes.map((c) => ({
          href: `/admin/clientes/${c.id}`,
          title: c.nome,
          subtitle: [c.cpfCnpj, c.telefone].filter(Boolean).join(' · '),
        })),
      },
      {
        label: 'Lotes',
        items: lotes.map((l) => ({
          href: `/admin/loteamentos/${l.loteamento.id}/lotes`,
          title: `${l.codigo} · ${l.loteamento.nome}`,
          subtitle: l.status,
        })),
      },
      {
        label: 'Vendas',
        items: vendas.map((v) => ({
          href: `/admin/vendas/${v.id}`,
          title: `#${v.numero} · ${v.cliente.nome}`,
          subtitle: `Lote ${v.lote.codigo} · ${v.status}`,
        })),
      },
      {
        label: 'Leads',
        items: leads.map((ld) => ({
          href: `/admin/leads`,
          title: ld.nome,
          subtitle: [ld.telefone, ld.status].filter(Boolean).join(' · '),
        })),
      },
    ].filter((g) => g.items.length > 0),
  });
}
