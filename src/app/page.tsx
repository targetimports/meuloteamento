import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo, LogoMark } from '@/components/Logo';
import { DashboardMockup } from '@/components/DashboardMockup';
import { HeroSpotlight, PricingTable } from '@/components/landing-interactive';
import {
  CrmKanbanMock,
  ReguaCobrancaMock,
  ContratoDigitalMock,
  AreaClienteMock,
  SimuladorLeadMock,
  IntegracoesMock,
} from '@/components/landing-mockups';
import {
  StatsAnimadas,
  IADestaque,
  EcossistemaOrbit,
  ComparativoConcorrentes,
  NovidadesGrid,
  CTAFlutuante,
} from '@/components/landing-premium';
import { CaseParqueTucano } from '@/components/CaseParqueTucano';
import { prisma } from '@/lib/prisma';
import {
  IconLock,
  IconBrand,
  IconPayment,
  IconDashboard,
  IconUsers,
  IconChart,
  IconCheck,
  IconX,
  IconArrowRight,
} from '@/components/icons';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://meuloteamento.com').replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'meuloteamento — Plataforma para venda de loteamentos online',
  description:
    'Sistema completo para loteadoras: site personalizado por loteamento, mapa interativo, reserva online de lotes, CRM de leads, contrato digital, cobrança automática via PIX/Boleto e área do comprador. Integração nativa com Asaas.',
  keywords: [
    'venda de loteamento online',
    'sistema para loteadoras',
    'CRM imobiliário',
    'reserva de lote online',
    'mapa interativo de loteamento',
    'cobrança PIX loteamento',
    'plataforma loteadora',
    'contrato digital imobiliário',
    'gestão de loteamentos',
  ],
  authors: [{ name: 'meuloteamento' }],
  creator: 'meuloteamento',
  publisher: 'meuloteamento',
  alternates: { canonical: APP_URL },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    siteName: 'meuloteamento',
    title: 'meuloteamento — Plataforma para venda de loteamentos online',
    description:
      'Sistema completo para loteadoras: site personalizado, mapa interativo, reserva online, CRM, contrato digital e cobrança automática.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'meuloteamento — venda de loteamentos online',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'meuloteamento — Plataforma para venda de loteamentos',
    description:
      'Site personalizado, mapa interativo, CRM e cobrança automática para loteadoras.',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'Real estate technology',
};

// JSON-LD: Organization + SoftwareApplication
const ORGANIZATION_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'meuloteamento',
  url: APP_URL,
  logo: `${APP_URL}/logo.png`,
  description:
    'Plataforma SaaS para loteadoras venderem lotes online, com site personalizado, mapa interativo, CRM, contrato digital e cobrança via PIX/Boleto.',
  areaServed: { '@type': 'Country', name: 'Brazil' },
  sameAs: [] as string[],
};

const SOFTWARE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'meuloteamento',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: APP_URL,
  offers: {
    '@type': 'Offer',
    priceCurrency: 'BRL',
    price: '299.00',
  },
  description:
    'Plataforma completa para loteadoras venderem lotes online: site, CRM, cobrança, contrato digital.',
};

// WebSite com SearchAction — permite que o Google exiba a caixa "Sitelinks
// searchbox" pro seu domínio na SERP, dando mais destaque orgânico.
const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'meuloteamento',
  url: APP_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${APP_URL}/?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

// LocalBusiness — reforça sinal geo pro Google Business / Maps.
// Tipo "RealEstateAgent" já é modelado nas landings de loteamento; aqui na
// home usamos o mais amplo pra englobar toda a plataforma.
const LOCAL_BUSINESS_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'meuloteamento',
  url: APP_URL,
  logo: `${APP_URL}/logo.png`,
  image: `${APP_URL}/og-default.png`,
  priceRange: 'R$$',
  areaServed: { '@type': 'Country', name: 'Brasil' },
  serviceType: [
    'Plataforma SaaS para loteadoras',
    'Venda online de lotes',
    'CRM imobiliário',
    'Cobrança automática de parcelas',
    'Contratos digitais',
  ],
};

// Renderiza dinamicamente (estatísticas vêm do banco) — não pré-renderiza no build.
export const dynamic = 'force-dynamic';
export const revalidate = 300; // cache de 5min

/**
 * Calcula estatísticas reais do banco para a landing.
 * Em caso de erro, retorna valores defaults (não trava o build/render).
 */
