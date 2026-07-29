/**
 * Analisa o JSON gerado por extract-dxf-lotes.mjs:
 *   - Quais números existem e quais faltam (gaps)
 *   - Atribui quadras a partir das letras detectadas no DXF
 *     (cada quadra = letra MTEXT cuja posição está próxima a um cluster de lotes)
 */
import { readFileSync, writeFileSync } from 'fs';
import DxfParser from 'dxf-parser';

const lotes = JSON.parse(readFileSync('.tmp/lotes-dxf.json', 'utf8'));
console.log(`${lotes.length} lotes carregados`);

// Quais números aparecem?
const nums = new Set(lotes.map((l) => l.numero));
const max = Math.max(...nums);
const min = Math.min(...nums);
const gaps = [];
for (let i = min; i <= max; i++) if (!nums.has(i)) gaps.push(i);
console.log(`Range: ${min}–${max}, gaps: ${gaps.length === 0 ? 'nenhum' : gaps.join(', ')}`);

// Re-parsear DXF pra pegar as LETRAS de quadra
function cleanRTF(s) {
  if (!s) return '';
  let r = s.replace(/\\f[^;]+;/g, '');
  r = r.replace(/\\[A-Za-z]+\s*/g, '');
  r = r.replace(/[{}]/g, '');
  r = r.replace(/\\P/g, ' ');
  return r.trim();
}

const dxf = new DxfParser().parseSync(readFileSync('.tmp/planta.dxf', 'utf8'));
const letras = dxf.entities
  .filter((e) => e.layer === 'A-AREA-IDEN' && (e.type === 'MTEXT' || e.type === 'TEXT'))
  .map((e) => ({
    text: cleanRTF(e.text || ''),
    x: e.position?.x ?? 0,
    y: e.position?.y ?? 0,
  }))
  .filter((t) => /^[A-Z]$/.test(t.text));

console.log(`\nLetras de quadra: ${letras.length}`);
letras
  .sort((a, b) => a.text.localeCompare(b.text))
  .forEach((q) => console.log(`  Quadra ${q.text}: x=${q.x.toFixed(1)}, y=${q.y.toFixed(1)}`));

// Para cada lote, atribuir quadra = letra mais próxima
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const lotesComQuadra = lotes.map((l) => {
  let melhor = null;
  let melhorD = Infinity;
  for (const q of letras) {
    const d = dist({ x: l.centro_x, y: l.centro_y }, q);
    if (d < melhorD) {
      melhorD = d;
      melhor = q.text;
    }
  }
  return { ...l, quadra: melhor };
});

// Distribuição por quadra
const porQuadra = {};
for (const l of lotesComQuadra) {
  porQuadra[l.quadra] = (porQuadra[l.quadra] ?? 0) + 1;
}
console.log('\nDistribuição por quadra:');
Object.entries(porQuadra)
  .sort()
  .forEach(([q, c]) => console.log(`  ${q}: ${c} lotes`));

writeFileSync('.tmp/lotes-dxf.json', JSON.stringify(lotesComQuadra, null, 2));
console.log(`\nSalvo .tmp/lotes-dxf.json com quadra atribuída.`);

// Primeiros lotes de cada quadra (verificação)
console.log('\nAmostra (3 primeiros de cada quadra):');
for (const q of Object.keys(porQuadra).sort()) {
  const sub = lotesComQuadra
    .filter((l) => l.quadra === q)
    .sort((a, b) => a.numero - b.numero)
    .slice(0, 3);
  console.log(
    `  ${q}: ${sub.map((l) => `${l.numero}(${l.area_m2}m²)`).join(', ')}${
      porQuadra[q] > 3 ? ', ...' : ''
    }`
  );
}
