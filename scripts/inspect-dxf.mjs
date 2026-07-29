/**
 * Inspeciona DXF: lista MTEXTs da camada A-AREA-IDEN para entender numeração,
 * estatísticas das LINEs e ARCs da camada A-AREA-BNDY.
 */
import { readFileSync } from 'fs';
import DxfParser from 'dxf-parser';

const file = process.argv[2] || '.tmp/planta.dxf';
const buf = readFileSync(file, 'utf8');
const parser = new DxfParser();
const dxf = parser.parseSync(buf);

const ents = dxf.entities || [];
console.log('Total entidades:', ents.length);

const byLayer = {};
for (const e of ents) {
  const k = `${e.layer ?? '?'} | ${e.type}`;
  byLayer[k] = (byLayer[k] ?? 0) + 1;
}
console.log('\n=== Entidades por (layer | tipo) ===');
Object.entries(byLayer)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`${v.toString().padStart(5)}  ${k}`));

// MTEXTs / TEXTs em A-AREA-IDEN
const textosIden = ents.filter(
  (e) => e.layer === 'A-AREA-IDEN' && (e.type === 'MTEXT' || e.type === 'TEXT')
);
console.log(`\n=== ${textosIden.length} textos em A-AREA-IDEN ===`);
console.log('Amostra (primeiros 30):');
for (const t of textosIden.slice(0, 30)) {
  const txt = (t.text || '').replace(/\n/g, ' ').replace(/\\P/g, ' ').slice(0, 60);
  const x = t.position?.x ?? t.startPoint?.x ?? '?';
  const y = t.position?.y ?? t.startPoint?.y ?? '?';
  console.log(`  [${t.type}] x=${typeof x === 'number' ? x.toFixed(1) : x}, y=${typeof y === 'number' ? y.toFixed(1) : y}  "${txt}"`);
}

// LINEs / ARCs em A-AREA-BNDY — bounds
const bndy = ents.filter((e) => e.layer === 'A-AREA-BNDY');
console.log(`\n=== ${bndy.length} entidades em A-AREA-BNDY ===`);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const e of bndy) {
  if (e.type === 'LINE') {
    minX = Math.min(minX, e.vertices[0].x, e.vertices[1].x);
    maxX = Math.max(maxX, e.vertices[0].x, e.vertices[1].x);
    minY = Math.min(minY, e.vertices[0].y, e.vertices[1].y);
    maxY = Math.max(maxY, e.vertices[0].y, e.vertices[1].y);
  } else if (e.type === 'ARC') {
    minX = Math.min(minX, e.center.x - e.radius);
    maxX = Math.max(maxX, e.center.x + e.radius);
    minY = Math.min(minY, e.center.y - e.radius);
    maxY = Math.max(maxY, e.center.y + e.radius);
  }
}
console.log(`Bounds: x=[${minX.toFixed(1)}, ${maxX.toFixed(1)}]  y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);
console.log(`Tamanho: ${(maxX - minX).toFixed(1)} x ${(maxY - minY).toFixed(1)}`);

// Primeiras 5 LINEs com detalhe
console.log('\nAmostra de LINEs:');
for (const e of bndy.filter((e) => e.type === 'LINE').slice(0, 5)) {
  console.log(
    `  LINE (${e.vertices[0].x.toFixed(2)}, ${e.vertices[0].y.toFixed(2)}) → (${e.vertices[1].x.toFixed(2)}, ${e.vertices[1].y.toFixed(2)})`
  );
}

// INSERTs em A-AREA-IDEN (provável bloco do número da QUADRA)
const inserts = ents.filter((e) => e.layer === 'A-AREA-IDEN' && e.type === 'INSERT');
console.log(`\n=== ${inserts.length} INSERTs em A-AREA-IDEN ===`);
console.log('Amostra dos blocos referenciados:');
const nomes = new Set();
for (const i of inserts) nomes.add(i.name);
console.log('Blocos únicos:', Array.from(nomes).slice(0, 20).join(', '));
