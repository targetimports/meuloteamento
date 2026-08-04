import { redirect } from 'next/navigation';
import { getSession, type AdminSession } from './auth';
import { prisma } from './prisma';

/**
 * Garante que existe sessão admin válida. Redireciona pra login se não.
 *
 * Também derruba quem pertence a uma empresa desativada. Barrar só no login
 * não bastaria: o token dura horas, então quem já estivesse dentro seguiria
 * trabalhando depois da suspensão — e é justamente no momento da suspensão
 * que o acesso precisa parar.
 *
 * FALHA ABERTA de propósito: se a consulta der erro, o acesso é liberado.
 * Deixar o cliente fora do sistema por um problema nosso de banco seria pior
 * que atrasar em minutos o corte de um inadimplente.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  if (session.loteadoraId) {
    let suspensa = false;
    try {
      const loteadora = await prisma.loteadora.findUnique({
        where: { id: session.loteadoraId },
        select: { ativo: true },
      });
      // Loteadora sumida (excluída) também derruba: a sessão aponta para algo
      // que não existe mais.
      suspensa = !loteadora || !loteadora.ativo;
    } catch {
      suspensa = false;
    }

    if (suspensa) {
      redirect(
        `/admin/login?error=${encodeURIComponent(
          'Acesso suspenso. Procure o responsável pela sua empresa.'
        )}`
      );
    }
  }

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
/**
 * Aborta se o loteamento não pertence à loteadora de quem está logado.
 * Use no INÍCIO de toda server action que recebe um loteamentoId — proteger só
 * a página não basta, porque a action é um endpoint POST próprio.
 */
export async function assertAcessoLoteamento(loteamentoId: string): Promise<void> {
  const session = await requireAdmin();
  if (!session.loteadoraId) return; // super admin passa

  const lot = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { loteadoraId: true },
  });
  if (!lot || lot.loteadoraId !== session.loteadoraId) {
    throw new Error('Acesso negado: este loteamento é de outra empresa.');
  }
}

/** Mesma checagem, partindo de um lote. */
export async function assertAcessoLote(loteId: string): Promise<void> {
  const session = await requireAdmin();
  if (!session.loteadoraId) return;

  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
    select: { loteamento: { select: { loteadoraId: true } } },
  });
  if (!lote || lote.loteamento.loteadoraId !== session.loteadoraId) {
    throw new Error('Acesso negado: este lote é de outra empresa.');
  }
}

/**
 * Filtro de loteadora para entidades que pendem direto dela (Corretor, por
 * exemplo). Super admin recebe {} e enxerga todas.
 *
 *   const corretores = await prisma.corretor.findMany({
 *     where: { ...(await whereLoteadora()), ativo: true },
 *   });
 */
export async function whereLoteadora(): Promise<{ loteadoraId?: string }> {
  const session = await requireAdmin();
  return session.loteadoraId ? { loteadoraId: session.loteadoraId } : {};
}

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
