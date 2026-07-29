/**
 * Extrai todos os lotes do DXF:
 *   - Cada lote tem 2 MTEXTs em A-AREA-IDEN: um com o número (ex "42")
 *     e outro com a área (ex "175,00 m²"), com coordenadas muito próximas.
 *   - Agrupa os pares por proximidade espacial.
 *   - Gera JSON com {numero, area_m2, x, y} (centroide entre os dois).
 *   - Calcula bounding box de cada lote estimado por:
 *       lado ≈ sqrt(area), com orientação derivada do vetor entre os textos.
 *
 * Saída: .tmp/lotes-dxf.json + .tmp/lotes-dxf.csv
 */
import { readFileSync, writeFileSync } from 'fs';
import DxfParser from 'dxf-parser';

const file = process.argv[2] || '.tmp/planta.dxf';
const buf = readFileSync(file, 'utf8');
const parser = new DxfParser();
const dxf = parser.parseSync(buf);

// =============================================================
// 1. Filtrar MTEXTs de A-AREA-IDEN e limpar RTF
// =============================================================

function cleanRTF(s) {
  if (!s) return '';
  // \fArial|b1|i0|c0|p34;TEXTO → TEXTO
  let r = s.replace(/\\f[^;]+;/g, '');
  r = r.replace(/\\[A-Za-z]+\s*/g, '');
  r = r.replace(/[{}]/g, '');
  r = r.replace(/\\P/g, ' ');
  return r.trim();
}

const textos = (dxf.entities || [])
  .filter((e) => e.layer === 'A-AREA-IDEN' && (e.type === 'MTEXT' || e.type === 'TEXT'))
  .map((e) => ({
    raw: e.text || '',
    text: cleanRTF(e.text || ''),
    x: e.position?.x ?? e.startPoint?.x ?? 0,
    y: e.position?.y ?? e.startPoint?.y ?? 0,
  }))
  .filter((t) => t.text.length > 0);

console.log(`Total MTEXTs em A-AREA-IDEN: ${textos.length}`);

// =============================================================
// 2. Classificar: area, numero, quadra (letra A-Z)
// =============================================================

const areas = []; // {text, valor_m2, x, y}
const numeros = []; // {text, valor, x, y}
const quadrasLetra = []; // {text, x, y}

for (const t of textos) {
  // Área: contém "m²" ou "m2"
  const matchArea = t.text.match(/(\d+[\.,]?\d*)\s*m[²2]/i);
  if (matchArea) {
    areas.push({
      ...t,
      valor_m2: parseFloat(matchArea[1].replace(',', '.')),
    });
    continue;
  }
  // Número de lote: só dígitos, possível ponto
  const matchNum = t.text.match(/^(\d{1,3})$/);
  if (matchNum) {
    numeros.push({ ...t, valor: parseInt(matchNum[1], 10) });
    continue;
  }
  // Letra de quadra (1 char A-Z)
  if (/^[A-Z]$/.test(t.text)) {
    quadrasLetra.push(t);
    continue;
  }
}

console.log(`Áreas detectadas: ${areas.length}`);
console.log(`Números detectados: ${numeros.length}`);
console.log(`Letras de quadra: ${quadrasLetra.length}`);

// =============================================================
// 3. Emparelhar cada número com a área mais próxima
// =============================================================

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

const usedAreas = new Set();
const pares = [];

for (const num of numeros) {
  let melhor = -1;
  let melhorDist = Infinity;
  for (let i = 0; i < areas.length; i++) {
    if (usedAreas.has(i)) continue;
    const d = dist2(num, areas[i]);
    if (d < melhorDist) {
      melhorDist = d;
      melhor = i;
    }
  }
  if (melhor >= 0 && melhorDist < 25 /* aprox 5m */) {
    usedAreas.add(melhor);
    const a = areas[melhor];
    pares.push({
      numero: num.valor,
      area_m2: a.valor_m2,
      // Centro do lote = média entre número e área
      x: (num.x + a.x) / 2,
      y: (num.y + a.y) / 2,
      // Vetor numero→area (dá orientação do lote)
      dx: a.x - num.x,
      dy: a.y - num.y,
      x_num: num.x,
      y_num: num.y,
      x_area: a.x,
      y_area: a.y,
    });
  }
}

console.log(`Pares emparelhados: ${pares.length}`);

// =============================================================
// 4. Calcular bounding box de cada lote
//    Aproximação: lote retangular orientado em paralelo aos eixos
//    com lado = sqrt(area) e aspect derivado do vetor entre textos
// =============================================================

const lotes = pares.map((p) => {
  const lado = Math.sqrt(p.area_m2);
  // Se o vetor entre os textos é mais horizontal, lote é mais largo
  const aspectFator = Math.abs(p.dx) > Math.abs(p.dy) ? 1.8 : 0.55;
  const w = lado * aspectFator;
  const h = lado / aspectFator;
  return {
    numero: p.numero,
    area_m2: p.area_m2,
    centro_x: p.x,
    centro_y: p.y,
    bbox_w: w,
    bbox_h: h,
    bbox_x_min: p.x - w / 2,
    bbox_y_min: p.y - h / 2,
    bbox_x_max: p.x + w / 2,
    bbox_y_max: p.y + h / 2,
  };
});

// Ordena por número
lotes.sort((a, b) => a.numero - b.numero);

// =============================================================
// 5. Salvar
// =============================================================

writeFileSync('.tmp/lotes-dxf.json', JSON.stringify(lotes, null, 2));

const csv = [
  'numero,area_m2,centro_x,centro_y,bbox_w,bbox_h',
  ...lotes.map(
    (l) =>
      `${l.numero},${l.area_m2.toFixed(2)},${l.centro_x.toFixed(2)},${l.centro_y.toFixed(2)},${l.bbox_w.toFixed(2)},${l.bbox_h.toFixed(2)}`
  ),
].join('\n');
writeFileSync('.tmp/lotes-dxf.csv', csv);

// =============================================================
// 6. Estatísticas
// =============================================================

console.log('\n=== Estatísticas ===');
const xs = lotes.map((l) => l.centro_x);
const ys = lotes.map((l) => l.centro_y);
console.log(`X: [${Math.min(...xs).toFixed(1)}, ${Math.max(...xs).toFixed(1)}]`);
console.log(`Y: [${Math.min(...ys).toFixed(1)}, ${Math.max(...ys).toFixed(1)}]`);
console.log(`Primeiro: lote ${lotes[0].numero} (área ${lotes[0].area_m2}m²)`);
console.log(`Último:   lote ${lotes[lotes.length - 1].numero} (área ${lotes[lotes.length - 1].area_m2}m²)`);
console.log(`Salvo em .tmp/lotes-dxf.json (${lotes.length} lotes)`);
