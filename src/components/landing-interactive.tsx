'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { IconArrowRight, IconCheck, IconX } from './icons';

// =====================================================================
// HERO SPOTLIGHT — radial gradient que segue o mouse (assinatura Cruip)
// =====================================================================

export function HeroSpotlight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }

  return (
    <div ref={ref} onMouseMove={onMove} className="relative spotlight-host">
      <div className="absolute inset-0 pointer-events-none spotlight-layer" aria-hidden />
      {children}
    </div>
  );
}

// =====================================================================
// PRICING com toggle Mensal / Anual
// =====================================================================

interface Plan {
  name: string;
  monthlyPrice: number;
  tagline: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: string[];
  missing: string[];
}

const plans: Plan[] = [
  {
    name: 'Iniciante',
    monthlyPrice: 197,
    tagline: 'Pra começar a digitalizar a venda',
    cta: 'Começar grátis',
    ctaHref: '/contato',
    featured: false,
    features: [
      '1 loteamento ativo',
      'Até 150 lotes',
      'Landing page personalizada',
      'Captação de leads',
      'Painel administrativo',
      'Suporte por e-mail',
    ],
    missing: ['Integração Asaas', 'Múltiplas loteadoras', 'Domínio próprio'],
  },
  {
    name: 'Profissional',
    monthlyPrice: 497,
    tagline: 'O escolhido por quem leva sério',
    cta: 'Começar grátis',
    ctaHref: '/contato',
    featured: true,
    features: [
      'Até 5 loteamentos',
      'Lotes ilimitados',
      'Branding completo (logo + cores)',
      'Integração Asaas (PIX/Boleto/Cartão)',
      'Lock automático de reserva',
      'Corretores + comissões',
      'Tabelas de preço flexíveis',
      'Webhooks idempotentes',
      'Suporte prioritário (WhatsApp)',
    ],
    missing: ['Domínio próprio'],
  },
  {
    name: 'Empresarial',
    monthlyPrice: 1297,
    tagline: 'Pra grupos com várias loteadoras',
    cta: 'Falar com vendas',
    ctaHref: '/contato',
    featured: false,
    features: [
      'Loteamentos ilimitados',
      'White-label completo',
      'Domínio próprio (CNAME)',
      'API REST para integração',
      'SLA 99,9% garantido',
      'Gerente de conta dedicado',
      'Integração com seu ERP',
      'Onboarding assistido',
    ],
    missing: [],
  },
];

export function PricingTable() {
  const [yearly, setYearly] = useState(true);

  return (
    <>
      {/* Toggle */}
      <div className="flex items-center justify-center mb-12">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-full shadow-sm">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              !yearly ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`relative px-5 py-2 rounded-full text-sm font-medium transition ${
              yearly ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Anual
            <span
              className={`absolute -top-2 -right-1 px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap ${
                yearly ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              -17%
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        {plans.map((p) => {
          const displayPrice = yearly ? Math.round(p.monthlyPrice * 0.83) : p.monthlyPrice;
          const yearlyTotal = displayPrice * 12;
          return (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 ${
                p.featured
                  ? 'bg-slate-900 text-white shadow-2xl shadow-primary-500/30 scale-105 md:-mt-4 border border-primary-500/30'
                  : 'bg-white border border-slate-200 text-slate-900'
              }`}
            >
              {p.featured && (
                <>
                  <div className="absolute -inset-px rounded-3xl bg-gradient-to-r from-primary-500 via-violet-500 to-primary-500 opacity-60 blur-md -z-10 animate-gradient" />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-primary-500 text-white text-xs font-bold rounded-full">
                    MAIS POPULAR
                  </div>
                </>
              )}

              <h3 className={`text-2xl font-bold mb-1 ${p.featured ? 'text-white' : 'text-slate-900'}`}>
                {p.name}
              </h3>
              <p className={`text-sm mb-6 ${p.featured ? 'text-slate-400' : 'text-slate-500'}`}>
                {p.tagline}
              </p>

              <div className="mb-6 h-20">
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm ${p.featured ? 'text-slate-400' : 'text-slate-500'}`}>R$</span>
                  <span className="text-5xl font-bold tabular-nums transition-all">
                    {displayPrice.toLocaleString('pt-BR')}
                  </span>
                  <span className={`${p.featured ? 'text-slate-400' : 'text-slate-500'}`}>/mês</span>
                </div>
                <p className={`text-xs mt-1 ${p.featured ? 'text-slate-500' : 'text-slate-400'}`}>
                  {yearly
                    ? `R$ ${yearlyTotal.toLocaleString('pt-BR')} cobrados anualmente`
                    : 'Cancele quando quiser'}
                </p>
              </div>

              <Link
                href={p.ctaHref}
                className={`flex items-center justify-center gap-2 font-semibold py-3 rounded-xl mb-6 transition ${
                  p.featured
                    ? 'bg-primary-500 hover:bg-primary-400 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {p.cta}
                <IconArrowRight />
              </Link>

              <ul className="space-y-3">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm ${
                      p.featured ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    <IconCheck className={`flex-shrink-0 mt-0.5 ${p.featured ? 'text-primary-400' : 'text-primary-600'}`} />
                    <span>{f}</span>
                  </li>
                ))}
                {p.missing.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm line-through opacity-40 ${
                      p.featured ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    <IconX className="flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
