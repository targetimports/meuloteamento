/**
 * Layout do BACKOFFICE — separado do /admin de propósito.
 *
 * Hoje o super admin opera por dentro do painel do cliente: as mesmas telas,
 * com o filtro de loteadora devolvendo tudo. Com um cliente só, os dois
 * perfis parecem o mesmo sistema duplicado. Aqui a plataforma ganha lugar
 * próprio — gerir empresas-cliente é outro trabalho, não uma visão ampliada
 * do trabalho delas.
 *
 * Nenhum componente do /admin é reaproveitado. Reusar o layout de lá
 * significaria alterá-lo, e ele está em produção para a Germanos.
 */

import Link from 'next/link';
import { requireBackoffice } from '@/lib/backoffice';
import { logoutBackofficeAction } from './actions';
import {
  NavDashboard,
  NavBuilding,
  NavMoney,
  NavUsers,
  NavSettings,
  NavLogout,
} from '@/components/icons';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  group: 'plataforma' | 'comercial';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/backoffice', label: 'Visão geral', Icon: NavDashboard, group: 'plataforma' },
  { href: '/backoffice/empresas', label: 'Empresas-cliente', Icon: NavBuilding, group: 'plataforma' },
  { href: '/backoffice/cobrancas', label: 'Cobranças', Icon: NavMoney, group: 'plataforma' },
  { href: '/backoffice/planos', label: 'Planos', Icon: NavMoney, group: 'comercial' },
  { href: '/backoffice/interessados', label: 'Interessados', Icon: NavUsers, group: 'comercial' },
  { href: '/backoffice/configuracoes', label: 'Config. da plataforma', Icon: NavSettings, group: 'comercial' },
];

const GROUP_LABEL: Record<NavItem['group'], string> = {
  plataforma: 'Plataforma',
  comercial: 'Comercial',
};

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireBackoffice();

  const initials = (session.nome || session.email)
    .split(' ')
    .map((s) => s.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const groups: NavItem['group'][] = ['plataforma', 'comercial'];

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* ==================== SIDEBAR ==================== */}
      <aside className="w-64 flex-shrink-0 sticky top-0 h-screen flex flex-col bg-slate-900 text-slate-300">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gold-500 text-slate-950 flex items-center justify-center font-bold text-sm">
              ML
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-white text-sm">meuloteamento</p>
              {/* Rótulo diferente do /admin: aqui não se opera loteamento
                  nenhum, se opera a plataforma. */}
              <p className="text-[10px] uppercase tracking-wider text-gold-500">
                Backoffice
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {groups.map((g) => {
            const itens = NAV_ITEMS.filter((i) => i.group === g);
            if (!itens.length) return null;
            return (
              <div key={g}>
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {GROUP_LABEL[g]}
                </p>
                <ul className="space-y-0.5">
                  {itens.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 hover:text-white transition"
                      >
                        <item.Icon className="flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm text-white truncate">{session.nome}</p>
              <p className="text-[11px] text-slate-500 truncate">{session.email}</p>
            </div>
          </div>
          <form action={logoutBackofficeAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <NavLogout className="flex-shrink-0" />
              <span>Sair</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ==================== CONTEÚDO ==================== */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
