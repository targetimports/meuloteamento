/**
 * robots.txt dinâmico.
 *
 * Bloqueia rotas administrativas/privadas para não indexar.
 * Aponta para o sitemap.
 *
 * Acessível em: https://meuloteamento.com/robots.txt
 */
import type { MetadataRoute } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://meuloteamento.com').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/minha-conta/',
          '/checkout/',
          '/_next/',
        ],
      },
      // Crawlers de IA: bloquear por padrão
      // (descomente se quiser permitir treinamento de modelos com o conteúdo)
      {
        userAgent: ['GPTBot', 'Google-Extended', 'CCBot', 'anthropic-ai', 'ClaudeBot'],
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
