import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logoutAction } from './actions';
import {
  NavDashboard,
  NavBuilding,
  NavHomes,
  NavUsers,
  NavBriefcase,
  NavInbox,
  NavChat,
  NavFunil,
  NavDoc,
  NavMoney,
  NavSettings,
  NavLogout,
} from '@/components/icons';
import { CommandPalette } from '@/components/CommandPalette';
import { ThemeToggle, THEME_INIT_SCRIPT } from '@/components/ThemeToggle';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
  tenantOnly?: boolean;
  group: 'atendimento' | 'main' | 'gestao' | 'sistema';
  /** Nome do contador a exibir ao lado (resolvido no servidor). */
  badge?: 'whatsapp' | 'leads';
}

const NAV_ITEMS: NavItem[] = [
  // Atendimento vem antes de tudo: e onde a equipe passa o dia. Dashboard e
  // relatorio se olha algumas vezes ao dia; conversa e funil sao o trabalho.
  {
    href: '/admin/whatsapp/chat',
    label: 'WhatsApp',
    Icon: NavChat,
    group: 'atendimento',
    badge: 'whatsapp',
  },
  {
    href: '/admin/leads',
    label: 'CRM',
    Icon: NavFunil,
    group: 'atendimento',
    badge: 'leads',
  },
  { href: '/admin', label: 'Dashboard', Icon: NavDashboard, group: 'main' },
  { href: '/admin/loteamentos', label: 'Loteamentos', Icon: NavHomes, group: 'main' },
  { href: '/admin/vendas', label: 'Vendas', Icon: NavDoc, group: 'main' },
  { href: '/admin/financeiro', label: 'Financeiro', Icon: NavMoney, group: 'main' },
  { href: '/admin/cobranca-avulsa', label: 'Cobrança avulsa', Icon: NavMoney, group: 'main' },
  { href: '/admin/contas', label: 'Contas', Icon: NavMoney, group: 'main' },
  { href: '/admin/clientes', label: 'Clientes', Icon: NavUsers, group: 'gestao' },
  { href: '/admin/corretores', label: 'Corretores', Icon: NavBriefcase, group: 'gestao' },
  { href: '/admin/comissoes', label: 'Comissões', Icon: NavMoney, group: 'gestao' },
  { href: '/admin/whatsapp', label: 'Conectar WhatsApp', Icon: NavSettings, group: 'sistema' },
  // Quem quer ASSINAR a plataforma (dono de loteadora). Diferente de Lead, que
  // e quem quer comprar um lote. So o dono da plataforma enxerga.
  { href: '/admin/interessados', label: 'Interessados', Icon: NavUsers, superAdminOnly: true, group: 'gestao' },
  { href: '/admin/formularios', label: 'Formulários', Icon: NavDoc, group: 'gestao' },
  { href: '/admin/contratos', label: 'Modelos de contrato', Icon: NavDoc, group: 'gestao' },
  { href: '/admin/regua-cobranca', label: 'Régua de cobrança', Icon: NavMoney, group: 'gestao' },
  { href: '/admin/envios', label: 'Envios automáticos', Icon: NavInbox, group: 'gestao' },
  { href: '/admin/loteadoras', label: 'Loteadoras', Icon: NavBuilding, superAdminOnly: true, group: 'sistema' },
  { href: '/admin/minha-loteadora', label: 'Minha conta / Keys', Icon: NavSettings, group: 'sistema' },
  { href: '/admin/configuracoes', label: 'Plataforma', Icon: NavSettings, superAdminOnly: true, group: 'sistema' },
];

