'use client';

import { useRef, useState } from 'react';
import { IconArrowRight, IconCheck, IconX } from './icons';
import { PlanoContatoModal } from './PlanoContatoModal';

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

interface Feature {
  text: string;
  /** Destaca o item — usado no que diferencia o plano. */
  destaque?: boolean;
}

interface Plan {
  name: string;
  price: number;
  tagline: string;
  cta: string;
  featured: boolean;
  /** Titulo da lista. Deixa explicito que o plano de cima ja inclui o anterior. */
  featuresTitulo: string;
  features: Feature[];
  missing: string[];
}

const plans: Plan[] = [
  {
    name: 'Profissional',
    price: 500,
    tagline: 'O escolhido por quem leva sério',
    cta: 'Começar grátis',
    featured: true,
    featuresTitulo: 'Tudo que você precisa para vender:',
    features: [
      { text: 'Até 5 loteamentos', destaque: true },
      { text: 'Lotes ilimitados' },
      { text: 'Branding completo (logo + cores)' },
      { text: 'Integração Asaas (PIX/Boleto/Cartão)' },
      { text: 'Lock automático de reserva' },
      { text: 'Corretores + comissões' },
      { text: 'Tabelas de preço flexíveis' },
      { text: 'Webhooks idempotentes' },
      { text: 'Suporte prioritário (WhatsApp)' },
    ],
    missing: ['Domínio próprio'],
  },
  {
    name: 'Empresarial',
    price: 1000,
    tagline: 'Pra grupos com várias loteadoras',
    cta: 'Falar com vendas',
    featured: false,
    featuresTitulo: 'Tudo do Profissional, e mais:',
    features: [
      { text: 'Loteamentos ilimitados', destaque: true },
      { text: 'Domínio próprio (CNAME)', destaque: true },
      { text: 'White-label completo' },
      { text: 'API REST para integração' },
      { text: 'SLA 99,9% garantido' },
      { text: 'Gerente de conta dedicado' },
      { text: 'Integração com seu ERP' },
      { text: 'Onboarding assistido' },
    ],
    missing: [],
  },
];

export function PricingTable() {
  // Nome do plano cujo modal esta aberto (null = fechado).
  const [planoAberto, setPlanoAberto] = useState<string | null>(null);

  return (
    <>
    <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
      {plans.map((p) => (
        <div
          key={p.name}
          className={`group relative flex flex-col rounded-3xl p-8 cursor-pointer transition duration-300 hover:-translate-y-1 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-gold-500 ${
            p.featured
              ? 'bg-slate-950 text-white border border-gold-500/40 shadow-2xl shadow-gold-600/20 hover:shadow-gold-500/40 focus-within:ring-offset-slate-50'
              : 'bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-slate-300 hover:shadow-xl'
          }`}
        >
          {p.featured && (
            /*
              Realce interno no topo, dando profundidade. O brilho externo vem
              da sombra dourada no card — nao de uma div com z negativo, que
              saltaria para cima do fundo quando o hover aplica transform.
            */
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-3xl bg-gradient-to-b from-gold-500/10 to-transparent"
              aria-hidden
            />
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

          {/*
            O ::after cobre o card inteiro, entao clicar em qualquer ponto abre
            o modal. E um <button> de verdade: acionavel por teclado e anunciado
            como botao que abre dialogo — melhor que onClick numa div.
          */}
          <button
            type="button"
            onClick={() => setPlanoAberto(p.name)}
            aria-haspopup="dialog"
            aria-label={`${p.cta} — plano ${p.name}`}
            className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl mb-8 transition focus:outline-none after:absolute after:inset-0 after:z-10 after:rounded-3xl after:content-[''] ${
              p.featured
                ? 'bg-gold-500 group-hover:bg-gold-400 text-slate-950 shadow-lg shadow-gold-600/25'
                : 'bg-slate-900 group-hover:bg-slate-800 text-white'
            }`}
          >
            {p.cta}
            <IconArrowRight />
          </button>

          <div
            className={`h-px w-full mb-5 ${p.featured ? 'bg-white/10' : 'bg-slate-100'}`}
            aria-hidden
          />

          <p
            className={`text-xs font-semibold uppercase tracking-wider mb-4 ${
              p.featured ? 'text-gold-400' : 'text-primary-600'
            }`}
          >
            {p.featuresTitulo}
          </p>

          <ul className="space-y-3.5">
            {p.features.map((f) => (
              <li
                key={f.text}
                className={`flex items-start gap-2.5 text-sm ${
                  f.destaque
                    ? p.featured
                      ? 'font-semibold text-white'
                      : 'font-semibold text-slate-900'
                    : p.featured
                      ? 'text-slate-300'
                      : 'text-slate-600'
                }`}
              >
                <IconCheck
                  className={`flex-shrink-0 mt-0.5 ${p.featured ? 'text-gold-400' : 'text-primary-600'}`}
                />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>

          {p.missing.length > 0 && (
            <>
              <p
                className={`text-xs font-semibold uppercase tracking-wider mt-6 mb-3 ${
                  p.featured ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Não incluído:
              </p>
              <ul className="space-y-3.5">
                {p.missing.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm ${
                      p.featured ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    <IconX className="flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </div>

    {planoAberto && (
      <PlanoContatoModal
        planoInicial={planoAberto}
        planos={plans.map(({ name, price, tagline, features }) => ({
          name,
          price,
          tagline,
          destaques: features.slice(0, 4).map((f) => f.text),
        }))}
        onClose={() => setPlanoAberto(null)}
      />
    )}
    </>
  );
}
