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
      // Crawlers de IA: PERMITIDOS.
      // Assistentes como ChatGPT, Perplexity, Google SGE, Claude respondem
      // perguntas como "onde comprar lote em Tucano BA" citando o site.
      // Permitir indexação equivale a virar fonte primária desses agentes.
      // Se um dia quiser bloquear, mude allow → disallow.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'Google-Extended',
          'CCBot',
          'anthropic-ai',
          'ClaudeBot',
          'PerplexityBot',
          'Perplexity-User',
          'Applebot-Extended',
        ],
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/minha-conta/',
          '/checkout/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
