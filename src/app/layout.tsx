import type { Metadata, Viewport } from 'next';
import './globals.css';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://meuloteamento.com').replace(/\/+$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'meuloteamento — Plataforma de venda e gestão de loteamentos',
    template: '%s | meuloteamento',
  },
  description:
    'Plataforma completa para loteadoras: venda online de lotes, CRM, financeiro, contratos digitais e cobrança automática. Encontre loteamentos e lotes à venda no Brasil.',
  applicationName: 'meuloteamento',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  // Keywords amplas — cobrem tanto B2B (loteadora que busca sistema) quanto
  // B2C (comprador buscando lote/terreno). Cada loteamento individual tem
  // suas próprias keywords geolocalizadas via generateMetadata.
  keywords: [
    'sistema para loteadora',
    'software gestão de loteamentos',
    'plataforma de venda de lotes online',
    'site para loteamento',
    'gestão de vendas de terrenos',
    'lotes à venda',
    'loteamentos à venda no Brasil',
    'comprar terreno parcelado',
    'CRM imobiliário loteamento',
    'contrato digital de compra e venda de lote',
  ],
  authors: [{ name: 'meuloteamento', url: APP_URL }],
  creator: 'meuloteamento',
  publisher: 'meuloteamento',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'meuloteamento',
    url: APP_URL,
    title: 'meuloteamento — Plataforma completa para loteadoras',
    description:
      'Venda seus lotes online com CRM, financeiro, cobrança automática e contratos digitais. Ou encontre loteamentos e lotes à venda no Brasil.',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'meuloteamento — plataforma de venda e gestão de loteamentos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'meuloteamento — Plataforma completa para loteadoras',
    description:
      'Venda seus lotes online com CRM, financeiro, cobrança automática e contratos digitais.',
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
  // Google Search Console — verificado em 2026-08-08 (contato@targetimports.com)
  verification: {
    google: 'WjZaAgC5o2GtJSHYOcDcGBSgHaDe6sekh9wvHBENJQo',
  },
  category: 'real estate',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-white text-slate-900">{children}</body>
    </html>
  );
}
