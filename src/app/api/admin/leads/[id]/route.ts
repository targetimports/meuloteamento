import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      corretor: { select: { id: true, nome: true } },
      loteamento: { select: { nome: true, slug: true, loteadoraId: true } },
      lote: { select: { codigo: true } },
      interacoes: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { nome: true } },
        },
      },
    },
  });

  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Tenant scope
  if (session.loteadoraId && lead.loteamento?.loteadoraId !== session.loteadoraId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    lead: {
      id: lead.id,
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      mensagem: lead.mensagem,
      status: lead.status,
      temperatura: lead.temperatura,
      origem: lead.origem,
      ordem: lead.ordem,
      proximaAcao: lead.proximaAcao,
      proximaAcaoData: lead.proximaAcaoData?.toISOString() ?? null,
      tags: (lead.tags as string[] | null) ?? [],
      corretor: lead.corretor,
      loteamento: lead.loteamento
        ? { nome: lead.loteamento.nome, slug: lead.loteamento.slug }
        : null,
      lote: lead.lote,
      observacoesInternas: lead.observacoesInternas,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      interacoes: lead.interacoes.map((i) => ({
        id: i.id,
        tipo: i.tipo,
        conteudo: i.conteudo,
        resultado: i.resultado,
        user: i.user,
        createdAt: i.createdAt.toISOString(),
      })),
    },
  });
}
