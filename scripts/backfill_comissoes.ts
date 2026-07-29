/**
 * BACKFILL: corrige comissão das vendas residenciais já lançadas.
 *
 *   - Para cada Venda com corretor + ao menos 1 lote RESIDENCIAL:
 *       1. Recalcula comissaoValor (R$2500/lote residencial + % se houver comercial)
 *       2. Cria as 4 ComissaoParcela (se ainda não existem)
 *       3. Vincula às parcelas certas (entrada + 3 primeiras mensais)
 *       4. Se a parcela vinculada já está PAGA → comissão já nasce LIBERADA
 *       5. Vendas CANCELADA/DISTRATADA → comissões nascem CANCELADA
 *
 * Rodar:
 *   npx tsx scripts/backfill_comissoes.ts          # dry-run (não modifica)
 *   npx tsx scripts/backfill_comissoes.ts --apply  # aplica de fato
 */

import { PrismaClient } from '@prisma/client';
import {
  calcularComissaoVenda,
  dividirEmParcelasIguais,
  escolherParcelasAncora,
  COMISSAO_NUMERO_PARCELAS,
} from '../src/lib/comissao';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(
    `${APPLY ? '🔴 APPLY MODE' : '🟡 DRY-RUN'} — backfill de comissões`
  );
  console.log();

  // Vendas com corretor e pelo menos 1 lote (residencial OU comercial)
  const vendas = await prisma.venda.findMany({
    where: {
      corretorId: { not: null },
    },
    include: {
      corretor: { select: { id: true, nome: true, comissaoPadrao: true } },
      lote: { select: { id: true, codigo: true, tipo: true, preco: true } },
      vendaLotes: {
        include: { lote: { select: { id: true, codigo: true, tipo: true, preco: true } } },
        orderBy: { ordem: 'asc' },
      },
      parcelas: {
        select: { id: true, tipo: true, numero: true, status: true },
        orderBy: { numero: 'asc' },
      },
      comissaoParcelas: { select: { id: true } },
    },
    orderBy: { numero: 'asc' },
  });

  console.log(`Total de vendas com corretor: ${vendas.length}\n`);

  let processadas = 0;
  let pulou_jaTem = 0;
  let pulou_semResidencial = 0;
  let pulou_semCorretor = 0;
  let valorTotalNovo = 0;
  let valorTotalAntigo = 0;

  for (const v of vendas) {
    if (!v.corretorId || !v.corretor) {
      pulou_semCorretor++;
      continue;
    }

    // Determina lotes da venda (multi ou single)
    const lotes =
      v.vendaLotes.length > 0
        ? v.vendaLotes.map((vl) => ({
            id: vl.lote.id,
            codigo: vl.lote.codigo,
            tipo: vl.lote.tipo,
            preco: Number(vl.lote.preco),
            valorVenda: Number(vl.valor),
          }))
        : [
            {
              id: v.lote.id,
              codigo: v.lote.codigo,
              tipo: v.lote.tipo,
              preco: Number(v.lote.preco),
              valorVenda: Number(v.valorTotal),
            },
          ];

    const temResidencial = lotes.some((l) => l.tipo === 'RESIDENCIAL');
    if (!temResidencial) {
      pulou_semResidencial++;
      continue;
    }
    if (v.comissaoParcelas.length > 0) {
      pulou_jaTem++;
      continue;
    }

    const calc = calcularComissaoVenda({
      lotes: lotes.map((l) => ({ id: l.id, tipo: l.tipo, preco: l.preco })),
      valorTotalVenda: Number(v.valorTotal),
      valoresPorLote: lotes.map((l) => l.valorVenda),
      pctCorretor: Number(v.corretor.comissaoPadrao),
    });

    const ancoras = escolherParcelasAncora(v.parcelas);
    const valores = dividirEmParcelasIguais(calc.valor, COMISSAO_NUMERO_PARCELAS);
    const parcelaPorId = new Map(v.parcelas.map((p) => [p.id, p]));

    const vendaFinalizada =
      v.status === 'CANCELADA' || v.status === 'DISTRATADA';

    const codLotes = lotes.map((l) => `${l.codigo}(${l.tipo[0]})`).join(',');
    const valorAntigo = Number(v.comissaoValor ?? 0);
    valorTotalAntigo += valorAntigo;
    valorTotalNovo += calc.valor;

    console.log(
      `Venda #${v.numero} [${v.status}] ` +
        `corretor=${v.corretor.nome} ` +
        `lotes=${codLotes} ` +
        `comissão: R$${valorAntigo.toFixed(2)} → R$${calc.valor.toFixed(2)} ` +
        `(${calc.qtdLotesResidenciais}res + ${calc.qtdLotesComerciais}com)`
    );

    if (!APPLY) {
      processadas++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // 1) Atualiza comissaoValor / comissaoPct na venda
      await tx.venda.update({
        where: { id: v.id },
        data: {
          comissaoValor: calc.valor,
          comissaoPct:
            calc.usaRegraFixa && calc.qtdLotesComerciais === 0
              ? null
              : calc.pctEquivalente,
        },
      });

      // 2) Cria as 4 ComissaoParcela
      const dataParcelas = Array.from(
        { length: COMISSAO_NUMERO_PARCELAS },
        (_, i) => {
          const ancoraId = ancoras[i];
          const ancora = ancoraId ? parcelaPorId.get(ancoraId) : null;
          const jaPaga = ancora?.status === 'PAGO';
          const status: 'BLOQUEADA' | 'LIBERADA' | 'CANCELADA' = vendaFinalizada
            ? 'CANCELADA'
            : jaPaga
              ? 'LIBERADA'
              : 'BLOQUEADA';
          return {
            vendaId: v.id,
            corretorId: v.corretorId!,
            numero: i + 1,
            valor: valores[i],
            parcelaClienteId: ancoraId,
            status,
            liberadaEm: status === 'LIBERADA' ? new Date() : null,
          };
        }
      );
      await tx.comissaoParcela.createMany({ data: dataParcelas });
    });

    processadas++;
  }

  console.log();
  console.log('=== RESUMO ===');
  console.log(`  Processadas:           ${processadas}`);
  console.log(`  Puladas (já tinha):    ${pulou_jaTem}`);
  console.log(`  Puladas (sem residenc):${pulou_semResidencial}`);
  console.log(`  Puladas (sem corretor):${pulou_semCorretor}`);
  console.log(
    `  Total comissões antigo: R$${valorTotalAntigo.toFixed(2)}`
  );
  console.log(`  Total comissões novo:   R$${valorTotalNovo.toFixed(2)}`);
  console.log(
    `  Diferença:              R$${(valorTotalNovo - valorTotalAntigo).toFixed(2)}`
  );
  console.log();
  if (!APPLY) {
    console.log('🟡 Dry-run — rode com --apply para aplicar.');
  } else {
    console.log('✅ APLICADO.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
