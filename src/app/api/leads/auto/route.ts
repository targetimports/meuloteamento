import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { calcularScoreLead, distribuirLead } from '@/lib/lead-distribution';

/**
 * Captura automatica de lead da simulacao OU do checkout abandonado.
 * - Idempotente: se ja existe lead com mesmo email+loteamentoId nos ultimos 7 dias,
 *   atualiza score/mensagem em vez de criar duplicata.
 * - Vincula a loteadora via loteamentoSlug ou loteId.
 * - Auto-distribui pra um corretor (round-robin).
 */

const schema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  telefone: z.string().trim().min(8),
  origem: z.enum([
    'simulacao',
    'checkout-iniciado',
    'checkout-abandonado',
    'comparador',
    'whatsapp-direto',
    'outro',
  ]),
  loteId: z.string().trim().optional(),
  loteamentoSlug: z.string().trim().optional(),
  loteamentoId: z.string().trim().optional(),
  mensagem: z.string().trim().optional(),
  simulacao: z
    .object({
      valorTotal: z.number().optional(),
      valorEntrada: z.number().optional(),
      qtdParcelas: z.number().optional(),
      valorParcela: z.number().optional(),
    })
    .optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

function brl(n?: number): string {
  if (n == null) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildSimulacaoMensagem(s: z.infer<typeof schema>['simulacao']): string {
  if (!s) return '';
  const partes: string[] = [];
  if (s.valorTotal) partes.push(`Total: ${brl(s.valorTotal)}`);
  if (s.valorEntrada) partes.push(`Entrada: ${brl(s.valorEntrada)}`);
  if (s.qtdParcelas && s.valorParcela)
    partes.push(`${s.qtdParcelas}x ${brl(s.valorParcela)}`);
  return partes.join(' · ');
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `leads-auto:${ip}`, limit: 20, windowSeconds: 60 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate limited', resetIn: rl.resetIn }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'dados invalidos' }, { status: 400 });
  }
  const d = parsed.data;
  const email = (d.email && d.email.length > 0 ? d.email : null);

  // Resolver loteamento
  let loteamento:
    | { id: string; loteadoraId: string; cidade: string; nome: string }
    | null = null;
  if (d.loteId) {
    const lote = await prisma.lote.findUnique({
      where: { id: d.loteId },
      select: {
        loteamento: { select: { id: true, loteadoraId: true, cidade: true, nome: true } },
      },
    });
    if (lote) loteamento = lote.loteamento;
  }
  if (!loteamento && d.loteamentoId) {
    loteamento = await prisma.loteamento.findUnique({
      where: { id: d.loteamentoId },
      select: { id: true, loteadoraId: true, cidade: true, nome: true },
    });
  }
  if (!loteamento && d.loteamentoSlug) {
    loteamento = await prisma.loteamento.findUnique({
      where: { slug: d.loteamentoSlug },
      select: { id: true, loteadoraId: true, cidade: true, nome: true },
    });
  }
  if (!loteamento) {
    return NextResponse.json({ error: 'loteamento nao identificado' }, { status: 400 });
  }

  const mensagemBase = d.mensagem ?? '';
  const mensagemSim = buildSimulacaoMensagem(d.simulacao);
  const mensagemCompleta = [mensagemBase, mensagemSim].filter(Boolean).join(' | ');

  // Score: simulacao = QUENTE, checkout-iniciado = QUENTE++, outros = MORNO
  let temperatura: 'FRIO' | 'MORNO' | 'QUENTE' = 'MORNO';
  let scoreBonus = 0;
  if (d.origem === 'checkout-iniciado' || d.origem === 'checkout-abandonado') {
    temperatura = 'QUENTE';
    scoreBonus = 30;
  } else if (d.origem === 'simulacao') {
    temperatura = 'QUENTE';
    scoreBonus = 20;
  }
  const { score: scoreBase, obs } = calcularScoreLead({
    mensagem: mensagemCompleta,
    loteId: d.loteId ?? null,
    origem: d.origem,
  });
  const score = Math.min(100, scoreBase + scoreBonus);

  const ua = req.headers.get('user-agent') ?? null;
  const setedays = new Date(Date.now() - 7 * 86400000);

  // Idempotencia: procura lead recente do mesmo contato no mesmo loteamento
  let existente = null;
  if (email) {
    existente = await prisma.lead.findFirst({
      where: {
        email,
        loteamentoId: loteamento.id,
        createdAt: { gte: setedays },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!existente) {
    const phoneDigits = d.telefone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      existente = await prisma.lead.findFirst({
        where: {
          telefone: { contains: phoneDigits.slice(-9) },
          loteamentoId: loteamento.id,
          createdAt: { gte: setedays },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  if (existente) {
    const novaMsg =
      `[${d.origem}] ${mensagemCompleta}` +
      (existente.mensagem ? `\n---\n${existente.mensagem}` : '');
    await prisma.lead.update({
      where: { id: existente.id },
      data: {
        nome: d.nome.length > existente.nome.length ? d.nome : existente.nome,
        telefone: d.telefone,
        ...(email && !existente.email.includes('@') ? { email } : {}),
        mensagem: novaMsg.slice(0, 2000),
        score: Math.max(existente.score, score),
        temperatura,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, leadId: existente.id, atualizado: true });
  }

  const lead = await prisma.lead.create({
    data: {
      nome: d.nome,
      email: email ?? `sem-email-${Date.now()}@meuloteamento.local`,
      telefone: d.telefone,
      mensagem: `[${d.origem}] ${mensagemCompleta}`.slice(0, 2000) || null,
      loteamentoId: loteamento.id,
      loteId: d.loteId ?? null,
      origem: d.origem,
      score,
      scoreObs: obs,
      temperatura,
      ipAddress: ip,
      userAgent: ua,
      utmSource: d.utm_source ?? null,
      utmMedium: d.utm_medium ?? null,
      utmCampaign: d.utm_campaign ?? null,
    },
  });

  await distribuirLead({
    leadId: lead.id,
    loteadoraId: loteamento.loteadoraId,
    cidade: loteamento.cidade,
  });

  return NextResponse.json({ ok: true, leadId: lead.id, atualizado: false });
}
