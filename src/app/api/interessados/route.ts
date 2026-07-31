import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * Contato de quem quer ASSINAR A PLATAFORMA (dono de loteadora).
 *
 * Proposital: nao grava em `leads`. Lead e quem quer comprar um LOTE, e
 * misturar os dois enchia o CRM dos corretores com gente que nunca vai
 * comprar lote nenhum.
 */

const schema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().trim().min(8),
  plano: z.string().trim().min(1).max(60),
  mensagem: z.string().trim().max(2000).optional(),
  website: z.string().optional(), // honeypot
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `interessados:${ip}`, limit: 5, windowSeconds: 60 });
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Bot preencheu o campo invisivel: responde ok e descarta em silencio.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const interessado = await prisma.interessado.create({
    data: {
      nome: parsed.data.nome,
      email: parsed.data.email,
      telefone: parsed.data.telefone,
      plano: parsed.data.plano,
      mensagem: parsed.data.mensagem || null,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: interessado.id });
}
