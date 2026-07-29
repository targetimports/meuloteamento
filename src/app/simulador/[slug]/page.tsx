import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SimuladorResidencial } from '@/components/SimuladorResidencial';

export const dynamic = 'force-dynamic';

interface Props {
  params: { slug: string };
}

async function getLoteamento(slug: string) {
  return prisma.loteamento.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      nome: true,
      cidade: true,
      estado: true,
      publicado: true,
      ativo: true,
      imagemCapa: true,
      loteadora: {
        select: {
          nome: true,
          whatsapp: true,
          corPrimaria: true,
          corSecundaria: true,
          logo: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getLoteamento(params.slug);
  if (!l || !l.publicado) {
    return {
      title: 'Simulador não encontrado',
      robots: { index: false, follow: false },
    };
  }
  const titulo = `Simulador de financiamento — ${l.nome}`;
  const descricao = `Simule a parcela mensal do seu lote no ${l.nome} em ${l.cidade}/${l.estado}. Calcule entrada, parcelas e veja o valor final.`;
  return {
    title: titulo,
    description: descricao,
    keywords: [
      `simulador ${l.nome}`,
      `simular financiamento de lote`,
      `parcela lote ${l.cidade}`,
      `calcular parcela ${l.nome}`,
    ],
    alternates: { canonical: `/simulador/${l.slug}` },
    openGraph: {
      title: titulo,
      description: descricao,
      type: 'website',
      images: l.imagemCapa ? [l.imagemCapa] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
    },
  };
}

export default async function SimuladorPage({ params }: Props) {
  const loteamento = await getLoteamento(params.slug);
  if (!loteamento || !loteamento.publicado || !loteamento.ativo) notFound();

  const { loteadora } = loteamento;
  const corPrimaria = loteadora.corPrimaria ?? '#0284c7';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header simples */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href={`/${loteamento.slug}`} className="flex items-center gap-3">
            {loteadora.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loteadora.logo}
                alt={loteadora.nome}
                className="h-9 w-auto object-contain"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: corPrimaria }}
              >
                {loteadora.nome.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">{loteamento.nome}</p>
              <p className="text-[11px] text-slate-500">
                {loteamento.cidade}/{loteamento.estado}
              </p>
            </div>
          </Link>
          <Link
            href={`/${loteamento.slug}`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden md:inline"
          >
            ← Voltar ao site
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <SimuladorResidencial
          corPrimaria={corPrimaria}
          whatsapp={loteadora.whatsapp ?? ''}
          loteamentoNome={loteamento.nome}
          loteadoraNome={loteadora.nome}
          loteamentoSlug={loteamento.slug}
          loteamentoId={loteamento.id}
          standalone
          linkLotes={`/${loteamento.slug}#lotes`}
        />
      </main>

      <footer className="border-t border-slate-200 py-6 bg-white">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {loteadora.nome} · Simulação ilustrativa, sujeita à análise
          de crédito. ·{' '}
          <Link href={`/${loteamento.slug}`} className="hover:underline">
            Conheça o {loteamento.nome}
          </Link>
        </div>
      </footer>
    </div>
  );
}
