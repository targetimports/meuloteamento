/**
 * Importa os 196 lotes REAIS do Parque Tucano com áreas exatas
 * extraídas via OCR/vision do PDF `mapeamento_lotes_quadras_legivel.pdf`.
 *
 * Convenção:
 *   - código = "L###" (ex: L001, L042, L219) — preserva o número do PDF original
 *   - quadra = agrupamento por faixa de numeração:
 *       Q1 = 1-30, Q2 = 31-60, Q3 = 72-82,
 *       Q4 = 95-130, Q5 = 131-160, Q6 = 161-203, Q7 = 204-219
 *   - número = mesmo do PDF, preservado ("001" .. "219")
 *   - área = exatamente como lida na tabela do PDF
 *   - preço = R$ 55.000 (default residencial; o user ajusta no admin se quiser)
 *
 * Os 196 lotes substituem os 78 do SVG esquemático anterior.
 * Status: todos DISPONIVEL — o user marca VENDIDO manualmente no admin.
 * Coordenadas mapaX/Y: NULL — não foi possível mapear automaticamente
 * (PDFs são raster, não vetor); o user mapeia no editor visual do admin.
 *
 * Uso na VPS:
 *   cd /var/www/meuloteamento && npx tsx scripts/importar-lotes-reais-parquetucano.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'parquetucano';
const PRECO_PADRAO = 55000;

// Lista exata, lida via vision do PDF (4 fatias da tabela)
// Formato: [numero, area_m2]
const LOTES: [number, number][] = [
  [1, 295.82],
  [2, 160.0],
  [3, 160.0],
  [4, 160.0],
  [5, 200.0],
  [6, 200.0],
  [7, 152.0],
  [8, 152.0],
  [9, 161.5],
  [10, 161.5],
  [11, 161.5],
  [12, 161.5],
  [13, 200.0],
  [14, 200.0],
  [15, 200.0],
  [16, 200.0],
  [17, 152.0],
  [18, 152.0],
  [19, 161.5],
  [20, 161.5],
  [21, 161.5],
  [22, 161.5],
  [23, 200.0],
  [24, 200.0],
  [25, 200.0],
  [26, 200.0],
  [27, 152.0],
  [28, 152.0],
  [29, 161.5],
  [30, 161.5],
  [31, 161.5],
  [32, 161.5],
  [33, 200.0],
  [34, 200.0],
  [35, 144.0],
  [36, 144.0],
  [37, 152.0],
  [38, 152.0],
  [39, 152.0],
  [40, 152.0],
  [41, 152.0],
  [42, 149.77],
  [43, 218.16],
  [44, 189.45],
  [45, 130.31],
  [46, 224.9],
  [47, 225.0],
  [48, 225.0],
  [49, 225.0],
  [50, 189.2],
  [51, 189.2],
  [52, 212.85],
  [53, 410.94],
  [54, 412.56],
  [55, 302.28],
  [56, 296.16],
  [57, 290.04],
  [58, 283.79],
  [59, 133.18],
  [60, 141.73],
  // 61-71 não existem (área institucional/verde)
  [72, 160.0],
  [73, 160.0],
  [74, 160.0],
  [75, 160.0],
  [76, 160.0],
  [77, 160.0],
  [78, 160.0],
  [79, 160.0],
  [80, 160.0],
  [81, 160.0],
  [82, 160.0],
  // 83-94 não existem
  [95, 136.0],
  [96, 136.0],
  [97, 136.0],
  [98, 136.0],
  [99, 136.0],
  [100, 136.0],
  [101, 136.0],
  [102, 136.0],
  [103, 136.0],
  [104, 136.0],
  [105, 136.0],
  [106, 136.0],
  [107, 170.0],
  [108, 170.0],
  [109, 170.0],
  [110, 170.0],
  [111, 136.0],
  [112, 136.0],
  [113, 136.0],
  [114, 136.0],
  [115, 136.0],
  [116, 136.0],
  [117, 136.0],
  [118, 136.0],
  [119, 136.0],
  [120, 136.0],
  [121, 136.0],
  [122, 136.0],
  [123, 126.41],
  [124, 129.27],
  [125, 127.52],
  [126, 136.0],
  [127, 136.0],
  [128, 136.0],
  [129, 136.0],
  [130, 136.0],
  [131, 136.0],
  [132, 136.0],
  [133, 136.0],
  [134, 136.0],
  [135, 136.0],
  [136, 136.0],
  [137, 170.0],
  [138, 170.0],
  [139, 170.0],
  [140, 170.0],
  [141, 136.0],
  [142, 136.0],
  [143, 136.0],
  [144, 136.0],
  [145, 136.0],
  [146, 136.0],
  [147, 136.0],
  [148, 136.0],
  [149, 136.0],
  [150, 136.0],
  [151, 136.0],
  [152, 162.51],
  [153, 142.99],
  [154, 133.73],
  [155, 136.0],
  [156, 136.0],
  [157, 136.0],
  [158, 136.0],
  [159, 136.0],
  [160, 136.0],
  [161, 136.0],
  [162, 136.0],
  [163, 136.0],
  [164, 136.0],
  [165, 170.0],
  [166, 170.0],
  [167, 170.0],
  [168, 170.0],
  [169, 136.0],
  [170, 136.0],
  [171, 136.0],
  [172, 136.0],
  [173, 136.0],
  [174, 136.0],
  [175, 136.0],
  [176, 136.0],
  [177, 136.0],
  [178, 136.0],
  [179, 173.32],
  [180, 153.81],
  [181, 145.53],
  [182, 129.31],
  [183, 129.31],
  [184, 129.31],
  [185, 129.31],
  [186, 129.31],
  [187, 129.31],
  [188, 129.31],
  [189, 129.31],
  [190, 129.25],
  [191, 132.08],
  [192, 130.78],
  [193, 139.62],
  [194, 140.0],
  [195, 129.2],
  [196, 129.2],
  [197, 129.2],
  [198, 129.2],
  [199, 129.2],
  [200, 129.2],
  [201, 129.2],
  [202, 129.2],
  [203, 129.2],
  [204, 184.14],
  [205, 164.62],
  [206, 133.57],
  [207, 178.18],
  [208, 144.64],
  [209, 185.89],
  [210, 230.68],
  [211, 160.0],
  [212, 160.0],
  [213, 160.0],
  [214, 160.0],
  [215, 160.0],
  [216, 160.0],
  [217, 160.0],
  [218, 160.0],
  [219, 160.0],
];

function quadraDoLote(n: number): string {
  if (n <= 30) return 'Q1';
  if (n <= 60) return 'Q2';
  if (n <= 82) return 'Q3';
  if (n <= 130) return 'Q4';
  if (n <= 160) return 'Q5';
  if (n <= 203) return 'Q6';
  return 'Q7';
}

async function main() {
  const loteamento = await prisma.loteamento.findUnique({
    where: { slug: SLUG },
    select: { id: true, nome: true },
  });
  if (!loteamento) throw new Error(`Loteamento "${SLUG}" não encontrado.`);
  console.log(`📦 Loteamento: ${loteamento.nome} (${loteamento.id})`);

  // 1. Apagar TODOS os lotes do parque tucano que não têm venda
  const antes = await prisma.lote.count({ where: { loteamentoId: loteamento.id } });
  console.log(`   ${antes} lotes atuais (serão substituídos)`);

  const apagados = await prisma.lote.deleteMany({
    where: {
      loteamentoId: loteamento.id,
      vendas: { none: {} },
    },
  });
  console.log(`   ${apagados.count} lotes deletados`);

  // 2. Inserir os 196 novos com áreas exatas
  let criados = 0;
  for (const [numero, area] of LOTES) {
    const quadra = quadraDoLote(numero);
    const codigo = `L${String(numero).padStart(3, '0')}`;
    await prisma.lote.create({
      data: {
        loteamentoId: loteamento.id,
        codigo,
        quadra,
        numero: String(numero).padStart(3, '0'),
        area,
        preco: PRECO_PADRAO,
        status: 'DISPONIVEL',
        // mapaX/Y deixados null — usuário mapeia no editor visual do admin
      },
    });
    criados++;
  }
  console.log(`✅ ${criados} lotes criados.`);

  // 3. Atualiza imagem de fundo do mapa
  await prisma.loteamento.update({
    where: { id: loteamento.id },
    data: { imagemMapa: '/mapa-parquetucano-real.png' },
  });
  console.log(`🖼  imagemMapa setado para '/mapa-parquetucano-real.png'`);

  // Resumo por quadra
  const grouped = LOTES.reduce<Record<string, number>>((acc, [n]) => {
    const q = quadraDoLote(n);
    acc[q] = (acc[q] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n📊 Distribuição por quadra:`, grouped);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
