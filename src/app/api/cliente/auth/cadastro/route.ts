import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { signClienteSession, setClienteCookie } from '@/lib/auth-cliente';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  cpfCnpj: z.string().min(11),
  senha: z.string().min(8),
});

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `cliente-cadastro:${ip}`, limit: 5, windowSeconds: 600 });
  if (!rl.ok) return NextResponse.json({ error: 'rate limited' }, { status: 429 });

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
  const cpfCnpj = digits(parsed.data.cpfCnpj);

  // Só permite cadastrar senha se o cliente JÁ EXISTE no sistema (foi comprador)
  // E ainda não tem senha definida.
  const cliente = await prisma.cliente.findUnique({ where: { email } });
  if (!cliente) {
    return NextResponse.json(
      { error: 'Cliente não encontrado. Use o e-mail usado na compra.' },
      { status: 404 }
    );
  }
  if (cliente.cpfCnpj !== cpfCnpj) {
    return NextResponse.json({ error: 'CPF/CNPJ não confere' }, { status: 400 });
  }
  if (cliente.passwordHash) {
    return NextResponse.json(
      { error: 'Já existe senha — use "Recuperar senha" se esqueceu.' },
      { status: 400 }
    );
  }

  const hash = await hashPassword(parsed.data.senha);
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      passwordHash: hash,
      emailVerificado: true,
      emailVerifyToken: crypto.randomBytes(16).toString('hex'),
    },
  });

  const token = await signClienteSession({
    sub: cliente.id,
    email: cliente.email,
    nome: cliente.nome,
  });
  await setClienteCookie(token);
  return NextResponse.json({ ok: true });
}
