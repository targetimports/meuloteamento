'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { signSession, setSessionCookie } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    redirect(`/admin/login?error=${encodeURIComponent('Preencha email e senha.')}`);
  }

  const h = headers();
  const ip =
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  const rl = await rateLimit({
    key: `admin-login:${ip}:${email}`,
    limit: 5,
    windowSeconds: 300,
  });
  if (!rl.ok) {
    redirect(
      `/admin/login?error=${encodeURIComponent(
        `Muitas tentativas. Tente novamente em ${Math.ceil(rl.resetIn / 60)} min.`
      )}`
    );
  }

  const user = await prisma.adminUser.findUnique({
    where: { email },
    include: { loteadora: { select: { ativo: true, nome: true } } },
  });
  if (!user || !user.ativo) {
    redirect(`/admin/login?error=${encodeURIComponent('Credenciais inválidas.')}`);
  }

  // Empresa desativada barra todos os usuários dela de uma vez. Antes disto o
  // campo `ativo` da loteadora não era consultado em lugar nenhum do login:
  // desativar a empresa mudava o rótulo na tela e mais nada.
  //
  // A mensagem é diferente de "credenciais inválidas" de propósito: a senha
  // está certa, e mandar o usuário procurar erro de digitação num acesso
  // suspenso só gera chamado de suporte.
  if (user.loteadora && !user.loteadora.ativo) {
    redirect(
      `/admin/login?error=${encodeURIComponent(
        'Acesso suspenso. Procure o responsável pela sua empresa.'
      )}`
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    redirect(`/admin/login?error=${encodeURIComponent('Credenciais inválidas.')}`);
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    loteadoraId: user.loteadoraId,
  });
  await setSessionCookie(token);

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { ultimoLogin: new Date() },
  });

  // Cada perfil entra na SUA casa. Quem opera a plataforma vai para o
  // backoffice; quem opera loteamento continua indo para /admin, exatamente
  // como antes — a condição só é verdadeira para super admin, então para as
  // loteadoras-cliente nada muda.
  const ehSuperAdmin = user.loteadoraId === null && user.role === 'SUPER_ADMIN';
  redirect(ehSuperAdmin ? '/backoffice' : '/admin');
}
