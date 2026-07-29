import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { LeadFormPublic } from '@/components/LeadFormPublic';
import {
  StatsBar,
  GalleryLightbox,
  MapaInterativo,
  MapaVisual,
  WhatsAppFloat,
  type LoteUI,
  type TabelaPrecoUI,
} from '@/components/loteamento-interactive';
import {
  IconTrendingUp,
  IconHomeTree,
  IconShieldCheck,
  IconPeople,
  IconRoad,
  IconLamp,
  IconStore,
  IconPin,
  IconBadge,
  IconInstagram,
  IconArrowRight,
  IconCheck,
  IconSpark,
} from '@/components/icons';
import { HeroSpotlight } from '@/components/landing-interactive';
import { LoteamentoFooter } from '@/components/LoteamentoFooter';
import { VideoPlayer, VideoBackground } from '@/components/VideoPlayer';
import { SimuladorResidencial } from '@/components/SimuladorResidencial';
import { ComparadorLotes } from '@/components/ComparadorLotes';
import { TickerVivo, type TickerEvento } from '@/components/TickerVivo';

interface ItemConteudo {
  titulo: string;
  descricao: string;
  icone?: string;
}

interface Parceiro {
  nome: string;
  descricao?: string;
  logo?: string;
}

function ItemIcon({ icone, className }: { icone?: string; className?: string }) {
  switch (icone) {
    case 'chart':
      return <IconTrendingUp className={className} />;
    case 'home':
      return <IconHomeTree className={className} />;
    case 'shield':
      return <IconShieldCheck className={className} />;
    case 'people':
      return <IconPeople className={className} />;
    case 'road':
      return <IconRoad className={className} />;
    case 'lamp':
      return <IconLamp className={className} />;
    case 'store':
      return <IconStore className={className} />;
    case 'pin':
      return <IconPin className={className} />;
    default:
      return <IconCheck className={className} />;
  }
}

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

/**
 * Carrega dados para o TickerVivo: últimas reservas/vendas, VGV 24h, leads 2h.
 * Anonimiza primeiro nome do cliente (LGPD/discreção) — só primeiro nome.
 */
