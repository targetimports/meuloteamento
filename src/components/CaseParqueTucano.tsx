/**
 * Case real Parque Tucano — server component que busca os 221 lotes REAIS
 * do banco e passa pro client que renderiza igualzinho ao site público.
 *
 * Se algo falhar (banco off, loteamento removido), cai num placeholder.
 */

import { prisma } from '@/lib/prisma';
import { CaseParqueTucanoMap, type LoteCaseUI } from './CaseParqueTucanoMap';

export async function CaseParqueTucano() {
  // Busca lotes reais com posição mapeada, e algumas estatísticas
  let lotes: LoteCaseUI[] = [];
  let stats = { total: 221, disponivel: 0, reservado: 0, em_pag: 0, vendido: 0 };
  let imagemMapa = '/mapa-parquetucano-real.png';

  try {
    const loteamento = await prisma.loteamento.findUnique({
      where: { slug: 'parquetucano' },
      select: {
        imagemMapa: true,
        lotes: {
          where: {
            mapaX: { not: null },
            mapaY: { not: null },
          },
          select: {
            id: true,
            codigo: true,
            quadra: true,
            area: true,
            preco: true,
            status: true,
            tipo: true,
            mapaX: true,
            mapaY: true,
            mapaLargura: true,
            mapaAltura: true,
          },
        },
      },
    });

    if (loteamento) {
      imagemMapa = loteamento.imagemMapa ?? imagemMapa;
      lotes = loteamento.lotes
        .filter(
          (l) =>
            l.mapaX !== null &&
            l.mapaY !== null &&
            l.mapaLargura !== null &&
            l.mapaAltura !== null,
        )
        .map((l) => ({
          id: l.id,
          codigo: l.codigo,
          quadra: l.quadra,
          area: Number(l.area),
          preco: Number(l.preco),
          status: l.status,
          tipo: l.tipo,
          x: l.mapaX as number,
          y: l.mapaY as number,
          w: l.mapaLargura as number,
          h: l.mapaAltura as number,
        }));

      stats = {
        total: lotes.length,
        disponivel: lotes.filter((l) => l.status === 'DISPONIVEL').length,
        reservado: lotes.filter((l) => l.status === 'RESERVADO').length,
        em_pag: lotes.filter((l) => l.status === 'EM_PAGAMENTO').length,
        vendido: lotes.filter((l) => l.status === 'VENDIDO').length,
      };
    }
  } catch (e) {
    // Banco off ou erro — mostra com lotes vazios mas não quebra
    console.warn('[CaseParqueTucano] falha ao buscar lotes:', e);
  }

  return (
    <CaseParqueTucanoMap
      imagemMapa={imagemMapa}
      lotes={lotes}
      stats={stats}
    />
  );
}
