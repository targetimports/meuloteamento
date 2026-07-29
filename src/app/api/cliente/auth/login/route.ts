import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { signClienteSession, setClienteCookie } from '@/lib/auth-cliente';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'dados inválidos' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const rl = await rateLimit({ key: `cliente-login:${ip}:${email}`, limit: 5, windowSeconds: 300 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente em ${Math.ceil(rl.resetIn / 60)} min.` },
      { status: 429 }
    );
  }

  const cliente = await prisma.cliente.findUnique({ where: { email } });
  if (!cliente || !cliente.passwordHash) {
    return NextResponse.json({ error: 'credenciais inválidas' }, { status: 401 });
  }
  const ok = await verifyPassword(parsed.data.senha, cliente.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'credenciais inválidas' }, { status: 401 });
  }

  const token = await signClienteSession({
    sub: cliente.id,
    email: cliente.email,
    nome: cliente.nome,
  });
  await setClienteCookie(token);
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { ultimoLogin: new Date() },
  });

  return NextResponse.json({ ok: true });
}
