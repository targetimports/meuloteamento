import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { calcularScoreLead, distribuirLead } from '@/lib/lead-distribution';

const leadSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().trim().min(8),
  mensagem: z.string().trim().optional(),
  loteamentoId: z.string().trim().optional(),
  loteId: z.string().trim().optional(),
  origem: z.string().trim().optional(),
  utm_source: z.string().trim().optional(),
  utm_medium: z.string().trim().optional(),
  utm_campaign: z.string().trim().optional(),
  utm_content: z.string().trim().optional(),
  utm_term: z.string().trim().optional(),
  website: z.string().optional(), // honeypot
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `leads:${ip}`, limit: 5, windowSeconds: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate limited', resetIn: rl.resetIn },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const ua = req.headers.get('user-agent') ?? null;
  const { score, obs } = calcularScoreLead({
    mensagem: parsed.data.mensagem,
    loteId: parsed.data.loteId,
    origem: parsed.data.origem,
  });

  let loteamento = null;
  if (parsed.data.loteamentoId) {
    loteamento = await prisma.loteamento.findUnique({
      where: { id: parsed.data.loteamentoId },
      select: { loteadoraId: true, cidade: true },
    });
  }

  const lead = await prisma.lead.create({
    data: {
      nome: parsed.data.nome,
      email: parsed.data.email,
      telefone: parsed.data.telefone,
      mensagem: parsed.data.mensagem || null,
      loteamentoId: parsed.data.loteamentoId || null,
      loteId: parsed.data.loteId || null,
      origem: parsed.data.origem || 'site',
      score,
      scoreObs: obs,
      ipAddress: ip,
      userAgent: ua,
      utmSource: parsed.data.utm_source ?? null,
      utmMedium: parsed.data.utm_medium ?? null,
      utmCampaign: parsed.data.utm_campaign ?? null,
      utmContent: parsed.data.utm_content ?? null,
      utmTerm: parsed.data.utm_term ?? null,
    },
  });

  await distribuirLead({
    leadId: lead.id,
    loteadoraId: loteamento?.loteadoraId,
    cidade: loteamento?.cidade,
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}
