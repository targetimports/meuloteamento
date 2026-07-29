import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';
import { hashPassword, verifyPassword } from '@/lib/password';

const schema = z.object({
  nome: z.string().trim().min(2),
  telefone: z.string().trim().min(8),
  aceitaEmail: z.boolean(),
  aceitaWhatsApp: z.boolean(),
  senhaAtual: z.string().optional(),
  novaSenha: z.string().min(8).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getClienteSession();
  if (!session) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'inválido' }, { status: 400 });

  let passwordHash: string | undefined;
  if (parsed.data.novaSenha) {
    if (!parsed.data.senhaAtual) {
      return NextResponse.json({ error: 'Informe a senha atual' }, { status: 400 });
    }
    const cliente = await prisma.cliente.findUnique({
      where: { id: session.sub },
      select: { passwordHash: true },
    });
    if (!cliente?.passwordHash) {
      return NextResponse.json({ error: 'Conta sem senha' }, { status: 400 });
    }
    const ok = await verifyPassword(parsed.data.senhaAtual, cliente.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    passwordHash = await hashPassword(parsed.data.novaSenha);
  }

  await prisma.cliente.update({
    where: { id: session.sub },
    data: {
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      aceitaEmail: parsed.data.aceitaEmail,
      aceitaWhatsApp: parsed.data.aceitaWhatsApp,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
