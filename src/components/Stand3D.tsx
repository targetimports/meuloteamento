'use client';

/**
 * Stand 3D — maquete interativa do loteamento para tela touch.
 *
 * - Renderiza com Three.js (sem GLB ainda — gera meshes procedurais a partir
 *   dos dados mapaX/mapaY/mapaLargura/mapaAltura de cada lote).
 * - Quando o loteamento tem `imagemMapa`, ela é usada como textura no chão
 *   pra dar referência visual da planta original.
 * - Touch: arrastar gira, pinçar dá zoom (OrbitControls suporta touch nativo).
 * - Click/tap em lote abre painel lateral com info + WhatsApp.
 * - Presets de câmera: aérea, entrada, comerciais, reset.
 * - Filtros, legenda, tour automático, modo apresentação.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
// Importação direta evita problema com export do Three em alguns bundlers
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ===== Tipos =====

export type LoteStatus =
  | 'DISPONIVEL'
  | 'RESERVADO'
  | 'EM_PAGAMENTO'
  | 'VENDIDO'
  | 'BLOQUEADO';

export type LoteTipo = 'RESIDENCIAL' | 'COMERCIAL';

export interface Lote3D {
  id: string;
  codigo: string;
  quadra: string;
  numero: string;
  area: number;
  preco: number;
  status: LoteStatus;
  tipo: LoteTipo;
  descricao: string | null;
  /** % do viewBox (0–100) */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Loteadora {
  nome: string;
  logo: string | null;
  whatsapp: string | null;
  telefone: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
}

