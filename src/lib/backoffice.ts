/**
 * Guard do BACKOFFICE — a área de quem opera a plataforma.
 *
 * Arquivo separado de tenant.ts de propósito. tenant.ts é usado por todo o
 * /admin, que está em produção para a Germanos; alterá-lo para acrescentar
 * regra de backoffice arriscaria o que já funciona. Aqui nada é compartilhado.
 *
 * A CONDIÇÃO É DUPLA: role SUPER_ADMIN **e** loteadoraId nulo.
 *
 * O sistema hoje tem dois conceitos concorrentes de "quem manda": o enum
 * AdminRole e o loteadoraId nulo — e só o segundo decide alguma coisa no
 * /admin. Exigir os dois aqui elimina a ambiguidade no código novo sem mudar
 * a regra do /admin. Conferido no banco: os três super admins têm role
 * SUPER_ADMIN e loteadoraId nulo, então ninguém fica trancado fora.
 */

import { redirect } from 'next/navigation';
import { getSession, type AdminSession } from './auth';

export async function requireBackoffice(): Promise<AdminSession> {
  const session = await getSession();

  // Sem sessão → login. Mesmo destino do /admin: o backoffice não tem login
  // próprio, é a mesma credencial de administrador.
  if (!session) redirect('/admin/login');

  // Admin de loteadora que digitou /backoffice na barra volta para o painel
  // dele. Não é erro, é lugar errado — daí redirect e não uma tela de negado.
  if (session.loteadoraId !== null || session.role !== 'SUPER_ADMIN') {
    redirect('/admin');
  }

  return session;
}

/** Formata Decimal do Prisma (ou number) como "R$ 1.234,56". */
export function brl(valor: unknown): string {
  const n = Number(valor ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Competência atual no formato AAAA-MM. */
export function competenciaAtual(base: Date = new Date()): string {
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
}
