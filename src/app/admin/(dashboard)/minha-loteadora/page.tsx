import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { loteadoraAlvoId } from '@/lib/tenant';

/**
 * Atalho para editar a loteadora (incluindo chave Asaas e WhatsApp).
 *
 *  - Admin de loteadora → a própria
 *  - Super admin (geral) → a única loteadora existente; se houver várias,
 *    manda pra lista pra ele escolher.
 */
export default async function MinhaLoteadoraRedirect() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const alvo = await loteadoraAlvoId();
  if (!alvo) redirect('/admin/loteadoras');
  redirect(`/admin/loteadoras/${alvo}`);
}
