import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { enfileirar, buildIdempotencyKey } from '@/lib/comunicacao';

const pedidoSchema = z.object({ email: z.string().email() });
const trocaSchema = z.object({
  token: z.string().min(20),
  senha: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Troca de senha
  if (body && typeof body === 'object' && 'token' in (body as object)) {
    const parsed = trocaSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'inválido' }, { status: 400 });

    const cliente = await prisma.cliente.findUnique({
      where: { resetPasswordToken: parsed.data.token },
    });
    if (!cliente || !cliente.resetPasswordExpiraEm || cliente.resetPasswordExpiraEm < new Date()) {
      return NextResponse.json({ error: 'token inválido ou expirado' }, { status: 400 });
    }
    const hash = await hashPassword(parsed.data.senha);
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { passwordHash: hash, resetPasswordToken: null, resetPasswordExpiraEm: null },
    });
    return NextResponse.json({ ok: true });
  }

  // Pedido de recuperação
  const rl = await rateLimit({ key: `recuperar:${ip}`, limit: 3, windowSeconds: 600 });
  if (!rl.ok) return NextResponse.json({ error: 'rate limited' }, { status: 429 });

  const parsed = pedidoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'inválido' }, { status: 400 });

  const cliente = await prisma.cliente.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });
  // Sempre responde ok para não revelar existência de conta
  if (!cliente) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { resetPasswordToken: token, resetPasswordExpiraEm: expira },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://meuloteamento.com';
  const link = `${baseUrl}/minha-conta/redefinir-senha?token=${token}`;
  await enfileirar({
    canal: 'EMAIL',
    destinatario: cliente.email,
    assunto: 'Recuperação de senha — meuloteamento',
    template: `<p>Olá {{cliente.nome}},</p>
<p>Você pediu para redefinir sua senha. O link abaixo expira em 1 hora:</p>
<p><a href="{{link}}">{{link}}</a></p>
<p>Se você não pediu isso, ignore este e-mail.</p>`,
    contexto: { cliente: { nome: cliente.nome }, link },
    idempotencyKey: buildIdempotencyKey(['recuperar', cliente.id, token]),
  });

  return NextResponse.json({ ok: true });
}
