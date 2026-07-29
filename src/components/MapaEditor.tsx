'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface LoteEditUI {
  id: string;
  codigo: string;
  quadra: string;
  numero: string;
  status: string;
  mapaX: number | null;
  mapaY: number | null;
  mapaLargura: number | null;
  mapaAltura: number | null;
}

interface Pos {
  x: number;
  y: number;
  w: number;
  h: number;
}

const STATUS_FILL: Record<string, string> = {
  DISPONIVEL: 'fill-emerald-500/40 stroke-emerald-600',
  RESERVADO: 'fill-amber-500/40 stroke-amber-600',
  EM_PAGAMENTO: 'fill-blue-500/40 stroke-blue-600',
  VENDIDO: 'fill-red-500/60 stroke-red-700',
  BLOQUEADO: 'fill-slate-400/30 stroke-slate-500',
};

type Mode = 'lote' | 'quadra';
type Direcao = 'horizontal' | 'vertical';
type EditHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface EditAction {
  kind: 'move' | 'resize';
  handle?: EditHandle;
  startMouseX: number;
  startMouseY: number;
  startPos: Pos;
}

export interface SateliteCalib {
  offsetX: number;
  offsetY: number;
  /** Escala horizontal (largura) — independente do scaleY */
  scaleX: number;
  /** Escala vertical (altura) — independente do scaleX */
  scaleY: number;
  rotation: number;
}

// Nota: normalize do calib do satélite agora é inlinado em quem precisa
// (page.tsx do mapa, touch page). NÃO exportar funções de utility daqui
// porque este arquivo é 'use client' — funções viram client references
// e quebram quando chamadas no server ("m is not a function").

interface MapaEditorProps {
  loteamentoId: string;
  imagemMapa: string;
  /** URL do satélite pré-gerado (se houver) — admin pode alternar pra calibrar contra ele */
  sateliteUrl?: string | null;
  /** Calibração atual da vista satélite (não afeta posições da planta) */
  sateliteCalib?: SateliteCalib;
  lotes: LoteEditUI[];
  salvarAction: (
    loteamentoId: string,
    raw: unknown
  ) => Promise<{ ok: boolean; error?: string; updated?: number }>;
  /** Salva calibração APENAS da vista satélite — não toca posições da planta */
  salvarSateliteCalibAction?: (
    loteamentoId: string,
    raw: unknown
  ) => Promise<{ ok: boolean; error?: string }>;
  resetarSateliteCalibAction?: (loteamentoId: string) => Promise<{ ok: boolean }>;
}

const MIN_SIZE = 0.3;
const CURSOR_BY_HANDLE: Record<EditHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

