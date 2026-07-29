import { redirect } from 'next/navigation';
import { getSession, type AdminSession } from './auth';
import { prisma } from './prisma';

/**
 * Garante que existe sessão admin válida. Redireciona pra login se não.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return session;
}

/**
 * Retorna o loteadoraId da sessão atual (ou null se for super admin).
 * Use isso pra filtrar queries em páginas tenant-scoped:
 *
 *   const tenantId = await tenantId();
 *   const lotes = await prisma.lote.findMany({
 *     where: tenantId ? { loteamento: { loteadoraId: tenantId } } : {}
 *   });
 */
export async function tenantId(): Promise<string | null> {
  const session = await requireAdmin();
  return session.loteadoraId;
}

/**
 * Hook: super admin ou tenant admin? `isSuperAdmin = true` quando NÃO há tenant.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await requireAdmin();
  return session.loteadoraId === null;
}

/**
 * Bloqueia acesso se não for super admin. Use em páginas exclusivas da plataforma
 * (ex: cadastro de loteadoras, configurações da empresa meuloteamento).
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.loteadoraId !== null) {
    redirect('/admin?erro=acesso-negado');
  }
  return session;
}

/**
 * Verifica se o admin atual tem acesso a uma loteadora específica.
 * Super admin sempre tem. Tenant admin só na sua própria.
 */
export async function canAccessLoteadora(loteadoraId: string): Promise<boolean> {
  const session = await requireAdmin();
  if (session.loteadoraId === null) return true;
  return session.loteadoraId === loteadoraId;
}

/**
 * Mesma coisa pra loteamento — checa via FK.
 * Use só com IDs já validados (cuid).
 */
export async function canAccessLoteamento(
  loteamentoLoteadoraId: string
): Promise<boolean> {
  return canAccessLoteadora(loteamentoLoteadoraId);
}

/**
 * Loteadora "alvo" para telas que exigem UMA loteadora específica
 * (régua de cobrança, conectar WhatsApp, minha loteadora).
 *
 *  - Admin de loteadora  → a própria loteadora dele
 *  - Super admin (geral) → a única loteadora existente (quando só há uma),
 *                          para que ele também consiga operar essas telas
 *
 * Retorna null se for super admin e houver 0 ou mais de 1 loteadora — nesse
 * caso a tela deve pedir para escolher a loteadora em /admin/loteadoras.
 */
export async function loteadoraAlvoId(): Promise<string | null> {
  const session = await requireAdmin();
  if (session.loteadoraId) return session.loteadoraId;

  const todas = await prisma.loteadora.findMany({
    where: { ativo: true },
    select: { id: true },
    take: 2,
  });
  return todas.length === 1 ? todas[0].id : null;
}
