'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { LeadFormPublic } from './LeadFormPublic';
import { CheckoutFlow } from './CheckoutFlow';
import { IconArrowRight, IconCheck, IconX } from './icons';

// =====================================================================
// TIPOS COMPARTILHADOS
// =====================================================================

export interface LoteUI {
  id: string;
  codigo: string;
  quadra: string;
  numero: string;
  area: number;
  testada: number | null;
  fundo: number | null;
  preco: number;
  descricao: string | null;
  status: 'DISPONIVEL' | 'RESERVADO' | 'EM_PAGAMENTO' | 'VENDIDO' | 'BLOQUEADO';
  tipo: 'RESIDENCIAL' | 'COMERCIAL';
  motivoBloqueio: string | null;
  orientacaoSolar: string | null;
  esquina: boolean;
  fronteAreaVerde: boolean;
  fotos: string[];
  mapaX: number | null;
  mapaY: number | null;
  mapaLargura: number | null;
  mapaAltura: number | null;
}

export interface TabelaPrecoUI {
  id: string;
  nome: string;
  descricao: string | null;
  descontoPct: number | null;
  entradaPct: number | null;
  parcelasMin: number;
  parcelasMax: number;
}

const STATUS_LABEL: Record<LoteUI['status'], string> = {
  DISPONIVEL: 'Disponível',
  RESERVADO: 'Reservado',
  EM_PAGAMENTO: 'Em pagamento',
  VENDIDO: 'Vendido',
  BLOQUEADO: 'Bloqueado',
};

const STATUS_BG: Record<LoteUI['status'], string> = {
  DISPONIVEL: 'bg-emerald-100 text-emerald-700 ring-emerald-300 hover:bg-emerald-200',
  RESERVADO: 'bg-amber-100 text-amber-700 ring-amber-300',
  EM_PAGAMENTO: 'bg-blue-100 text-blue-700 ring-blue-300',
  VENDIDO: 'bg-red-100 text-red-700 ring-red-400 line-through cursor-not-allowed',
  BLOQUEADO: 'bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed',
};

