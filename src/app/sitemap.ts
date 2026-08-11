/**
 * Sitemap dinâmico — gerado a cada request (sem cache) para refletir
 * loteamentos publicados, formulários ativos e mudanças do conteúdo.
 *
 * Acessível em: https://meuloteamento.com/sitemap.xml
 *
 * Inclui:
 *   - páginas institucionais (home, sobre, contato)
 *   - landing pages de cada loteamento publicado
 *   - simuladores
 *
 * NÃO inclui (intencional):
 *   - /admin/*, /minha-conta/*, /api/*, /checkout/* — privadas
 *   - /f/* — formulários privados de coleta (marcados noindex)
 *   - loteamentos com publicado=false ou ativo=false
 *   - subdomínios customizados (cada um se gerencia)
 */
import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1h

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://meuloteamento.com').replace(/\/+$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();

  // === Páginas institucionais ===
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: agora,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/sobre`,
      lastModified: agora,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contato`,
      lastModified: agora,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // === Loteamentos publicados ===
  let loteamentos: { slug: string; updatedAt: Date }[] = [];
  try {
    loteamentos = await prisma.loteamento.findMany({
      where: { publicado: true, ativo: true },
      select: { slug: true, updatedAt: true },
    });
  } catch (err) {
    console.warn('[sitemap] falha ao buscar loteamentos', err);
  }

  // Formulários /f/* são páginas privadas de coleta — não devem indexar,
  // então não entram no sitemap (deixamos noindex nas próprias páginas).

  const loteamentoRoutes: MetadataRoute.Sitemap = loteamentos.flatMap((l) => [
    {
      url: `${BASE_URL}/${l.slug}`,
      lastModified: l.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/simulador/${l.slug}`,
      lastModified: l.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]);

  return [...staticRoutes, ...loteamentoRoutes];
}
