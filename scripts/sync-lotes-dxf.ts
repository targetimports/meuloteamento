/**
 * Sincroniza os 220 lotes extraídos do DXF para o banco.
 *
 * Pipeline:
 *   1. Lê .tmp/lotes-dxf.json (gerado por extract-dxf-lotes + analisar-lotes-dxf)
 *   2. Lê .tmp/dxf-bounds.json (bounds do SVG)
 *   3. Para cada lote, converte centro DXF → coordenadas % do SVG (Y invertido)
 *   4. Apaga TODOS os lotes sem venda
 *   5. Cria os 220 novos com área exata, quadra, e bbox %
 *   6. Atualiza imagemMapa do loteamento pra apontar pro SVG novo
 *
 * Uso na VPS:
 *   cd /var/www/meuloteamento && npx tsx scripts/sync-lotes-dxf.ts
 */

import { promises as fs } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SLUG = 'parquetucano';
const PRECO_PADRAO = 55000;

interface LoteDxf {
  numero: number;
  area_m2: number;
  centro_x: number;
  centro_y: number;
  bbox_w: number;
  bbox_h: number;
  bbox_x_min: number;
  bbox_y_min: number;
  bbox_x_max: number;
  bbox_y_max: number;
  quadra: string | null;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  svgW: number;
  svgH: number;
}

async function main() {
  const lotes: LoteDxf[] = JSON.parse(await fs.readFile('.tmp/lotes-dxf.json', 'utf8'));
  const bounds: Bounds = JSON.parse(await fs.readFile('.tmp/dxf-bounds.json', 'utf8'));
  console.log(`📦 ${lotes.length} lotes lidos do DXF`);

  const VBW = bounds.maxX - bounds.minX;
  const VBH = bounds.maxY - bounds.minY;

  const loteamento = await prisma.loteamento.findUnique({
    where: { slug: SLUG },
    select: { id: true, nome: true },
  });
  if (!loteamento) throw new Error(`Loteamento "${SLUG}" não encontrado.`);
  console.log(`🏘  Alvo: ${loteamento.nome}`);

  // 1. Apaga TUDO que não tem venda
  const apagados = await prisma.lote.deleteMany({
    where: {
      loteamentoId: loteamento.id,
      vendas: { none: {} },
    },
  });
  console.log(`🗑  ${apagados.count} lotes apagados`);

  // 2. Insere os 220 novos com coordenadas %
  let criados = 0;
  for (const l of lotes) {
    // Converte DXF (Y+=norte, ~234 unidades) → % do SVG (Y+=sul, 0..100)
    // mapaX% = (x - minX) / VBW * 100
    // mapaY% = (maxY - y) / VBH * 100   ← Y invertido
    const mapaX = ((l.bbox_x_min - bounds.minX) / VBW) * 100;
    const mapaY = ((bounds.maxY - l.bbox_y_max) / VBH) * 100;
    const mapaLargura = (l.bbox_w / VBW) * 100;
    const mapaAltura = (l.bbox_h / VBH) * 100;

    const quadra = l.quadra ?? 'Z';
    const codigo = `L${String(l.numero).padStart(3, '0')}`;

    await prisma.lote.create({
      data: {
        loteamentoId: loteamento.id,
        codigo,
        quadra,
        numero: String(l.numero).padStart(3, '0'),
        area: l.area_m2,
        preco: PRECO_PADRAO,
        status: 'DISPONIVEL',
        mapaX,
        mapaY,
        mapaLargura,
        mapaAltura,
      },
    });
    criados++;
  }
  console.log(`✅ ${criados} lotes criados`);

  // 3. Atualiza imagem do mapa
  await prisma.loteamento.update({
    where: { id: loteamento.id },
    data: { imagemMapa: '/mapa-parquetucano-real.svg' },
  });
  console.log(`🖼  imagemMapa setado para SVG vetorial real`);

  // 4. Resumo
  const grouped = lotes.reduce<Record<string, number>>((acc, l) => {
    const q = l.quadra ?? '?';
    acc[q] = (acc[q] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\n📊 Por quadra:', grouped);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
