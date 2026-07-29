/**
 * Converte o DXF inteiro para SVG estilizado, focando só nas camadas relevantes
 * (lotes, ruas, áreas) — descartando dimensões e blocos de título.
 *
 * Saída: public/mapa-parquetucano-real.svg
 */
import { readFileSync, writeFileSync } from 'fs';
import DxfParser from 'dxf-parser';

const buf = readFileSync('.tmp/planta.dxf', 'utf8');
const dxf = new DxfParser().parseSync(buf);

// Camadas que entram no desenho final
const CAMADAS_DESENHO = new Set([
  'A-AREA-BNDY', // bordas dos lotes/quadras
  'A-DETL', // detalhes (ruas etc)
  'A-DETL-THIN',
  'A-DETL-GENF',
]);

// Calcula bounds apenas das LINEs de A-AREA-BNDY (que são os contornos dos lotes;
// outras camadas têm pontos soltos em (0,0) que distorcem os bounds)
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

function expand(x, y) {
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (y < minY) minY = y;
  if (y > maxY) maxY = y;
}

for (const e of dxf.entities) {
  if (e.layer !== 'A-AREA-BNDY') continue;
  if (e.type === 'LINE') {
    expand(e.vertices[0].x, e.vertices[0].y);
    expand(e.vertices[1].x, e.vertices[1].y);
  } else if (e.type === 'ARC' || e.type === 'CIRCLE') {
    expand(e.center.x - e.radius, e.center.y - e.radius);
    expand(e.center.x + e.radius, e.center.y + e.radius);
  }
}

const W = maxX - minX;
const H = maxY - minY;
const pad = Math.max(W, H) * 0.02;
console.log(`Bounds: X[${minX.toFixed(1)},${maxX.toFixed(1)}]  Y[${minY.toFixed(1)},${maxY.toFixed(1)}]`);
console.log(`Tamanho: ${W.toFixed(1)} x ${H.toFixed(1)}`);

// SVG: queremos Y invertido pra ficar "norte em cima" (no DXF Y+ é norte)
// → usamos transform="scale(1,-1)" + translate pra inverter.

const svgW = 2400;
const svgH = Math.round((H / W) * svgW);

const cmds = [];
// Camada de fundo (preenchimento dos lotes)
cmds.push(`<rect width="100%" height="100%" fill="#fafaf7"/>`);

// LINEs em A-AREA-BNDY (limites)
const lineCmds = [];
const arcCmds = [];
for (const e of dxf.entities) {
  if (!CAMADAS_DESENHO.has(e.layer)) continue;
  if (e.type === 'LINE') {
    const x1 = e.vertices[0].x;
    const y1 = e.vertices[0].y;
    const x2 = e.vertices[1].x;
    const y2 = e.vertices[1].y;
    const stroke = e.layer === 'A-AREA-BNDY' ? '#1e293b' : '#94a3b8';
    const sw = e.layer === 'A-AREA-BNDY' ? 0.15 : 0.1;
    lineCmds.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}"/>`
    );
  } else if (e.type === 'ARC') {
    // ARC: center + radius + startAngle + endAngle (radianos)
    const cx = e.center.x;
    const cy = e.center.y;
    const r = e.radius;
    // dxf-parser dá ângulos em radianos
    const sa = e.startAngle;
    const ea = e.endAngle;
    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);
    let delta = ea - sa;
    while (delta < 0) delta += Math.PI * 2;
    const largeArc = delta > Math.PI ? 1 : 0;
    arcCmds.push(
      `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="#1e293b" stroke-width="0.15" fill="none"/>`
    );
  }
}

// ViewBox em coords DXF
const vbX = minX - pad;
const vbY = minY - pad;
const vbW = W + 2 * pad;
const vbH = H + 2 * pad;

// Wrapper que inverte Y (DXF→SVG)
const inner = [...lineCmds, ...arcCmds].join('\n  ');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX.toFixed(2)} ${(-vbY - vbH).toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}" width="${svgW}" height="${svgH}" preserveAspectRatio="xMidYMid meet">
  <rect x="${vbX.toFixed(2)}" y="${(-vbY - vbH).toFixed(2)}" width="${vbW.toFixed(2)}" height="${vbH.toFixed(2)}" fill="#fafaf7"/>
  <g transform="scale(1,-1)">
  ${inner}
  </g>
</svg>`;

writeFileSync('public/mapa-parquetucano-real.svg', svg);
console.log(`SVG salvo em public/mapa-parquetucano-real.svg`);
console.log(`Dimensões: ${svgW} x ${svgH}, viewBox W=${vbW.toFixed(1)} H=${vbH.toFixed(1)}`);

// Bounds em coords absolutas para os scripts subsequentes
writeFileSync(
  '.tmp/dxf-bounds.json',
  JSON.stringify(
    {
      minX: vbX,
      maxX: vbX + vbW,
      minY: vbY,
      maxY: vbY + vbH,
      svgW,
      svgH,
    },
    null,
    2
  )
);