async function getPlatformStats() {
  try {
    const [vgvAgg, parcelasCount, loteadorasCount, leadsCount] = await Promise.all([
      // VGV total — soma de valorTotal de TODAS as vendas que não foram canceladas
      prisma.venda.aggregate({
        where: { status: { in: ['ATIVA', 'INADIMPLENTE', 'QUITADA'] } },
        _sum: { valorTotal: true },
      }),
      prisma.parcela.count(),
      prisma.loteadora.count(),
      prisma.lead.count(),
    ]);

    const vgvMilhoes = Math.round(Number(vgvAgg._sum.valorTotal ?? 0) / 1_000_000);
    return {
      vgv: vgvMilhoes,
      parcelas: parcelasCount,
      loteadoras: loteadorasCount,
      leads: leadsCount,
    };
  } catch {
    // Banco indisponível? Defaults conservadores pra não quebrar a página.
    return { vgv: 0, parcelas: 0, loteadoras: 1, leads: 0 };
  }
}

export default async function HomePage() {
  const stats = await getPlatformStats();
  return (
    <div className="overflow-x-hidden">
      {/* SEO: dados estruturados JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSONLD) }}
      />

      <Navbar />
      <Hero />
      <LogosMarquee />
      <StatsAnimadas
        stats={[
          // Mostra VGV se houver dados; senão, mostra capacidade da plataforma
          stats.vgv > 0
            ? { prefix: 'R$ ', number: stats.vgv, suffix: 'M', label: 'VGV gerenciado' }
            : { prefix: '+', number: 480, suffix: 'M', label: 'Capacidade (R$)' },
          stats.parcelas > 0
            ? { prefix: '+', number: stats.parcelas, label: 'Parcelas processadas' }
            : { prefix: '+', number: 120_000, label: 'Parcelas/ano de capacidade' },
          { prefix: '+', number: Math.max(1, stats.loteadoras), label: 'Loteadoras ativas' },
          { number: 99, suffix: ',9%', label: 'Uptime contratado' },
        ]}
      />
      <Comparison />
      <ComparativoConcorrentes />
      <EcossistemaOrbit />
      <CaseParqueTucano />
      <IADestaque />
      <NovidadesGrid />
      <Features />
      <DashboardSection />
      <CaptureLeadSection />
      <CobrancaSection />
      <ContratoSection />
      <AreaCompradorSection />
      <IntegracoesSection />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCTA />
      <Footer />
      <CTAFlutuante />
    </div>
  );
}

// =====================================================================
// NAVBAR
// =====================================================================

function Navbar() {
  return (
    <header className="absolute top-0 inset-x-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo variant="light" size={28} />
          {/* Selo desenvolvedora — só aparece em md+ pra não comer espaço no mobile */}
          <a
            href="https://wa.me/5575988411277"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition text-[10px] text-slate-300"
            title="Desenvolvido pela Target Nexus · Tucano-BA"
          >
            <span className="text-amber-400 font-bold">⚡</span>
            <span>por <strong className="text-white">Target Nexus</strong> · Tucano-BA</span>
          </a>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#features" className="text-slate-300 hover:text-white transition">
            Recursos
          </a>
          <a href="#pricing" className="text-slate-300 hover:text-white transition">
            Planos
          </a>
          <a href="#faq" className="text-slate-300 hover:text-white transition">
            FAQ
          </a>
          <Link
            href="/parquetucano"
            className="text-slate-300 hover:text-white transition"
          >
            Ver exemplo →
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/login"
            className="text-sm text-slate-300 hover:text-white transition hidden md:block"
          >
            Entrar
          </Link>
          <Link
            href="#pricing"
            className="bg-white/10 backdrop-blur hover:bg-white/20 border border-white/15 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

// =====================================================================
// HERO
// =====================================================================

function Hero() {
  return (
    <HeroSpotlight>
      <section className="relative mesh-hero overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32">
        {/* ===== Vídeo de fundo (drone sobre loteamento) ===== */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/hero-poster.jpg"
            className="w-full h-full object-cover"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          {/* Overlays: escurece o vídeo e garante leitura do texto */}
          <div className="absolute inset-0 bg-slate-950/75" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-transparent to-slate-950/70" />
        </div>

        {/* ===== Motivo de planta cadastral (subdivisão de lotes) ===== */}
        <svg
          className="absolute inset-0 w-full h-full z-[1] opacity-[0.18] text-primary-300"
          aria-hidden
        >
          <defs>
            <pattern id="lotes-grid" width="120" height="90" patternUnits="userSpaceOnUse">
              <path d="M0 0H120V90H0Z" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M40 0V90M80 0V90M0 45H120" fill="none" stroke="currentColor" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lotes-grid)" />
        </svg>

        {/* ===== Ícones flutuantes: casa, lote, construção ===== */}
        <div className="absolute top-28 right-[8%] hidden lg:block animate-float z-[1] text-white/25">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6" />
          </svg>
        </div>
        <div className="absolute bottom-28 left-[7%] hidden lg:block animate-float-slow z-[1] text-primary-300/40">
          {/* lote demarcado */}
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h18v16H3z" strokeDasharray="2 2" />
            <path d="M3 12h18M12 4v16" />
            <circle cx="3" cy="4" r="1.2" fill="currentColor" />
            <circle cx="21" cy="4" r="1.2" fill="currentColor" />
            <circle cx="3" cy="20" r="1.2" fill="currentColor" />
            <circle cx="21" cy="20" r="1.2" fill="currentColor" />
          </svg>
        </div>
        <div className="absolute top-1/2 left-[4%] hidden xl:block animate-float z-[1] text-white/20">
          {/* guindaste / construção */}
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 21V4l13 2M5 8l13 2M9 21V9M5 4l4 4M18 6v4l-3 3M15 13v3" />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.08] backdrop-blur border border-white/15 rounded-full text-xs text-primary-200 mb-8 animate-fade-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>
              Mapa interativo · CRM · Financeiro · IA · Portal do Cliente · Tudo integrado
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white max-w-5xl mx-auto leading-[1.05] animate-fade-up delay-1 [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]">
            O sistema operacional <br className="hidden md:block" />
            <span className="gradient-text animate-gradient">completo para loteadoras modernas</span>
          </h1>

          <p className="text-lg md:text-2xl text-slate-200 max-w-3xl mx-auto mt-8 animate-fade-up delay-2 leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
            Do mapa interativo ao financeiro. Da reserva online ao contrato assinado.
            <br className="hidden md:block" />
            <strong className="text-white">Uma única plataforma — pensada para escalar.</strong>
          </p>

          {/* Pílulas dos módulos centrais — reforça o "ecossistema" no hero */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 animate-fade-up delay-2">
            {['🗺 Mapa', '👥 CRM', '💰 Financeiro', '🤖 IA', '📱 Portal cliente', '⚡ PIX'].map((m) => (
              <span
                key={m}
                className="text-xs px-3 py-1.5 rounded-full bg-white/[0.06] backdrop-blur border border-white/10 text-slate-200"
              >
                {m}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 animate-fade-up delay-3">
            <Link
              href="#pricing"
              className="group relative inline-flex items-center gap-2 px-6 py-3.5 bg-primary-500 hover:bg-primary-400 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60 transition animate-pulse-glow"
            >
              <span>Começar grátis por 14 dias</span>
              <IconArrowRight className="group-hover:translate-x-1 transition" />
            </Link>
            <Link
              href="/parquetucano"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur text-white font-medium rounded-xl transition"
            >
              <span>Ver demo ao vivo</span>
            </Link>
          </div>

          <p className="text-xs text-slate-300 mt-5 animate-fade-up delay-4">
            Sem cartão de crédito. Cancele quando quiser.
          </p>

          {/* dashboard mockup com glow */}
          <div className="mt-20 relative animate-fade-up delay-4">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/30 via-violet-500/30 to-pink-500/30 blur-3xl opacity-50" />
            <div className="relative">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>
    </HeroSpotlight>
  );
}

// =====================================================================
// LOGOS MARQUEE — "confiam em nós"
// =====================================================================

function LogosMarquee() {
  // Placeholders — substituir pelas loteadoras reais quando tiver
  const loteadoras = [
    'Grupo Germanos',
    'Construtora Aurora',
    'Real Estate Sul',
    'Loteadora Nascer',
    'Vale Empreendimentos',
    'Horizonte Imóveis',
    'Solar Loteamentos',
    'Terra Nova',
  ];
  // duplica pra loop sem corte
  const all = [...loteadoras, ...loteadoras];

  return (
    <section className="bg-slate-950 py-10 border-y border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-6 text-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">
          Loteadoras que já vendem com a gente
        </p>
      </div>
      <div className="relative">
        {/* máscaras laterais */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

        <div className="marquee-track">
          {all.map((nome, i) => (
            <div
              key={`${nome}-${i}`}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition whitespace-nowrap"
            >
              <LogoMark size={20} variant="dark" className="text-slate-600" />
              <span className="text-lg font-semibold tracking-tight">{nome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// TRUST STRIP
// =====================================================================

function Trust() {
  const stats = [
    { value: '99,9%', label: 'Uptime contratado' },
    { value: 'PIX', label: 'Confirmação em segundos' },
    { value: '15min', label: 'Lock automático de reserva' },
    { value: '0', label: 'Lotes vendidos duas vezes' },
  ];

  return (
    <section className="bg-slate-950 py-12 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl md:text-4xl font-bold gradient-text">{s.value}</p>
            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// PROBLEMA vs SOLUÇÃO
// =====================================================================

function Comparison() {
  const antes = [
    'Planilha que ninguém atualiza',
    'Lote vendido pra duas pessoas no mesmo dia',
    'Cliente liga pra perguntar se ainda tem o A-12',
    'WhatsApp lotado de comprovante de pagamento',
    'Contrato impresso e perdido na gaveta',
    'Você descobre que tá inadimplente quando ele vira inadimplência',
  ];

  const depois = [
    'Mapa de lotes atualizado em tempo real',
    'Lock automático impede venda duplicada',
    'Cliente vê disponibilidade direto no site',
    'Asaas confirma pagamento automaticamente',
    'Tudo digital, com histórico completo',
    'Dashboard mostra inadimplência no minuto seguinte',
  ];

  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            A diferença que muda o jogo
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
            Da planilha ao <span className="gradient-text">processo de classe mundial</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 relative">
            <p className="absolute -top-3 left-6 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
              ANTES
            </p>
            <h3 className="font-bold text-slate-900 mb-4">Como você gerencia hoje</h3>
            <ul className="space-y-3">
              {antes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-600">
                  <IconX className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="line-through opacity-60">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-primary-50 via-white to-primary-100/50 border-2 border-primary-200 rounded-2xl p-8 relative card-lift">
            <p className="absolute -top-3 left-6 px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full">
              COM MEULOTEAMENTO
            </p>
            <h3 className="font-bold text-slate-900 mb-4">Como passa a ser</h3>
            <ul className="space-y-3">
              {depois.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-800">
                  <IconCheck className="text-primary-600 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// FEATURES
// =====================================================================

function Features() {
  const features = [
    {
      icon: IconBrand,
      title: 'Landing page por loteamento',
      text: 'Cada empreendimento ganha seu próprio site, com sua identidade visual, fotos, mapa, condições de pagamento e formulário de interesse.',
    },
    {
      icon: IconLock,
      title: 'Lock de reserva automático',
      text: 'Quando alguém inicia a compra, o lote sai do ar por 15 minutos. Trava no banco impede que duas pessoas reservem o mesmo lote simultaneamente.',
    },
    {
      icon: IconPayment,
      title: 'Asaas integrado',
      text: 'PIX, boleto, cartão e parcelamento recorrente. Webhook idempotente faz a baixa automática assim que o pagamento entra na sua conta.',
    },
    {
      icon: IconChart,
      title: 'Captura automática de leads',
      text: 'Cliente que simula ou inicia o checkout vira lead na hora — mesmo sem pagar. O CRM distribui pro corretor certo automaticamente.',
    },
    {
      icon: IconPayment,
      title: 'Régua de cobrança automática',
      text: 'WhatsApp e e-mail de cobrança disparados sozinhos, antes e depois do vencimento. A inadimplência despenca sem ninguém ligar.',
    },
    {
      icon: IconBrand,
      title: 'Contrato digital + assinatura',
      text: 'Gera o contrato preenchido a partir dos dados da venda e envia para assinatura eletrônica via Clicksign. Sem papel, sem cartório de ida e volta.',
    },
    {
      icon: IconUsers,
      title: 'Área do comprador',
      text: 'Seu cliente acessa o portal, vê as parcelas, paga por PIX, baixa o contrato e renegocia sozinho. Menos ligação, mais autonomia.',
    },
    {
      icon: IconUsers,
      title: 'Corretores e comissões',
      text: 'Cadastre sua equipe comercial, distribua leads por round-robin, defina comissão por venda. Cada corretor vê o que é dele.',
    },
    {
      icon: IconDashboard,
      title: 'Painel CRM completo',
      text: 'Dashboard de vendas, funil de leads, financeiro, conciliação, auditoria de cada mudança. Tudo num só lugar, em tempo real.',
    },
  ];

  return (
    <section id="features" className="relative bg-slate-50 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Recursos
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 max-w-3xl mx-auto">
            Tudo que você precisa para{' '}
            <span className="gradient-text">vender mais, com menos erro</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-white border border-slate-200 rounded-2xl p-7 card-lift relative overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition" />
              <div className="relative">
                <div className="inline-flex p-3 bg-primary-50 text-primary-600 rounded-xl mb-4 group-hover:scale-110 transition">
                  <f.icon />
                </div>
                <h3 className="font-bold text-slate-900 mb-2 text-lg">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// DASHBOARD SECTION
// =====================================================================

function DashboardSection() {
  return (
    <section className="bg-slate-950 py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-dark opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] conic-bg opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-3">
              Painel administrativo
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Tudo na palma da{' '}
              <span className="gradient-text">sua mão</span>
            </h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Mapa interativo de lotes, dashboard de vendas, controle de parcelas, conciliação
              automática. Pensado para quem realmente opera o dia a dia do loteamento.
            </p>
            <ul className="space-y-3">
              {[
                'Visualização em mapa, lista e Kanban',
                'Filtros por status, quadra e período',
                'Exportação de relatórios em planilha',
                'Auditoria de cada mudança',
              ].map((i) => (
                <li key={i} className="flex items-center gap-3 text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-primary-500/20 border border-primary-500/40 flex items-center justify-center flex-shrink-0">
                    <IconCheck className="text-primary-300 w-3.5 h-3.5" />
                  </span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary-500/40 to-violet-500/40 blur-3xl opacity-50" />
            <div className="relative">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// CAPTURA DE LEAD — simulador + CRM
// =====================================================================

function CaptureLeadSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Nenhum interessado se perde
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Quem simula vira{' '}
              <span className="gradient-text">lead automático</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Todo cliente que faz uma simulação ou começa o checkout — mesmo sem pagar — entra
              direto no seu funil. O CRM distribui pro corretor certo, calcula a temperatura do
              lead e marca quem está quente.
            </p>
            <ul className="space-y-3">
              {[
                'Captura no simulador e no checkout abandonado',
                'Distribuição automática por round-robin e cidade',
                'Score e temperatura calculados na hora',
                'Kanban com arrastar-soltar e ações em massa',
              ].map((i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <span className="w-6 h-6 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <IconCheck className="text-primary-600 w-3.5 h-3.5" />
                  </span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <SimuladorLeadMock />
            <CrmKanbanMock />
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// COBRANÇA AUTOMÁTICA — régua
// =====================================================================

function CobrancaSection() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="lg:order-2">
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Inadimplência sob controle
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              A cobrança que <span className="gradient-text">funciona sozinha</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Configure uma régua de cobrança e pronto: a plataforma manda WhatsApp e e-mail
              antes do vencimento, no dia e nos dias seguintes — com o PIX copia-e-cola já no
              texto. Você só vê a parcela ser paga.
            </p>
            <ul className="space-y-3">
              {[
                'Mensagens automáticas por WhatsApp, e-mail e SMS',
                'PIX copia-e-cola e link do boleto no próprio texto',
                'Passos configuráveis: −3, 0, +3, +7, +15 dias…',
                'Histórico de cada envio com status de entrega',
              ].map((i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <span className="w-6 h-6 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <IconCheck className="text-primary-600 w-3.5 h-3.5" />
                  </span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:order-1">
            <ReguaCobrancaMock />
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// CONTRATO DIGITAL
// =====================================================================

function ContratoSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Do clique à assinatura
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Contrato gerado e <span className="gradient-text">assinado online</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Cadastre seu modelo de contrato uma vez, com variáveis. A cada venda, a plataforma
              preenche tudo automaticamente — nome, CPF, lote, valores por extenso — e envia para
              assinatura eletrônica via Clicksign. Tudo arquivado, com validade jurídica.
            </p>
            <ul className="space-y-3">
              {[
                'Modelo único com variáveis — preenchimento automático',
                'Compatível com a Lei 6.766/79 (loteamentos)',
                'Assinatura eletrônica via Clicksign ou ZapSign',
                'PDF assinado arquivado e disponível pro cliente',
              ].map((i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <span className="w-6 h-6 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <IconCheck className="text-primary-600 w-3.5 h-3.5" />
                  </span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ContratoDigitalMock />
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// ÁREA DO COMPRADOR
// =====================================================================

function AreaCompradorSection() {
  return (
    <section className="bg-slate-950 py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-dark opacity-40" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] conic-bg opacity-25" />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="lg:order-2">
            <p className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-3">
              Portal do cliente
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Seu comprador se vira{' '}
              <span className="gradient-text">sozinho</span>
            </h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Cada cliente tem acesso à própria área: vê as parcelas, paga por PIX na hora, baixa
              o contrato, pega a segunda via do boleto e até renegocia parcelas atrasadas — sem
              ligar pra ninguém.
            </p>
            <ul className="space-y-3">
              {[
                'Parcelas com PIX copia-e-cola e boleto',
                'Contrato e documentos para download',
                'Renegociação self-service de atrasos',
                'Login próprio, separado do painel admin',
              ].map((i) => (
                <li key={i} className="flex items-center gap-3 text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-primary-500/20 border border-primary-500/40 flex items-center justify-center flex-shrink-0">
                    <IconCheck className="text-primary-300 w-3.5 h-3.5" />
                  </span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:order-1 relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary-500/30 to-violet-500/30 blur-3xl opacity-50" />
            <div className="relative">
              <AreaClienteMock />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// INTEGRAÇÕES
// =====================================================================

function IntegracoesSection() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
              Suas chaves, sua conta
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Integrações <span className="gradient-text">no seu nome</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Cada loteadora conecta as próprias contas — Asaas, WhatsApp, e-mail, Clicksign —
              direto pelo painel. As chaves ficam criptografadas e isoladas. O dinheiro e os
              dados são seus, sempre.
            </p>
            <ul className="space-y-3">
              {[
                'Asaas próprio — recebimento cai na SUA conta',
                'WhatsApp e e-mail com o seu remetente',
                'Clicksign / ZapSign para assinatura de contratos',
                'Configurável pelo painel, sem suporte técnico',
              ].map((i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <span className="w-6 h-6 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <IconCheck className="text-primary-600 w-3.5 h-3.5" />
                  </span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <IntegracoesMock />
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// COMO FUNCIONA
// =====================================================================

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Cadastre seu loteamento',
      text: 'Adicione fotos, mapa, lotes, condições de pagamento e diferenciais. Configure sua identidade visual.',
    },
    {
      n: '02',
      title: 'Publique sua landing page',
      text: 'O site fica no ar com seu domínio (Pro+) ou em meuloteamento.com.br/seuempreendimento. Mobile-first.',
    },
    {
      n: '03',
      title: 'Receba leads e venda',
      text: 'Cliente escolhe lote, paga via Asaas, recebe contrato. Você cuida do seu negócio.',
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Como funciona
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
            Pronto pra vender em <span className="gradient-text">3 passos</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* linha conectora */}
          <div className="hidden md:block absolute top-12 left-12 right-12 h-px bg-gradient-to-r from-primary-200 via-primary-300 to-primary-200" />

          {steps.map((s) => (
            <div key={s.n} className="relative bg-white">
              <div className="w-24 h-24 mx-auto mb-5 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl rotate-6 opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">{s.n}</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 text-center leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// TESTIMONIALS
// =====================================================================

function Testimonials() {
  // Placeholders — substituir pelos depoimentos reais quando tiver
  const items = [
    {
      quote:
        'Em duas semanas migramos toda a planilha pro sistema. Hoje meu time vê o status do lote em tempo real e o cliente nunca mais comprou algo que já tinha sido vendido.',
      name: 'Ricardo Almeida',
      role: 'Diretor comercial',
      company: 'Construtora Aurora',
      initials: 'RA',
      color: 'from-primary-500 to-violet-500',
    },
    {
      quote:
        'A integração com Asaas economiza pelo menos 6 horas semanais. Antes a gente ficava conferindo extrato e batendo no banco. Hoje a baixa é automática.',
      name: 'Camila Vieira',
      role: 'Sócia-fundadora',
      company: 'Vale Empreendimentos',
      initials: 'CV',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      quote:
        'Tinha planilha de 800 linhas com fórmula em tudo. Já perdi conta de lote vendido errado. O lock automático resolveu isso no primeiro dia.',
      name: 'João Pedro Lima',
      role: 'Gerente de vendas',
      company: 'Real Estate Sul',
      initials: 'JP',
      color: 'from-amber-500 to-orange-500',
    },
    {
      quote:
        'A landing page de cada loteamento ficou impecável. Já vendi 3 lotes só pelo formulário do site, sem corretor ter mexido um dedo.',
      name: 'Mariana Souza',
      role: 'Diretora de marketing',
      company: 'Horizonte Imóveis',
      initials: 'MS',
      color: 'from-fuchsia-500 to-pink-500',
    },
    {
      quote:
        'O painel é tão direto que minha sócia, que não é técnica, opera tudo sem precisar me chamar. O suporte responde no WhatsApp em menos de uma hora.',
      name: 'Eduardo Pinheiro',
      role: 'CEO',
      company: 'Loteadora Nascer',
      initials: 'EP',
      color: 'from-sky-500 to-blue-600',
    },
    {
      quote:
        'Migrei dois empreendimentos no mesmo plano. Cada um com sua identidade visual, cada um com sua conta Asaas. Funciona como se fossem sistemas separados.',
      name: 'Patrícia Mendes',
      role: 'Sócia-diretora',
      company: 'Grupo Solar',
      initials: 'PM',
      color: 'from-violet-500 to-purple-600',
    },
  ];

  return (
    <section className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Quem usa, recomenda
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 max-w-3xl mx-auto">
            Histórias reais de quem deixou a{' '}
            <span className="gradient-text">planilha pra trás</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((t) => (
            <figure
              key={t.name}
              className="bg-white border border-slate-200 rounded-2xl p-6 card-lift flex flex-col"
            >
              {/* aspas decorativas */}
              <svg
                className="w-8 h-8 text-primary-200 mb-3"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M9 14H5a1 1 0 0 1-1-1v-3a7 7 0 0 1 7-7v2a5 5 0 0 0-5 5h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1Zm10 0h-4a1 1 0 0 1-1-1v-3a7 7 0 0 1 7-7v2a5 5 0 0 0-5 5h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1Z" />
              </svg>
              <blockquote className="text-slate-700 leading-relaxed mb-5 flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.role} · <span className="font-medium">{t.company}</span>
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// PRICING
// =====================================================================

function Pricing() {
  return (
    <section id="pricing" className="relative bg-slate-50 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Planos
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
            Preço justo. Sem letras miúdas.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            14 dias grátis em qualquer plano. Sem cartão. Migre, faça upgrade ou cancele quando quiser.
          </p>
        </div>

        <PricingTable />

        <p className="text-center text-sm text-slate-500 mt-12">
          Todos os planos incluem hospedagem, SSL, backup diário e atualizações sem custo.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// FAQ
// =====================================================================

function Faq() {
  const items = [
    {
      q: 'Preciso de conhecimento técnico para usar?',
      a: 'Não. O painel foi pensado pra ser usado por quem entende de loteamento, não de software. Em 30 minutos você cadastra seu primeiro empreendimento.',
    },
    {
      q: 'Como funciona a integração com o Asaas?',
      a: 'Você conecta sua própria conta Asaas (a chave fica criptografada). A plataforma gera cobranças automaticamente, recebe webhooks e dá baixa nas parcelas sem você mexer. Funciona com PIX, boleto, cartão e parcelamento recorrente.',
    },
    {
      q: 'O contrato é assinado digitalmente mesmo?',
      a: 'Sim. Você cadastra um modelo de contrato com variáveis, e a cada venda a plataforma preenche tudo automaticamente e envia para assinatura eletrônica via Clicksign ou ZapSign. O PDF assinado fica arquivado e disponível para o comprador na área dele.',
    },
    {
      q: 'A cobrança das parcelas é automática?',
      a: 'É. Você monta uma régua de cobrança (ex: lembrete 3 dias antes, aviso no vencimento, cobrança 3 e 7 dias depois) e a plataforma dispara WhatsApp e e-mail sozinha — com o PIX copia-e-cola já no texto. Cada envio fica registrado com status.',
    },
    {
      q: 'Meu cliente tem acesso a alguma coisa?',
      a: 'Sim. Cada comprador tem a própria área (login separado do painel admin) onde vê as parcelas, paga por PIX, baixa o contrato, pega segunda via de boleto e renegocia atrasos sozinho. Menos ligação para o seu time.',
    },
    {
      q: 'O lote pode ser vendido duas vezes?',
      a: 'Não. Garantimos isso em três camadas: status do lote, transação com lock pessimista no Postgres e índice único parcial no banco. Mesmo com mil pessoas clicando ao mesmo tempo, só uma fecha o negócio.',
    },
    {
      q: 'Posso ter mais de um loteamento?',
      a: 'Sim. No plano Iniciante é um, no Profissional até 5 e no Empresarial ilimitado. Cada um com sua identidade visual, seus lotes e suas condições.',
    },
    {
      q: 'Os dados são meus?',
      a: 'Sim, sempre. Você pode exportar tudo a qualquer momento, e oferecemos backup diário. Se quiser sair, leva seus dados sem fricção.',
    },
    {
      q: 'E se eu já uso uma planilha gigante?',
      a: 'No onboarding do plano Empresarial nós importamos a planilha pra você. Nos demais, você sobe um CSV ou cadastra os lotes em massa via painel.',
    },
  ];

  return (
    <section id="faq" className="bg-white py-24">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">
            Perguntas frequentes
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
            Tirando suas dúvidas
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <details
              key={i}
              className="group bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition"
            >
              <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900">{item.q}</span>
                <svg
                  className="w-5 h-5 text-slate-500 group-open:rotate-180 transition flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="px-5 pb-5 text-slate-700 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// CTA FINAL
// =====================================================================

function FinalCTA() {
  return (
    <section className="relative mesh-hero py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid-dark opacity-50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] conic-bg opacity-30" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <div className="inline-flex p-4 bg-white/5 backdrop-blur border border-white/10 rounded-2xl mb-8">
          <LogoMark size={56} variant="light" className="text-white" />
        </div>

        <h2 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          Pronto pra <span className="gradient-text">vender melhor?</span>
        </h2>
        <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
          Cadastre seu primeiro loteamento em minutos. Sem cartão. Sem compromisso. Sem riscos.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary-500 hover:bg-primary-400 text-white font-semibold rounded-xl shadow-2xl shadow-primary-500/40 transition animate-pulse-glow"
          >
            Começar grátis agora
            <IconArrowRight />
          </Link>
          <Link
            href="/contato"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/15 backdrop-blur text-white font-medium rounded-xl transition"
          >
            Falar com vendas
          </Link>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// FOOTER
// =====================================================================

function Footer() {
  return (
    <footer className="relative bg-slate-950 overflow-hidden">
      {/* Motivo de planta cadastral no fundo */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] text-primary-300" aria-hidden>
        <defs>
          <pattern id="footer-lotes" width="90" height="70" patternUnits="userSpaceOnUse">
            <path d="M0 0H90V70H0Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M45 0V70M0 35H90" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#footer-lotes)" />
      </svg>
      {/* glow superior */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-primary-500/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Faixa skyline — silhueta de casas/prédios */}
        <div className="pt-14">
          <svg
            viewBox="0 0 1200 80"
            preserveAspectRatio="none"
            className="w-full h-12 text-white/[0.07]"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M0 80V58h60V40h40V58h70V30h50v28h60V46h44v12h70V22h54v36h64V52h40v6h74V38h48v20h70V48h46v10h78V60h60v20z"
            />
          </svg>
        </div>

        <div className="grid md:grid-cols-12 gap-10 py-12 border-t border-white/10">
          {/* Marca + pitch */}
          <div className="md:col-span-5">
            <Logo variant="light" size={28} />
            <p className="text-sm text-slate-400 mt-4 max-w-sm leading-relaxed">
              A plataforma definitiva para loteadoras venderem online — do primeiro lead à
              assinatura do contrato. Tecnologia pensada para quem constrói bairros e realiza o
              sonho da casa própria.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {[
                { label: 'Instagram', d: 'M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.5-.1 4.8c-.1 3.2-1.6 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.9-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.1 15.5 2 15.2 2 12s0-3.5.1-4.8C2.2 4 3.7 2.4 7 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.9a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm6.2-8.3a1.2 1.2 0 1 1-2.3 0 1.2 1.2 0 0 1 2.3 0z' },
                { label: 'WhatsApp', d: 'M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8' },
              ].map((s) => (
                <span
                  key={s.label}
                  title={s.label}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d={s.d} />
                  </svg>
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="md:col-span-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Produto
            </p>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li><a href="#features" className="hover:text-white transition">Recursos</a></li>
              <li><a href="#pricing" className="hover:text-white transition">Planos</a></li>
              <li><Link href="/parquetucano" className="hover:text-white transition">Ver demo</Link></li>
              <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Empresa
            </p>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li><Link href="/sobre" className="hover:text-white transition">Sobre</Link></li>
              <li><Link href="/contato" className="hover:text-white transition">Contato</Link></li>
              <li><Link href="/admin/login" className="hover:text-white transition">Painel admin</Link></li>
              <li><Link href="/minha-conta/login" className="hover:text-white transition">Área do comprador</Link></li>
            </ul>
          </div>

          {/* CTA mini */}
          <div className="md:col-span-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Comece hoje
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Cadastre seu primeiro loteamento em minutos. 14 dias grátis.
            </p>
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold rounded-xl transition"
            >
              Criar minha conta
              <IconArrowRight />
            </Link>
          </div>
        </div>

        {/* ===== Bloco "Desenvolvido por" Target Nexus ===== */}
        <div className="py-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-bold mb-2">
                Desenvolvido por
              </p>
              <a
                href="https://wa.me/5575988411277"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 hover:opacity-90 transition"
                aria-label="Site desenvolvido pela Target Nexus"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/uploads/system/target-nexus-logo.jpg"
                  alt="Target Nexus"
                  className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/20 group-hover:ring-amber-400/60 transition"
                />
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">
                    Target Nexus <span className="text-amber-400">AI</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Tecnologia & Soluções
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    📍 Tucano · Bahia
                  </p>
                </div>
              </a>
            </div>

            <div className="text-right text-xs text-slate-500 leading-relaxed">
              <p>
                <strong className="text-slate-300">meuloteamento</strong> é uma plataforma SaaS
                desenvolvida pela Target Nexus
              </p>
              <p className="mt-1 text-[11px]">
                Da idealização à manutenção · 100% nacional
              </p>
            </div>
          </div>
        </div>

        <div className="py-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} meuloteamento · Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Todos os sistemas operacionais
          </div>
        </div>
      </div>
    </footer>
  );
}
