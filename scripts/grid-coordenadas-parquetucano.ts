/**
 * Caminho B — atribui coordenadas aproximadas aos 196 lotes do Parque Tucano,
 * distribuídos em grades retangulares por quadra sobre a imagem de fundo.
 *
 * AVISO: as posições NÃO batem 1:1 com a planta real. Servem para o espelho
 * de vendas funcionar visualmente. Para precisão pixel-perfect, use o editor
 * visual em /admin/loteamentos/{id}/mapa.
 *
 * Layout das 7 quadras: cada uma vira um bloco retangular sobre a imagem,
 * com seus lotes em grid interno (cols × rows). Coordenadas em % do viewBox 100×100.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RegiaoQuadra {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cols: number;
  rows: number;
}

// Layout — desenhado para caber no espaço útil da planta real
// (área superior e central da imagem onde de fato existem lotes).
const LAYOUT: Record<string, RegiaoQuadra> = {
  Q1: { x0: 6, y0: 9, x1: 32, y1: 22, cols: 6, rows: 5 }, // 30 lotes
  Q2: { x0: 33, y0: 9, x1: 59, y1: 22, cols: 6, rows: 5 }, // 30 lotes
  Q3: { x0: 60, y0: 9, x1: 84, y1: 14, cols: 11, rows: 1 }, // 11 lotes
  Q4: { x0: 6, y0: 25, x1: 38, y1: 41, cols: 9, rows: 4 }, // 36 lotes
  Q5: { x0: 39, y0: 25, x1: 79, y1: 37, cols: 10, rows: 3 }, // 30 lotes
  Q6: { x0: 6, y0: 44, x1: 50, y1: 60, cols: 11, rows: 4 }, // 43 lotes (sobra 1 ao final)
  Q7: { x0: 51, y0: 44, x1: 81, y1: 51, cols: 8, rows: 2 }, // 16 lotes
};

const GAP = 0.3; // % de espaçamento entre lotes

async function main() {
  const lotes = await prisma.lote.findMany({
    where: { loteamento: { slug: 'parquetucano' } },
    orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
    select: { id: true, quadra: true, numero: true, codigo: true },
  });

  console.log(`📍 Aplicando grid em ${lotes.length} lotes`);

  // Agrupa por quadra mantendo a ordem do número
  const porQuadra = new Map<string, typeof lotes>();
  for (const l of lotes) {
    if (!porQuadra.has(l.quadra)) porQuadra.set(l.quadra, []);
    porQuadra.get(l.quadra)!.push(l);
  }

  let atualizados = 0;
  for (const [quadra, lotesQuadra] of porQuadra) {
    const reg = LAYOUT[quadra];
    if (!reg) {
      console.warn(`   [skip] Quadra ${quadra} sem layout definido`);
      continue;
    }

    const w = (reg.x1 - reg.x0) / reg.cols;
    const h = (reg.y1 - reg.y0) / reg.rows;
    const capacidade = reg.cols * reg.rows;

    console.log(
      `   ${quadra}: ${lotesQuadra.length} lotes em grid ${reg.cols}×${reg.rows} ` +
      `(capacidade ${capacidade})`
    );

    for (let i = 0; i < lotesQuadra.length; i++) {
      if (i >= capacidade) {
        console.warn(`     ⚠ Lote ${lotesQuadra[i].codigo} sobrou (capacidade excedida)`);
        continue;
      }
      const col = i % reg.cols;
      const row = Math.floor(i / reg.cols);
      const mapaX = reg.x0 + col * w + GAP / 2;
      const mapaY = reg.y0 + row * h + GAP / 2;
      const mapaLargura = w - GAP;
      const mapaAltura = h - GAP;

      await prisma.lote.update({
        where: { id: lotesQuadra[i].id },
        data: {
          mapaX,
          mapaY,
          mapaLargura,
          mapaAltura,
        },
      });
      atualizados++;
    }
  }

  console.log(`✅ ${atualizados} coordenadas aplicadas`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