const ORIENTACAO_LABEL: Record<string, string> = {
  NORTE: 'Norte',
  SUL: 'Sul',
  LESTE: 'Leste',
  OESTE: 'Oeste',
  NORDESTE: 'Nordeste',
  NOROESTE: 'Noroeste',
  SUDESTE: 'Sudeste',
  SUDOESTE: 'Sudoeste',
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatArea(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m²`;
}

// =====================================================================
// STATS BAR — count-up ao entrar na viewport
// =====================================================================

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || started.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - (1 - t) ** 3;
            setValue(Math.floor(eased * target));
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

function StatCard({
  to,
  label,
  prefix = '',
  suffix = '',
  tint,
}: {
  to: number;
  label: string;
  prefix?: string;
  suffix?: string;
  tint: string;
}) {
  const { value, ref } = useCountUp(to);
  return (
    <div ref={ref} className="text-center group">
      <p className={`text-4xl md:text-5xl font-bold tabular-nums ${tint}`}>
        {prefix}
        {value.toLocaleString('pt-BR')}
        {suffix}
      </p>
      <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export function StatsBar({ lotes, corPrimaria }: { lotes: LoteUI[]; corPrimaria: string }) {
  const total = lotes.length;
  const disponiveis = lotes.filter((l) => l.status === 'DISPONIVEL').length;
  const vendidos = lotes.filter((l) => l.status === 'VENDIDO').length;
  const precoMin = lotes.length > 0 ? Math.min(...lotes.filter((l) => l.status === 'DISPONIVEL').map((l) => l.preco)) : 0;
  const percentVendido = total > 0 ? Math.round((vendidos / total) * 100) : 0;

  return (
    <section className="bg-white py-12 border-y border-slate-200 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard to={total} label="Lotes no total" tint="text-slate-900" />
          <StatCard to={disponiveis} label="Disponíveis agora" tint="text-emerald-600" />
          <StatCard to={percentVendido} label="Já vendidos" suffix="%" tint="text-amber-600" />
          <div className="text-center">
            <p className="text-4xl md:text-5xl font-bold" style={{ color: corPrimaria }}>
              {precoMin > 0 ? `R$ ${(precoMin / 1000).toFixed(0)}k` : '—'}
            </p>
            <p className="text-xs uppercase tracking-wider text-slate-500 mt-1">A partir de</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// GALLERY LIGHTBOX
// =====================================================================

export function GalleryLightbox({ images }: { images: string[] }) {
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (idx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIdx(null);
      if (e.key === 'ArrowRight') setIdx((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === 'ArrowLeft') setIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length));
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [idx, images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="aspect-video relative rounded-xl overflow-hidden group ring-1 ring-slate-200 hover:ring-primary-400 transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Imagem ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
            <div className="absolute bottom-2 right-2 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg">
              <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z M11 7v6m-3-3h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {idx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up"
          onClick={() => setIdx(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(null); }}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"
            aria-label="Fechar"
          >
            <IconX />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i === null ? 0 : (i - 1 + images.length) % images.length)); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"
            aria-label="Anterior"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i === null ? 0 : (i + 1) % images.length)); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"
            aria-label="Próxima"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            className="max-h-[90vh] max-w-[90vw] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper
              minScale={1}
              maxScale={5}
              initialScale={1}
              centerOnInit
              wheel={{ step: 0.2 }}
              doubleClick={{ mode: 'toggle', step: 2 }}
              pinch={{ step: 5 }}
            >
              <TransformComponent
                wrapperClass="!max-h-[90vh] !max-w-[90vw]"
                contentClass="!max-h-[90vh]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[idx]}
                  alt=""
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
                  draggable={false}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm pointer-events-none">
            {idx + 1} / {images.length}
            <span className="mx-2 text-white/40">·</span>
            <span className="text-white/50">scroll/pinça para zoom · duplo-clique alterna</span>
          </p>
        </div>
      )}
    </>
  );
}

// =====================================================================
// MAPA INTERATIVO DE LOTES — com filtros, hover tooltip e modal
// =====================================================================

export function MapaInterativo({
  lotes,
  tabelas,
  loteamentoId,
  loteamentoNome,
  loteamentoSlug,
  corPrimaria,
}: {
  lotes: LoteUI[];
  tabelas: TabelaPrecoUI[];
  loteamentoId: string;
  loteamentoNome: string;
  loteamentoSlug: string;
  corPrimaria: string;
}) {
  const quadras = useMemo(
    () => Array.from(new Set(lotes.map((l) => l.quadra))).sort(),
    [lotes]
  );

  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO'])
  );
  const [quadraFilter, setQuadraFilter] = useState<string>('');
  const [esquina, setEsquina] = useState(false);
  const [areaVerde, setAreaVerde] = useState(false);
  const [precoMax, setPrecoMax] = useState<number | null>(null);
  const [selected, setSelected] = useState<LoteUI | null>(null);

  // Deep link: abre modal se ?lote=X-N na URL
  const searchParams = useSearchParams();
  useEffect(() => {
    const param = searchParams?.get('lote');
    if (param && !selected) {
      const match = lotes.find((l) => l.codigo === param);
      if (match) setSelected(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const maxPrecoGlobal = useMemo(() => {
    if (lotes.length === 0) return 0;
    return Math.max(...lotes.map((l) => l.preco));
  }, [lotes]);

  const filtered = useMemo(() => {
    return lotes.filter((l) => {
      if (!statusFilter.has(l.status)) return false;
      if (quadraFilter && l.quadra !== quadraFilter) return false;
      if (esquina && !l.esquina) return false;
      if (areaVerde && !l.fronteAreaVerde) return false;
      if (precoMax !== null && l.preco > precoMax) return false;
      return true;
    });
  }, [lotes, statusFilter, quadraFilter, esquina, areaVerde, precoMax]);

  const porQuadra = useMemo(() => {
    const map = new Map<string, LoteUI[]>();
    for (const l of filtered) {
      if (!map.has(l.quadra)) map.set(l.quadra, []);
      map.get(l.quadra)!.push(l);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function toggleStatus(s: string) {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  }

  return (
    <>
      <div className="grid lg:grid-cols-[280px,1fr] gap-6">
        {/* Filtros */}
        <aside className="lg:sticky lg:top-24 lg:self-start bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Filtros</h3>

            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Status</p>
            <div className="space-y-1.5">
              {(['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO', 'BLOQUEADO'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={statusFilter.has(s)}
                    onChange={() => toggleStatus(s)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                    s === 'DISPONIVEL' ? 'bg-emerald-500' :
                    s === 'RESERVADO' ? 'bg-amber-500' :
                    s === 'EM_PAGAMENTO' ? 'bg-blue-500' :
                    s === 'VENDIDO' ? 'bg-slate-400' :
                    'bg-slate-300'
                  }`} />
                  {STATUS_LABEL[s]}
                </label>
              ))}
            </div>
          </div>

          {quadras.length > 1 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Quadra</p>
              <select
                value={quadraFilter}
                onChange={(e) => setQuadraFilter(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todas</option>
                {quadras.map((q) => (
                  <option key={q} value={q}>Quadra {q}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Preço até</p>
              <p className="text-sm font-semibold" style={{ color: corPrimaria }}>
                {precoMax !== null ? formatBRL(precoMax) : 'Qualquer'}
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={maxPrecoGlobal}
              step={1000}
              value={precoMax ?? maxPrecoGlobal}
              onChange={(e) => setPrecoMax(Number(e.target.value) === maxPrecoGlobal ? null : Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <button
              onClick={() => setPrecoMax(null)}
              className="text-xs text-slate-500 hover:text-slate-700 mt-1"
            >
              Limpar limite
            </button>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Características</p>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={esquina} onChange={(e) => setEsquina(e.target.checked)} className="rounded text-primary-600" />
              Esquina
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mt-1">
              <input type="checkbox" checked={areaVerde} onChange={(e) => setAreaVerde(e.target.checked)} className="rounded text-primary-600" />
              Frente para área verde
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{filtered.length}</strong> de {lotes.length} lote(s)
            </p>
          </div>
        </aside>

        {/* Mapa / grade */}
        <div>
          {porQuadra.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
              Nenhum lote corresponde aos filtros selecionados.
            </div>
          ) : (
            <div className="space-y-6">
              {porQuadra.map(([quadra, items]) => (
                <div key={quadra} className="bg-white border border-slate-200 rounded-2xl p-5">
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-bold text-slate-900">Quadra {quadra}</h3>
                    <span className="text-xs text-slate-500">{items.length} lote(s)</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2">
                    {items.map((lote, i) => (
                      <button
                        key={lote.id}
                        onClick={() => setSelected(lote)}
                        disabled={lote.status === 'BLOQUEADO' || lote.status === 'VENDIDO'}
                        style={{ animationDelay: `${i * 20}ms` }}
                        className={`group relative aspect-square rounded-lg ring-1 transition-all duration-200 p-2 text-left animate-fade-up ${STATUS_BG[lote.status]} ${
                          lote.status !== 'BLOQUEADO' && lote.status !== 'VENDIDO' && 'hover:scale-110 hover:z-10 hover:shadow-xl cursor-pointer'
                        }`}
                      >
                        <p className="font-mono font-bold text-xs">{lote.codigo}</p>
                        <p className="text-[10px] opacity-70 mt-0.5">{formatArea(lote.area)}</p>
                        {(lote.esquina || lote.fronteAreaVerde) && (
                          <div className="absolute top-1 right-1 flex gap-0.5">
                            {lote.esquina && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" title="Esquina" />}
                            {lote.fronteAreaVerde && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" title="Área verde" />}
                          </div>
                        )}
                        {/* tooltip */}
                        <div className="invisible group-hover:visible group-hover:translate-y-0 translate-y-1 opacity-0 group-hover:opacity-100 transition absolute -top-24 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-xs rounded-lg p-2.5 w-44 pointer-events-none shadow-2xl">
                          <p className="font-bold mb-0.5">Lote {lote.codigo}</p>
                          <p className="text-slate-300">{formatArea(lote.area)}</p>
                          <p className="text-primary-300 font-semibold mt-1">{formatBRL(lote.preco)}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{STATUS_LABEL[lote.status]}</p>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <LoteModal
          lote={selected}
          tabelas={tabelas}
          loteamentoId={loteamentoId}
          loteamentoNome={loteamentoNome}
          loteamentoSlug={loteamentoSlug}
          corPrimaria={corPrimaria}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// =====================================================================
// CONTROLES DE ZOOM (overlay nos cantos do mapa)
// =====================================================================

function ZoomControls({ corPrimaria }: { corPrimaria: string }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-1">
      <button
        onClick={() => zoomIn()}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:text-white hover:bg-slate-900 transition font-bold text-lg"
        title="Aproximar (scroll)"
        aria-label="Aproximar"
        style={{ ['--hover' as never]: corPrimaria }}
      >
        +
      </button>
      <button
        onClick={() => zoomOut()}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:text-white hover:bg-slate-900 transition font-bold text-lg"
        title="Afastar"
        aria-label="Afastar"
      >
        −
      </button>
      <button
        onClick={() => resetTransform()}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:text-white hover:bg-slate-900 transition"
        title="Resetar zoom"
        aria-label="Resetar zoom"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path d="M9 9h6v6H9z M3 3v6m0-6h6 M21 3v6m0-6h-6 M21 21v-6m0 6h-6 M3 21v-6m0 6h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// =====================================================================
// MAPA VISUAL — imagem com sobreposição de lotes clicáveis
// =====================================================================

export function MapaVisual({
  imagemMapa,
  lotes,
  tabelas,
  loteamentoId,
  loteamentoNome,
  loteamentoSlug,
  corPrimaria,
  somenteImagem,
}: {
  imagemMapa: string;
  lotes: LoteUI[];
  tabelas: TabelaPrecoUI[];
  loteamentoId: string;
  loteamentoNome: string;
  loteamentoSlug: string;
  corPrimaria: string;
  /** Se true: mostra só a imagem do mapa com zoom, sem retângulos clicáveis nem modal de lote. */
  somenteImagem?: boolean;
}) {
  const lotesPosicionados = useMemo(
    () =>
      somenteImagem
        ? []
        : lotes.filter(
            (l) =>
              l.mapaX !== null && l.mapaY !== null && l.mapaLargura !== null && l.mapaAltura !== null
          ),
    [lotes, somenteImagem]
  );

  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    new Set(['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO', 'BLOQUEADO'])
  );
  const [tipoFilter, setTipoFilter] = useState<Set<string>>(
    new Set(['RESIDENCIAL', 'COMERCIAL'])
  );
  const [selected, setSelected] = useState<LoteUI | null>(null);

  // Deep link
  const searchParams = useSearchParams();
  useEffect(() => {
    const param = searchParams?.get('lote');
    if (param && !selected) {
      const match = lotes.find((l) => l.codigo === param);
      if (match) setSelected(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function toggleStatus(s: string) {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  }

  function toggleTipo(t: string) {
    const next = new Set(tipoFilter);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setTipoFilter(next);
  }

  if (lotesPosicionados.length === 0) {
    return <MapaImagemSimples imagemMapa={imagemMapa} corPrimaria={corPrimaria} />;
  }

  // KPIs do espelho de vendas
  const totalPosicionados = lotesPosicionados.length;
  const cDispo = lotesPosicionados.filter((l) => l.status === 'DISPONIVEL').length;
  const cReserv = lotesPosicionados.filter((l) => l.status === 'RESERVADO').length;
  const cEmPag = lotesPosicionados.filter((l) => l.status === 'EM_PAGAMENTO').length;
  const cVend = lotesPosicionados.filter((l) => l.status === 'VENDIDO').length;
  const pctVendido = totalPosicionados > 0 ? Math.round((cVend / totalPosicionados) * 100) : 0;
  const pctReservado = totalPosicionados > 0 ? Math.round((cReserv / totalPosicionados) * 100) : 0;
  const pctEmPag = totalPosicionados > 0 ? Math.round((cEmPag / totalPosicionados) * 100) : 0;

  return (
    <>
      {/* Resumo visual + barra de progresso */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
          <KpiEspelho label="Total" valor={totalPosicionados} cor="text-slate-900" />
          <KpiEspelho label="Disponíveis" valor={cDispo} cor="text-emerald-600" />
          <KpiEspelho label="Reservados" valor={cReserv} cor="text-amber-600" />
          <KpiEspelho label="Em pagto." valor={cEmPag} cor="text-blue-600" />
          <KpiEspelho label="Vendidos" valor={cVend} cor="text-red-600" />
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status do empreendimento
            </p>
            <p className="text-xs text-slate-500">
              <span className="font-bold text-slate-900">{pctVendido + pctEmPag + pctReservado}%</span> comprometido
            </p>
          </div>
          {/* Barra empilhada — vendido | em pagto | reservado | disponível */}
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${pctVendido}%` }}
              title={`Vendidos: ${pctVendido}%`}
            />
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${pctEmPag}%` }}
              title={`Em pagamento: ${pctEmPag}%`}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${pctReservado}%` }}
              title={`Reservados: ${pctReservado}%`}
            />
          </div>
        </div>
      </div>

      {/* Filtro de TIPO (Residencial / Comercial) */}
      <div className="flex flex-wrap gap-2 mb-2 justify-center">
        {(['RESIDENCIAL', 'COMERCIAL'] as const).map((t) => {
          const count = lotesPosicionados.filter((l) => l.tipo === t).length;
          const active = tipoFilter.has(t);
          const cor = t === 'RESIDENCIAL' ? 'bg-emerald-500' : 'bg-violet-500';
          const emoji = t === 'RESIDENCIAL' ? '🏡' : '🏢';
          const lbl = t === 'RESIDENCIAL' ? 'Residencial' : 'Comercial';
          return (
            <button
              key={t}
              onClick={() => toggleTipo(t)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                active
                  ? 'bg-white border-2 border-slate-300 text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-400 line-through border-2 border-transparent'
              }`}
            >
              <span>{emoji}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${cor}`} />
              {lbl} ({count})
            </button>
          );
        })}
      </div>

      {/* Legenda clicável (status) */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {(['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO', 'VENDIDO'] as const).map((s) => {
          const count = lotesPosicionados.filter((l) => l.status === s).length;
          const active = statusFilter.has(s);
          const dotColor =
            s === 'DISPONIVEL' ? 'bg-emerald-500' :
            s === 'RESERVADO' ? 'bg-amber-500' :
            s === 'EM_PAGAMENTO' ? 'bg-blue-500' :
            'bg-red-500';
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                active
                  ? 'bg-white border border-slate-300 text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-400 line-through'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
              {STATUS_LABEL[s]} ({count})
            </button>
          );
        })}
        <p className="basis-full text-center text-[11px] text-slate-400 mt-1">
          Lotes <span className="font-semibold text-violet-700">comerciais</span> aparecem em violeta · <span className="font-semibold text-emerald-700">residenciais</span> em verde
        </p>
      </div>

      {/* Mapa interativo com ZOOM/PAN */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-200 relative">
        <TransformWrapper
          minScale={1}
          maxScale={6}
          initialScale={1}
          centerOnInit
          wheel={{ step: 0.15 }}
          doubleClick={{ mode: 'toggle', step: 1.8 }}
          panning={{ velocityDisabled: true, excluded: ['rect-lote'] }}
          pinch={{ step: 5 }}
        >
          <ZoomControls corPrimaria={corPrimaria} />
          <TransformComponent
            wrapperClass="!w-full !h-auto"
            contentClass="!w-full"
          >
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagemMapa}
                alt="Planta do loteamento"
                className="w-full block select-none"
                draggable={false}
              />
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                {lotesPosicionados.map((lote) => {
                  if (!statusFilter.has(lote.status)) return null;
                  if (!tipoFilter.has(lote.tipo)) return null;
                  const indisponivel = lote.status === 'VENDIDO' || lote.status === 'BLOQUEADO';
                  const isComercial = lote.tipo === 'COMERCIAL';
                  // Comerciais usam paleta violeta/roxa distinta para destacar
                  const fillClass = isComercial
                    ? lote.status === 'DISPONIVEL'
                      ? 'fill-violet-500/45 hover:fill-violet-500/75 stroke-violet-700'
                      : lote.status === 'RESERVADO'
                      ? 'fill-fuchsia-500/45 hover:fill-fuchsia-500/75 stroke-fuchsia-700'
                      : lote.status === 'EM_PAGAMENTO'
                      ? 'fill-purple-500/45 hover:fill-purple-500/75 stroke-purple-700'
                      : lote.status === 'VENDIDO'
                      ? 'fill-red-500/65 stroke-red-700'
                      : 'fill-slate-500/40 stroke-slate-600'
                    : lote.status === 'DISPONIVEL'
                      ? 'fill-emerald-500/40 hover:fill-emerald-500/70 stroke-emerald-600'
                      : lote.status === 'RESERVADO'
                      ? 'fill-amber-500/40 hover:fill-amber-500/70 stroke-amber-600'
                      : lote.status === 'EM_PAGAMENTO'
                      ? 'fill-blue-500/40 hover:fill-blue-500/70 stroke-blue-600'
                      : lote.status === 'VENDIDO'
                      ? 'fill-red-500/65 stroke-red-700'
                      : 'fill-slate-500/40 stroke-slate-600';

                  return (
                    <g
                      key={lote.id}
                      className={`rect-lote ${indisponivel ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <title>
                        Lote {lote.codigo}
                        {isComercial ? ' (COMERCIAL)' : ''} —{' '}
                        {lote.status === 'VENDIDO'
                          ? 'VENDIDO'
                          : `${STATUS_LABEL[lote.status]} — ${formatBRL(lote.preco)}`}
                      </title>
                      <rect
                        x={lote.mapaX!}
                        y={lote.mapaY!}
                        width={lote.mapaLargura!}
                        height={lote.mapaAltura!}
                        className={`${fillClass} transition rect-lote`}
                        strokeWidth={0.2}
                        onClick={(e) => {
                          if (!indisponivel) {
                            e.stopPropagation();
                            setSelected(lote);
                          }
                        }}
                      />
                      {/* Número do lote, centralizado, sempre visível */}
                      <text
                        x={lote.mapaX! + lote.mapaLargura! / 2}
                        y={lote.mapaY! + lote.mapaAltura! / 2}
                        fontSize={Math.min(lote.mapaLargura!, lote.mapaAltura!) * 0.45}
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={
                          lote.status === 'VENDIDO'
                            ? 'fill-red-900 pointer-events-none'
                            : 'fill-slate-900 pointer-events-none'
                        }
                        style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 0.06 }}
                      >
                        {lote.numero}
                      </text>
                      {lote.status === 'VENDIDO' && (
                        <g pointerEvents="none">
                          <line
                            x1={lote.mapaX!}
                            y1={lote.mapaY!}
                            x2={lote.mapaX! + lote.mapaLargura!}
                            y2={lote.mapaY! + lote.mapaAltura!}
                            className="stroke-red-700"
                            strokeWidth={0.25}
                          />
                          <line
                            x1={lote.mapaX! + lote.mapaLargura!}
                            y1={lote.mapaY!}
                            x2={lote.mapaX!}
                            y2={lote.mapaY! + lote.mapaAltura!}
                            className="stroke-red-700"
                            strokeWidth={0.25}
                          />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* ============ LABELS DAS QUADRAS (uma letra grande no centroide) ============ */}
                {Array.from(
                  lotesPosicionados.reduce((map, l) => {
                    if (!statusFilter.has(l.status)) return map;
                    const q = l.quadra;
                    const arr = map.get(q) ?? [];
                    arr.push(l);
                    map.set(q, arr);
                    return map;
                  }, new Map<string, typeof lotesPosicionados>())
                ).map(([quadra, lotesDaQuadra]) => {
                  if (lotesDaQuadra.length === 0) return null;
                  // Centroide da quadra = média dos centros dos lotes
                  const cx =
                    lotesDaQuadra.reduce(
                      (s, l) => s + l.mapaX! + l.mapaLargura! / 2,
                      0
                    ) / lotesDaQuadra.length;
                  const cy =
                    lotesDaQuadra.reduce(
                      (s, l) => s + l.mapaY! + l.mapaAltura! / 2,
                      0
                    ) / lotesDaQuadra.length;
                  return (
                    <g key={`quadra-${quadra}`} pointerEvents="none">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={2.2}
                        fill="white"
                        stroke="#0f172a"
                        strokeWidth={0.25}
                        opacity={0.85}
                      />
                      <text
                        x={cx}
                        y={cy}
                        fontSize={2.4}
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-slate-900"
                      >
                        {quadra}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-2 flex-wrap">
        <span>🖱️ Use o scroll para zoom</span>
        <span className="text-slate-300">·</span>
        <span>👆 Pinça nos dedos no celular</span>
        <span className="text-slate-300">·</span>
        <span>Clique no lote para ver detalhes</span>
      </p>

      {selected && (
        <LoteModal
          lote={selected}
          tabelas={tabelas}
          loteamentoId={loteamentoId}
          loteamentoNome={loteamentoNome}
          loteamentoSlug={loteamentoSlug}
          corPrimaria={corPrimaria}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// =====================================================================
// LOTE MODAL — detalhes + simulador + lead form
// =====================================================================

function LoteModal({
  lote,
  tabelas,
  loteamentoId,
  loteamentoNome,
  loteamentoSlug,
  corPrimaria,
  onClose,
}: {
  lote: LoteUI;
  tabelas: TabelaPrecoUI[];
  loteamentoId: string;
  loteamentoNome: string;
  loteamentoSlug: string;
  corPrimaria: string;
  onClose: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [tab, setTab] = useState<'detalhes' | 'simulador' | 'reservar' | 'contato'>('detalhes');
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  function shareLink() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/${loteamentoSlug}?lote=${encodeURIComponent(lote.codigo)}`;
    if (navigator.share) {
      navigator
        .share({
          title: `Lote ${lote.codigo} — ${loteamentoNome}`,
          text: `Confira o lote ${lote.codigo} no ${loteamentoNome}`,
          url,
        })
        .catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(
      () => {
        setShareMsg('Link copiado!');
        setTimeout(() => setShareMsg(null), 2200);
      },
      () => {
        setShareMsg('Falha ao copiar.');
        setTimeout(() => setShareMsg(null), 2200);
      }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const fotos = lote.fotos.length > 0 ? lote.fotos : [];
  const indisponivel = lote.status !== 'DISPONIVEL';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-up"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl md:rounded-3xl max-w-3xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white backdrop-blur rounded-full flex items-center justify-center text-slate-700 shadow-lg"
          aria-label="Fechar"
        >
          <IconX />
        </button>

        {/* Hero do modal */}
        <div
          className="relative h-56 md:h-72"
          style={{
            background: fotos.length === 0
              ? `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}aa)`
              : undefined,
          }}
        >
          {fotos.length > 0 && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotos[photoIdx]} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {fotos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx((i) => (i - 1 + fotos.length) % fotos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setPhotoIdx((i) => (i + 1) % fotos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {fotos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={`w-2 h-2 rounded-full transition ${i === photoIdx ? 'bg-white w-6' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <div className="absolute bottom-4 left-6 text-white">
            <p className="text-xs uppercase tracking-wider opacity-80">{loteamentoNome}</p>
            <h2 className="text-3xl font-bold">Lote {lote.codigo}</h2>
          </div>

          <div className="absolute top-4 left-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                indisponivel ? 'bg-slate-900/80 text-white' : 'bg-emerald-500 text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {STATUS_LABEL[lote.status]}
            </span>
          </div>
        </div>

        {/* Action bar with share */}
        <div className="border-b border-slate-200 px-4 py-2 flex items-center justify-between bg-slate-50">
          <p className="text-xs text-slate-600">
            Lote {lote.codigo} · Quadra {lote.quadra}
          </p>
          <div className="flex items-center gap-2">
            {shareMsg && (
              <span className="text-xs font-medium text-emerald-700">{shareMsg}</span>
            )}
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('comparador:add', { detail: { id: lote.id } })
                );
                setShareMsg('Adicionado ao comparador!');
                setTimeout(() => setShareMsg(null), 2200);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md hover:bg-white"
              style={{ color: corPrimaria }}
              title="Adicionar ao comparador de lotes"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
              Comparar
            </button>
            <button
              onClick={shareLink}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-white"
              title="Compartilhar este lote"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4m0 0L8 6m4-4v13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Compartilhar
            </button>
          </div>
        </div>

        {/* Tabs — comerciais não têm Simulador nem Comprar (vendido por consultor) */}
        {(() => null)()}
        <div className="border-b border-slate-200">
          <div className="flex">
            {(lote.tipo === 'COMERCIAL'
              ? ([
                  ['detalhes', 'Detalhes'],
                  ['contato', 'Falar c/ consultor'],
                ] as const)
              : ([
                  ['detalhes', 'Detalhes'],
                  ['simulador', 'Simulador'],
                  ['reservar', 'Comprar agora'],
                  ['contato', 'Falar c/ consultor'],
                ] as const)
            ).map(([key, label]) => {
              const disabled = key === 'reservar' && indisponivel;
              return (
                <button
                  key={key}
                  onClick={() => !disabled && setTab(key)}
                  disabled={disabled}
                  className={`flex-1 px-3 py-3 text-xs md:text-sm font-medium transition relative ${
                    disabled ? 'text-slate-300 cursor-not-allowed' :
                    tab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                  {tab === key && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: corPrimaria }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {tab === 'detalhes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Info label="Preço" value={formatBRL(lote.preco)} highlight={corPrimaria} />
                <Info label="Área" value={formatArea(lote.area)} />
                {lote.testada !== null && <Info label="Testada" value={`${lote.testada} m`} />}
                {lote.fundo !== null && <Info label="Fundo" value={`${lote.fundo} m`} />}
                {lote.orientacaoSolar && (
                  <Info label="Orientação solar" value={ORIENTACAO_LABEL[lote.orientacaoSolar] ?? lote.orientacaoSolar} />
                )}
                <Info label="Quadra" value={lote.quadra} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Características</p>
                <div className="flex flex-wrap gap-2">
                  {lote.esquina && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                      <IconCheck className="w-3 h-3" />
                      Esquina
                    </span>
                  )}
                  {lote.fronteAreaVerde && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                      <IconCheck className="w-3 h-3" />
                      Frente para área verde
                    </span>
                  )}
                  {!lote.esquina && !lote.fronteAreaVerde && (
                    <span className="text-sm text-slate-500">Lote padrão</span>
                  )}
                </div>
              </div>

              {lote.descricao && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Descrição</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{lote.descricao}</p>
                </div>
              )}

              {indisponivel && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-700">
                    <strong>Este lote está {STATUS_LABEL[lote.status].toLowerCase()}.</strong>{' '}
                    {lote.motivoBloqueio && <span>Motivo: {lote.motivoBloqueio}.</span>}{' '}
                    Deixe seu contato e te avisamos se voltar a ficar disponível.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'simulador' && (
            <Simulador valorLote={lote.preco} tabelas={tabelas} corPrimaria={corPrimaria} />
          )}

          {tab === 'reservar' && !indisponivel && (
            <CheckoutFlow
              loteId={lote.id}
              loteCodigo={lote.codigo}
              loteamentoNome={loteamentoNome}
              precoLote={lote.preco}
              corPrimaria={corPrimaria}
            />
          )}

          {tab === 'contato' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Preencha seus dados e um consultor te chama pra falar sobre o Lote {lote.codigo}.
              </p>
              <LeadFormPublic
                loteamentoId={loteamentoId}
                loteId={lote.id}
                origem={`lote-${loteamentoSlug}-${lote.codigo}`}
                hideTitle
              />
            </div>
          )}
        </div>

        {/* CTA fixo no rodapé do modal */}
        {(tab === 'detalhes' || tab === 'simulador') && !indisponivel && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Valor do lote</p>
              <p className="text-xl font-bold" style={{ color: corPrimaria }}>
                {formatBRL(lote.preco)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTab('contato')}
                className="flex items-center gap-1 px-3 py-3 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 font-medium text-sm rounded-xl transition"
              >
                Mais info
              </button>
              <button
                onClick={() => setTab(lote.tipo === 'COMERCIAL' ? 'contato' : 'reservar')}
                className="flex items-center gap-2 px-5 py-3 text-white font-semibold rounded-xl shadow-lg transition hover:opacity-90"
                style={{ background: corPrimaria }}
              >
                {lote.tipo === 'COMERCIAL' ? 'Negociar comercial' : 'Comprar agora'}
                <IconArrowRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-semibold mt-0.5" style={highlight ? { color: highlight } : { color: '#0f172a' }}>
        {value}
      </p>
    </div>
  );
}

// =====================================================================
// SIMULADOR DE PARCELAMENTO
// =====================================================================

function Simulador({
  valorLote,
  tabelas,
  corPrimaria,
}: {
  valorLote: number;
  tabelas: TabelaPrecoUI[];
  corPrimaria: string;
}) {
  const [entradaPct, setEntradaPct] = useState(20);
  const [parcelas, setParcelas] = useState(60);
  const [tabelaId, setTabelaId] = useState<string>('');

  const tabela = tabelas.find((t) => t.id === tabelaId);
  const descontoPct = tabela?.descontoPct ? Number(tabela.descontoPct) : 0;

  const valorComDesconto = valorLote * (1 - descontoPct / 100);
  const entrada = (valorComDesconto * entradaPct) / 100;
  const restante = valorComDesconto - entrada;
  const valorParcela = parcelas > 0 ? restante / parcelas : 0;

  return (
    <div className="space-y-5">
      {tabelas.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-2 uppercase tracking-wider">
            Condição
          </label>
          <select
            value={tabelaId}
            onChange={(e) => setTabelaId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Personalizado</option>
            {tabelas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.descontoPct ? ` (-${Number(t.descontoPct).toFixed(0)}%)` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Entrada
          </label>
          <span className="text-sm font-semibold text-slate-900">
            {entradaPct}% — {formatBRL(entrada)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={entradaPct}
          onChange={(e) => setEntradaPct(Number(e.target.value))}
          className="w-full accent-primary-600"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">
            Parcelas
          </label>
          <span className="text-sm font-semibold text-slate-900">{parcelas}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={tabela?.parcelasMax ?? 180}
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
          className="w-full accent-primary-600"
        />
      </div>

      {/* Resultado */}
      <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}cc)` }}>
        <p className="text-xs uppercase tracking-wider opacity-80">Sua parcela</p>
        <p className="text-4xl font-bold mt-1">{formatBRL(valorParcela)}</p>
        <p className="text-xs opacity-80 mt-2">por mês durante {parcelas} meses</p>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/20 text-sm">
          <div>
            <p className="opacity-70 text-xs">Valor do lote</p>
            <p className="font-semibold">{formatBRL(valorComDesconto)}</p>
            {descontoPct > 0 && (
              <p className="text-xs opacity-70 line-through">{formatBRL(valorLote)}</p>
            )}
          </div>
          <div>
            <p className="opacity-70 text-xs">Entrada</p>
            <p className="font-semibold">{formatBRL(entrada)}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Valores simulados sem juros. Condições reais sujeitas a análise comercial.
      </p>
    </div>
  );
}

// =====================================================================
// FORM DE RESERVA (com lock pessimista no servidor)
// =====================================================================

function ReservaForm({
  loteId,
  loteCodigo,
  loteamentoNome,
  corPrimaria,
}: {
  loteId: string;
  loteCodigo: string;
  loteamentoNome: string;
  corPrimaria: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ expiraEm: Date } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      loteId,
      nome: String(fd.get('nome') || ''),
      cpfCnpj: String(fd.get('cpfCnpj') || ''),
      telefone: String(fd.get('telefone') || ''),
      email: String(fd.get('email') || ''),
      mensagem: String(fd.get('mensagem') || ''),
    };

    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Falha ao reservar');
      setSuccess({ expiraEm: new Date(json.expiraEm) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <ReservaConfirmacao
        expiraEm={success.expiraEm}
        loteCodigo={loteCodigo}
        loteamentoNome={loteamentoNome}
        corPrimaria={corPrimaria}
      />
    );
  }

  return (
    <div>
      <div className="mb-5 p-4 rounded-xl border border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-900 mb-1">
          🔒 Reserve este lote por 15 minutos
        </p>
        <p className="text-xs text-amber-800">
          Durante a reserva, ninguém mais consegue comprar este lote. Um consultor entrará em contato pra finalizar a compra.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Campo label="Nome completo" required>
          <input
            name="nome"
            required
            minLength={2}
            autoComplete="name"
            className={inputClassForm}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="CPF" required>
            <input
              name="cpfCnpj"
              required
              minLength={11}
              autoComplete="off"
              placeholder="000.000.000-00"
              className={inputClassForm}
            />
          </Campo>
          <Campo label="Telefone" required>
            <input
              name="telefone"
              type="tel"
              required
              minLength={8}
              autoComplete="tel"
              placeholder="(75) 99999-9999"
              className={inputClassForm}
            />
          </Campo>
        </div>
        <Campo label="E-mail" required>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClassForm}
          />
        </Campo>
        <Campo label="Mensagem (opcional)">
          <textarea
            name="mensagem"
            rows={2}
            className={inputClassForm}
            placeholder="Algum detalhe que o consultor deva saber..."
          />
        </Campo>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 transition hover:opacity-90"
          style={{ background: corPrimaria }}
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Reservando…
            </>
          ) : (
            <>
              🔒 Reservar lote {loteCodigo} agora
            </>
          )}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Sem cobrança neste passo. A reserva é gratuita por 15 minutos.
        </p>
      </form>
    </div>
  );
}

function ReservaConfirmacao({
  expiraEm,
  loteCodigo,
  loteamentoNome,
  corPrimaria,
}: {
  expiraEm: Date;
  loteCodigo: string;
  loteamentoNome: string;
  corPrimaria: string;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, expiraEm.getTime() - Date.now())
  );

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(Math.max(0, expiraEm.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [expiraEm]);

  const min = Math.floor(remaining / 60_000);
  const sec = Math.floor((remaining % 60_000) / 1000);
  const mmss = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  const expirado = remaining === 0;

  return (
    <div className="text-center py-4">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-3xl"
        style={{ background: corPrimaria }}
      >
        ✓
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-1">
        Lote {loteCodigo} reservado!
      </h3>
      <p className="text-sm text-slate-600 mb-6">
        {loteamentoNome}
      </p>

      <div className={`rounded-2xl p-5 mb-5 ${expirado ? 'bg-red-50 border border-red-200' : 'bg-slate-900'}`}>
        <p className={`text-xs uppercase tracking-wider ${expirado ? 'text-red-700' : 'text-white/70'}`}>
          {expirado ? 'Reserva expirada' : 'Você tem'}
        </p>
        <p className={`text-5xl font-bold font-mono tabular-nums mt-1 ${expirado ? 'text-red-700' : 'text-white'}`}>
          {mmss}
        </p>
        <p className={`text-xs mt-2 ${expirado ? 'text-red-700' : 'text-white/70'}`}>
          {expirado ? 'O lote voltou a ficar disponível.' : 'para finalizar a compra'}
        </p>
      </div>

      <div className="text-left bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
        <p className="font-semibold text-slate-900">Próximos passos:</p>
        <ol className="list-decimal list-inside space-y-1 text-slate-700">
          <li>Um consultor entrará em contato em breve pelo telefone informado.</li>
          <li>Você receberá as condições de pagamento e o contrato.</li>
          <li>Após confirmar a entrada, o lote vira oficialmente seu.</li>
        </ol>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Dúvidas? Fale com o WhatsApp do botão flutuante.
      </p>
    </div>
  );
}

function Campo({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClassForm =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

// =====================================================================
// WHATSAPP FLOAT
// =====================================================================

export function WhatsAppFloat({
  phone,
  message,
  loteadoraNome,
  loteamentoNome,
}: {
  phone: string;
  message: string;
  loteadoraNome?: string;
  loteamentoNome?: string;
}) {
  const digits = phone.replace(/\D/g, '');
  const [showTip, setShowTip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const t1 = setTimeout(() => setShowTip(true), 4500);
    const t2 = setTimeout(() => setShowTip(false), 18000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [dismissed]);

  if (!digits) return null;

  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-end gap-3">
      {showTip && (
        <div className="bg-white shadow-2xl rounded-2xl p-4 max-w-[260px] mb-1 relative animate-fade-in-up border border-slate-100">
          <button
            onClick={() => {
              setShowTip(false);
              setDismissed(true);
            }}
            className="absolute top-1.5 right-1.5 text-slate-400 hover:text-slate-700 p-1"
            aria-label="Fechar"
          >
            <IconX className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-800">
              {loteadoraNome ?? 'Consultor'}
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 font-semibold">online</span>
          </div>
          <p className="text-sm text-slate-700 leading-snug">
            Olá! 👋 Posso te ajudar
            {loteamentoNome ? ` com o ${loteamentoNome}` : ''}? Estou aqui agora!
          </p>
        </div>
      )}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-2xl transition-all hover:scale-110"
        aria-label="Falar no WhatsApp"
      >
        <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-50 animate-ping" />
        <svg className="w-7 h-7 text-white relative" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8" />
        </svg>
      </a>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// Mapa só-imagem (sem retângulos clicáveis) — usado em #planta
// =====================================================================

function MapaImagemSimples({
  imagemMapa,
  corPrimaria,
}: {
  imagemMapa: string;
  corPrimaria: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagemMapa}
          alt="Planta do loteamento"
          width={2400}
          height={1697}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            aspectRatio: '2400/1697',
          }}
          className="select-none cursor-zoom-in"
          draggable={false}
          onClick={() => setFullscreen(true)}
        />
        <button
          onClick={() => setFullscreen(true)}
          className="absolute top-3 right-3 bg-white/95 hover:bg-white backdrop-blur rounded-lg px-3 py-1.5 text-xs font-bold shadow-lg transition flex items-center gap-1"
          style={{ color: corPrimaria }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4-4M11 8v6M8 11h6" />
          </svg>
          Ampliar
        </button>
      </div>
      <p className="text-xs text-slate-500 text-center mt-3">
        Clique na imagem para ampliar e usar os controles de zoom.
      </p>

      {/* Fullscreen / lightbox com zoom + botões +/- */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setFullscreen(false)}
        >
          <div className="bg-black/60 backdrop-blur px-4 py-3 flex items-center justify-between text-white">
            <p className="text-sm font-semibold">Planta do loteamento</p>
            <button
              onClick={() => setFullscreen(false)}
              className="text-white hover:text-red-400 text-2xl leading-none px-2"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          <div
            className="flex-1 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper
              minScale={0.5}
              maxScale={10}
              initialScale={1}
              centerOnInit
              wheel={{ step: 0.15 }}
              doubleClick={{ mode: 'toggle', step: 2 }}
              pinch={{ step: 5 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Controles + / - / reset */}
                  <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-2xl p-1">
                    <button
                      onClick={() => zoomIn()}
                      className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xl"
                      aria-label="Aumentar zoom"
                      title="Aumentar zoom"
                    >
                      +
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xl"
                      aria-label="Diminuir zoom"
                      title="Diminuir zoom"
                    >
                      −
                    </button>
                    <button
                      onClick={() => resetTransform()}
                      className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700"
                      aria-label="Resetar zoom"
                      title="Encaixar tela"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
                      </svg>
                    </button>
                  </div>

                  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full pointer-events-none z-10">
                    Scroll · arrastar · pinça · duplo-clique
                  </p>

                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{ width: '100%', height: '100%' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagemMapa}
                      alt="Planta do loteamento (ampliada)"
                      style={{ maxWidth: '100%', maxHeight: '100%', margin: '0 auto', display: 'block' }}
                      className="select-none"
                      draggable={false}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </div>
      )}
    </>
  );
}

// =====================================================================
// KPI card pequeno do espelho de vendas
// =====================================================================

function KpiEspelho({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-2xl md:text-3xl font-black ${cor} leading-none`}>{valor}</p>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-1">
        {label}
      </p>
    </div>
  );
}
