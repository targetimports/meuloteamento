'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface LoteCaseUI {
  id: string;
  codigo: string;
  quadra: string;
  area: number;
  preco: number;
  status: 'DISPONIVEL' | 'RESERVADO' | 'EM_PAGAMENTO' | 'VENDIDO' | 'BLOQUEADO';
  tipo: 'RESIDENCIAL' | 'COMERCIAL';
  /** Coordenadas em % do mapa (0–100) */
  x: number; y: number; w: number; h: number;
}

interface Stats {
  total: number;
  disponivel: number;
  reservado: number;
  em_pag: number;
  vendido: number;
}

// Mesma paleta de cores que o site público do parquetucano usa
const STATUS_FILL: Record<LoteCaseUI['status'], string> = {
  DISPONIVEL:    'rgba(16,185,129,0.45)',  // emerald-500/45
  RESERVADO:     'rgba(245,158,11,0.5)',   // amber-500/50
  EM_PAGAMENTO:  'rgba(59,130,246,0.5)',   // blue-500/50
  VENDIDO:       'rgba(239,68,68,0.6)',    // red-500/60
  BLOQUEADO:     'rgba(100,116,139,0.3)',  // slate-500/30
};

const STATUS_STROKE: Record<LoteCaseUI['status'], string> = {
  DISPONIVEL:    '#059669',
  RESERVADO:     '#d97706',
  EM_PAGAMENTO:  '#2563eb',
  VENDIDO:       '#b91c1c',
  BLOQUEADO:     '#64748b',
};

const STATUS_LABEL: Record<LoteCaseUI['status'], string> = {
  DISPONIVEL:   'Disponível',
  RESERVADO:    'Reservado',
  EM_PAGAMENTO: 'Em pagamento',
  VENDIDO:      'Vendido',
  BLOQUEADO:    'Bloqueado',
};

