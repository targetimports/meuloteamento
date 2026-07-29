/**
 * Importa lotes do mapa vetorizado SVG para o loteamento Parque Tucano.
 *
 * Estratégia:
 *   1. Parse de <rect class="lot" ...> do SVG
 *   2. Agrupa por coluna X (quadra A=280, B=480, C=680, D=880, E=1080, F=1280)
 *   3. Numera dentro de cada quadra de cima para baixo (1..N)
 *   4. Converte x,y,w,h do viewBox 1800x1200 para porcentagem (0..100)
 *   5. Upsert no banco — preserva status atual do lote se já existir
 *
 * Uso: npx tsx scripts/importar-mapa-parquetucano.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SVG_PATH = path.resolve('public/mapa-parquetucano.svg');
const SLUG = 'parquetucano';

// Mapping coluna X -> quadra letter
const QUADRA_POR_COLUNA: Record<number, string> = {
  280: 'A',
  480: 'B',
  680: 'C',
  880: 'D',
  1080: 'E',
  1280: 'F',
};

// ViewBox do SVG fornecido
const VB_W = 1800;
const VB_H = 1200;

// Preço base por m² para o cálculo automático (configurável depois)
const AREA_LOTE_M2 = 200; // todos os lotes são 200m² no SVG esquemático
const PRECO_BASE = 95000; // R$ 95.000 por lote (~ R$ 475/m²)

interface RectLot {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function main() {
  console.log('📍 Lendo SVG:', SVG_PATH);
  const svg = await fs.readFile(SVG_PATH, 'utf8');

  // Regex robusto para <rect class="lot" x="..." y="..." width="..." height="..." />
  const rectRegex =
    /<rect\s+class="lot"\s+x="(\d+(?:\.\d+)?)"\s+y="(\d+(?:\.\d+)?)"\s+width="(\d+(?:\.\d+)?)"\s+height="(\d+(?:\.\d+)?)"\s*\/?>/g;

  const rects: RectLot[] = [];
  let m: RegExpExecArray | null;
  while ((m = rectRegex.exec(svg)) !== null) {
    rects.push({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
      w: parseFloat(m[3]),
      h: parseFloat(m[4]),
    });
  }
  console.log(`   ${rects.length} rect.lot encontrados no SVG`);

  // Agrupa por coluna X
  const porQuadra = new Map<string, RectLot[]>();
  for (const r of rects) {
    const quadra = QUADRA_POR_COLUNA[r.x];
    if (!quadra) {
      console.warn(`   [skip] rect em x=${r.x} fora das colunas conhecidas`);
      continue;
    }
    if (!porQuadra.has(quadra)) porQuadra.set(quadra, []);
    porQuadra.get(quadra)!.push(r);
  }

  // Ordena dentro de cada quadra por Y (cima → baixo) e numera 1..N
  const loteamento = await prisma.loteamento.findUnique({
    where: { slug: SLUG },
    select: { id: true, nome: true },
  });
  if (!loteamento) {
    throw new Error(`Loteamento "${SLUG}" não encontrado no banco. Cadastre primeiro.`);
  }
  console.log(`📦 Loteamento alvo: ${loteamento.nome} (${loteamento.id})`);

  let criados = 0;
  let atualizados = 0;

  for (const [quadra, lotes] of porQuadra) {
    lotes.sort((a, b) => a.y - b.y);
    console.log(`   Quadra ${quadra}: ${lotes.length} lotes`);

    for (let i = 0; i < lotes.length; i++) {
      const r = lotes[i];
      const numero = String(i + 1).padStart(2, '0');
      const codigo = `${quadra}${numero}`;

      const mapaX = (r.x / VB_W) * 100;
      const mapaY = (r.y / VB_H) * 100;
      const mapaLargura = (r.w / VB_W) * 100;
      const mapaAltura = (r.h / VB_H) * 100;

      // Existe já? preserva status, atualiza apenas geometria + área + preço
      const existente = await prisma.lote.findFirst({
        where: { loteamentoId: loteamento.id, codigo },
        select: { id: true, status: true },
      });

      if (existente) {
        await prisma.lote.update({
          where: { id: existente.id },
          data: {
            quadra,
            numero,
            area: AREA_LOTE_M2,
            preco: PRECO_BASE,
            mapaX,
            mapaY,
            mapaLargura,
            mapaAltura,
          },
        });
        atualizados++;
      } else {
        await prisma.lote.create({
          data: {
            loteamentoId: loteamento.id,
            codigo,
            quadra,
            numero,
            area: AREA_LOTE_M2,
            preco: PRECO_BASE,
            status: 'DISPONIVEL',
            mapaX,
            mapaY,
            mapaLargura,
            mapaAltura,
          },
        });
        criados++;
      }
    }
  }

  console.log(`✅ ${criados} criados, ${atualizados} atualizados.`);

  // Atualiza o campo imagemMapa do loteamento se quisermos usar o SVG
  // (vamos converter para PNG num próximo passo)
  await prisma.loteamento.update({
    where: { id: loteamento.id },
    data: { imagemMapa: '/mapa-parquetucano.png' },
  });
  console.log(`🖼  imagemMapa setado em '/mapa-parquetucano.png'`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e);
  prisma.$disconnect();
  process.exit(1);
});
