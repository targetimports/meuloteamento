/**
 * PWA manifest — habilita "instalar app" no Chrome/Edge mobile e desktop.
 * Acessível em /manifest.webmanifest
 */
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'meuloteamento',
    short_name: 'meuloteamento',
    description: 'Plataforma para venda de loteamentos online — site, CRM e cobrança integrados.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#6366f1',
    lang: 'pt-BR',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity', 'real estate'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