export interface SateliteCalib {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

interface Props {
  loteamentoNome: string;
  loteamentoCidade: string;
  loteamentoSlug: string;
  loteamentoEndereco?: string | null;
  imagemMapa: string | null;
  /** Imagem de satélite composta (Esri tiles) — usada como chão no stand 3D */
  satelitePath?: string | null;
  /** Calibração das posições para vista satélite (não afeta planta) */
  sateliteCalib?: SateliteCalib;
  lat?: number | null;
  lng?: number | null;
  lotes: Lote3D[];
  loteadora: Loteadora;
  /** Admin logado → mostra painel pra ajustar calibração direto da tela */
  isAdmin?: boolean;
  loteamentoId?: string;
  salvarSateliteCalibAction?: (
    loteamentoId: string,
    raw: unknown
  ) => Promise<{ ok: boolean; error?: string }>;
  resetarSateliteCalibAction?: (loteamentoId: string) => Promise<{ ok: boolean }>;
}

// ===== Cores por status / tipo =====
const COR: Record<LoteStatus | 'COMERCIAL', string> = {
  DISPONIVEL: '#22c55e', // verde
  RESERVADO: '#f59e0b', // amarelo
  EM_PAGAMENTO: '#3b82f6', // azul claro
  VENDIDO: '#ef4444', // vermelho
  BLOQUEADO: '#64748b', // cinza
  COMERCIAL: '#0ea5e9', // azul (sobrescreve quando tipo=COMERCIAL e disponível)
};

function colorOf(l: Lote3D): string {
  // Comerciais disponíveis ganham cor azul-comercial
  if (l.tipo === 'COMERCIAL' && l.status === 'DISPONIVEL') return COR.COMERCIAL;
  return COR[l.status];
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function onlyDigits(s: string | null | undefined) {
  return (s ?? '').replace(/\D/g, '');
}

/**
 * Cria um sprite Three.js com texto (número do lote) usando canvas como textura.
 * Sempre vira pra câmera e fica legível em qualquer ângulo.
 */
function makeNumberSprite(texto: string, corHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const w = 256;
  const h = 128;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Fundo arredondado da cor do status (com transparência)
  const r = 28;
  ctx.fillStyle = corHex;
  ctx.beginPath();
  ctx.moveTo(r, 4);
  ctx.lineTo(w - r, 4);
  ctx.quadraticCurveTo(w - 4, 4, w - 4, r);
  ctx.lineTo(w - 4, h - r);
  ctx.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
  ctx.lineTo(r, h - 4);
  ctx.quadraticCurveTo(4, h - 4, 4, h - r);
  ctx.lineTo(4, r);
  ctx.quadraticCurveTo(4, 4, r, 4);
  ctx.closePath();
  ctx.fill();
  // Borda branca
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();
  // Texto: número grande, branco com sombra
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${texto.length > 3 ? 64 : 80}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(texto, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false, // sempre por cima
    depthWrite: false,
  });
  return new THREE.Sprite(mat);
}

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

type Filtro = 'todos' | 'DISPONIVEL' | 'RESERVADO' | 'VENDIDO' | 'COMERCIAL' | 'RESIDENCIAL';
type Tela = 'inicial' | 'mapa';
type Preset = 'aerea' | 'entrada' | 'comercial' | 'reset';

export function Stand3D({
  loteamentoNome,
  loteamentoCidade,
  loteamentoSlug,
  loteamentoEndereco,
  imagemMapa,
  satelitePath,
  sateliteCalib: sateliteCalibInicial = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  lat,
  lng,
  lotes: lotesOriginais,
  loteadora,
  isAdmin,
  loteamentoId,
  salvarSateliteCalibAction,
  resetarSateliteCalibAction,
}: Props) {
  void imagemMapa; // mantido na assinatura mas não usado no 3D (só no editor/landing)

  // State LOCAL da calibração — admin pode ajustar em tempo real;
  // só persiste no DB quando clicar "Salvar".
  const [sateliteCalib, setSateliteCalib] = useState<SateliteCalib>(sateliteCalibInicial);

  // Modo do toque/click esquerdo: pan (arrastar) ou rotate (girar câmera)
  // Toggle pelo botão 🔄 na barra de presets.
  const [touchMode, setTouchMode] = useState<'pan' | 'rotate'>('pan');

  // Lotes RAW — sem transformação. A calib é aplicada no Cena3D via Group transform
  // pra que mudanças em tempo real propaguem pra cena 3D sem rebuild.
  const lotes = lotesOriginais;
  const [tela, setTela] = useState<Tela>('inicial');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [loteSelecionado, setLoteSelecionado] = useState<Lote3D | null>(null);
  const [tourAtivo, setTourAtivo] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const corPrimaria = loteadora.corPrimaria ?? '#0ea5e9';

  // Filtragem
  const lotesFiltrados = useMemo(() => {
    if (filtro === 'todos') return lotes;
    if (filtro === 'COMERCIAL') return lotes.filter((l) => l.tipo === 'COMERCIAL');
    if (filtro === 'RESIDENCIAL') return lotes.filter((l) => l.tipo === 'RESIDENCIAL');
    return lotes.filter((l) => l.status === filtro);
  }, [lotes, filtro]);

  // KPIs
  const kpis = useMemo(() => {
    const total = lotes.length;
    const disp = lotes.filter((l) => l.status === 'DISPONIVEL').length;
    const reserv = lotes.filter((l) => l.status === 'RESERVADO').length;
    const vend = lotes.filter((l) => l.status === 'VENDIDO').length;
    const comerciais = lotes.filter((l) => l.tipo === 'COMERCIAL').length;
    return { total, disp, reserv, vend, comerciais };
  }, [lotes]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  // Mensagem WhatsApp
  const msgWhatsApp = (l: Lote3D) =>
    `Olá! Tenho interesse no Lote ${l.codigo} (Quadra ${l.quadra}, ${l.area.toFixed(0)} m², ${formatBRL(l.preco)}) do loteamento ${loteamentoNome}. Pode me enviar uma simulação?`;

  const wppLink = (l: Lote3D) =>
    loteadora.whatsapp
      ? `https://wa.me/55${onlyDigits(loteadora.whatsapp)}?text=${encodeURIComponent(msgWhatsApp(l))}`
      : null;

  return (
    <div className="w-screen h-screen relative bg-slate-950 text-white overflow-hidden touch-none select-none">
      {/* TELA INICIAL */}
      {tela === 'inicial' && (
        <TelaInicial
          loteamentoNome={loteamentoNome}
          loteamentoCidade={loteamentoCidade}
          loteamentoEndereco={loteamentoEndereco}
          lat={lat}
          lng={lng}
          loteadora={loteadora}
          kpis={kpis}
          corPrimaria={corPrimaria}
          onEntrar={(f) => {
            setFiltro(f);
            setTela('mapa');
          }}
          onTour={() => {
            setTourAtivo(true);
            setTela('mapa');
          }}
        />
      )}

      {/* MAPA 3D */}
      {tela === 'mapa' && (
        <>
          <Cena3D
            lotes={lotes}
            lotesFiltrados={lotesFiltrados}
            imagemMapa={satelitePath ?? null}
            sateliteCalib={sateliteCalib}
            touchMode={touchMode}
            onSelectLote={setLoteSelecionado}
            tourAtivo={tourAtivo}
            onTourEnd={() => setTourAtivo(false)}
            presetRef={(_apply) => {
              presetApplyRef.current = _apply;
            }}
          />

          {/* HEADER FLUTUANTE */}
          <HeaderMapa
            loteamentoNome={loteamentoNome}
            loteamentoSlug={loteamentoSlug}
            loteadora={loteadora}
            onVoltar={() => setTela('inicial')}
            onFullscreen={toggleFullscreen}
            fullscreen={fullscreen}
            corPrimaria={corPrimaria}
          />

          {/* FILTROS / LEGENDA */}
          <FiltrosBar filtro={filtro} setFiltro={setFiltro} kpis={kpis} />

          {/* PRESETS DE CÂMERA */}
          <PresetsBar
            corPrimaria={corPrimaria}
            tourAtivo={tourAtivo}
            temGeo={!!(lat && lng)}
            touchMode={touchMode}
            onToggleTouchMode={() =>
              setTouchMode((m) => (m === 'pan' ? 'rotate' : 'pan'))
            }
            onPreset={(p) => presetApplyRef.current?.(p)}
            onTour={() => setTourAtivo(true)}
            onConsultor={() => {
              if (loteadora.whatsapp) {
                window.open(
                  `https://wa.me/55${onlyDigits(loteadora.whatsapp)}?text=${encodeURIComponent(
                    `Olá! Estou no stand do ${loteamentoNome}, pode me ajudar?`
                  )}`,
                  '_blank'
                );
              }
            }}
            onComoChegar={() => {
              if (lat && lng) {
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                  '_blank'
                );
              }
            }}
            onSatelite={() => {
              if (lat && lng) {
                window.open(
                  `https://www.google.com/maps/@${lat},${lng},500m/data=!3m1!1e3`,
                  '_blank'
                );
              }
            }}
          />

          {/* PAINEL DO LOTE */}
          {loteSelecionado && (
            <PainelLote
              lote={loteSelecionado}
              loteamentoNome={loteamentoNome}
              onFechar={() => setLoteSelecionado(null)}
              wppLink={wppLink(loteSelecionado)}
              corPrimaria={corPrimaria}
            />
          )}

          {/* PAINEL ADMIN DE CALIBRAÇÃO — só pra admin logado */}
          {isAdmin && loteamentoId && salvarSateliteCalibAction && (
            <AdminCalibPanel
              loteamentoId={loteamentoId}
              calib={sateliteCalib}
              onChange={setSateliteCalib}
              salvarAction={salvarSateliteCalibAction}
              resetarAction={resetarSateliteCalibAction}
              calibInicial={sateliteCalibInicial}
            />
          )}
        </>
      )}
    </div>
  );

  // ref pra disparar preset da cena 3D
  function _placeholder() {} void _placeholder;
}

// Ref global pra acionar presets de câmera do componente externo
const presetApplyRef = { current: null as ((p: Preset) => void) | null };

// =====================================================================
// TELA INICIAL
// =====================================================================
function TelaInicial({
  loteamentoNome,
  loteamentoCidade,
  loteamentoEndereco,
  lat,
  lng,
  loteadora,
  kpis,
  corPrimaria,
  onEntrar,
  onTour,
}: {
  loteamentoNome: string;
  loteamentoCidade: string;
  loteamentoEndereco?: string | null;
  lat?: number | null;
  lng?: number | null;
  loteadora: Loteadora;
  kpis: { total: number; disp: number; reserv: number; vend: number; comerciais: number };
  corPrimaria: string;
  onEntrar: (filtro: Filtro) => void;
  onTour: () => void;
}) {
  const temGeo = !!(lat && lng);
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center p-12 overflow-y-auto"
      style={{
        background: `radial-gradient(circle at top, ${corPrimaria}30, transparent 60%), linear-gradient(180deg, #020617, #0f172a)`,
      }}
    >
      <div className="max-w-5xl w-full text-center">
        {loteadora.logo && (
          <img
            src={loteadora.logo}
            alt={loteadora.nome}
            className="h-20 mx-auto mb-6 object-contain"
          />
        )}
        <p
          className="text-sm uppercase tracking-[0.4em] font-semibold mb-3"
          style={{ color: corPrimaria }}
        >
          {loteadora.nome}
        </p>
        <h1 className="text-6xl md:text-7xl font-black text-white mb-3 leading-tight">
          {loteamentoNome}
        </h1>
        <p className="text-xl text-slate-300 mb-10">{loteamentoCidade}</p>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-3xl mx-auto">
          <KpiPill label="Lotes" valor={kpis.total} cor="#94a3b8" />
          <KpiPill label="Disponíveis" valor={kpis.disp} cor="#22c55e" />
          <KpiPill label="Reservados" valor={kpis.reserv} cor="#f59e0b" />
          <KpiPill label="Comerciais" valor={kpis.comerciais} cor="#0ea5e9" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <BotaoCTA
            label="Conhecer o loteamento"
            sub="Maquete 3D interativa"
            icon="🌎"
            primary
            cor={corPrimaria}
            onClick={() => onEntrar('todos')}
          />
          <BotaoCTA
            label="Lotes disponíveis"
            sub={`${kpis.disp} para escolher`}
            icon="🏡"
            cor="#22c55e"
            onClick={() => onEntrar('DISPONIVEL')}
          />
          <BotaoCTA
            label="Lotes comerciais"
            sub={`${kpis.comerciais} oportunidades`}
            icon="🏪"
            cor="#0ea5e9"
            onClick={() => onEntrar('COMERCIAL')}
          />
          <BotaoCTA
            label="Tour guiado"
            sub="Apresentação automática"
            icon="🎬"
            cor="#a855f7"
            onClick={onTour}
          />
        </div>

        {loteadora.whatsapp && (
          <a
            href={`https://wa.me/55${onlyDigits(loteadora.whatsapp)}?text=${encodeURIComponent(`Olá! Estou no stand do ${loteamentoNome}, pode me atender?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-[#25D366] hover:bg-[#1cb858] text-white text-lg font-bold rounded-2xl shadow-2xl"
          >
            📱 Chamar consultor por WhatsApp
          </a>
        )}

        {/* GOOGLE MAPS — onde fica */}
        {temGeo && (
          <div className="mt-10 max-w-3xl mx-auto bg-slate-900/70 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 flex items-center justify-between gap-3 border-b border-slate-700/60 flex-wrap">
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                  📍 Localização
                </p>
                <p className="text-sm font-bold text-white">{loteamentoCidade}</p>
                {loteamentoEndereco && (
                  <p className="text-xs text-slate-400">{loteamentoEndereco}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  🧭 Como chegar
                </a>
                <a
                  href={`https://www.google.com/maps/@${lat},${lng},500m/data=!3m1!1e3`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-600"
                >
                  🛰 Satélite
                </a>
              </div>
            </div>
            <iframe
              title="Localização no Google Maps"
              src={`https://www.google.com/maps?q=${lat},${lng}&hl=pt-BR&z=16&output=embed`}
              className="w-full h-72 border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function KpiPill({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-slate-900/70 backdrop-blur border border-slate-700 rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{label}</p>
      <p className="text-3xl font-black mt-0.5" style={{ color: cor }}>
        {valor}
      </p>
    </div>
  );
}

function BotaoCTA({
  label,
  sub,
  icon,
  cor,
  primary,
  onClick,
}: {
  label: string;
  sub: string;
  icon: string;
  cor: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: primary ? cor : 'rgba(15, 23, 42, 0.7)',
        borderColor: primary ? cor : `${cor}55`,
        boxShadow: primary ? `0 20px 40px ${cor}30` : `0 8px 20px rgba(0,0,0,0.4)`,
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-5xl">{icon}</span>
        <div>
          <p className="text-2xl font-black text-white leading-tight">{label}</p>
          <p className="text-sm text-white/80 mt-1">{sub}</p>
        </div>
      </div>
    </button>
  );
}

// =====================================================================
// HEADER FLUTUANTE NO MAPA
// =====================================================================
function HeaderMapa({
  loteamentoNome,
  loteamentoSlug,
  loteadora,
  onVoltar,
  onFullscreen,
  fullscreen,
  corPrimaria,
}: {
  loteamentoNome: string;
  loteamentoSlug: string;
  loteadora: Loteadora;
  onVoltar: () => void;
  onFullscreen: () => void;
  fullscreen: boolean;
  corPrimaria: string;
}) {
  void loteamentoSlug;
  return (
    <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between pointer-events-none">
      <div className="flex items-center gap-3 pointer-events-auto bg-slate-900/80 backdrop-blur border border-slate-700 rounded-2xl px-4 py-2.5 shadow-lg">
        <button
          onClick={onVoltar}
          className="text-2xl text-slate-300 hover:text-white"
          title="Voltar"
        >
          ←
        </button>
        {loteadora.logo && (
          <img src={loteadora.logo} alt="" className="w-9 h-9 rounded object-contain bg-white p-0.5" />
        )}
        <div>
          <p className="text-sm font-bold text-white leading-tight">{loteamentoNome}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">
            {loteadora.nome}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onFullscreen}
          className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-xl px-4 py-2 text-sm text-white hover:bg-slate-800"
          title="Tela cheia"
        >
          {fullscreen ? '✕ Sair' : '⛶ Tela cheia'}
        </button>
      </div>
      <style jsx>{`
        button:hover {
          border-color: ${corPrimaria};
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// FILTROS + LEGENDA
// =====================================================================
function FiltrosBar({
  filtro,
  setFiltro,
  kpis,
}: {
  filtro: Filtro;
  setFiltro: (f: Filtro) => void;
  kpis: { total: number; disp: number; reserv: number; vend: number; comerciais: number };
}) {
  const filtros: { id: Filtro; label: string; cor: string; count: number }[] = [
    { id: 'todos', label: 'Todos', cor: '#94a3b8', count: kpis.total },
    { id: 'DISPONIVEL', label: 'Disponíveis', cor: COR.DISPONIVEL, count: kpis.disp },
    { id: 'RESERVADO', label: 'Reservados', cor: COR.RESERVADO, count: kpis.reserv },
    { id: 'VENDIDO', label: 'Vendidos', cor: COR.VENDIDO, count: kpis.vend },
    { id: 'COMERCIAL', label: 'Comerciais', cor: COR.COMERCIAL, count: kpis.comerciais },
  ];
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-wrap gap-2 max-w-[90vw] justify-center">
      {filtros.map((f) => {
        const active = filtro === f.id;
        return (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className="px-4 py-2.5 rounded-full text-sm font-semibold backdrop-blur border-2 transition-all min-w-[120px]"
            style={{
              background: active ? f.cor : 'rgba(15, 23, 42, 0.85)',
              borderColor: f.cor,
              color: active ? '#0f172a' : 'white',
            }}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
              style={{ background: f.cor }}
            />
            {f.label} <span className="opacity-70">({f.count})</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// PRESETS DE CÂMERA
// =====================================================================
function PresetsBar({
  corPrimaria,
  tourAtivo,
  temGeo,
  touchMode,
  onToggleTouchMode,
  onPreset,
  onTour,
  onConsultor,
  onComoChegar,
  onSatelite,
}: {
  corPrimaria: string;
  tourAtivo: boolean;
  temGeo: boolean;
  touchMode: 'pan' | 'rotate';
  onToggleTouchMode: () => void;
  onPreset: (p: Preset) => void;
  onTour: () => void;
  onConsultor: () => void;
  onComoChegar: () => void;
  onSatelite: () => void;
}) {
  void corPrimaria;
  const presets: { id: Preset; label: string; icon: string }[] = [
    { id: 'aerea', label: 'Aérea', icon: '🛩' },
    { id: 'entrada', label: 'Entrada', icon: '🚪' },
    { id: 'comercial', label: 'Comerciais', icon: '🏪' },
    { id: 'reset', label: 'Resetar', icon: '↺' },
  ];
  return (
    <div className="absolute top-24 right-4 z-20 flex flex-col gap-2 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* TOGGLE PAN / ROTATE — 1º na barra pra fácil acesso no touch */}
      <button
        onClick={onToggleTouchMode}
        className={`w-16 h-16 rounded-2xl backdrop-blur border-2 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition ${
          touchMode === 'rotate'
            ? 'bg-orange-600 border-orange-400'
            : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
        }`}
        title={
          touchMode === 'pan'
            ? 'Tocar pra alternar pra modo rotação'
            : 'Tocar pra voltar ao modo arrastar'
        }
      >
        <span className="text-2xl">{touchMode === 'pan' ? '✋' : '🔄'}</span>
        <span className="text-[9px] uppercase tracking-wider mt-0.5">
          {touchMode === 'pan' ? 'Mover' : 'Girar'}
        </span>
      </button>
      {/* Divisor */}
      <div className="h-px bg-slate-700/60" />
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onPreset(p.id)}
          className="w-16 h-16 rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-700 hover:border-slate-500 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition"
          title={p.label}
        >
          <span className="text-2xl">{p.icon}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5">{p.label}</span>
        </button>
      ))}
      <button
        onClick={onTour}
        disabled={tourAtivo}
        className="w-16 h-16 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition"
        title="Tour automático"
      >
        <span className="text-2xl">{tourAtivo ? '⏸' : '🎬'}</span>
        <span className="text-[9px] uppercase tracking-wider mt-0.5">Tour</span>
      </button>

      {temGeo && (
        <>
          {/* Divisor */}
          <div className="h-px bg-slate-700 my-1" />
          <button
            onClick={onComoChegar}
            className="w-16 h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition"
            title="Como chegar (Google Maps)"
          >
            <span className="text-2xl">🧭</span>
            <span className="text-[9px] uppercase tracking-wider mt-0.5">Chegar</span>
          </button>
          <button
            onClick={onSatelite}
            className="w-16 h-16 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition border border-slate-500"
            title="Ver satélite no Google Maps"
          >
            <span className="text-2xl">🛰</span>
            <span className="text-[9px] uppercase tracking-wider mt-0.5">Satélite</span>
          </button>
        </>
      )}

      <button
        onClick={onConsultor}
        className="w-16 h-16 rounded-2xl bg-[#25D366] hover:bg-[#1cb858] text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition"
        title="Chamar consultor"
      >
        <span className="text-2xl">📱</span>
        <span className="text-[9px] uppercase tracking-wider mt-0.5">Consultor</span>
      </button>
    </div>
  );
}

// =====================================================================
// PAINEL DO LOTE
// =====================================================================
function PainelLote({
  lote,
  loteamentoNome,
  onFechar,
  wppLink,
  corPrimaria,
}: {
  lote: Lote3D;
  loteamentoNome: string;
  onFechar: () => void;
  wppLink: string | null;
  corPrimaria: string;
}) {
  const cor = colorOf(lote);
  const statusLabel: Record<LoteStatus, string> = {
    DISPONIVEL: 'Disponível',
    RESERVADO: 'Reservado',
    EM_PAGAMENTO: 'Em pagamento',
    VENDIDO: 'Vendido',
    BLOQUEADO: 'Indisponível',
  };
  void loteamentoNome;
  void corPrimaria;

  // Sugestão de entrada/parcelas (20% / 60x)
  const entrada = Math.round(lote.preco * 0.2);
  const restante = lote.preco - entrada;
  const parcela = Math.round(restante / 60);

  return (
    <div className="absolute top-0 right-0 h-full w-[90vw] sm:w-[420px] bg-slate-900/95 backdrop-blur-md border-l border-slate-700 z-40 overflow-y-auto shadow-2xl">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Lote selecionado
            </p>
            <h2 className="text-4xl font-black text-white leading-tight">{lote.codigo}</h2>
            <span
              className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: cor, color: '#0f172a' }}
            >
              {lote.tipo === 'COMERCIAL' ? '🏪 COMERCIAL · ' : ''}
              {statusLabel[lote.status]}
            </span>
          </div>
          <button
            onClick={onFechar}
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <SpecBox label="Quadra" valor={lote.quadra} />
          <SpecBox label="Número" valor={lote.numero} />
          <SpecBox label="Área" valor={`${lote.area.toFixed(0)} m²`} />
          <SpecBox label="Tipo" valor={lote.tipo === 'COMERCIAL' ? 'Comercial' : 'Residencial'} />
        </div>

        {/* Valor */}
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-4 mb-4">
          <p className="text-[11px] uppercase tracking-widest text-emerald-300 font-semibold">
            Valor à vista
          </p>
          <p className="text-4xl font-black text-white mt-1">{formatBRL(lote.preco)}</p>
        </div>

        {/* Condições sugeridas */}
        {lote.status === 'DISPONIVEL' && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 mb-4">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Simulação rápida
            </p>
            <div className="space-y-1.5 text-sm">
              <p className="text-slate-200">
                Entrada de <strong className="text-white">{formatBRL(entrada)}</strong> (20%)
              </p>
              <p className="text-slate-200">
                + 60x de <strong className="text-emerald-300">{formatBRL(parcela)}</strong>/mês
              </p>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              * Simulação demonstrativa. Consulte um consultor para condições finais.
            </p>
          </div>
        )}

        {lote.descricao && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 mb-4">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Observações
            </p>
            <p className="text-sm text-slate-200">{lote.descricao}</p>
          </div>
        )}

        {/* CTAs */}
        {lote.status === 'DISPONIVEL' && (
          <div className="space-y-2">
            {wppLink ? (
              <a
                href={wppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-4 rounded-2xl text-center text-white font-bold text-lg bg-[#25D366] hover:bg-[#1cb858] shadow-lg"
              >
                📱 Tenho interesse — falar no WhatsApp
              </a>
            ) : (
              <p className="text-xs text-slate-500 text-center">
                Consultor sem WhatsApp configurado
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// PAINEL ADMIN DE CALIBRAÇÃO — flutua no canto, só aparece pra admin
// =====================================================================
function AdminCalibPanel({
  loteamentoId,
  calib,
  onChange,
  salvarAction,
  resetarAction,
  calibInicial,
}: {
  loteamentoId: string;
  calib: SateliteCalib;
  onChange: (c: SateliteCalib) => void;
  salvarAction: (id: string, raw: unknown) => Promise<{ ok: boolean; error?: string }>;
  resetarAction?: (id: string) => Promise<{ ok: boolean }>;
  calibInicial: SateliteCalib;
}) {
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty =
    calib.offsetX !== calibInicial.offsetX ||
    calib.offsetY !== calibInicial.offsetY ||
    calib.scaleX !== calibInicial.scaleX ||
    calib.scaleY !== calibInicial.scaleY ||
    calib.rotation !== calibInicial.rotation;

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const r = await salvarAction(loteamentoId, calib);
    setSalvando(false);
    if (r.ok) {
      setMsg('✓ Salvo');
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg(r.error ?? 'Erro');
    }
  }
  async function resetar() {
    if (!resetarAction) return;
    if (!confirm('Resetar calibração? Volta pra X=0, Y=0, escala 100%, rotação 0°.')) return;
    setSalvando(true);
    await resetarAction(loteamentoId);
    onChange({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    setSalvando(false);
    setMsg('✓ Resetado');
    setTimeout(() => setMsg(null), 3000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-24 left-4 z-30 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border-2 border-fuchsia-400/40 flex items-center gap-2"
        title="Ajustar calibração do satélite (só admin)"
      >
        🎯 Ajustar mapa {dirty && <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />}
      </button>
    );
  }

  return (
    <div className="absolute bottom-24 left-4 z-30 bg-slate-900/95 backdrop-blur border-2 border-fuchsia-500/50 rounded-2xl p-4 w-80 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-fuchsia-300 uppercase tracking-widest">
            🎯 Ajustar mapa
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Só você vê este painel (admin)
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-white text-lg w-6 h-6 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <AdminSlider
          label="Deslocar X"
          value={calib.offsetX}
          min={-100}
          max={100}
          step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => onChange({ ...calib, offsetX: v })}
        />
        <AdminSlider
          label="Deslocar Y"
          value={calib.offsetY}
          min={-100}
          max={100}
          step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => onChange({ ...calib, offsetY: v })}
        />
        <AdminSlider
          label="Largura (X)"
          value={calib.scaleX * 100}
          min={20}
          max={300}
          step={0.5}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => onChange({ ...calib, scaleX: v / 100 })}
        />
        <AdminSlider
          label="Altura (Y)"
          value={calib.scaleY * 100}
          min={20}
          max={300}
          step={0.5}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => onChange({ ...calib, scaleY: v / 100 })}
        />
        <button
          type="button"
          onClick={() => {
            const avg = (calib.scaleX + calib.scaleY) / 2;
            onChange({ ...calib, scaleX: avg, scaleY: avg });
          }}
          className="w-full text-[10px] text-slate-400 hover:text-slate-200 underline py-0.5"
        >
          🔗 igualar X = Y
        </button>
        <AdminSlider
          label="Rotação"
          value={calib.rotation}
          min={-180}
          max={180}
          step={0.5}
          format={(v) => `${v.toFixed(1)}°`}
          onChange={(v) => onChange({ ...calib, rotation: v })}
        />
      </div>

      <div className="flex items-center gap-2 mt-4">
        {resetarAction && (
          <button
            onClick={resetar}
            disabled={salvando}
            className="flex-1 text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg disabled:opacity-50"
          >
            ↺ Resetar
          </button>
        )}
        <button
          onClick={salvar}
          disabled={salvando || !dirty}
          className="flex-1 text-xs px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 text-white font-semibold rounded-lg"
        >
          {salvando ? 'Salvando…' : dirty ? '💾 Salvar' : '✓ Salvo'}
        </button>
      </div>

      {msg && (
        <p
          className={`text-[11px] mt-2 text-center ${
            msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {msg}
        </p>
      )}
      <p className="text-[10px] text-slate-500 mt-2 leading-snug">
        Arrasta os sliders e os lotes se movem em tempo real. Clica em <strong>Salvar</strong> pra persistir.
      </p>
    </div>
  );
}

function AdminSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
        <span className="text-fuchsia-300 font-mono font-semibold">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-fuchsia-500"
      />
    </div>
  );
}

function SpecBox({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
        {label}
      </p>
      <p className="text-base font-bold text-white mt-0.5">{valor}</p>
    </div>
  );
}

// =====================================================================
// CENA 3D (Three.js)
// =====================================================================
function Cena3D({
  lotes,
  lotesFiltrados,
  imagemMapa,
  sateliteCalib,
  touchMode = 'pan',
  onSelectLote,
  tourAtivo,
  onTourEnd,
  presetRef,
}: {
  lotes: Lote3D[];
  lotesFiltrados: Lote3D[];
  imagemMapa: string | null;
  sateliteCalib?: SateliteCalib;
  touchMode?: 'pan' | 'rotate';
  onSelectLote: (l: Lote3D | null) => void;
  tourAtivo: boolean;
  onTourEnd: () => void;
  presetRef: (apply: (p: Preset) => void) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    raycaster?: THREE.Raycaster;
    pointer?: THREE.Vector2;
    loteamentoGroup?: THREE.Group; // Group que recebe a transformação de calib
    loteW?: number;
    loteH?: number;
    loteMeshes: Map<string, THREE.Mesh>;
    loteLabels: Map<string, THREE.Sprite>;
    selectedMesh?: THREE.Mesh;
    animFrame?: number;
    tourTimers: number[];
  }>({
    loteMeshes: new Map(),
    loteLabels: new Map(),
    tourTimers: [],
  });

  // ===== Setup inicial =====
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    // Pré-carrega a imagem aérea pra descobrir o aspect ratio,
    // depois inicializa a cena com plano dimensionado corretamente.
    function start(planeW: number, planeH: number, groundTex: THREE.Texture | null) {
      if (cancelled) return;
      cleanupFn = _initScene(planeW, planeH, groundTex);
    }

    if (imagemMapa) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight;
        const planeW = 100;
        const planeH = 100 / aspect;
        const tex = new THREE.TextureLoader().load(imagemMapa);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        start(planeW, planeH, tex);
      };
      img.onerror = () => {
        console.warn('[Stand3D] falha ao carregar imagem aérea');
        start(100, 100, null);
      };
      img.src = imagemMapa;
    } else {
      start(100, 100, null);
    }

    return () => {
      cancelled = true;
      cleanupFn?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Função principal — recebe o tamanho do plano alinhado à imagem,
  // monta a cena e retorna a função de cleanup.
  function _initScene(planeW: number, planeH: number, groundTex: THREE.Texture | null): () => void {
    const container = containerRef.current;
    if (!container) return () => {};

    // Se o background é quase quadrado (satélite 8×8 tiles), expande o plano
    // pra cobrir muito mais área, mantendo os lotes na região calibrada original.
    // Isso faz o satélite preencher mais da tela mostrando o entorno do loteamento.
    const isSquare = Math.abs(planeW / planeH - 1) < 0.1;
    const BG_SCALE = isSquare ? 2.5 : 1; // satélite ocupa 2.5× a área dos lotes
    const bgPlaneW = planeW * BG_SCALE;
    const bgPlaneH = planeH * BG_SCALE;

    // Lotes: para satélite, mantém aspect ratio original da planta (1.668)
    // de forma que a calibração feita contra a planta continue válida.
    const PLANTA_ASPECT = 1.668;
    const loteW = isSquare ? 100 : planeW;
    const loteH = isSquare ? 100 / PLANTA_ASPECT : planeH;

    // Mapeia % (0–100) → coords no mundo, usando a área CALIBRADA dos lotes
    // (não a área expandida do plano). Lotes ficam no centro da cena.
    const toWorld = (x: number, y: number) => ({
      x: (x / 100) * loteW - loteW / 2,
      z: (y / 100) * loteH - loteH / 2,
    });

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x0a1828);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a1828, 80, 200);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(45, 60, 80);
    camera.lookAt(0, 0, 0);

    // Lights — sol quente + hemisphere (céu/chão) pra dar mais profundidade às edificações
    const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x8b7355, 0.55); // céu azul + reflexo terra
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
    // Sol — tom quente, sombras nítidas
    const dir = new THREE.DirectionalLight(0xfff2d6, 1.05);
    dir.position.set(50, 90, 35);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -120;
    dir.shadow.camera.right = 120;
    dir.shadow.camera.top = 120;
    dir.shadow.camera.bottom = -120;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 250;
    dir.shadow.bias = -0.0005;
    scene.add(dir);
    // Fill light suave por trás (azulado) pra evitar sombras pretas
    const fill = new THREE.DirectionalLight(0x6b88c4, 0.25);
    fill.position.set(-40, 40, -30);
    scene.add(fill);

    // Skybox simples (gradient)
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x1e3a8a) },
        bottomColor: { value: new THREE.Color(0x0a1828) },
      },
      vertexShader: `varying vec3 vWorldPos; void main(){ vWorldPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorldPos;
        void main(){ float h = normalize(vWorldPos).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(h*0.5+0.5, 0.0)), 1.0); }`,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Chão
    const groundSize = 200;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1f3041,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Plano com imagem aérea/satélite — usa as dimensões EXPANDIDAS quando satélite
    if (groundTex) {
      const planeGeo = new THREE.PlaneGeometry(bgPlaneW, bgPlaneH, 1, 1);
      const planeMat = new THREE.MeshBasicMaterial({ map: groundTex, transparent: false });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = 0.02;
      plane.receiveShadow = true;
      scene.add(plane);
    } else {
      // Sem foto — usa grid de referência
      const grid = new THREE.GridHelper(loteW, 20, 0x334155, 0x1e293b);
      grid.position.y = 0.01;
      (grid.material as THREE.Material).opacity = 0.3;
      (grid.material as THREE.Material).transparent = true;
      scene.add(grid);
    }

    // OrbitControls — configurado tipo "mapa":
    //   1 dedo/click esquerdo = ARRASTAR (pan)  ← mais intuitivo pra mapa
    //   2 dedos = pinch zoom + rotação
    //   roda do mouse = zoom
    //   click direito = rotação (desktop)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 15;
    controls.maxDistance = 300;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 0, 0);
    controls.enablePan = true;
    controls.panSpeed = 1.5;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };

    // Lotes — marcador fino no chão + casinha/prédio por status + label numérico
    // TODOS ficam dentro de loteamentoGroup pra calibração aplicar uniformemente
    const loteamentoGroup = new THREE.Group();
    scene.add(loteamentoGroup);

    const loteMeshes = new Map<string, THREE.Mesh>();
    const loteLabels = new Map<string, THREE.Sprite>();
    const buildingMeshes: THREE.Object3D[] = []; // pra cleanup

    const altura = 0.25; // marcadores finos (parecem com plot demarcado no solo)

    // Materiais compartilhados (cacheados) pra performance
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe8d9b8,
      roughness: 0.85,
      metalness: 0.02,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xb44b2e,
      roughness: 0.75,
      metalness: 0.05,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x4a7ba8,
      roughness: 0.22,
      metalness: 0.65,
      emissive: 0x132a44,
      emissiveIntensity: 0.18,
    });
    const baseGlassMat = new THREE.MeshStandardMaterial({
      color: 0x2a3441,
      roughness: 0.5,
      metalness: 0.3,
    });
    const reservedMarkerMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });

    for (const lote of lotes) {
      const w = (lote.w / 100) * loteW;
      const d = (lote.h / 100) * loteH;
      const center = toWorld(lote.x + lote.w / 2, lote.y + lote.h / 2);
      const cor = new THREE.Color(colorOf(lote));

      // 1) MARCADOR DO LOTE — caixa fina no chão (limite do plot)
      const geo = new THREE.BoxGeometry(w, altura, d);
      const mat = new THREE.MeshStandardMaterial({
        color: cor,
        roughness: 0.55,
        metalness: 0.05,
        emissive: cor,
        emissiveIntensity: 0.12,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(center.x, altura / 2, center.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.lote = lote;
      loteamentoGroup.add(mesh);
      loteMeshes.set(lote.id, mesh);

      // 2) ESTRUTURA 3D opcional por status/tipo:
      //    - COMERCIAL: prédio comercial (caixa alta com vidro espelhado)
      //    - VENDIDO residencial: casinha (caixa + telhado triangular)
      //    - RESERVADO: pequeno marcador vertical (placa indicando reserva)
      const buildingScale = 0.55; // % do lote ocupado pela edificação
      const bW = w * buildingScale;
      const bD = d * buildingScale;
      const yBase = altura; // edificação começa no topo do marcador

      if (lote.tipo === 'COMERCIAL' && lote.status !== 'BLOQUEADO') {
        // Prédio comercial: base + corpo de vidro + topo
        const hCorpo = Math.max(3, Math.min(w, d) * 0.6);
        const corpoGeo = new THREE.BoxGeometry(bW, hCorpo, bD);
        const corpo = new THREE.Mesh(corpoGeo, glassMat);
        corpo.position.set(center.x, yBase + hCorpo / 2, center.z);
        corpo.castShadow = true;
        loteamentoGroup.add(corpo);
        buildingMeshes.push(corpo);

        // Base mais escura (térreo)
        const baseGeo = new THREE.BoxGeometry(bW * 1.08, 0.6, bD * 1.08);
        const baseMesh = new THREE.Mesh(baseGeo, baseGlassMat);
        baseMesh.position.set(center.x, yBase + 0.3, center.z);
        baseMesh.castShadow = true;
        loteamentoGroup.add(baseMesh);
        buildingMeshes.push(baseMesh);
      } else if (lote.status === 'VENDIDO') {
        // Casinha: paredes + telhado de duas águas
        const hParedes = Math.max(1.5, Math.min(w, d) * 0.35);
        const paredesGeo = new THREE.BoxGeometry(bW, hParedes, bD);
        const paredes = new THREE.Mesh(paredesGeo, wallMat);
        paredes.position.set(center.x, yBase + hParedes / 2, center.z);
        paredes.castShadow = true;
        loteamentoGroup.add(paredes);
        buildingMeshes.push(paredes);

        // Telhado — cone com 4 lados (pirâmide quadrada)
        const hTelhado = hParedes * 0.5;
        const telhadoGeo = new THREE.ConeGeometry(Math.max(bW, bD) * 0.72, hTelhado, 4);
        const telhado = new THREE.Mesh(telhadoGeo, roofMat);
        telhado.position.set(center.x, yBase + hParedes + hTelhado / 2, center.z);
        telhado.rotation.y = Math.PI / 4;
        telhado.castShadow = true;
        loteamentoGroup.add(telhado);
        buildingMeshes.push(telhado);
      } else if (lote.status === 'RESERVADO') {
        // Pequeno poste/placa "reservado" no centro do lote
        const posteGeo = new THREE.BoxGeometry(0.25, 1.8, 0.25);
        const posteMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
        const poste = new THREE.Mesh(posteGeo, posteMat);
        poste.position.set(center.x, yBase + 0.9, center.z);
        poste.castShadow = true;
        loteamentoGroup.add(poste);
        buildingMeshes.push(poste);

        const placaGeo = new THREE.BoxGeometry(1.4, 0.7, 0.06);
        const placa = new THREE.Mesh(placaGeo, reservedMarkerMat);
        placa.position.set(center.x, yBase + 1.7, center.z);
        placa.castShadow = true;
        loteamentoGroup.add(placa);
        buildingMeshes.push(placa);
      }

      // 3) LABEL com o número do lote — flutuando acima
      const sprite = makeNumberSprite(lote.numero, colorOf(lote));
      const labelY =
        lote.tipo === 'COMERCIAL' && lote.status !== 'BLOQUEADO'
          ? altura + Math.max(3, Math.min(w, d) * 0.6) + 0.8
          : lote.status === 'VENDIDO'
            ? altura + Math.max(1.5, Math.min(w, d) * 0.35) * 1.5 + 0.6
            : altura + 1.2;
      sprite.position.set(center.x, labelY, center.z);
      // Label menor — não atrapalha visão das edificações
      const sScale = Math.max(1.2, Math.min(2.2, (w + d) * 0.18));
      sprite.scale.set(sScale, sScale * 0.5, 1);
      sprite.userData.loteId = lote.id;
      sprite.renderOrder = 10;
      loteamentoGroup.add(sprite);
      loteLabels.set(lote.id, sprite);
    }

    // Raycaster pra clicks
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointerDown(event: PointerEvent) {
      // Ignora drags (só conta como click se mover < 5px do ponto inicial)
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      const onMove = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) moved = true;
      };
      const onUp = (e: PointerEvent) => {
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerup', onUp);
        if (moved) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const meshes = Array.from(loteMeshes.values());
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          const lote = hits[0].object.userData.lote as Lote3D;
          // Foca câmera no lote
          const target = hits[0].object.position.clone();
          animateCameraTo(target.clone().add(new THREE.Vector3(12, 14, 12)), target);
          onSelectLote(lote);
        } else {
          onSelectLote(null);
        }
      };
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // ===== Animação de câmera =====
    function animateCameraTo(camPos: THREE.Vector3, target: THREE.Vector3, dur = 1000) {
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const t0 = performance.now();
      const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      function step() {
        const t = Math.min((performance.now() - t0) / dur, 1);
        const e = ease(t);
        camera.position.lerpVectors(startPos, camPos, e);
        controls.target.lerpVectors(startTarget, target, e);
        controls.update();
        if (t < 1) requestAnimationFrame(step);
      }
      step();
    }

    // ===== Presets (adaptados ao tamanho do plano) =====
    // Distância padrão proporcional ao maior lado do plano
    // Distância da câmera baseada no LOTE (não no background satélite expandido)
    // — assim os lotes ficam num bom tamanho na tela mesmo com satélite grande
    const dist = Math.max(loteW, loteH) * 0.9;
    const applyPreset = (p: Preset) => {
      switch (p) {
        case 'aerea':
          animateCameraTo(new THREE.Vector3(0, dist * 1.5, 0.001), new THREE.Vector3(0, 0, 0));
          break;
        case 'entrada':
          // Vista de baixo-esquerda do plano
          animateCameraTo(
            new THREE.Vector3(-planeW / 2 + 10, planeH * 0.35, planeH / 2 + 15),
            new THREE.Vector3(-planeW / 3, 0, planeH / 4)
          );
          break;
        case 'comercial': {
          const comerciais = lotes.filter((l) => l.tipo === 'COMERCIAL');
          if (comerciais.length > 0) {
            const cx = comerciais.reduce((s, l) => s + (l.x + l.w / 2), 0) / comerciais.length;
            const cy = comerciais.reduce((s, l) => s + (l.y + l.h / 2), 0) / comerciais.length;
            const target = toWorld(cx, cy);
            animateCameraTo(
              new THREE.Vector3(target.x + 25, 25, target.z + 25),
              new THREE.Vector3(target.x, 0, target.z)
            );
          }
          break;
        }
        case 'reset':
        default:
          animateCameraTo(
            new THREE.Vector3(dist * 0.6, dist * 0.8, dist),
            new THREE.Vector3(0, 0, 0)
          );
      }
    };
    presetRef(applyPreset);
    // Posição inicial alinhada com o tamanho do plano
    camera.position.set(dist * 0.6, dist * 0.8, dist);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);

    // Resize
    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // Render loop
    function loop() {
      controls.update();
      renderer.render(scene, camera);
      stateRef.current.animFrame = requestAnimationFrame(loop);
    }
    loop();

    // Salva no state
    stateRef.current.renderer = renderer;
    stateRef.current.scene = scene;
    stateRef.current.camera = camera;
    stateRef.current.controls = controls;
    stateRef.current.raycaster = raycaster;
    stateRef.current.pointer = pointer;
    stateRef.current.loteamentoGroup = loteamentoGroup;
    stateRef.current.loteW = loteW;
    stateRef.current.loteH = loteH;
    stateRef.current.loteMeshes = loteMeshes;
    stateRef.current.loteLabels = loteLabels;

    // Aplica calibração inicial no Group (caso já existam valores salvos)
    if (sateliteCalib) {
      const c = sateliteCalib;
      loteamentoGroup.position.x = (c.offsetX / 100) * loteW;
      loteamentoGroup.position.z = (c.offsetY / 100) * loteH;
      loteamentoGroup.scale.x = c.scaleX;
      loteamentoGroup.scale.z = c.scaleY;
      loteamentoGroup.rotation.y = -((c.rotation * Math.PI) / 180);
    }

    // Cleanup desta cena (retornado para useEffect)
    return () => {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      if (stateRef.current.animFrame) cancelAnimationFrame(stateRef.current.animFrame);
      stateRef.current.tourTimers.forEach((t) => clearTimeout(t));
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      loteMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      loteLabels.forEach((s) => {
        s.material.map?.dispose();
        s.material.dispose();
      });
      // Cleanup edificações (casinhas, prédios, placas)
      buildingMeshes.forEach((m) => {
        if (m instanceof THREE.Mesh) m.geometry.dispose();
      });
      // Materiais compartilhados — dispose só 1×
      wallMat.dispose();
      roofMat.dispose();
      glassMat.dispose();
      baseGlassMat.dispose();
      reservedMarkerMat.dispose();
      if (groundTex) groundTex.dispose();
    };
  } // <- fim de _initScene

  // ===== Reage à mudança de modo de toque (pan / rotate) =====
  // Atualiza OrbitControls em tempo real conforme o admin/usuário escolhe
  useEffect(() => {
    const ctrl = stateRef.current.controls;
    if (!ctrl) return;
    if (touchMode === 'rotate') {
      ctrl.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      ctrl.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    } else {
      ctrl.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      ctrl.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
      };
    }
  }, [touchMode]);

  // ===== Reage à mudança de calibração — aplica transform no Group =====
  // (sem rebuild de cena, em tempo real)
  useEffect(() => {
    const g = stateRef.current.loteamentoGroup;
    const lW = stateRef.current.loteW;
    const lH = stateRef.current.loteH;
    if (!g || !lW || !lH) return;
    const c = sateliteCalib ?? { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 };

    // Calib offsetX/Y são em % do bounding box dos lotes (0-100).
    // Convertendo pra world: 1% = (lW ou lH)/100.
    // No 3D: X mundo = X calib, Z mundo = Y calib (que vai pra "baixo" no SVG).
    g.position.x = (c.offsetX / 100) * lW;
    g.position.z = (c.offsetY / 100) * lH;
    g.scale.x = c.scaleX;
    g.scale.z = c.scaleY;
    // Rotação: SVG roda em torno do eixo Z (no plano XY); em 3D top-down,
    // isso é rotação em torno do eixo Y. Sinal negativo pra bater com SVG.
    g.rotation.y = -((c.rotation * Math.PI) / 180);
  }, [sateliteCalib]);

  // ===== Reage à mudança de filtro: esmaecer lotes + labels fora =====
  useEffect(() => {
    const idsVisiveis = new Set(lotesFiltrados.map((l) => l.id));
    stateRef.current.loteMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const visivel = idsVisiveis.has(id);
      mat.opacity = visivel ? 0.92 : 0.12;
      mat.emissiveIntensity = visivel ? 0.08 : 0;
    });
    stateRef.current.loteLabels.forEach((sprite, id) => {
      const visivel = idsVisiveis.has(id);
      sprite.material.opacity = visivel ? 1 : 0.15;
      sprite.visible = visivel || lotesFiltrados.length === 0;
    });
  }, [lotesFiltrados]);

  // ===== Tour automático =====
  useEffect(() => {
    if (!tourAtivo) return;
    const state = stateRef.current;
    if (!state.camera || !state.controls) return;

    const camera = state.camera;
    const controls = state.controls;

    type Step = { pos: [number, number, number]; target: [number, number, number]; dur: number };
    const steps: Step[] = [
      { pos: [0, 120, 0.001], target: [0, 0, 0], dur: 2500 }, // aérea
      { pos: [-45, 18, 45], target: [-20, 0, 20], dur: 2500 }, // entrada
      { pos: [50, 25, 0], target: [10, 0, 0], dur: 2500 }, // lateral
      { pos: [0, 15, 50], target: [0, 0, 0], dur: 2500 }, // frente
      { pos: [45, 60, 80], target: [0, 0, 0], dur: 2000 }, // reset
    ];

    function animateTo(s: Step, done: () => void) {
      const start = camera.position.clone();
      const startTgt = controls.target.clone();
      const tgtPos = new THREE.Vector3(...s.pos);
      const tgtTgt = new THREE.Vector3(...s.target);
      const t0 = performance.now();
      const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      function step() {
        const t = Math.min((performance.now() - t0) / s.dur, 1);
        camera.position.lerpVectors(start, tgtPos, ease(t));
        controls.target.lerpVectors(startTgt, tgtTgt, ease(t));
        controls.update();
        if (t < 1) requestAnimationFrame(step);
        else done();
      }
      step();
    }

    let cancelled = false;
    let idx = 0;
    function next() {
      if (cancelled) return;
      if (idx >= steps.length) {
        onTourEnd();
        return;
      }
      animateTo(steps[idx], () => {
        if (cancelled) return;
        const t = window.setTimeout(() => {
          idx++;
          next();
        }, 800);
        stateRef.current.tourTimers.push(t);
      });
    }
    next();

    return () => {
      cancelled = true;
      stateRef.current.tourTimers.forEach((t) => clearTimeout(t));
      stateRef.current.tourTimers = [];
    };
  }, [tourAtivo, onTourEnd]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
