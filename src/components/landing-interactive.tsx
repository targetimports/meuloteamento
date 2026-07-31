'use client';

import Link from 'next/link';
import { useRef } from 'react';
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
// PRICING — preco mensal unico, sem toggle
// =====================================================================

interface Plan {
  name: string;
  price: number;
  tagline: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: string[];
  missing: string[];
}

const plans: Plan[] = [
  {
    name: 'Profissional',
    price: 500,
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
    price: 1000,
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
  return (
    <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
      {plans.map((p) => (
        <div
          key={p.name}
          className={`relative flex flex-col rounded-3xl p-8 transition duration-300 ${
            p.featured
              ? 'bg-slate-950 text-white border border-gold-500/40 shadow-2xl shadow-gold-600/20 hover:shadow-gold-500/30'
              : 'bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-slate-300 hover:shadow-md'
          }`}
        >
          {p.featured && (
            <>
              {/* Brilho dourado suave atras do card (substitui o gradiente violeta) */}
              <div
                className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-b from-gold-400/50 via-gold-600/20 to-transparent blur-md"
                aria-hidden
              />
              {/* Realce interno no topo, dando profundidade */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-3xl bg-gradient-to-b from-gold-500/10 to-transparent"
                aria-hidden
              />
            </>
          )}

          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className={`text-2xl font-bold ${p.featured ? 'text-white' : 'text-slate-900'}`}>
              {p.name}
            </h3>
            {p.featured && (
              <span className="flex-shrink-0 px-3 py-1 bg-gold-500 text-slate-950 text-[11px] font-bold tracking-wide rounded-full">
                MAIS POPULAR
              </span>
            )}
          </div>

          <p className={`text-sm mb-8 ${p.featured ? 'text-slate-400' : 'text-slate-500'}`}>
            {p.tagline}
          </p>

          <div className="mb-8">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-medium ${p.featured ? 'text-gold-400' : 'text-slate-400'}`}>
                R$
              </span>
              <span
                className={`text-6xl font-bold tabular-nums tracking-tight ${
                  p.featured ? 'text-white' : 'text-slate-900'
                }`}
              >
                {p.price.toLocaleString('pt-BR')}
              </span>
              <span className={`text-base ${p.featured ? 'text-slate-400' : 'text-slate-500'}`}>
                /mês
              </span>
            </div>
            <p className={`text-xs mt-2 ${p.featured ? 'text-slate-500' : 'text-slate-400'}`}>
              Cancele quando quiser
            </p>
          </div>

          <Link
            href={p.ctaHref}
            className={`flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl mb-8 transition ${
              p.featured
                ? 'bg-gold-500 hover:bg-gold-400 text-slate-950 shadow-lg shadow-gold-600/25'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {p.cta}
            <IconArrowRight />
          </Link>

          <div
            className={`h-px w-full mb-6 ${p.featured ? 'bg-white/10' : 'bg-slate-100'}`}
            aria-hidden
          />

          <ul className="space-y-3.5">
            {p.features.map((f) => (
              <li
                key={f}
                className={`flex items-start gap-2.5 text-sm ${
                  p.featured ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                <IconCheck
                  className={`flex-shrink-0 mt-0.5 ${p.featured ? 'text-gold-400' : 'text-primary-600'}`}
                />
                <span>{f}</span>
              </li>
            ))}
            {p.missing.map((f) => (
              <li
                key={f}
                className={`flex items-start gap-2.5 text-sm line-through ${
                  p.featured ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                <IconX className="flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
