'use server';

/**
 * Ações do backoffice.
 *
 * O logout é uma cópia de três linhas do que existe em /admin, e não um
 * import de lá, de propósito: importar de dentro do route group do painel do
 * cliente criaria acoplamento entre uma área nova e outra em produção. O
 * custo de duplicar isto é menor que o de amarrar as duas.
 */

import { redirect } from 'next/navigation';
import { clearSessionCookie } from '@/lib/auth';

export async function logoutBackofficeAction() {
  await clearSessionCookie();
  redirect('/admin/login');
}