export function MapaEditor({
  loteamentoId,
  imagemMapa,
  sateliteUrl,
  sateliteCalib: sateliteCalibInicial = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  lotes,
  salvarAction,
  salvarSateliteCalibAction,
  resetarSateliteCalibAction,
}: MapaEditorProps) {
  // Toggle entre planta e satélite (afeta APENAS o que é mostrado, não muda nada salvo).
  const [bgMode, setBgMode] = useState<'planta' | 'satelite'>('planta');
  const imagemAtual = bgMode === 'satelite' && sateliteUrl ? sateliteUrl : imagemMapa;

  // Calibração específica do satélite (não afeta posições da planta)
  const [satCalib, setSatCalib] = useState<SateliteCalib>(sateliteCalibInicial);
  const [savingSat, setSavingSat] = useState(false);
  const [savedSatMsg, setSavedSatMsg] = useState<string | null>(null);

  /** Transforma uma posição base (da planta) para a posição na vista satélite.
   *  Aplica primeiro escala X/Y independentes, depois rotação, depois translação. */
  function applySatCalib(p: Pos): Pos {
    if (bgMode !== 'satelite') return p;
    const { offsetX, offsetY, scaleX, scaleY, rotation } = satCalib;
    const rad = (rotation * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    // Posição relativa ao centro (50,50)
    const cx = p.x + p.w / 2 - 50;
    const cy = p.y + p.h / 2 - 50;
    // Escala independente em X e Y, depois rotação em torno do centro
    const sx = cx * scaleX;
    const sy = cy * scaleY;
    const nx = sx * cosA - sy * sinA + 50 + offsetX;
    const ny = sx * sinA + sy * cosA + 50 + offsetY;
    const nw = p.w * scaleX;
    const nh = p.h * scaleY;
    return { x: nx - nw / 2, y: ny - nh / 2, w: nw, h: nh };
  }

  async function salvarSat() {
    if (!salvarSateliteCalibAction) return;
    setSavingSat(true);
    setSavedSatMsg(null);
    const r = await salvarSateliteCalibAction(loteamentoId, satCalib);
    setSavingSat(false);
    if (r.ok) {
      setSavedSatMsg('✓ Calibração do satélite salva');
      setTimeout(() => setSavedSatMsg(null), 4000);
    } else {
      setSavedSatMsg(r.error ?? 'Falha ao salvar');
    }
  }
  async function resetarSat() {
    if (!resetarSateliteCalibAction) return;
    if (!confirm('Resetar calibração do satélite? (não afeta posições da planta)')) return;
    setSavingSat(true);
    await resetarSateliteCalibAction(loteamentoId);
    setSatCalib({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    setSavingSat(false);
    setSavedSatMsg('✓ Calibração resetada');
    setTimeout(() => setSavedSatMsg(null), 4000);
  }
  const [positions, setPositions] = useState<Record<string, Pos | null>>(() => {
    const map: Record<string, Pos | null> = {};
    for (const l of lotes) {
      if (l.mapaX !== null && l.mapaY !== null && l.mapaLargura !== null && l.mapaAltura !== null) {
        map[l.id] = { x: l.mapaX, y: l.mapaY, w: l.mapaLargura, h: l.mapaAltura };
      } else {
        map[l.id] = null;
      }
    }
    return map;
  });

  const [mode, setMode] = useState<Mode>('quadra');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQuadra, setSelectedQuadra] = useState<string>('');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(15);
  const [direcao, setDirecao] = useState<Direcao>('horizontal');
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Edição (redimensionar/mover) de um lote já posicionado
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAction, setEditAction] = useState<EditAction | null>(null);

  const [tab, setTab] = useState<'posicionar' | 'todos'>('posicionar');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // ===== MODO CALIBRAÇÃO — transforma todos os lotes em conjunto =====
  const [calibracaoAtiva, setCalibracaoAtiva] = useState(false);
  const [calibX, setCalibX] = useState(0); // offset % horizontal (-20..+20)
  const [calibY, setCalibY] = useState(0); // offset % vertical
  const [calibScale, setCalibScale] = useState(100); // escala em % (50..150)
  const [calibRotation, setCalibRotation] = useState(0); // rotação em graus (-5..+5)

  // ===== MODO "ARRASTAR PLANTA" — move a imagem de fundo (não os lotes) =====
  // O usuário desliza a planta até ela ficar visualmente alinhada com os lotes.
  // Ao clicar "Aplicar", o sistema move TODOS os lotes pelo INVERSO do delta,
  // pra que a imagem volte à origem mas o alinhamento visual seja preservado.
  const [arrastarPlanta, setArrastarPlanta] = useState(false);
  const [plantaShift, setPlantaShift] = useState({ x: 0, y: 0 });
  const plantaDragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startShiftX: number;
    startShiftY: number;
  } | null>(null);

  function transformPos(p: Pos): Pos {
    if (!calibracaoAtiva) return p;
    const s = calibScale / 100;
    const rad = (calibRotation * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    // centro do lote relativo ao centro da imagem (50, 50)
    const cx = p.x + p.w / 2 - 50;
    const cy = p.y + p.h / 2 - 50;
    // escala + rotação em torno do centro (50,50), depois translação
    const nx = (cx * cosA - cy * sinA) * s + 50 + calibX;
    const ny = (cx * sinA + cy * cosA) * s + 50 + calibY;
    const nw = p.w * s;
    const nh = p.h * s;
    return { x: nx - nw / 2, y: ny - nh / 2, w: nw, h: nh };
  }

  function aplicarCalibracao() {
    if (!calibracaoAtiva) return;
    setPositions((prev) => {
      const novo: typeof prev = {};
      for (const id in prev) {
        const p = prev[id];
        novo[id] = p ? transformPos(p) : null;
      }
      return novo;
    });
    setCalibX(0); setCalibY(0); setCalibScale(100); setCalibRotation(0);
    setCalibracaoAtiva(false);
  }
  function cancelarCalibracao() {
    setCalibX(0); setCalibY(0); setCalibScale(100); setCalibRotation(0);
    setCalibracaoAtiva(false);
  }

  /**
   * Aplica o deslocamento da planta nos lotes (em sentido OPOSTO).
   *
   * Raciocínio: o usuário arrastou a planta +shift% para encaixá-la sobre os
   * lotes. Quando salvarmos, a imagem PNG continuará a mesma (não muda no
   * servidor) — então pra que o alinhamento persista, os LOTES precisam ser
   * movidos -shift% (sentido contrário), pra que ao recarregar (planta em 0,0)
   * eles fiquem alinhados com a planta original.
   */
  function aplicarShiftPlanta() {
    if (plantaShift.x === 0 && plantaShift.y === 0) return;
    setPositions((prev) => {
      const novo: typeof prev = {};
      for (const id in prev) {
        const p = prev[id];
        if (!p) {
          novo[id] = null;
          continue;
        }
        novo[id] = {
          x: Math.max(0, Math.min(100 - p.w, p.x - plantaShift.x)),
          y: Math.max(0, Math.min(100 - p.h, p.y - plantaShift.y)),
          w: p.w,
          h: p.h,
        };
      }
      return novo;
    });
    setPlantaShift({ x: 0, y: 0 });
    setArrastarPlanta(false);
  }

  function cancelarShiftPlanta() {
    setPlantaShift({ x: 0, y: 0 });
    setArrastarPlanta(false);
    plantaDragRef.current = null;
  }

  function zoomIn() { setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2))); }
  function zoomOut() { setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2))); }
  function zoomReset() { setZoom(1); }

  // Atalhos +/-/0 para zoom (quando não estiver digitando em input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); zoomReset(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const quadras = useMemo(
    () => Array.from(new Set(lotes.map((l) => l.quadra))).sort(),
    [lotes]
  );

  // Auto-seleciona próximo quadra/lote a posicionar
  useEffect(() => {
    if (editingId) return; // pausa auto-seleção quando editando
    if (mode === 'lote' && selectedId === null) {
      const next = lotes.find((l) => !positions[l.id]);
      if (next) setSelectedId(next.id);
    }
    if (mode === 'quadra' && !selectedQuadra) {
      const next = quadras.find((q) => lotes.some((l) => l.quadra === q && !positions[l.id]));
      if (next) {
        setSelectedQuadra(next);
        autoSetGridSize(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedId, selectedQuadra, positions, editingId]);

  // Teclado: ESC, setas (passo 0.1 ou 1 com shift), Delete remove
  useEffect(() => {
    if (!editingId) return;
    function onKey(e: KeyboardEvent) {
      if (!editingId) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.tagName === 'BODY') {
          e.preventDefault();
          setPositions((prev) => ({ ...prev, [editingId]: null }));
          setEditingId(null);
        }
        return;
      }
      const step = e.shiftKey ? 1 : 0.1;
      setPositions((prev) => {
        const p = prev[editingId];
        if (!p) return prev;
        let n: Pos | null = null;
        if (e.altKey) {
          // Alt + setas redimensiona (W/H)
          if (e.key === 'ArrowRight') n = { ...p, w: Math.max(MIN_SIZE, Math.min(100 - p.x, p.w + step)) };
          else if (e.key === 'ArrowLeft') n = { ...p, w: Math.max(MIN_SIZE, p.w - step) };
          else if (e.key === 'ArrowDown') n = { ...p, h: Math.max(MIN_SIZE, Math.min(100 - p.y, p.h + step)) };
          else if (e.key === 'ArrowUp') n = { ...p, h: Math.max(MIN_SIZE, p.h - step) };
        } else {
          // setas movem (X/Y)
          if (e.key === 'ArrowLeft') n = { ...p, x: Math.max(0, p.x - step) };
          else if (e.key === 'ArrowRight') n = { ...p, x: Math.min(100 - p.w, p.x + step) };
          else if (e.key === 'ArrowUp') n = { ...p, y: Math.max(0, p.y - step) };
          else if (e.key === 'ArrowDown') n = { ...p, y: Math.min(100 - p.h, p.y + step) };
        }
        if (n) {
          e.preventDefault();
          return { ...prev, [editingId]: n };
        }
        return prev;
      });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId]);

  function autoSetGridSize(quadra: string) {
    const n = lotes.filter((l) => l.quadra === quadra).length;
    if (n <= 4) { setRows(2); setCols(2); }
    else if (n <= 12) { setRows(2); setCols(Math.ceil(n / 2)); }
    else if (n <= 36) { setRows(2); setCols(Math.ceil(n / 2)); }
    else { setRows(Math.ceil(Math.sqrt(n))); setCols(Math.ceil(n / Math.ceil(Math.sqrt(n)))); }
  }

  function getRelativeCoords(e: React.MouseEvent): { x: number; y: number } | null {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function onMouseDown(e: React.MouseEvent) {
    // Modo "arrastar planta": sempre prioritário — inicia drag do fundo
    if (arrastarPlanta) {
      const coords = getRelativeCoords(e);
      if (!coords) return;
      plantaDragRef.current = {
        startMouseX: coords.x,
        startMouseY: coords.y,
        startShiftX: plantaShift.x,
        startShiftY: plantaShift.y,
      };
      return;
    }
    // Click no fundo (não em rect/handle) — se editando, desseleciona; senão começa desenho
    if (editingId) {
      setEditingId(null);
      return;
    }
    const ready =
      (mode === 'lote' && selectedId) ||
      (mode === 'quadra' && selectedQuadra);
    if (!ready) return;
    const coords = getRelativeCoords(e);
    if (!coords) return;
    setDrawing({ startX: coords.x, startY: coords.y, currentX: coords.x, currentY: coords.y });
  }

  function onMouseMove(e: React.MouseEvent) {
    // Modo "arrastar planta": atualiza shift
    if (arrastarPlanta && plantaDragRef.current) {
      const coords = getRelativeCoords(e);
      if (!coords) return;
      const d = plantaDragRef.current;
      const dx = coords.x - d.startMouseX;
      const dy = coords.y - d.startMouseY;
      // Clamp em [-50, 50] para evitar a planta sair completamente da área
      setPlantaShift({
        x: Math.max(-50, Math.min(50, d.startShiftX + dx)),
        y: Math.max(-50, Math.min(50, d.startShiftY + dy)),
      });
      return;
    }
    // Modo edição: arrasta handle ou move o corpo
    if (editingId && editAction) {
      const coords = getRelativeCoords(e);
      if (!coords) return;
      const dx = coords.x - editAction.startMouseX;
      const dy = coords.y - editAction.startMouseY;
      const sp = editAction.startPos;
      let p: Pos = { ...sp };
      if (editAction.kind === 'move') {
        p.x = Math.max(0, Math.min(100 - sp.w, sp.x + dx));
        p.y = Math.max(0, Math.min(100 - sp.h, sp.y + dy));
      } else if (editAction.kind === 'resize' && editAction.handle) {
        const h = editAction.handle;
        if (h.includes('w')) {
          const desiredX = Math.max(0, Math.min(sp.x + sp.w - MIN_SIZE, sp.x + dx));
          p.x = desiredX;
          p.w = sp.w + (sp.x - desiredX);
        }
        if (h.includes('e')) {
          p.w = Math.max(MIN_SIZE, Math.min(100 - sp.x, sp.w + dx));
        }
        if (h.includes('n')) {
          const desiredY = Math.max(0, Math.min(sp.y + sp.h - MIN_SIZE, sp.y + dy));
          p.y = desiredY;
          p.h = sp.h + (sp.y - desiredY);
        }
        if (h.includes('s')) {
          p.h = Math.max(MIN_SIZE, Math.min(100 - sp.y, sp.h + dy));
        }
      }
      setPositions((prev) => ({ ...prev, [editingId]: p }));
      return;
    }

    // Modo desenho
    if (!drawing) return;
    const coords = getRelativeCoords(e);
    if (!coords) return;
    setDrawing({ ...drawing, currentX: coords.x, currentY: coords.y });
  }

  function onMouseUp() {
    // Modo "arrastar planta": encerra drag
    if (arrastarPlanta && plantaDragRef.current) {
      plantaDragRef.current = null;
      return;
    }
    // Edição: encerra o action
    if (editAction) {
      setEditAction(null);
      return;
    }

    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.currentX);
    const y = Math.min(drawing.startY, drawing.currentY);
    const w = Math.abs(drawing.currentX - drawing.startX);
    const h = Math.abs(drawing.currentY - drawing.startY);
    setDrawing(null);

    if (w < 0.5 || h < 0.5) return;

    if (mode === 'lote' && selectedId) {
      setPositions((prev) => ({ ...prev, [selectedId]: { x, y, w, h } }));
      avancarLote();
    } else if (mode === 'quadra' && selectedQuadra) {
      distribuirNaQuadra({ x, y, w, h });
      avancarQuadra();
    }
  }

  // Click em um rect já posicionado: seleciona pra editar + começa move
  function onRectMouseDown(e: React.MouseEvent, loteId: string) {
    // Em modo satélite, o admin não pode mover lotes individuais —
    // só calibração global (que vai pra mapaSateliteCalib, não pras posições).
    if (bgMode === 'satelite') return;
    e.stopPropagation();
    const coords = getRelativeCoords(e);
    if (!coords) return;
    const pos = positions[loteId];
    if (!pos) return;
    setEditingId(loteId);
    setEditAction({
      kind: 'move',
      startMouseX: coords.x,
      startMouseY: coords.y,
      startPos: pos,
    });
  }

  function onHandleMouseDown(e: React.MouseEvent, loteId: string, handle: EditHandle) {
    if (bgMode === 'satelite') return;
    e.stopPropagation();
    const coords = getRelativeCoords(e);
    if (!coords) return;
    const pos = positions[loteId];
    if (!pos) return;
    setEditingId(loteId);
    setEditAction({
      kind: 'resize',
      handle,
      startMouseX: coords.x,
      startMouseY: coords.y,
      startPos: pos,
    });
  }

  function avancarLote() {
    const idx = lotes.findIndex((l) => l.id === selectedId);
    for (let i = idx + 1; i < lotes.length; i++) {
      if (!positions[lotes[i].id]) {
        setSelectedId(lotes[i].id);
        return;
      }
    }
    for (let i = 0; i < idx; i++) {
      if (!positions[lotes[i].id]) {
        setSelectedId(lotes[i].id);
        return;
      }
    }
    setSelectedId(null);
  }

  function avancarQuadra() {
    const idx = quadras.findIndex((q) => q === selectedQuadra);
    for (let i = idx + 1; i < quadras.length; i++) {
      if (lotes.some((l) => l.quadra === quadras[i] && !positions[l.id])) {
        setSelectedQuadra(quadras[i]);
        autoSetGridSize(quadras[i]);
        return;
      }
    }
    setSelectedQuadra('');
  }

  function distribuirNaQuadra(rect: Pos) {
    const quadraLotes = lotes
      .filter((l) => l.quadra === selectedQuadra)
      .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));

    if (quadraLotes.length === 0) return;

    const cellW = rect.w / cols;
    const cellH = rect.h / rows;
    const padding = 0.93;

    const novas: Record<string, Pos | null> = { ...positions };
    let idx = 0;
    const ordem = direcao === 'horizontal'
      ? Array.from({ length: rows * cols }, (_, i) => ({ r: Math.floor(i / cols), c: i % cols }))
      : Array.from({ length: rows * cols }, (_, i) => ({ r: i % rows, c: Math.floor(i / rows) }));

    for (const { r, c } of ordem) {
      if (idx >= quadraLotes.length) break;
      const lote = quadraLotes[idx];
      const cellX = rect.x + c * cellW;
      const cellY = rect.y + r * cellH;
      novas[lote.id] = {
        x: cellX + (cellW * (1 - padding)) / 2,
        y: cellY + (cellH * (1 - padding)) / 2,
        w: cellW * padding,
        h: cellH * padding,
      };
      idx++;
    }
    setPositions(novas);
  }

  function removerPosicao(loteId: string) {
    setPositions((prev) => ({ ...prev, [loteId]: null }));
    if (editingId === loteId) setEditingId(null);
    setSelectedId(loteId);
    setMode('lote');
  }

  function limparQuadra(quadra: string) {
    if (!confirm(`Limpar posições de todos os lotes da Quadra ${quadra}?`)) return;
    setPositions((prev) => {
      const next = { ...prev };
      for (const l of lotes) {
        if (l.quadra === quadra) next[l.id] = null;
      }
      return next;
    });
  }

  function setEditingFieldValue(field: 'x' | 'y' | 'w' | 'h', v: number) {
    if (!editingId) return;
    setPositions((prev) => {
      const p = prev[editingId];
      if (!p) return prev;
      const next = { ...p };
      if (field === 'x') next.x = Math.max(0, Math.min(100 - p.w, v));
      if (field === 'y') next.y = Math.max(0, Math.min(100 - p.h, v));
      if (field === 'w') next.w = Math.max(MIN_SIZE, Math.min(100 - p.x, v));
      if (field === 'h') next.h = Math.max(MIN_SIZE, Math.min(100 - p.y, v));
      return { ...prev, [editingId]: next };
    });
  }

  async function salvar() {
    setSaving(true);
    setSavedMsg(null);
    const payload = {
      posicoes: lotes.map((l) => ({
        loteId: l.id,
        mapaX: positions[l.id]?.x ?? null,
        mapaY: positions[l.id]?.y ?? null,
        mapaLargura: positions[l.id]?.w ?? null,
        mapaAltura: positions[l.id]?.h ?? null,
      })),
    };
    const res = await salvarAction(loteamentoId, payload);
    setSaving(false);
    if (res.ok) {
      setSavedMsg(`${res.updated} lote(s) salvos.`);
      setTimeout(() => setSavedMsg(null), 4000);
    } else {
      setSavedMsg(`Erro: ${res.error ?? 'falha ao salvar'}`);
    }
  }

  const drawingRect = drawing
    ? {
        x: Math.min(drawing.startX, drawing.currentX),
        y: Math.min(drawing.startY, drawing.currentY),
        w: Math.abs(drawing.currentX - drawing.startX),
        h: Math.abs(drawing.currentY - drawing.startY),
      }
    : null;

  const naoPosicionados = lotes.filter((l) => !positions[l.id]);
  const posicionados = lotes.filter((l) => positions[l.id]);

  const cursorActive = arrastarPlanta
    ? plantaDragRef.current
      ? 'grabbing'
      : 'grab'
    : editingId
      ? 'default'
      : (mode === 'lote' && selectedId) || (mode === 'quadra' && selectedQuadra)
        ? 'crosshair'
        : 'default';

  const editingLote = editingId ? lotes.find((l) => l.id === editingId) : null;
  const editingPos = editingId ? positions[editingId] : null;

  return (
    <div className="grid lg:grid-cols-[340px,1fr] gap-4">
      {/* Sidebar */}
      <aside className="bg-white border border-slate-200 rounded-xl flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {/* Mode toggle */}
        <div className="p-3 border-b border-slate-200 flex gap-1 bg-slate-50 rounded-t-xl">
          <button
            onClick={() => { setMode('quadra'); setEditingId(null); }}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
              mode === 'quadra' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-white'
            }`}
          >
            🟦 Quadra
          </button>
          <button
            onClick={() => { setMode('lote'); setEditingId(null); }}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
              mode === 'lote' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-white'
            }`}
          >
            🟧 Lote
          </button>
          <button
            onClick={() => { setCalibracaoAtiva(!calibracaoAtiva); setEditingId(null); setArrastarPlanta(false); }}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
              calibracaoAtiva ? 'bg-fuchsia-600 text-white' : 'text-slate-600 hover:bg-white'
            }`}
            title="Ajustar TODOS os lotes juntos (alinhar com a foto)"
          >
            🎯 Calibrar
          </button>
          <button
            onClick={() => {
              const novo = !arrastarPlanta;
              setArrastarPlanta(novo);
              setEditingId(null);
              setCalibracaoAtiva(false);
              if (!novo) {
                setPlantaShift({ x: 0, y: 0 });
                plantaDragRef.current = null;
              }
            }}
            disabled={bgMode === 'satelite'}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
              arrastarPlanta ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-white'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Arrastar a imagem de fundo (planta) para alinhar com os lotes"
          >
            🤚 Mover planta
          </button>
        </div>

        {/* ====== AVISO QUANDO ESTÁ EM MODO SATÉLITE ====== */}
        {bgMode === 'satelite' && sateliteUrl && (
          <div className="p-3 border-b border-slate-200 bg-cyan-50/70">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-cyan-700 font-bold">
                🛰 Modo satélite (Stand 3D)
              </p>
              {savedSatMsg && (
                <p className={`text-[10px] ${savedSatMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {savedSatMsg}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Esta calibração é <strong>só pra vista satélite</strong> do Stand 3D —
              não toca as posições da planta.
            </p>

            <div className="space-y-2.5">
              <SliderField
                label="Deslocar X"
                value={satCalib.offsetX}
                min={-100}
                max={100}
                step={0.1}
                suffix="%"
                onChange={(v) => setSatCalib({ ...satCalib, offsetX: v })}
              />
              <SliderField
                label="Deslocar Y"
                value={satCalib.offsetY}
                min={-100}
                max={100}
                step={0.1}
                suffix="%"
                onChange={(v) => setSatCalib({ ...satCalib, offsetY: v })}
              />
              <SliderField
                label="Largura (X)"
                value={satCalib.scaleX * 100}
                min={20}
                max={300}
                step={0.5}
                suffix="%"
                onChange={(v) => setSatCalib({ ...satCalib, scaleX: v / 100 })}
              />
              <SliderField
                label="Altura (Y)"
                value={satCalib.scaleY * 100}
                min={20}
                max={300}
                step={0.5}
                suffix="%"
                onChange={(v) => setSatCalib({ ...satCalib, scaleY: v / 100 })}
              />
              {/* Botão pra travar X=Y (escalar uniforme) */}
              <button
                type="button"
                onClick={() => {
                  const avg = (satCalib.scaleX + satCalib.scaleY) / 2;
                  setSatCalib({ ...satCalib, scaleX: avg, scaleY: avg });
                }}
                className="w-full text-[10px] text-slate-500 hover:text-slate-700 underline py-0.5"
                title="Iguala largura e altura (média atual)"
              >
                🔗 igualar X = Y
              </button>
              <SliderField
                label="Rotação"
                value={satCalib.rotation}
                min={-180}
                max={180}
                step={0.5}
                suffix="°"
                onChange={(v) => setSatCalib({ ...satCalib, rotation: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={resetarSat}
                disabled={savingSat}
                className="text-xs px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg disabled:opacity-50"
              >
                ↺ Resetar
              </button>
              <button
                onClick={salvarSat}
                disabled={savingSat}
                className="text-xs px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {savingSat ? 'Salvando…' : '💾 Salvar calib. satélite'}
              </button>
            </div>
          </div>
        )}

        {/* ====== PAINEL MODO CALIBRAÇÃO (afeta posições da planta) ====== */}
        {calibracaoAtiva && bgMode === 'planta' && (
          <div className="p-3 border-b border-slate-200 bg-fuchsia-50/70">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-fuchsia-700 font-bold">
                  Calibração global
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Move/escala/gira <strong>todos</strong> os lotes juntos para alinhar com a foto.
                  Use depois ajustes individuais.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 mt-3">
              <SliderField
                label="Deslocar horizontal"
                value={calibX}
                min={-20}
                max={20}
                step={0.1}
                suffix="%"
                onChange={setCalibX}
              />
              <SliderField
                label="Deslocar vertical"
                value={calibY}
                min={-20}
                max={20}
                step={0.1}
                suffix="%"
                onChange={setCalibY}
              />
              <SliderField
                label="Escala"
                value={calibScale}
                min={50}
                max={150}
                step={0.5}
                suffix="%"
                onChange={setCalibScale}
              />
              <SliderField
                label="Rotação"
                value={calibRotation}
                min={-15}
                max={15}
                step={0.1}
                suffix="°"
                onChange={setCalibRotation}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={cancelarCalibracao}
                className="text-xs px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Resetar
              </button>
              <button
                onClick={aplicarCalibracao}
                disabled={calibX === 0 && calibY === 0 && calibScale === 100 && calibRotation === 0}
                className="text-xs px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 text-white font-semibold rounded-lg"
              >
                ✓ Aplicar nos {posicionados.length} lotes
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mt-2 leading-snug">
              ✦ &ldquo;Aplicar&rdquo; grava as novas posições (não salva no banco ainda — clique em
              &ldquo;Salvar&rdquo; abaixo para persistir).
            </p>
          </div>
        )}

        {/* ====== PAINEL MODO ARRASTAR PLANTA ====== */}
        {arrastarPlanta && bgMode === 'planta' && (
          <div className="p-3 border-b border-slate-200 bg-teal-50/70">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-teal-700 font-bold">
                  🤚 Mover planta de fundo
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  Clique e arraste a planta na área principal até ela ficar
                  alinhada com os lotes. Ao confirmar, os lotes são deslocados
                  pelo inverso do delta para preservar o alinhamento.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-teal-200 p-2.5 mt-2 font-mono text-xs">
              <div className="flex justify-between text-slate-700">
                <span>Δ horizontal</span>
                <strong className={plantaShift.x !== 0 ? 'text-teal-700' : 'text-slate-400'}>
                  {plantaShift.x > 0 ? '+' : ''}{plantaShift.x.toFixed(2)}%
                </strong>
              </div>
              <div className="flex justify-between text-slate-700 mt-1">
                <span>Δ vertical</span>
                <strong className={plantaShift.y !== 0 ? 'text-teal-700' : 'text-slate-400'}>
                  {plantaShift.y > 0 ? '+' : ''}{plantaShift.y.toFixed(2)}%
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={cancelarShiftPlanta}
                className="text-xs px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={aplicarShiftPlanta}
                disabled={plantaShift.x === 0 && plantaShift.y === 0}
                className="text-xs px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-semibold rounded-lg"
              >
                ✓ Aplicar nos {posicionados.length} lotes
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mt-2 leading-snug">
              ✦ Após aplicar, ainda é preciso clicar em <strong>Salvar</strong> para gravar no banco.
            </p>
          </div>
        )}

        {/* ====== PAINEL DE EDIÇÃO DO LOTE SELECIONADO ====== */}
        {editingLote && editingPos && (
          <div className="p-3 border-b border-slate-100 bg-amber-50/60">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
                  Editando
                </p>
                <p className="font-mono text-sm font-semibold text-slate-900">{editingLote.codigo}</p>
              </div>
              <button
                onClick={() => setEditingId(null)}
                className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-white"
                title="Fechar (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumField label="X (%)" value={editingPos.x} onChange={(v) => setEditingFieldValue('x', v)} />
              <NumField label="Y (%)" value={editingPos.y} onChange={(v) => setEditingFieldValue('y', v)} />
              <NumField label="Largura" value={editingPos.w} onChange={(v) => setEditingFieldValue('w', v)} />
              <NumField label="Altura" value={editingPos.h} onChange={(v) => setEditingFieldValue('h', v)} />
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => removerPosicao(editingLote.id)}
                className="flex-1 text-xs text-red-600 hover:bg-red-50 py-1.5 rounded-lg border border-red-200"
              >
                Remover posição
              </button>
            </div>

            <p className="text-[10px] text-slate-500 mt-2 leading-snug">
              <strong>Dicas:</strong> arraste o corpo pra mover · cantos/bordas pra redimensionar · setas pra ajuste fino (Shift = passo 1, Alt = redimensiona) · ESC fecha.
            </p>
          </div>
        )}

        {/* Painel de modo quadra */}
        {!editingLote && mode === 'quadra' ? (
          <div className="p-3 space-y-3 border-b border-slate-100">
            <p className="text-xs text-slate-500">
              Mapeie todos os lotes de uma quadra de uma só vez desenhando um retângulo.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quadra</label>
              <select
                value={selectedQuadra}
                onChange={(e) => { setSelectedQuadra(e.target.value); if (e.target.value) autoSetGridSize(e.target.value); }}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Selecione —</option>
                {quadras.map((q) => {
                  const total = lotes.filter((l) => l.quadra === q).length;
                  const pos = lotes.filter((l) => l.quadra === q && positions[l.id]).length;
                  return (
                    <option key={q} value={q}>
                      Quadra {q} ({pos}/{total} posicionados)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Linhas</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, Number(e.target.value)))}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Colunas</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Number(e.target.value)))}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ordem de numeração</label>
              <select
                value={direcao}
                onChange={(e) => setDirecao(e.target.value as Direcao)}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="horizontal">Horizontal (linha por linha)</option>
                <option value="vertical">Vertical (coluna por coluna)</option>
              </select>
            </div>

            {selectedQuadra && (
              <button
                onClick={() => limparQuadra(selectedQuadra)}
                className="w-full text-xs text-red-600 hover:bg-red-50 py-1.5 rounded-lg"
              >
                Limpar quadra {selectedQuadra}
              </button>
            )}
          </div>
        ) : !editingLote ? (
          <>
            <div className="border-b border-slate-200">
              <div className="flex">
                <button
                  onClick={() => setTab('posicionar')}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium ${
                    tab === 'posicionar' ? 'text-slate-900 border-b-2 border-primary-600' : 'text-slate-500'
                  }`}
                >
                  A posicionar ({naoPosicionados.length})
                </button>
                <button
                  onClick={() => setTab('todos')}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium ${
                    tab === 'todos' ? 'text-slate-900 border-b-2 border-primary-600' : 'text-slate-500'
                  }`}
                >
                  Posicionados ({posicionados.length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {tab === 'posicionar' ? (
                naoPosicionados.length === 0 ? (
                  <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 text-center">
                    ✓ Todos os lotes posicionados.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {naoPosicionados.map((l) => (
                      <li key={l.id}>
                        <button
                          onClick={() => setSelectedId(l.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                            selectedId === l.id
                              ? 'bg-primary-100 text-primary-900 font-semibold ring-1 ring-primary-400'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="font-mono">{l.codigo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <ul className="space-y-1">
                  {posicionados.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(l.id)}
                        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition ${
                          editingId === l.id
                            ? 'bg-amber-100 text-amber-900 font-semibold ring-1 ring-amber-400'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                        title="Clique pra editar tamanho e posição"
                      >
                        <span className="font-mono">{l.codigo}</span>
                      </button>
                      <button
                        onClick={() => removerPosicao(l.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        title="Remover posição"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}

        <div className="border-t border-slate-200 p-3 space-y-2 bg-slate-50 rounded-b-xl">
          {!editingLote && (
            <div className="text-xs text-slate-600 bg-white rounded-lg p-2.5 border border-slate-200">
              {mode === 'quadra' ? (
                selectedQuadra ? (
                  <>
                    <strong className="text-slate-900">Quadra {selectedQuadra}</strong> · {rows}×{cols} células
                    <p className="text-slate-500 mt-1">Desenhe um retângulo no mapa cobrindo TODA a quadra.</p>
                  </>
                ) : (
                  <p className="text-slate-500">Selecione uma quadra na lista acima.</p>
                )
              ) : (
                selectedId ? (
                  <>
                    <strong className="text-slate-900">{lotes.find((l) => l.id === selectedId)?.codigo}</strong>
                    <p className="text-slate-500 mt-1">Desenhe o retângulo deste lote no mapa.</p>
                  </>
                ) : (
                  <p className="text-slate-500">Selecione um lote.</p>
                )
              )}
              <p className="text-[10px] text-slate-400 mt-2 leading-snug">
                💡 Clique num lote já posicionado para <strong>editar tamanho/posição</strong>.
              </p>
            </div>
          )}

          <button
            onClick={salvar}
            disabled={saving}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
          >
            {saving ? 'Salvando...' : `Salvar (${posicionados.length}/${lotes.length})`}
          </button>
          {savedMsg && (
            <p className={`text-xs text-center ${savedMsg.startsWith('Erro') ? 'text-red-600' : 'text-emerald-600'}`}>
              {savedMsg}
            </p>
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Toolbar de zoom */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={zoom <= 0.5}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-lg flex items-center justify-center"
              title="Diminuir zoom (−)"
            >
              −
            </button>
            <span className="text-xs font-mono font-semibold text-slate-700 w-14 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoom >= 4}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-lg flex items-center justify-center"
              title="Aumentar zoom (+)"
            >
              +
            </button>
            <button
              onClick={zoomReset}
              disabled={zoom === 1}
              className="ml-1 px-2 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-medium flex items-center"
              title="Voltar para 100% (0)"
            >
              100%
            </button>
          </div>
          <div className="flex items-center gap-2">
            {sateliteUrl && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setBgMode('planta')}
                  className={`px-3 py-1 text-xs font-semibold rounded transition ${
                    bgMode === 'planta'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Calibrar contra a planta original"
                >
                  📐 Planta
                </button>
                <button
                  onClick={() => setBgMode('satelite')}
                  className={`px-3 py-1 text-xs font-semibold rounded transition ${
                    bgMode === 'satelite'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Calibrar contra o satélite (igual ao stand 3D)"
                >
                  🛰 Satélite
                </button>
              </div>
            )}
            <span className="text-[10px] text-slate-400 hidden md:inline">
              atalhos: <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono">+</kbd> <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono">−</kbd> <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono">0</kbd>
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          {editingLote ? (
            <>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">
                Editando
              </span>
              <strong className="text-slate-900">{editingLote.codigo}</strong>
              <span className="text-slate-400">·</span>
              <span>Arraste o corpo para mover · alças nos cantos/bordas para redimensionar · ESC fecha</span>
            </>
          ) : mode === 'quadra' ? (
            <>
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-[10px] font-bold uppercase">Quadra</span>
              {selectedQuadra ? (
                <>
                  <strong className="text-slate-900">Quadra {selectedQuadra}</strong>
                  <span className="text-slate-400">·</span>
                  <span>Arraste no mapa para demarcar a quadra inteira ({rows}×{cols})</span>
                </>
              ) : (
                <span>Selecione uma quadra na lateral</span>
              )}
            </>
          ) : (
            <>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">Lote</span>
              {selectedId ? (
                <>
                  <strong className="text-slate-900">{lotes.find((l) => l.id === selectedId)?.codigo}</strong>
                  <span className="text-slate-400">·</span>
                  <span>Arraste no mapa para demarcar este lote</span>
                </>
              ) : (
                <span>Selecione um lote na lateral</span>
              )}
            </>
          )}
        </div>
        <div
          ref={viewportRef}
          className="overflow-auto bg-slate-100"
          style={{ maxHeight: 'calc(100vh - 220px)' }}
        >
        <div
          ref={imageRef}
          className="relative select-none"
          style={{ cursor: cursorActive, width: `${zoom * 100}%` }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Planta — SEMPRE renderizada pra fixar o aspect ratio do container.
              Em modo satélite vira invisível mas continua dimensionando o layout.
              Quando modo "arrastar planta" ativo, aplica translate visual — os
              lotes ficam fixos no SVG e a imagem desliza embaixo. */}
          <img
            src={imagemMapa}
            alt="Planta do loteamento"
            className={`w-full block pointer-events-none ${bgMode === 'satelite' ? 'opacity-0' : ''}`}
            draggable={false}
            style={
              plantaShift.x !== 0 || plantaShift.y !== 0
                ? {
                    transform: `translate(${plantaShift.x}%, ${plantaShift.y}%)`,
                    transition: plantaDragRef.current ? 'none' : 'transform 80ms',
                  }
                : undefined
            }
          />
          {/* Satélite — overlay escalado 2.5× sobre a área da planta (igual ao Stand 3D).
              Lotes (SVG abaixo) ocupam exatamente o retângulo onde a planta estava,
              que corresponde ao 40%×24% central do satélite — mesma proporção do 3D. */}
          {bgMode === 'satelite' && sateliteUrl && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img
                src={sateliteUrl}
                alt="Satélite"
                className="absolute"
                style={{
                  top: '50%',
                  left: '50%',
                  width: '250%',
                  transform: 'translate(-50%, -50%)',
                }}
                draggable={false}
              />
              {/* Linha tracejada destacando a área dos lotes (= planta) */}
              <div
                className="absolute inset-0 border-2 border-cyan-400/50 pointer-events-none"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.15)' }}
                title="Área da planta sobre o satélite"
              />
            </div>
          )}

          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            {lotes.map((l) => {
              const posOrig = positions[l.id];
              if (!posOrig) return null;
              // Em modo satélite, aplica a calibração do satélite (apenas visual).
              // Em modo planta, aplica o transformPos da calibração global (que de fato escreve nos lotes).
              const pos = bgMode === 'satelite' ? applySatCalib(posOrig) : transformPos(posOrig);
              const isEditing = editingId === l.id;
              const isSelectedLote = mode === 'lote' && l.id === selectedId;
              const isSelectedQuadra = mode === 'quadra' && l.quadra === selectedQuadra;
              const highlight = isEditing || isSelectedLote || isSelectedQuadra;
              return (
                <g key={l.id}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.w}
                    height={pos.h}
                    className={`${STATUS_FILL[l.status] ?? STATUS_FILL.DISPONIVEL} ${isEditing ? '' : 'cursor-pointer'} pointer-events-auto`}
                    style={{ cursor: isEditing ? 'move' : 'pointer' }}
                    strokeWidth={isEditing ? 0.6 : highlight ? 0.5 : 0.2}
                    strokeDasharray={isEditing ? '0.6 0.3' : undefined}
                    onMouseDown={(e) => onRectMouseDown(e, l.id)}
                  />
                  <text
                    x={pos.x + pos.w / 2}
                    y={pos.y + pos.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(0.5, Math.min(pos.w, pos.h) * 0.35)}
                    fill="white"
                    stroke="black"
                    strokeWidth="0.05"
                    paintOrder="stroke"
                    className="pointer-events-none"
                  >
                    {l.codigo}
                  </text>
                </g>
              );
            })}

            {/* Handles do lote em edição */}
            {editingLote && editingPos && (() => {
              const p = editingPos;
              const cx = p.x + p.w / 2;
              const cy = p.y + p.h / 2;
              const pts: { h: EditHandle; cx: number; cy: number }[] = [
                { h: 'nw', cx: p.x, cy: p.y },
                { h: 'n', cx, cy: p.y },
                { h: 'ne', cx: p.x + p.w, cy: p.y },
                { h: 'e', cx: p.x + p.w, cy },
                { h: 'se', cx: p.x + p.w, cy: p.y + p.h },
                { h: 's', cx, cy: p.y + p.h },
                { h: 'sw', cx: p.x, cy: p.y + p.h },
                { h: 'w', cx: p.x, cy },
              ];
              const size = 0.9;
              return pts.map(({ h, cx, cy }) => (
                <rect
                  key={h}
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  fill="white"
                  stroke="#0284c7"
                  strokeWidth={0.2}
                  className="pointer-events-auto"
                  style={{ cursor: CURSOR_BY_HANDLE[h] }}
                  onMouseDown={(e) => onHandleMouseDown(e, editingLote.id, h)}
                />
              ));
            })()}

            {drawingRect && (
              <>
                {mode === 'quadra' && selectedQuadra && (() => {
                  const cellW = drawingRect.w / cols;
                  const cellH = drawingRect.h / rows;
                  const cells = [];
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                      cells.push(
                        <rect
                          key={`g-${r}-${c}`}
                          x={drawingRect.x + c * cellW}
                          y={drawingRect.y + r * cellH}
                          width={cellW}
                          height={cellH}
                          className="fill-primary-400/20 stroke-primary-500"
                          strokeWidth={0.15}
                        />
                      );
                    }
                  }
                  return cells;
                })()}
                <rect
                  x={drawingRect.x}
                  y={drawingRect.y}
                  width={drawingRect.w}
                  height={drawingRect.h}
                  className="fill-primary-500/15 stroke-primary-600"
                  strokeWidth={0.4}
                  strokeDasharray="0.8 0.5"
                />
              </>
            )}
          </svg>
        </div>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        step={0.1}
        min={0}
        max={100}
        value={Number(value.toFixed(2))}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full text-sm font-mono px-2 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={Number(value.toFixed(2))}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
            className="w-16 text-xs font-mono px-1.5 py-0.5 border border-slate-300 rounded bg-white text-right focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
          />
          <span className="text-[10px] text-slate-500 font-mono w-3">{suffix}</span>
          <button
            type="button"
            onClick={() => onChange(suffix === '%' && label === 'Escala' ? 100 : 0)}
            className="text-slate-400 hover:text-slate-700 text-xs"
            title="Resetar"
          >
            ↺
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-fuchsia-600"
      />
    </div>
  );
}
