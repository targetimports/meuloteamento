/**
 * Modo TV — tela para plantão de vendas / stand físico.
 *
 * Layout fullscreen 16:9 com:
 *   - Header: nome do loteamento + relógio
 *   - 4 KPIs grandes: lotes disponíveis, reservados, vendidos, VGV
 *   - Mapa ao vivo de lotes (componente já existente, escalado)
 *   - Faixa de "feed" das últimas atividades
 *   - Rodapé com ranking de corretores (top 3) + barra de progresso
 *
 * URL: /<slug>/tv  (ex: /parquetucano/tv)
 *
 * Refresh: a página revalida a cada 30s via `revalidate = 30`. Em produção
 * fica viva sem precisar dar F5 manualmente.
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MapaVisual } from '@/components/loteamento-interactive';
import { TvRelogio, TvAutoRefresh } from '@/components/TvLive';
import type { LoteUI } from '@/components/loteamento-interactive';

export const dynamic = 'force-dynamic';
export const revalidate = 30; // re-render a cada 30 segundos

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const lo = await prisma.loteamento.findUnique({
    where: { slug: params.slug },
    select: { nome: true },
  });
  return {
    title: `${lo?.nome ?? 'Loteamento'} · Modo TV — Plantão`,
    robots: { index: false, follow: false }, // não indexar
  };
}

export default async function ModoTvPage({ params }: { params: { slug: string } }) {
  const loteamento = await prisma.loteamento.findUnique({
    where: { slug: params.slug },
    include: {
      loteadora: {
        select: { nome: true, logo: true, corPrimaria: true, corSecundaria: true },
      },
      lotes: {
        orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
      },
    },
  });
  if (!loteamento) notFound();

  const corPrimaria = loteamento.loteadora.corPrimaria ?? '#0284c7';

  // KPIs por status
  const stats = {
    disponiveis: loteamento.lotes.filter((l) => l.status === 'DISPONIVEL').length,
    reservados: loteamento.lotes.filter((l) => l.status === 'RESERVADO' || l.status === 'EM_PAGAMENTO').length,
    vendidos: loteamento.lotes.filter((l) => l.status === 'VENDIDO').length,
    total: loteamento.lotes.length,
  };

  // VGV potencial (vendidos + reservados) — valor que está "em jogo"
  const vgvVendido = loteamento.lotes
    .filter((l) => l.status === 'VENDIDO')
    .reduce((s, l) => s + Number(l.preco), 0);
  const vgvReservado = loteamento.lotes
    .filter((l) => l.status === 'RESERVADO' || l.status === 'EM_PAGAMENTO')
    .reduce((s, l) => s + Number(l.preco), 0);

  // Últimas atividades (24h)
  const ontem = new Date(Date.now() - 24 * 3600 * 1000);
  const atividades = await prisma.venda.findMany({
    where: {
      lote: { loteamentoId: loteamento.id },
      createdAt: { gte: ontem },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      createdAt: true,
      status: true,
      cliente: { select: { nome: true } },
      lote: { select: { codigo: true } },
      corretor: { select: { nome: true } },
    },
  });

  // Ranking corretores (vendas últimas 30 dias)
  const trintaDias = new Date(Date.now() - 30 * 86400 * 1000);
  const rankingRaw = await prisma.venda.groupBy({
    by: ['corretorId'],
    where: {
      lote: { loteamentoId: loteamento.id },
      corretorId: { not: null },
      createdAt: { gte: trintaDias },
      status: { in: ['ATIVA', 'INADIMPLENTE', 'QUITADA'] },
    },
    _count: { _all: true },
    _sum: { valorTotal: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });
  const corretoresIds = rankingRaw
    .map((r) => r.corretorId)
    .filter((id): id is string => !!id);
  const corretoresInfo = await prisma.corretor.findMany({
    where: { id: { in: corretoresIds } },
    select: { id: true, nome: true },
  });
  const ranking = rankingRaw.map((r) => ({
    nome: corretoresInfo.find((c) => c.id === r.corretorId)?.nome ?? 'Sem nome',
    vendas: r._count._all,
    valor: Number(r._sum.valorTotal ?? 0),
  }));

  // Serializa lotes pro componente de mapa
  const lotesUI: LoteUI[] = loteamento.lotes.map((l) => ({
    id: l.id,
    codigo: l.codigo,
    quadra: l.quadra,
    numero: l.numero,
    area: Number(l.area),
    testada: l.testada ? Number(l.testada) : null,
    fundo: l.fundo ? Number(l.fundo) : null,
    preco: Number(l.preco),
    status: l.status,
    tipo: l.tipo,
    mapaX: l.mapaX,
    mapaY: l.mapaY,
    mapaLargura: l.mapaLargura,
    mapaAltura: l.mapaAltura,
    descricao: l.descricao,
    motivoBloqueio: null,
    orientacaoSolar: l.orientacaoSolar ?? null,
    esquina: l.esquina,
    fronteAreaVerde: l.fronteAreaVerde,
    fotos: l.fotos ?? [],
  }));

  // Imagem da planta (pega do filesystem como na landing principal)
  const imagemMapa = loteamento.imagemMapa ?? null;

  function fmtBRL(n: number): string {
    if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function tempoRel(d: Date): string {
    const ms = Date.now() - d.getTime();
    const min = Math.round(ms / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Refresh automático a cada 30s — força revalidate */}
      <TvAutoRefresh intervaloMs={30_000} />

      {/* Background com glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[40vw] h-[40vh] rounded-full blur-3xl opacity-20" style={{ background: corPrimaria }} />
        <div className="absolute bottom-0 right-1/4 w-[40vw] h-[40vh] rounded-full blur-3xl opacity-20" style={{ background: corPrimaria }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
          <defs>
            <pattern id="tv-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M0 0H80V80H0Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tv-grid)" />
        </svg>
      </div>

      <div className="relative z-10 grid grid-rows-[auto,1fr,auto] min-h-screen">
        {/* ============ HEADER ============ */}
        <header className="px-8 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-4">
            {loteamento.loteadora.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loteamento.loteadora.logo}
                alt={loteamento.loteadora.nome}
                className="h-12 w-auto object-contain"
              />
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {loteamento.loteadora.nome}
              </p>
              <h1 className="text-3xl font-black tracking-tight">{loteamento.nome}</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-400">Plantão · ao vivo</p>
              <TvRelogio />
            </div>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          </div>
        </header>

        {/* ============ MIDDLE GRID ============ */}
        <main className="grid grid-cols-[1fr,420px] gap-6 p-6 min-h-0">
          {/* Coluna esquerda: KPIs + Mapa */}
          <section className="flex flex-col gap-6 min-h-0">
            {/* 4 KPIs */}
            <div className="grid grid-cols-4 gap-4">
              <KPI label="Disponíveis" valor={stats.disponiveis} cor="text-emerald-300" bg="bg-emerald-500/10 border-emerald-500/30" total={stats.total} />
              <KPI label="Reservados" valor={stats.reservados} cor="text-amber-300" bg="bg-amber-500/10 border-amber-500/30" total={stats.total} />
              <KPI label="Vendidos" valor={stats.vendidos} cor="text-sky-300" bg="bg-sky-500/10 border-sky-500/30" total={stats.total} />
              <KPI label="VGV Vendido" valor={fmtBRL(vgvVendido)} cor="text-fuchsia-300" bg="bg-fuchsia-500/10 border-fuchsia-500/30" sub={`+ ${fmtBRL(vgvReservado)} reservado`} />
            </div>

            {/* Mapa */}
            <div className="flex-1 min-h-0 bg-white/[0.02] rounded-2xl border border-white/10 overflow-hidden">
              <div className="h-full overflow-auto p-4">
                {imagemMapa ? (
                  <MapaVisual
                    imagemMapa={imagemMapa}
                    lotes={lotesUI}
                    tabelas={[]}
                    loteamentoId={loteamento.id}
                    loteamentoNome={loteamento.nome}
                    loteamentoSlug={loteamento.slug}
                    corPrimaria={corPrimaria}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    Planta não cadastrada
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Coluna direita: Feed + Ranking */}
          <aside className="flex flex-col gap-6 min-h-0">
            {/* Feed de atividades */}
            <div className="flex-1 min-h-0 bg-white/[0.02] rounded-2xl border border-white/10 p-5 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-semibold">
                  📡 Últimas atividades · 24h
                </p>
                <span className="text-[10px] text-slate-500">{atividades.length} eventos</span>
              </div>
              <ul className="space-y-2 overflow-y-auto flex-1 -mr-2 pr-2">
                {atividades.length === 0 ? (
                  <li className="text-slate-500 text-sm text-center py-8">
                    Sem atividades nas últimas 24h
                  </li>
                ) : (
                  atividades.map((a, i) => {
                    const verbo = a.status === 'QUITADA' ? 'fechou' : 'reservou';
                    const icone = a.status === 'QUITADA' ? '✅' : '🔒';
                    return (
                      <li
                        key={i}
                        className="bg-white/5 border-l-2 border-primary-400/40 rounded-r-lg px-3 py-2"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm">
                            <span className="mr-1">{icone}</span>
                            <strong className="text-white">
                              {a.cliente.nome.split(' ')[0]}
                            </strong>{' '}
                            <span className="text-slate-300">{verbo} o lote</span>{' '}
                            <strong className="font-mono">{a.lote.codigo}</strong>
                          </p>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">
                            {tempoRel(a.createdAt)}
                          </span>
                        </div>
                        {a.corretor && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            por {a.corretor.nome}
                          </p>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* Ranking de corretores */}
            <div className="bg-white/[0.02] rounded-2xl border border-white/10 p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-semibold mb-3">
                🏆 Ranking · últimos 30 dias
              </p>
              {ranking.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  Sem vendas no período
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {ranking.map((r, i) => {
                    const max = ranking[0].valor || 1;
                    const pct = (r.valor / max) * 100;
                    const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    return (
                      <li key={i} className="relative">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-sm font-medium">
                            <span className="mr-1.5">{medalha}</span>
                            {r.nome}
                          </span>
                          <span className="text-xs text-slate-400">
                            {r.vendas} <span className="text-slate-500">venda{r.vendas > 1 ? 's' : ''}</span>
                          </span>
                        </div>
                        <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-amber-500 rounded-full transition-all duration-1000"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{fmtBRL(r.valor)}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </aside>
        </main>

        {/* ============ FOOTER ============ */}
        <footer className="px-8 py-3 flex items-center justify-between border-t border-white/10 text-xs">
          <span className="text-slate-500">
            Atualiza automaticamente a cada 30s · F11 para tela cheia
          </span>
          <span className="text-slate-400">
            Powered by <strong className="text-white">meuloteamento</strong>
          </span>
        </footer>
      </div>
    </div>
  );
}

// =====================================================================
// SUB-COMPONENTES
// =====================================================================

function KPI({
  label,
  valor,
  cor,
  bg,
  total,
  sub,
}: {
  label: string;
  valor: number | string;
  cor: string;
  bg: string;
  total?: number;
  sub?: string;
}) {
  const pct = typeof valor === 'number' && total ? Math.round((valor / total) * 100) : null;
  return (
    <div className={`rounded-2xl border ${bg} backdrop-blur p-4 relative overflow-hidden`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-1">
        {label}
      </p>
      <p className={`text-3xl xl:text-4xl font-black ${cor} leading-none`}>{valor}</p>
      {pct !== null && (
        <p className="text-[11px] text-slate-400 mt-1.5">
          {pct}% do total
        </p>
      )}
      {sub && <p className="text-[10px] text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}