const STATUS_TEXT_COR: Record<LoteCaseUI['status'], string> = {
  DISPONIVEL:   'text-emerald-400 border-emerald-500/60',
  RESERVADO:    'text-amber-400 border-amber-500/60',
  EM_PAGAMENTO: 'text-blue-400 border-blue-500/60',
  VENDIDO:      'text-red-400 border-red-500/60',
  BLOQUEADO:    'text-slate-400 border-slate-500/60',
};

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function CaseParqueTucanoMap({
  imagemMapa,
  lotes,
  stats,
}: {
  imagemMapa: string;
  lotes: LoteCaseUI[];
  stats: Stats;
}) {
  const [selected, setSelected] = useState<LoteCaseUI | null>(null);

  const pctComprometido =
    stats.total > 0
      ? Math.round(((stats.vendido + stats.em_pag + stats.reservado) / stats.total) * 100)
      : 0;

  return (
    <section className="relative bg-black py-24 overflow-hidden">
      {/* Spotlight dourado */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-gold-500/20 via-gold-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(212,175,55,0.08),transparent_50%)]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-500/10 backdrop-blur border border-gold-500/40 rounded-full mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-500" />
            </span>
            <span className="text-xs font-bold text-gold-300 uppercase tracking-[0.25em]">
              Case real · {stats.total} lotes ao vivo
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
            <span className="bg-gradient-to-r from-white via-gold-200 to-gold-400 bg-clip-text text-transparent">
              Parque Tucano
            </span>{' '}
            ·{' '}
            <span className="text-white">Grupo Germanos</span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            O mesmo mapa que está em produção no site do empreendimento.{' '}
            <strong className="text-white">Clique em qualquer lote</strong> abaixo pra ver preço,
            condições e reservar — exatamente como o cliente final faz.
          </p>
        </div>

        {/* KPIs reais (mesmo layout do site público) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 bg-zinc-900/60 border border-gold-500/20 rounded-2xl p-4">
          <Kpi label="Total" valor={stats.total} cor="text-white" />
          <Kpi label="Disponíveis" valor={stats.disponivel} cor="text-emerald-400" />
          <Kpi label="Reservados" valor={stats.reservado} cor="text-amber-400" />
          <Kpi label="Em pagto." valor={stats.em_pag} cor="text-blue-400" />
          <Kpi label="Vendidos" valor={stats.vendido} cor="text-red-400" />
        </div>

        {/* Barra de progresso comprometido (igual ao site) */}
        <div className="mb-6">
          <div className="flex items-baseline justify-between mb-1.5 px-1">
            <p className="text-[10px] uppercase tracking-widest text-gold-400 font-bold">
              Status do empreendimento
            </p>
            <p className="text-xs text-slate-400">
              <span className="font-bold text-white">{pctComprometido}%</span> comprometido
            </p>
          </div>
          <div className="h-3 bg-zinc-900 rounded-full overflow-hidden flex border border-gold-500/20">
            {[
              { qtd: stats.vendido,    cor: 'bg-red-500' },
              { qtd: stats.em_pag,     cor: 'bg-blue-500' },
              { qtd: stats.reservado,  cor: 'bg-amber-500' },
              { qtd: stats.disponivel, cor: 'bg-emerald-500' },
            ].map((s, i) => (
              <div
                key={i}
                className={`h-full ${s.cor}`}
                style={{ width: `${(s.qtd / Math.max(stats.total, 1)) * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Grid: Mapa (esquerda) + Painel info (direita) */}
        <div className="grid lg:grid-cols-[1.6fr,1fr] gap-6 items-start">
          {/* === MAPA === */}
          <div className="relative bg-gradient-to-br from-zinc-900 to-black border-2 border-gold-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-gold-500/10">
            <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-gold-500/20 backdrop-blur">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gold-400 font-bold">
                  parquetucano.meuloteamento.com
                </p>
                <p className="text-xs text-white font-semibold">
                  Mapa interativo · {stats.total} lotes
                </p>
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ao vivo · dados reais
              </span>
            </div>

            {/* Planta + overlay SVG idêntico ao site público */}
            <div className="relative bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagemMapa}
                alt="Planta real do Parque Tucano"
                className="w-full block select-none"
                draggable={false}
              />

              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {lotes.map((l) => {
                  const isSelected = selected?.id === l.id;
                  return (
                    <g key={l.id}>
                      <rect
                        x={l.x}
                        y={l.y}
                        width={l.w}
                        height={l.h}
                        fill={STATUS_FILL[l.status]}
                        stroke={isSelected ? '#d4af37' : STATUS_STROKE[l.status]}
                        strokeWidth={isSelected ? '0.5' : '0.15'}
                        className="cursor-pointer transition-all hover:opacity-90"
                        style={{
                          filter: isSelected
                            ? 'drop-shadow(0 0 3px rgba(212,175,55,0.9))'
                            : undefined,
                        }}
                        onClick={() => setSelected(l)}
                      />
                    </g>
                  );
                })}
              </svg>

              <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 bg-gold-500 text-black rounded font-bold uppercase tracking-widest shadow-lg">
                ⚡ Demo · 100% dados reais
              </span>
            </div>

            {/* Legenda + filtros */}
            <div className="px-4 py-3 bg-black/60 border-t border-gold-500/20 flex items-center gap-3 flex-wrap text-[11px] text-slate-300">
              {(['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO', 'BLOQUEADO'] as const).map(
                (s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-sm border"
                      style={{
                        background: STATUS_FILL[s],
                        borderColor: STATUS_STROKE[s],
                      }}
                    />
                    {STATUS_LABEL[s]}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* === PAINEL INFO === */}
          <div className="space-y-3">
            {selected ? (
              <div className="bg-gradient-to-br from-gold-500/10 to-black border-2 border-gold-500/40 rounded-2xl p-5 shadow-xl shadow-gold-500/10">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gold-400 font-bold">
                      Lote selecionado · {selected.tipo === 'RESIDENCIAL' ? '🏠' : '🏢'}{' '}
                      {selected.tipo}
                    </p>
                    <p className="text-3xl font-black text-white font-mono mt-0.5">
                      {selected.codigo}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest border ${STATUS_TEXT_COR[selected.status]}`}
                  >
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-black/40 rounded-lg p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">Quadra</p>
                    <p className="text-lg font-bold text-white">{selected.quadra}</p>
                  </div>
                  <div className="bg-black/40 rounded-lg p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400">Área</p>
                    <p className="text-lg font-bold text-white">
                      {selected.area.toFixed(0)} <span className="text-xs">m²</span>
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gold-500/20 to-gold-600/10 border border-gold-500/30 rounded-lg p-3 mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-gold-300 font-bold">
                    Preço à vista
                  </p>
                  <p className="text-2xl font-black text-white mt-0.5">
                    {formatBRL(selected.preco)}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Ou{' '}
                    <strong className="text-gold-300">
                      60× {formatBRL(Math.round((selected.preco - 5000) / 60))}
                    </strong>{' '}
                    com R$ 5.000 de entrada
                  </p>
                </div>

                {selected.status === 'DISPONIVEL' ? (
                  <Link
                    href={`https://parquetucano.meuloteamento.com/?lote=${selected.codigo}#planta`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-black text-center text-sm font-black py-3 rounded-lg transition shadow-lg"
                  >
                    ⚡ Reservar este lote no site →
                  </Link>
                ) : (
                  <Link
                    href={`https://parquetucano.meuloteamento.com/?lote=${selected.codigo}#planta`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-zinc-900 hover:bg-zinc-800 border border-gold-500/30 text-white text-center text-xs font-medium py-2.5 rounded-lg transition"
                  >
                    Ver outros disponíveis no site →
                  </Link>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-zinc-900 to-black border border-gold-500/20 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3 opacity-50">👆</div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Clique em qualquer lote do mapa pra ver{' '}
                  <strong className="text-gold-300">preço, condições e reservar</strong> — fluxo
                  idêntico ao do site público.
                </p>
              </div>
            )}

            <Link
              href="https://parquetucano.meuloteamento.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white hover:bg-gold-100 text-black text-center text-sm font-bold py-3 rounded-xl transition border border-gold-500/40 shadow"
            >
              🌐 Abrir o site completo do Parque Tucano →
            </Link>
          </div>
        </div>

        {/* 4 cards explicativos */}
        <div className="mt-12">
          <h3 className="text-center text-xs uppercase tracking-[0.3em] text-gold-400 font-bold mb-6">
            ✨ O que esse mapa faz por você
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: '🎯',
                titulo: 'Reserva em 1 clique',
                desc:
                  'Cliente vê o lote, escolhe condição, paga PIX e fica reservado por 15 minutos — sem corretor envolvido.',
              },
              {
                icon: '🔒',
                titulo: 'Lock automático',
                desc:
                  'Dois clientes não conseguem reservar o mesmo lote ao mesmo tempo. Lock pessimista no Postgres garante.',
              },
              {
                icon: '⚡',
                titulo: 'Sincronização real-time',
                desc:
                  'Quando alguém compra ou reserva, o mapa atualiza pra todos os visitantes sem ninguém dar refresh.',
              },
              {
                icon: '🗺',
                titulo: 'Editor visual no admin',
                desc:
                  'Você desenha cada lote no mapa arrastando o mouse — sem precisar configurar coordenadas manualmente.',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="bg-gradient-to-br from-zinc-900 to-black border border-gold-500/20 rounded-xl p-5 hover:border-gold-500/50 transition group"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition">{f.icon}</div>
                <h4 className="font-bold text-white text-sm mb-1.5">{f.titulo}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold">{label}</p>
      <p className={`text-2xl font-black mt-0.5 ${cor}`}>{valor}</p>
    </div>
  );
}
