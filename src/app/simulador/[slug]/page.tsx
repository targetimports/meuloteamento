import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SimuladorResidencial } from '@/components/SimuladorResidencial';

export const dynamic = 'force-dynamic';

/**
 * Converte os parâmetros configurados em props do simulador.
 *
 * Só entrega o que está preenchido: campo nulo é omitido do objeto, e o
 * componente aplica o próprio padrão. Passar `undefined` explicitamente
 * também funcionaria, mas omitir deixa claro que "não configurado" e "zero"
 * são coisas diferentes — um lote não custa R$ 0.
 */
function paramsSimulador(l: {
  simPrecoResidencial: unknown;
  simPrecoComercial: unknown;
  simEntradaMinima: unknown;
  simParcelas: number | null;
  simValorParcela: unknown;
  simEntradasSugeridas: unknown;
  simuladorTipos?: unknown[];
}) {
  const n = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
  return {
    tiposLote: (l as { simuladorTipos?: unknown[] }).simuladorTipos?.map((t) => {
      const x = t as Record<string, unknown>;
      return {
        id: String(x.id),
        nome: String(x.nome),
        descricao: (x.descricao as string | null) ?? null,
        preco: Number(x.preco),
        entradaMinima: Number(x.entradaMinima),
        parcelas: Number(x.parcelas),
        valorParcela: Number(x.valorParcela),
        entradasSugeridas: Array.isArray(x.entradasSugeridas)
          ? (x.entradasSugeridas as number[])
          : null,
        simulavel: Boolean(x.simulavel),
        ativo: Boolean(x.ativo),
      };
    }),
    precoResidencial: n(l.simPrecoResidencial),
    precoComercial: n(l.simPrecoComercial),
    entradaMinima: n(l.simEntradaMinima),
    parcelas: l.simParcelas ?? undefined,
    valorParcelaPadrao: n(l.simValorParcela),
    entradasSugeridas: Array.isArray(l.simEntradasSugeridas)
      ? (l.simEntradasSugeridas as number[])
      : undefined,
  };
}

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
      simPrecoResidencial: true,
      simPrecoComercial: true,
      simEntradaMinima: true,
      simParcelas: true,
      simValorParcela: true,
      simEntradasSugeridas: true,
      simuladorTipos: {
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      },
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
          {...paramsSimulador(loteamento)}
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
