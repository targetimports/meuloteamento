import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcularScoreLead, distribuirLead } from '@/lib/lead-distribution';
import { rateLimit, clientIp } from '@/lib/rate-limit';

interface ParsedLead {
  nome: string;
  email: string;
  telefone: string;
  mensagem?: string;
  loteamentoId?: string;
  origem: string;
  utm?: Record<string, string>;
}

function verifyHmac(body: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parseFacebook(payload: unknown): ParsedLead | null {
  const p = payload as {
    field_data?: { name: string; values: string[] }[];
    form_id?: string;
  };
  const data = p?.field_data;
  if (!Array.isArray(data)) return null;
  const get = (name: string) =>
    data.find((d) => d.name.toLowerCase() === name)?.values?.[0] ?? '';
  return {
    nome: get('full_name') || get('nome'),
    email: get('email'),
    telefone: get('phone_number') || get('telefone'),
    mensagem: get('mensagem') || undefined,
    origem: 'facebook-leadads',
  };
}

function parseTypeform(payload: unknown): ParsedLead | null {
  const p = payload as {
    form_response?: {
      answers?: { field?: { ref?: string }; text?: string; email?: string; phone_number?: string }[];
    };
  };
  const answers = p?.form_response?.answers;
  if (!Array.isArray(answers)) return null;
  let nome = '';
  let email = '';
  let telefone = '';
  let mensagem = '';
  for (const a of answers) {
    const ref = a.field?.ref ?? '';
    const val = a.text ?? a.email ?? a.phone_number ?? '';
    if (ref.includes('nome') || ref.includes('name')) nome = val;
    else if (ref.includes('email')) email = val;
    else if (ref.includes('phone') || ref.includes('telefone')) telefone = val;
    else if (ref.includes('mensagem') || ref.includes('message')) mensagem = val;
  }
  return { nome, email, telefone, mensagem: mensagem || undefined, origem: 'typeform' };
}

export async function POST(req: NextRequest, ctx: { params: { provider: string } }) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `lead-webhook:${ip}`, limit: 60, windowSeconds: 60 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  const provider = ctx.params.provider.toLowerCase();
  const secret = process.env[`LEAD_WEBHOOK_SECRET_${provider.toUpperCase()}`];
  if (!secret) {
    return NextResponse.json({ error: 'provider not configured' }, { status: 404 });
  }

  const raw = await req.text();
  const signature =
    req.headers.get('x-hub-signature-256') ||
    req.headers.get('x-typeform-signature') ||
    req.headers.get('x-signature');
  if (!verifyHmac(raw, signature, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  let parsed: ParsedLead | null = null;
  if (provider === 'facebook') parsed = parseFacebook(payload);
  else if (provider === 'typeform') parsed = parseTypeform(payload);
  else return NextResponse.json({ error: 'unknown provider' }, { status: 404 });

  if (!parsed || !parsed.email || !parsed.telefone) {
    return NextResponse.json({ error: 'lead inválido' }, { status: 400 });
  }

  const loteamento = parsed.loteamentoId
    ? await prisma.loteamento.findUnique({
        where: { id: parsed.loteamentoId },
        select: { loteadoraId: true, cidade: true },
      })
    : null;

  const { score, obs } = calcularScoreLead({
    mensagem: parsed.mensagem,
    origem: parsed.origem,
  });

  const lead = await prisma.lead.create({
    data: {
      nome: parsed.nome || 'Sem nome',
      email: parsed.email.toLowerCase().trim(),
      telefone: parsed.telefone.trim(),
      mensagem: parsed.mensagem ?? null,
      loteamentoId: parsed.loteamentoId ?? null,
      origem: parsed.origem,
      score,
      scoreObs: obs,
      ipAddress: ip,
      utmSource: parsed.utm?.source ?? null,
      utmMedium: parsed.utm?.medium ?? null,
      utmCampaign: parsed.utm?.campaign ?? null,
    },
  });

  await distribuirLead({
    leadId: lead.id,
    loteadoraId: loteamento?.loteadoraId,
    cidade: loteamento?.cidade,
  });

  return NextResponse.json({ ok: true, leadId: lead.id });
}