const GROUP_LABEL: Record<NavItem['group'], string> = {
  atendimento: 'Atendimento',
  main: 'Operação',
  gestao: 'Gestão',
  sistema: 'Sistema',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const isSuper = session.loteadoraId === null;
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly && !isSuper) return false;
    if (item.tenantOnly && isSuper) return false;
    return true;
  });

  let loteadoraNome: string | null = null;
  let loteadoraLogo: string | null = null;
  let loteadoraCor: string | null = null;
  if (session.loteadoraId) {
    const l = await prisma.loteadora.findUnique({
      where: { id: session.loteadoraId },
      select: { nome: true, logo: true, corPrimaria: true },
    });
    loteadoraNome = l?.nome ?? null;
    loteadoraLogo = l?.logo ?? null;
    loteadoraCor = l?.corPrimaria ?? null;
  }
  const accent = loteadoraCor ?? '#6366f1';

  /**
   * Contadores do menu de atendimento.
   *
   * O numero ao lado do item e o que transforma "onde clico" em "o que preciso
   * fazer agora": sem ele, a pessoa abre as duas telas para descobrir se ha algo
   * esperando. Sao duas contagens baratas, feitas na mesma renderizacao do menu.
   *
   * O WhatsApp conta so a caixa de QUEM ESTA LOGADO — a caixa e do dono do
   * numero, e mostrar o total da empresa aqui contradiria a tela.
   */
  const [naoLidasWhatsapp, leadsNovos] = await Promise.all([
    prisma.whatsappConversa
      .aggregate({
        where: { arquivada: false, instancia: { userId: session.sub } },
        _sum: { naoLidas: true },
      })
      .then((r) => r._sum.naoLidas ?? 0)
      .catch(() => 0),
    prisma.lead
      .count({
        where: {
          status: 'NOVO',
          ...(session.loteadoraId ? { loteamento: { loteadoraId: session.loteadoraId } } : {}),
        },
      })
      .catch(() => 0),
  ]);
  const contadores: Record<string, number> = {
    whatsapp: naoLidasWhatsapp,
    leads: leadsNovos,
  };

  const groups: NavItem['group'][] = ['atendimento', 'main', 'gestao', 'sistema'];
  const initials = (session.nome || session.email)
    .split(' ')
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {/* ============ SIDEBAR (dark, premium) ============ */}
      <aside className="w-64 flex-shrink-0 sticky top-0 h-screen flex flex-col bg-slate-900 text-slate-300">
        {/* Marca */}
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          >
            ML
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">meuloteamento</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              {isSuper ? 'Plataforma' : 'Painel CRM'}
            </p>
          </div>
        </div>

        {/* Tenant badge */}
        {loteadoraNome && (
          <div className="mx-3 mt-3 p-2.5 rounded-xl bg-white/5 flex items-center gap-2.5">
            {loteadoraLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loteadoraLogo}
                alt={loteadoraNome}
                className="w-8 h-8 rounded-lg object-contain bg-white"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                style={{ background: accent }}
              >
                {loteadoraNome.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">
                Loteadora
              </p>
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {loteadoraNome}
              </p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((g) => {
            const items = navItems.filter((n) => n.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {GROUP_LABEL[g]}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const contador = item.badge ? (contadores[item.badge] ?? 0) : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <item.Icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {contador > 0 && (
                          <span
                            className="ml-auto flex-shrink-0 min-w-[20px] px-1.5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center text-slate-900"
                            style={{ background: accent }}
                          >
                            {contador > 99 ? '99+' : contador}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Perfil + sair */}
        <div className="border-t border-white/5 p-3">
          <Link
            href="/admin/perfil"
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}88)` }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {session.nome}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{session.email}</p>
            </div>
          </Link>
          <form action={logoutAction} className="mt-1">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"
            >
              <NavLogout className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ============ CONTEÚDO ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <CommandPalette />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono">
                ⌘K
              </kbd>
              busca rápida
            </span>
            <ThemeToggle />
            <Link
              href="/admin/leads"
              className="relative w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
              title="Leads"
            >
              <NavInbox className="w-[18px] h-[18px]" />
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <span
              className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded"
              style={{ background: `${accent}22`, color: accent }}
            >
              {session.role.replace('_', ' ')}
            </span>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