async function getTickerData(loteamentoId: string): Promise<{
  eventos: TickerEvento[];
  vgvHoje: number;
  leadsRecentes: number;
}> {
  try {
    const agora = new Date();
    const ontem = new Date(agora.getTime() - 24 * 3600 * 1000);
    const duasHorasAtras = new Date(agora.getTime() - 2 * 3600 * 1000);

    const [vendasRecentes, vgvAgg, leadsCount] = await Promise.all([
      // Últimas 6 vendas (qualquer status exceto cancelada/distratada)
      prisma.venda.findMany({
        where: {
          lote: { loteamentoId },
          status: { in: ['ATIVA', 'INADIMPLENTE', 'QUITADA'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          createdAt: true,
          status: true,
          cliente: { select: { nome: true } },
          lote: { select: { codigo: true } },
        },
      }),
      // VGV últimas 24h
      prisma.venda.aggregate({
        where: {
          lote: { loteamentoId },
          status: { in: ['ATIVA', 'INADIMPLENTE', 'QUITADA'] },
          createdAt: { gte: ontem },
        },
        _sum: { valorTotal: true },
      }),
      // Leads últimas 2h
      prisma.lead.count({
        where: { loteamentoId, createdAt: { gte: duasHorasAtras } },
      }),
    ]);

    function tempoRelativo(d: Date): string {
      const ms = Date.now() - d.getTime();
      const min = Math.round(ms / 60000);
      if (min < 1) return 'agora';
      if (min < 60) return `há ${min} min`;
      const h = Math.round(min / 60);
      if (h < 24) return `há ${h}h`;
      const dias = Math.round(h / 24);
      return `há ${dias}d`;
    }

    const eventos: TickerEvento[] = vendasRecentes.map((v) => ({
      tipo: v.status === 'QUITADA' ? 'comprou' : 'reservou',
      // Pega só primeiro nome — discrição
      nome: (v.cliente.nome.split(' ')[0] ?? 'Alguém').slice(0, 24),
      loteCodigo: v.lote.codigo,
      quando: tempoRelativo(v.createdAt),
    }));

    return {
      eventos,
      vgvHoje: Number(vgvAgg._sum.valorTotal ?? 0),
      leadsRecentes: leadsCount,
    };
  } catch {
    return { eventos: [], vgvHoje: 0, leadsRecentes: 0 };
  }
}

async function getLoteamento(slug: string) {
  return prisma.loteamento.findUnique({
    where: { slug },
    include: {
      loteadora: true,
      lotes: {
        orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
      },
      tabelasPreco: {
        where: { ativo: true },
        orderBy: { ordem: 'asc' },
      },
    },
  });
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://meuloteamento.com').replace(/\/+$/, '');

function absolutize(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${APP_URL}${path.startsWith('/') ? path : '/' + path}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const l = await getLoteamento(params.slug);
  if (!l || !l.publicado) {
    return {
      title: 'Loteamento não encontrado',
      robots: { index: false, follow: false },
    };
  }

  const titleBase = l.tagline
    ? `${l.nome} — ${l.tagline}`
    : `${l.nome} em ${l.cidade}/${l.estado}`;
  const fullTitle = `${titleBase} | ${l.loteadora.nome}`;
  const description =
    l.descricao ||
    l.tagline ||
    `${l.nome}: loteamento em ${l.cidade}/${l.estado}, com lotes a partir de ${
      l.parcelaAPartirDe ? `R$ ${Number(l.parcelaAPartirDe).toFixed(0)}/mês` : 'condições especiais'
    }. ${l.lotes.length} lotes ${l.permiteFinanciamento ? 'com financiamento direto' : 'à venda'}.`;
  const imgCapa = absolutize(l.imagemCapa);
  const canonical = `${APP_URL}/${l.slug}`;

  return {
    title: fullTitle,
    description: description.slice(0, 160),
    keywords: [
      l.nome,
      `loteamento em ${l.cidade}`,
      `lotes em ${l.cidade}`,
      `loteamento ${l.cidade}/${l.estado}`,
      `${l.loteadora.nome}`,
      'comprar lote',
      'loteamento aberto',
      'financiamento de lote',
      l.permiteFinanciamento ? 'lote parcelado' : '',
    ].filter(Boolean) as string[],
    authors: [{ name: l.loteadora.nome }],
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      url: canonical,
      siteName: l.loteadora.nome,
      title: fullTitle,
      description: description.slice(0, 200),
      images: imgCapa
        ? [{ url: imgCapa, width: 1200, height: 630, alt: `${l.nome} — ${l.cidade}/${l.estado}` }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: description.slice(0, 160),
      images: imgCapa ? [imgCapa] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function LoteamentoPublicPage({ params }: PageProps) {
  const loteamento = await getLoteamento(params.slug);
  if (!loteamento || !loteamento.publicado || !loteamento.ativo) notFound();

  // Detecta se a requisição vem por SUBDOMÍNIO (ex: parquetucano.meuloteamento.com)
  // ou domínio principal (meuloteamento.com/parquetucano). Isso decide o href
  // da logo: subdomínio → "/" (raiz). Domínio principal → "/{slug}".
  // Sem essa detecção, o link "/parquetucano" no subdomínio vira
  // "parquetucano.meuloteamento.com/parquetucano" → 404 (middleware tenta
  // rewrite duplicado).
  const hdrs = headers();
  const hostHeader = (hdrs.get('host') || '').toLowerCase().split(':')[0];
  const baseDomain = (process.env.BASE_DOMAIN || 'meuloteamento.com').toLowerCase();
  const isSubdomain =
    hostHeader.endsWith(`.${baseDomain}`) &&
    hostHeader !== baseDomain &&
    hostHeader !== `www.${baseDomain}`;
  const homeHref = isSubdomain ? '/' : `/${loteamento.slug}`;

  // ===== Eventos REAIS para o Ticker (Onda 2) =====
  // Carrega últimas reservas/vendas + VGV 24h + leads 2h. Tudo num try/catch
  // pra não quebrar a página se algum índice falhar.
  const tickerData = await getTickerData(loteamento.id);

  const { loteadora } = loteamento;
  const corPrimaria = loteadora.corPrimaria ?? '#0284c7';
  const corSecundaria = loteadora.corSecundaria ?? '#0c4a6e';

  // Serializa Decimals para o client component
  const lotesUI: LoteUI[] = loteamento.lotes.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    quadra: l.quadra,
    numero: l.numero,
    area: Number(l.area),
    testada: l.testada ? Number(l.testada) : null,
    fundo: l.fundo ? Number(l.fundo) : null,
    preco: Number(l.preco),
    descricao: l.descricao,
    status: l.status,
    tipo: l.tipo,
    motivoBloqueio: l.motivoBloqueio,
    orientacaoSolar: l.orientacaoSolar,
    esquina: l.esquina,
    fronteAreaVerde: l.fronteAreaVerde,
    fotos: l.fotos,
    mapaX: l.mapaX,
    mapaY: l.mapaY,
    mapaLargura: l.mapaLargura,
    mapaAltura: l.mapaAltura,
  }));

  const tabelasUI: TabelaPrecoUI[] = loteamento.tabelasPreco.map((t) => ({
    id: t.id,
    nome: t.nome,
    descricao: t.descricao,
    descontoPct: t.descontoPct ? Number(t.descontoPct) : null,
    entradaPct: t.entradaPct ? Number(t.entradaPct) : null,
    parcelasMin: t.parcelasMin,
    parcelasMax: t.parcelasMax,
  }));

  const documentos = (loteamento.documentos as { nome: string; url: string }[] | null) ?? [];
  const porqueInvestir = (loteamento.porqueInvestir as ItemConteudo[] | null) ?? [];
  const infraestrutura = (loteamento.infraestrutura as ItemConteudo[] | null) ?? [];
  const parceiros = (loteadora.parceiros as Parceiro[] | null) ?? [];
  const cidadeFotos = (loteamento.cidadeFotos as { url: string; legenda?: string }[] | null) ?? [];
  const whatsappPhone = loteadora.whatsapp ?? '';
  const whatsappMsg = `Olá! Tenho interesse em saber mais sobre o ${loteamento.nome}.`;

  // ============ JSON-LD: dados estruturados para Google ============
  const canonical = `${APP_URL}/${loteamento.slug}`;
  const precoMin = loteamento.lotes.length
    ? Math.min(...loteamento.lotes.map((x) => Number(x.preco)))
    : null;
  const precoMax = loteamento.lotes.length
    ? Math.max(...loteamento.lotes.map((x) => Number(x.preco)))
    : null;
  const lotesDisponiveis = loteamento.lotes.filter((x) => x.status === 'DISPONIVEL').length;
  const imgCapaAbs = absolutize(loteamento.imagemCapa);

  const placeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: loteamento.nome,
    description: loteamento.descricao ?? loteamento.tagline ?? `Loteamento ${loteamento.nome} em ${loteamento.cidade}/${loteamento.estado}.`,
    url: canonical,
    image: imgCapaAbs ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: loteamento.endereco,
      addressLocality: loteamento.cidade,
      addressRegion: loteamento.estado,
      postalCode: loteamento.cep ?? undefined,
      addressCountry: 'BR',
    },
    geo:
      loteamento.lat && loteamento.lng
        ? {
            '@type': 'GeoCoordinates',
            latitude: loteamento.lat,
            longitude: loteamento.lng,
          }
        : undefined,
  };

  const productJsonLd = precoMin != null
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: `Lotes — ${loteamento.nome}`,
        description: `${loteamento.lotes.length} lotes em ${loteamento.cidade}/${loteamento.estado}, ${lotesDisponiveis} disponíveis.`,
        image: imgCapaAbs ?? undefined,
        brand: { '@type': 'Brand', name: loteadora.nome },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'BRL',
          lowPrice: precoMin,
          highPrice: precoMax,
          offerCount: lotesDisponiveis,
          availability:
            lotesDisponiveis > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
        },
      }
    : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: loteamento.nome, item: canonical },
    ],
  };

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: loteadora.nome,
    url: loteadora.site ?? canonical,
    logo: absolutize(loteadora.logo) ?? undefined,
    telephone: loteadora.telefone ?? loteadora.whatsapp ?? undefined,
    email: loteadora.email ?? undefined,
    address: loteadora.endereco
      ? {
          '@type': 'PostalAddress',
          streetAddress: loteadora.endereco,
          addressLocality: loteadora.cidade ?? loteamento.cidade,
          addressRegion: loteadora.estado ?? loteamento.estado,
          postalCode: loteadora.cep ?? undefined,
          addressCountry: 'BR',
        }
      : undefined,
    sameAs: loteadora.instagram
      ? [`https://instagram.com/${loteadora.instagram.replace('@', '')}`]
      : undefined,
  };

  return (
    <div
      className="overflow-x-hidden"
      style={
        {
          '--cor-primaria': corPrimaria,
          '--cor-secundaria': corSecundaria,
        } as React.CSSProperties
      }
    >
      {/* SEO: dados estruturados JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* ============ HEADER ============ */}
      <Header
        loteamento={loteamento}
        loteadora={loteadora}
        corPrimaria={corPrimaria}
        homeHref={homeHref}
      />

      {/* ============ HERO CINEMÁTICO ============ */}
      <Hero
        loteamento={{
          nome: loteamento.nome,
          cidade: loteamento.cidade,
          estado: loteamento.estado,
          imagemCapa: loteamento.imagemCapa,
          tagline: loteamento.tagline,
          subtagline: loteamento.subtagline,
          parcelaAPartirDe: loteamento.parcelaAPartirDe ? Number(loteamento.parcelaAPartirDe) : null,
          endereco: loteamento.endereco,
          videoHero: loteamento.videoHero,
          videoHeroPoster: loteamento.videoHeroPoster,
        }}
        corPrimaria={corPrimaria}
        corSecundaria={corSecundaria}
        totalLotes={lotesUI.length}
        lotesDisponiveis={lotesUI.filter((l) => l.status === 'DISPONIVEL').length}
        infraItems={infraestrutura.map((i) => i.titulo)}
      />

      {/* ============ APRESENTAÇÃO PRINCIPAL (vídeo) ============ */}
      {loteamento.videoApresentacao && (
        <section className="bg-white py-20 relative overflow-hidden">
          <div
            className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-10"
            style={{ background: corPrimaria }}
          />
          <div className="relative max-w-5xl mx-auto px-6">
            <div className="text-center mb-8">
              <p
                className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: corPrimaria }}
              >
                Conheça o empreendimento
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Veja o {loteamento.nome} em ação
              </h2>
              <p className="text-slate-600 mt-3 max-w-2xl mx-auto">
                Um passeio pela infraestrutura, ruas e localização — direto da fonte.
              </p>
            </div>
            <VideoPlayer
              src={loteamento.videoApresentacao}
              poster={loteamento.videoApresentacaoPoster}
              corPrimaria={corPrimaria}
            />
          </div>
        </section>
      )}

      {/* ============ STATS ANIMADOS ============ */}
      <StatsBar lotes={lotesUI} corPrimaria={corPrimaria} />

      {/* ============ SOBRE + DIFERENCIAIS ============ */}
      <section id="sobre" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            <p
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: corPrimaria }}
            >
              Sobre o empreendimento
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-5 leading-tight">
              {loteamento.nome}
            </h2>
            {loteamento.descricao ? (
              <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap">
                {loteamento.descricao}
              </p>
            ) : (
              <p className="text-slate-500 italic">Descrição em breve.</p>
            )}
          </div>
          {loteamento.diferenciais.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-4">
                Diferenciais
              </h3>
              <ul className="space-y-3">
                {loteamento.diferenciais.map((d) => (
                  <li key={d} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                      style={{ background: corPrimaria }}
                    >
                      ✓
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* ============ POR QUE INVESTIR ============ */}
      {porqueInvestir.length > 0 && (
        <section id="investir" className="bg-slate-50 py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <p
                className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: corPrimaria }}
              >
                Por que investir
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Por que investir no{' '}
                <span style={{ color: corPrimaria }}>{loteamento.nome}?</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {porqueInvestir.map((item, i) => (
                <div
                  key={i}
                  className="group bg-white border border-slate-200 rounded-2xl p-6 card-lift relative overflow-hidden"
                >
                  <div
                    className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition"
                    style={{ background: corPrimaria }}
                  />
                  <div className="relative">
                    <div
                      className="inline-flex p-3 rounded-xl mb-4 group-hover:scale-110 transition shadow-md"
                      style={{ background: corPrimaria, color: 'white' }}
                    >
                      <ItemIcon icone={item.icone} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.titulo}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ INFRAESTRUTURA COMPLETA ============ */}
      {infraestrutura.length > 0 && (
        <section
          className="py-20 relative overflow-hidden text-white"
          style={{ background: `linear-gradient(135deg, ${corSecundaria}, ${corPrimaria})` }}
        >
          <div className="absolute inset-0 bg-grid-dark opacity-30" />
          <div className="absolute -top-20 -right-20 w-[400px] h-[400px] conic-bg animate-spin-slow opacity-20" />

          <div className="relative max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">
                Infraestrutura
              </p>
              <h2 className="text-3xl md:text-4xl font-bold">Infraestrutura completa</h2>
              <p className="mt-3 opacity-85 max-w-2xl mx-auto">
                Loteamento planejado pra você morar, investir e crescer com tranquilidade.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {infraestrutura.map((item, i) => (
                <div
                  key={i}
                  className="glass rounded-2xl p-6 hover:bg-white/10 transition group"
                >
                  <div className="inline-flex p-3 rounded-xl bg-white/10 mb-4 group-hover:scale-110 transition">
                    <ItemIcon icone={item.icone} className="text-white" />
                  </div>
                  <h3 className="font-bold mb-1.5">{item.titulo}</h3>
                  <p className="text-xs opacity-80 leading-relaxed">{item.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ SOBRE A CIDADE (Tucano-BA) ============ */}
      {cidadeFotos.length > 0 && loteamento.cidadeTexto && (
        <section className="bg-white py-20 relative overflow-hidden">
          <div
            className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-10"
            style={{ background: corPrimaria }}
          />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <p
                className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: corPrimaria }}
              >
                A cidade
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                {loteamento.cidadeTitulo ?? `Conheça ${loteamento.cidadeTitulo ?? loteamento.cidade}`}
              </h2>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-center">
              {/* Coluna esquerda: foto aérea grande */}
              <div className="lg:col-span-7">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-slate-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cidadeFotos[0].url}
                    alt={cidadeFotos[0].legenda ?? 'Tucano - BA'}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  {cidadeFotos[0].legenda && (
                    <p className="absolute bottom-4 left-5 right-5 text-white text-sm font-medium drop-shadow">
                      {cidadeFotos[0].legenda}
                    </p>
                  )}
                  <div
                    className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg text-white"
                    style={{ background: corPrimaria }}
                  >
                    📍 {loteamento.cidade} — {loteamento.estado}
                  </div>
                </div>
              </div>

              {/* Coluna direita: texto + foto secundária */}
              <div className="lg:col-span-5 space-y-6">
                <div className="prose prose-slate max-w-none">
                  {loteamento.cidadeTexto.split('\n\n').map((paragrafo, i) => (
                    <p
                      key={i}
                      className="text-slate-700 leading-relaxed mb-3 text-base"
                    >
                      {paragrafo}
                    </p>
                  ))}
                </div>
                {cidadeFotos[1] && (
                  <div className="relative rounded-2xl overflow-hidden shadow-lg ring-1 ring-slate-200 group max-w-[260px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cidadeFotos[1].url}
                      alt={cidadeFotos[1].legenda ?? 'Tucano'}
                      className="w-full aspect-[3/4] object-cover group-hover:scale-105 transition duration-700"
                    />
                    {cidadeFotos[1].legenda && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <p className="text-white text-xs font-medium">
                          {cidadeFotos[1].legenda}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Galeria adicional caso tenha 3+ fotos */}
            {cidadeFotos.length > 2 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                {cidadeFotos.slice(2).map((f, i) => (
                  <div
                    key={i}
                    className="relative rounded-xl overflow-hidden aspect-square ring-1 ring-slate-200 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt={f.legenda ?? `Tucano ${i + 3}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============ CALDAS DO JORRO (só Parque Tucano) ============ */}
      {/*
        Distrito turístico de Tucano-BA — bloco fixo de conteúdo focado em
        valorização imobiliária. Renderiza apenas para o slug "parquetucano"
        (loteamento específico). As fotos são procuradas em
        /uploads/parquetucano/caldas-jorro-{1..4}.jpg — quando ainda não foram
        subidas, o fallback é um gradiente com ícone (server-side check via fs).
      */}
      {(() => {
        if (loteamento.slug !== 'parquetucano') return null;
        const PUBLIC_DIR = path.join(process.cwd(), 'public');
        const fotoCaldas = (n: number) => {
          const rel = `/uploads/parquetucano/caldas-jorro-${n}.jpg`;
          const abs = path.join(PUBLIC_DIR, rel);
          try { return fs.existsSync(abs) ? rel : null; } catch { return null; }
        };
        const fotos = [1, 2, 3, 4].map(fotoCaldas);
        return (
        <section className="relative py-20 overflow-hidden bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50">
          {/* decoração */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-20 bg-cyan-300 -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-20 bg-emerald-300 translate-y-1/3 -translate-x-1/4" />

          <div className="relative max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <p
                className="text-sm font-semibold uppercase tracking-wider mb-3 inline-flex items-center gap-2"
                style={{ color: corPrimaria }}
              >
                <span>♨</span>
                Atrativo turístico do município
              </p>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900">
                Caldas do Jorro
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
                O distrito termal de Tucano que está mudando o ritmo de
                crescimento e valorização da região.
              </p>
            </div>

            {/* Grid principal: foto grande + bloco de texto/fatos */}
            <div className="grid lg:grid-cols-12 gap-8 items-stretch mb-8">
              {/* Foto grande */}
              <div className="lg:col-span-7">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-cyan-200/60 group h-full min-h-[360px]">
                  {/* Fundo gradient sempre presente (fallback visual) */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 via-sky-700 to-emerald-700" />
                  {fotos[0] && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={fotos[0]}
                      alt="Caldas do Jorro — águas termais de Tucano/BA"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                  )}
                  {/* Overlay escurecedor pra texto ficar legível */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg text-white bg-cyan-600">
                    ♨ Águas termais sulfurosas
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <p className="text-2xl md:text-3xl font-bold drop-shadow mb-1">
                      A 30 min do Parque Tucano
                    </p>
                    <p className="text-sm md:text-base text-white/90 drop-shadow">
                      Distrito turístico em ascensão · Hotelaria termal,
                      gastronomia e turismo de bem-estar
                    </p>
                  </div>
                </div>
              </div>

              {/* Card com fatos/diferenciais */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-6">
                  <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                    <span className="text-2xl">📈</span>
                    Por que isso valoriza o seu lote?
                  </h3>
                  <ul className="space-y-3 text-sm text-slate-700">
                    <li className="flex gap-3">
                      <span className="text-cyan-600 font-bold shrink-0">→</span>
                      <span>
                        <strong>Turismo de bem-estar em alta:</strong> as águas
                        sulfurosas de Caldas do Jorro são únicas na Bahia e
                        atraem visitantes de todo o Nordeste o ano inteiro.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-cyan-600 font-bold shrink-0">→</span>
                      <span>
                        <strong>Crescimento da hotelaria:</strong> novos
                        empreendimentos hoteleiros e pousadas estão abrindo na
                        região, gerando demanda por moradia para colaboradores
                        e segunda residência para visitantes.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-cyan-600 font-bold shrink-0">→</span>
                      <span>
                        <strong>Acesso fácil:</strong> ligação direta com
                        Tucano via BR e estradas pavimentadas — quem vem para
                        Caldas passa por Tucano.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-cyan-600 font-bold shrink-0">→</span>
                      <span>
                        <strong>Eventos e festas tradicionais</strong> trazem
                        fluxo turístico constante, fortalecendo comércio e
                        serviços locais — e o preço do m² acompanha.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Mini estatística destacada */}
                <div
                  className="rounded-2xl p-5 text-white shadow-xl"
                  style={{
                    background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)`,
                  }}
                >
                  <p className="text-xs uppercase tracking-widest opacity-80 font-semibold mb-1">
                    Potencial regional
                  </p>
                  <p className="text-3xl font-black leading-tight">
                    Tucano + Caldas do Jorro
                  </p>
                  <p className="text-sm opacity-90 mt-2 leading-relaxed">
                    Uma das regiões turísticas que mais cresce no semiárido
                    baiano. Investir aqui é investir num polo em formação.
                  </p>
                </div>
              </div>
            </div>

            {/* Mini galeria de 3 fotos secundárias */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  src: fotos[1],
                  title: 'Águas termais',
                  desc: 'Banhos terapêuticos sulfurosos',
                  icon: '♨',
                  gradFrom: 'from-cyan-500',
                  gradTo: 'to-sky-600',
                },
                {
                  src: fotos[2],
                  title: 'Tucano em expansão',
                  desc: 'Cidade e comércio em pleno crescimento',
                  icon: '🏙',
                  gradFrom: 'from-emerald-500',
                  gradTo: 'to-teal-600',
                },
                {
                  src: fotos[3],
                  title: 'Tradição e cultura',
                  desc: 'Festas religiosas e populares',
                  icon: '🎉',
                  gradFrom: 'from-amber-500',
                  gradTo: 'to-orange-600',
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-lg group"
                >
                  {/* Fallback gradient sempre presente */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${card.gradFrom} ${card.gradTo}`}
                  />
                  {card.src && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={card.src}
                      alt={card.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xl">
                    {card.icon}
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="font-bold text-lg drop-shadow leading-tight">
                      {card.title}
                    </p>
                    <p className="text-sm opacity-90 mt-0.5">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bloco de fechamento — apelo emocional + CTA suave */}
            <div className="mt-10 bg-white/80 backdrop-blur rounded-2xl p-6 md:p-8 ring-1 ring-cyan-200/60 shadow-xl text-center">
              <p className="text-slate-700 leading-relaxed text-base md:text-lg max-w-3xl mx-auto">
                Comprar um lote em <strong>Tucano</strong> é estar a poucos
                quilômetros de um dos destinos termais mais procurados da Bahia.
                Cada nova pousada, cada hotel, cada festa em Caldas do Jorro{' '}
                <strong className="text-cyan-700">
                  empurra o preço dos terrenos da região pra cima
                </strong>{' '}
                — e quem entrou cedo, colhe primeiro.
              </p>
              <p
                className="mt-4 text-sm font-bold uppercase tracking-widest"
                style={{ color: corPrimaria }}
              >
                Garanta seu lote enquanto a região está em formação.
              </p>
            </div>
          </div>
        </section>
        );
      })()}

      {/* ============ GALERIA COM LIGHTBOX ============ */}
      {loteamento.imagensGaleria.length > 0 && (
        <section id="galeria" className="bg-slate-50 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <p
                className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: corPrimaria }}
              >
                Galeria
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Conheça o {loteamento.nome}
              </h2>
            </div>
            <GalleryLightbox images={loteamento.imagensGaleria} />
          </div>
        </section>
      )}

      {/* ============ PLANTA DO LOTEAMENTO (interativa, com numeração) ============ */}
      {loteamento.imagemMapa && (
        <section id="planta" className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-8">
            <p
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: corPrimaria }}
            >
              Planta interativa
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Escolha seu lote no mapa
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto mt-3">
              Clique em qualquer lote para ver detalhes e iniciar a compra. Use zoom para
              aproximar.
            </p>
          </div>
          <MapaVisual
            imagemMapa={loteamento.imagemMapa}
            lotes={lotesUI}
            tabelas={tabelasUI}
            loteamentoId={loteamento.id}
            loteamentoNome={loteamento.nome}
            loteamentoSlug={loteamento.slug}
            corPrimaria={corPrimaria}
          />
        </section>
      )}

      {/* ============ SIMULADOR DE FINANCIAMENTO (antes dos lotes) ============ */}
      <section id="simulador" className="scroll-mt-20">
        <SimuladorResidencial
          corPrimaria={corPrimaria}
          whatsapp={whatsappPhone}
          loteamentoNome={loteamento.nome}
          loteadoraNome={loteadora.nome}
          loteamentoSlug={loteamento.slug}
          loteamentoId={loteamento.id}
          linkLotes="#lotes"
        />
        <div className="text-center -mt-8 mb-8">
          <Link
            href={`/simulador/${loteamento.slug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            style={{ color: corPrimaria }}
          >
            Abrir simulador em página dedicada
            <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ============ LISTA DE LOTES (cards, com filtros — sem mapa SVG) ============ */}
      <section id="lotes" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p
            className="text-sm font-semibold uppercase tracking-wider mb-3"
            style={{ color: corPrimaria }}
          >
            Escolha o seu
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Lotes disponíveis
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Use os filtros para encontrar o lote ideal. Clique em qualquer card para ver detalhes,
            simular o parcelamento ou falar com o consultor.
          </p>
        </div>

        <MapaInterativo
          lotes={lotesUI}
          tabelas={tabelasUI}
          loteamentoId={loteamento.id}
          loteamentoNome={loteamento.nome}
          loteamentoSlug={loteamento.slug}
          corPrimaria={corPrimaria}
        />
      </section>

      {/* ============ TABELAS DE PREÇO ============ */}
      {tabelasUI.length > 0 && (
        <section
          id="condicoes"
          className="py-20 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${corSecundaria}, ${corPrimaria})`,
          }}
        >
          <div className="absolute inset-0 bg-grid-dark opacity-30" />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="text-center mb-10 text-white">
              <p className="text-sm font-semibold uppercase tracking-wider mb-3 opacity-80">
                Condições de pagamento
              </p>
              <h2 className="text-3xl md:text-4xl font-bold">
                Compre do seu jeito
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tabelasUI.map((t) => (
                <div
                  key={t.id}
                  className="glass rounded-2xl p-6 text-white card-lift"
                >
                  <h3 className="font-bold text-xl mb-1">{t.nome}</h3>
                  {t.descricao && <p className="text-sm opacity-80 mb-4">{t.descricao}</p>}
                  <ul className="space-y-2 text-sm">
                    {t.descontoPct && (
                      <li className="flex items-baseline justify-between border-b border-white/10 pb-2">
                        <span className="opacity-80">Desconto</span>
                        <span className="font-bold text-2xl">{t.descontoPct.toFixed(0)}%</span>
                      </li>
                    )}
                    {t.entradaPct && (
                      <li className="flex items-baseline justify-between">
                        <span className="opacity-80">Entrada mínima</span>
                        <span className="font-semibold">{t.entradaPct.toFixed(0)}%</span>
                      </li>
                    )}
                    <li className="flex items-baseline justify-between">
                      <span className="opacity-80">Parcelas</span>
                      <span className="font-semibold">
                        {t.parcelasMin === t.parcelasMax
                          ? `${t.parcelasMin}x`
                          : `${t.parcelasMin}x — ${t.parcelasMax}x`}
                      </span>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ LOCALIZAÇÃO COM GOOGLE MAPS ============ */}
      <section id="localizacao" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: corPrimaria }}
            >
              Localização
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Onde fica
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">{loteamento.endereco}</p>
            <p className="text-slate-700">
              <strong className="text-slate-900">{loteamento.cidade}</strong> — {loteamento.estado}
              {loteamento.cep && ` · CEP ${loteamento.cep}`}
            </p>

            {loteamento.lat && loteamento.lng && (
              <a
                href={`https://www.google.com/maps?q=${loteamento.lat},${loteamento.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 px-5 py-3 text-white font-semibold rounded-xl shadow-md hover:opacity-90 transition"
                style={{ background: corPrimaria }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.66 6.34a8 8 0 1 0-11.32 11.32L12 22l5.66-4.34a8 8 0 0 0 0-11.32ZM12 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
                </svg>
                Abrir no Google Maps
              </a>
            )}
          </div>
          <div className="rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 aspect-video bg-slate-100">
            {loteamento.lat && loteamento.lng ? (
              <iframe
                src={`https://maps.google.com/maps?q=${loteamento.lat},${loteamento.lng}&z=15&output=embed`}
                className="w-full h-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Mapa"
              />
            ) : (
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${loteamento.cidade}, ${loteamento.estado}`)}&z=12&output=embed`}
                className="w-full h-full"
                loading="lazy"
                title="Mapa"
              />
            )}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: corPrimaria }}
            >
              Tirando dúvidas
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqItems(loteamento.nome, loteamento.reservaMinutos).map((item, i) => (
              <details
                key={i}
                className="group bg-white border border-slate-200 rounded-xl"
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

      {/* ============ DOCUMENTOS ============ */}
      {documentos.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-8">
            <p
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: corPrimaria }}
            >
              Documentação
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Documentos do empreendimento
            </h2>
          </div>
          <div className="space-y-2">
            {documentos.map((d, i) => (
              <a
                key={i}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-400 hover:shadow-md transition group"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{ background: corPrimaria }}
                >
                  📄
                </div>
                <span className="flex-1 font-medium text-slate-900 group-hover:underline">
                  {d.nome}
                </span>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ============ CTA FINAL + LEAD FORM ============ */}
      <section
        id="contato"
        className="relative py-24 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${corSecundaria} 0%, ${corPrimaria} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-grid-dark opacity-30" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] conic-bg opacity-20" />

        <div className="relative max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-start">
          <div className="text-white">
            <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
              Pronto pra ter seu lote no {loteamento.nome}?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Fale com um consultor agora. Tire dúvidas, agende uma visita ou solicite uma proposta personalizada.
            </p>

            <div className="space-y-3">
              {(loteamento.contatoTelefone ?? loteadora.telefone) && (
                <ContactItem
                  icon="📞"
                  label="Telefone"
                  value={loteamento.contatoTelefone ?? loteadora.telefone!}
                />
              )}
              {loteadora.whatsapp && (
                <ContactItem
                  icon="💬"
                  label="WhatsApp"
                  value={loteadora.whatsapp}
                  href={`https://wa.me/${loteadora.whatsapp.replace(/\D/g, '')}`}
                />
              )}
              {(loteamento.contatoEmail ?? loteadora.email) && (
                <ContactItem
                  icon="✉️"
                  label="E-mail"
                  value={loteamento.contatoEmail ?? loteadora.email!}
                  href={`mailto:${loteamento.contatoEmail ?? loteadora.email}`}
                />
              )}
              {loteadora.instagram && (
                <a
                  href={`https://instagram.com/${loteadora.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 transition"
                >
                  <IconInstagram className="w-6 h-6" />
                  <div>
                    <p className="text-xs opacity-70">Instagram</p>
                    <p className="font-semibold">{loteadora.instagram}</p>
                  </div>
                </a>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl">
            <div className="p-6">
              <h3 className="font-bold text-slate-900 text-lg mb-1">Tenho interesse</h3>
              <p className="text-sm text-slate-500 mb-4">
                Resposta em até 1 dia útil.
              </p>
              <LeadFormPublic
                loteamentoId={loteamento.id}
                origem={`lp-${loteamento.slug}`}
                hideTitle
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ PARCEIROS ============ */}
      {parceiros.length > 0 && (
        <section className="bg-white py-12 border-t border-slate-200">
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 text-center mb-6">
              Em parceria com
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              {parceiros.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-xl border border-slate-200"
                >
                  {p.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo} alt={p.nome} className="h-10 object-contain" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      style={{ background: corPrimaria }}
                    >
                      {p.nome.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{p.nome}</p>
                    {p.descricao && (
                      <p className="text-xs text-slate-500">{p.descricao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ FOOTER ESTILOSO ============ */}
      <LoteamentoFooter
        loteamento={{
          nome: loteamento.nome,
          slug: loteamento.slug,
          cidade: loteamento.cidade,
          estado: loteamento.estado,
          endereco: loteamento.endereco,
          contatoTelefone: loteamento.contatoTelefone,
          contatoEmail: loteamento.contatoEmail,
        }}
        loteadora={{
          nome: loteadora.nome,
          razaoSocial: loteadora.razaoSocial,
          cnpj: loteadora.cnpj,
          telefone: loteadora.telefone,
          whatsapp: loteadora.whatsapp,
          email: loteadora.email,
          instagram: loteadora.instagram,
          site: loteadora.site,
          logo: loteadora.logo,
          sobreTexto: loteadora.sobreTexto,
        }}
        corPrimaria={corPrimaria}
      />

      {/* ============ WHATSAPP FLUTUANTE ============ */}
      {whatsappPhone && (
        <WhatsAppFloat
          phone={whatsappPhone}
          message={whatsappMsg}
          loteadoraNome={loteadora.nome}
          loteamentoNome={loteamento.nome}
        />
      )}

      {/* ============ COMPARADOR DE LOTES (flutuante quando há seleção) ============ */}
      <ComparadorLotes lotes={lotesUI} corPrimaria={corPrimaria} />

      {/* ============ TICKER AO VIVO (canto inferior esquerdo) ============ */}
      <TickerVivo
        eventosReais={tickerData.eventos}
        vgvHoje={tickerData.vgvHoje}
        leadsRecentes={tickerData.leadsRecentes}
      />
    </div>
  );
}

// =====================================================================
// SUB-COMPONENTES SERVER
// =====================================================================

function Header({
  loteamento,
  loteadora,
  corPrimaria,
  homeHref,
}: {
  loteamento: { slug: string; nome: string };
  loteadora: { nome: string; logo: string | null };
  corPrimaria: string;
  /**
   * href correto para a logo. Recebido do server porque depende do host atual
   * (subdomínio vs domínio principal).
   */
  homeHref: string;
}) {
  return (
    <header className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-black/30 to-transparent">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-white">
        <Link href={homeHref} className="flex items-center gap-3">
          {loteadora.logo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={loteadora.logo}
                alt={loteadora.nome}
                className="h-9 md:h-11 object-contain drop-shadow-lg"
              />
              {/* Só o nome do loteamento ao lado (loteadora já está no logo) */}
              <div className="hidden md:block pl-3 border-l border-white/20">
                <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 leading-tight">
                  Empreendimento
                </p>
                <p className="text-sm font-bold leading-tight">{loteamento.nome}</p>
              </div>
            </>
          ) : (
            <div>
              <span className="text-lg font-bold" style={{ color: corPrimaria }}>
                {loteadora.nome}
              </span>
              <p className="text-xs opacity-80 leading-tight hidden md:block">{loteamento.nome}</p>
            </div>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#sobre" className="hover:opacity-70">Sobre</a>
          <a href="#investir" className="hover:opacity-70">Por que investir</a>
          <a href="#planta" className="hover:opacity-70">Planta</a>
          <a href="#simulador" className="hover:opacity-70">Simulador</a>
          <a href="#lotes" className="hover:opacity-70">Lotes</a>
          <a href="#localizacao" className="hover:opacity-70">Localização</a>
        </nav>

        <a
          href="#contato"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition hover:scale-105"
          style={{ background: corPrimaria }}
        >
          Tenho interesse
        </a>
      </div>
    </header>
  );
}

// Posições fixas pra evitar mismatch de hidratação
const PARTICLES = [
  { left: 5, dur: 22, delay: 0, size: 2 },
  { left: 11, dur: 18, delay: 4, size: 1 },
  { left: 17, dur: 25, delay: 8, size: 3 },
  { left: 22, dur: 20, delay: 12, size: 1 },
  { left: 28, dur: 24, delay: 2, size: 2 },
  { left: 33, dur: 19, delay: 14, size: 1 },
  { left: 38, dur: 26, delay: 6, size: 2 },
  { left: 44, dur: 21, delay: 9, size: 1 },
  { left: 49, dur: 23, delay: 15, size: 3 },
  { left: 55, dur: 18, delay: 1, size: 1 },
  { left: 60, dur: 27, delay: 11, size: 2 },
  { left: 66, dur: 20, delay: 5, size: 1 },
  { left: 71, dur: 24, delay: 13, size: 2 },
  { left: 77, dur: 22, delay: 7, size: 1 },
  { left: 82, dur: 19, delay: 10, size: 3 },
  { left: 88, dur: 25, delay: 3, size: 2 },
  { left: 93, dur: 21, delay: 16, size: 1 },
  { left: 97, dur: 23, delay: 6, size: 2 },
];

function Hero({
  loteamento,
  corPrimaria,
  corSecundaria,
  totalLotes,
  lotesDisponiveis,
  infraItems,
}: {
  loteamento: {
    nome: string;
    cidade: string;
    estado: string;
    imagemCapa: string | null;
    tagline: string | null;
    subtagline: string | null;
    parcelaAPartirDe: number | null;
    endereco: string;
    videoHero: string | null;
    videoHeroPoster: string | null;
  };
  corPrimaria: string;
  corSecundaria: string;
  totalLotes: number;
  lotesDisponiveis: number;
  infraItems: string[];
}) {
  const parcela = loteamento.parcelaAPartirDe
    ? loteamento.parcelaAPartirDe.toLocaleString('pt-BR')
    : null;

  const palavras = loteamento.nome.trim().split(/\s+/);
  const ultimaPalavra = palavras.length > 1 ? palavras[palavras.length - 1] : null;
  const inicio = palavras.length > 1 ? palavras.slice(0, -1).join(' ') : loteamento.nome;

  const marqueeItems = [
    ...infraItems,
    'Lotes escriturados',
    'Infraestrutura completa',
    'Financiamento direto',
  ];
  const marqueeAll = [...marqueeItems, ...marqueeItems];

  return (
    <HeroSpotlight>
      <section className="relative min-h-[95vh] flex items-center overflow-hidden bg-black">
        {/* Vídeo de fundo (drone) — substitui Ken Burns quando disponível */}
        {loteamento.videoHero ? (
          <VideoBackground
            src={loteamento.videoHero}
            poster={loteamento.videoHeroPoster ?? loteamento.imagemCapa}
          />
        ) : (
          loteamento.imagemCapa && (
            <div
              className="absolute inset-0 ken-burns"
              style={{
                backgroundImage: `url(${loteamento.imagemCapa})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )
        )}

        {/* Overlay dark + vignette */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 vignette" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-dark opacity-25" />

        {/* Conic blobs sutis */}
        <div
          className="absolute -top-40 -right-40 w-[450px] h-[450px] rounded-full blur-3xl opacity-20"
          style={{ background: corPrimaria }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full blur-3xl opacity-15"
          style={{ background: corPrimaria }}
        />

        {/* Particles flutuantes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        {/* CONTEÚDO — layout assimétrico (texto à esquerda no desktop) */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full grid lg:grid-cols-12 gap-8 items-center">
          {/* Lado texto (8 cols) */}
          <div className="lg:col-span-8 text-white text-center lg:text-left">
            {/* Top row: badges */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-7 animate-fade-up">
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg"
                style={{ background: corPrimaria, color: 'white' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Lançamento
              </span>
              <span className="glass-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                <IconBadge className="w-3 h-3" />
                Lotes escriturados
              </span>
              <span className="glass-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                <IconPin className="w-3 h-3" />
                {loteamento.cidade} · {loteamento.estado}
              </span>
            </div>

            {/* Eyebrow */}
            <p className="text-xs md:text-[11px] uppercase tracking-[0.5em] text-white/60 mb-3 animate-fade-up delay-1">
              Residencial
            </p>

            {/* Título menor + dual color */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[0.95] mb-5 animate-fade-up delay-1">
              <span className="text-white">{inicio}</span>
              {ultimaPalavra && (
                <>
                  {' '}
                  <span style={{ color: corPrimaria }}>{ultimaPalavra}</span>
                </>
              )}
            </h1>

            {loteamento.tagline && (
              <p className="text-lg md:text-xl text-white/90 max-w-xl mb-2 leading-snug animate-fade-up delay-2 mx-auto lg:mx-0">
                {loteamento.tagline}
              </p>
            )}

            {loteamento.subtagline && (
              <p className="text-sm md:text-base text-white/65 max-w-xl mb-7 animate-fade-up delay-2 mx-auto lg:mx-0">
                {loteamento.subtagline}
              </p>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 animate-fade-up delay-4">
              <a
                href="#simulador"
                className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl shadow-2xl transition hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]"
                style={{ background: corPrimaria, color: 'white' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h6" />
                </svg>
                Simular meu lote
                <IconArrowRight />
              </a>
              <a
                href="#lotes"
                className="glass-chip inline-flex items-center gap-2 px-6 py-3 text-white font-medium rounded-xl hover:bg-white/15 transition"
              >
                Ver lotes disponíveis
              </a>
            </div>
          </div>

          {/* Lado painel de stats + parcela (4 cols) */}
          <aside className="lg:col-span-4 space-y-3 animate-fade-up delay-3">
            {parcela && (
              <div
                className="rounded-2xl p-5 shadow-2xl border relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${corPrimaria}, #c2410c)`,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                <p className="relative text-[10px] font-bold uppercase tracking-[0.25em] text-white/85 mb-1 flex items-center gap-1">
                  <IconSpark className="w-3 h-3" />
                  Parcelas a partir de
                </p>
                <p className="relative text-white">
                  <span className="text-4xl md:text-5xl font-extrabold">R$ {parcela}</span>
                  <span className="text-sm font-medium opacity-90 ml-1">/mês</span>
                </p>
                <p className="relative text-xs text-white/85 mt-2">
                  Financiamento direto, sem burocracia
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <StatChip valor={totalLotes.toString()} label="Lotes totais" />
              <StatChip valor={lotesDisponiveis.toString()} label="Disponíveis" tint={corPrimaria} />
            </div>
          </aside>
        </div>

        {/* Marquee inferior */}
        <div className="absolute bottom-0 inset-x-0 py-3 bg-black/55 backdrop-blur-md border-t border-white/10 overflow-hidden">
          <div className="marquee-track text-xs uppercase tracking-[0.3em] text-white/65">
            {marqueeAll.map((item, i) => (
              <span key={i} className="flex items-center gap-3 whitespace-nowrap">
                <span style={{ color: corPrimaria }}>◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </HeroSpotlight>
  );
}

function StatChip({ valor, label, tint }: { valor: string; label: string; tint?: string }) {
  return (
    <div className="glass-chip rounded-xl px-3 py-2.5 text-white">
      <p className="text-2xl font-bold leading-none" style={tint ? { color: tint } : undefined}>
        {valor}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">{label}</p>
    </div>
  );
}

function ContactItem({
  icon,
  label,
  value,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur border border-white/15 hover:bg-white/20 transition">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs opacity-70">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}

function faqItems(nome: string, reservaMinutos: number) {
  return [
    {
      q: 'Como funciona a reserva do lote?',
      a: `Ao escolher um lote no ${nome}, ele fica bloqueado por ${reservaMinutos} minutos enquanto você finaliza a compra. Durante esse tempo, ninguém mais consegue reservá-lo. Após o pagamento da entrada, o lote é seu.`,
    },
    {
      q: 'Posso visitar o terreno antes de comprar?',
      a: 'Sim! Agendamos uma visita guiada com um corretor, sem compromisso. Use o formulário de contato pra solicitar.',
    },
    {
      q: 'Quais formas de pagamento são aceitas?',
      a: 'À vista (PIX, boleto ou cartão), financiamento direto com a loteadora ou consórcio. Cada condição tem suas regras — confira as tabelas de preço acima.',
    },
    {
      q: 'O preço inclui escrituração?',
      a: 'Não. Os valores de cartório (escritura, registro, ITBI) são pagos separadamente pelo comprador, conforme tabela da cidade.',
    },
    {
      q: 'Existe taxa de manutenção ou condomínio?',
      a: 'Loteamentos abertos não cobram condomínio. Pode haver taxa de associação de moradores em alguns casos — pergunte ao consultor.',
    },
    {
      q: 'Posso construir imediatamente após a compra?',
      a: 'Sim, desde que respeitando as regras de uso e ocupação do solo do município e as normas do loteamento (recuos, gabarito, etc.).',
    },
  ];
}
