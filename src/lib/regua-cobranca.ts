import { prisma } from './prisma';
import { enfileirar, buildIdempotencyKey } from './comunicacao';
import { formatBRL, formatDate } from './format';
import { garantirCobrancaAsaasParaParcela } from './garantir-cobranca-asaas';
import { dentroDaJanelaCobranca } from './horario-cobranca';

interface RodarReguaResult {
  loteadora: string;
  parcelasAvaliadas: number;
  enviosCriados: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

export async function rodarReguaCobranca(): Promise<RodarReguaResult[]> {
  // Janela de disparo: só gera/envia cobrança entre 08h e 12h (BRT).
  if (!dentroDaJanelaCobranca()) return [];

  const loteadoras = await prisma.loteadora.findMany({
    where: { ativo: true, reguaCobrancaId: { not: null } },
    include: {
      reguaCobranca: {
        include: { passos: { where: { ativo: true }, orderBy: { ordem: 'asc' } } },
      },
    },
  });

  const hoje = startOfDay(new Date());
  const resultados: RodarReguaResult[] = [];

  for (const loteadora of loteadoras) {
    const regua = loteadora.reguaCobranca;
    if (!regua || !regua.ativa) continue;

    const offsets = regua.passos.map((p) => p.diasOffset);
    const minOffset = Math.min(...offsets, 0);
    const maxOffset = Math.max(...offsets, 0);

    // Quando "cobrar em atraso diariamente" está ligado, qualquer parcela
    // vencida (diasAtraso >= 1) recebe o template de atraso TODO DIA — então a
    // janela de busca precisa pegar vencimentos bem antigos.
    const passoAtrasoDiario = regua.cobrarAtrasoDiario
      ? [...regua.passos]
          .filter((p) => p.diasOffset >= 1)
          .sort((a, b) => a.diasOffset - b.diasOffset)[0] ?? null
      : null;

    const vencInicio = new Date(hoje);
    vencInicio.setDate(
      vencInicio.getDate() - (passoAtrasoDiario ? 3650 : maxOffset) - 1
    );
    const vencFim = new Date(hoje);
    vencFim.setDate(vencFim.getDate() - minOffset + 1);

    const parcelas = await prisma.parcela.findMany({
      where: {
        status: { in: ['PENDENTE', 'ATRASADO'] },
        vencimento: { gte: vencInicio, lte: vencFim },
        venda: {
          status: { in: ['ATIVA', 'INADIMPLENTE'] },
          lote: { loteamento: { loteadoraId: loteadora.id } },
        },
      },
      include: {
        venda: {
          include: {
            cliente: true,
            lote: { include: { loteamento: true } },
          },
        },
      },
    });

    let enviosCriados = 0;

    for (const parcela of parcelas) {
      const venc = startOfDay(parcela.vencimento);
      const diasAtraso = diasEntre(hoje, venc);

      // Match exato (5/3 dias antes, vencimento, ou um offset positivo específico)
      let passo = regua.passos.find((p) => p.diasOffset === diasAtraso);
      // Fallback: atraso diário — qualquer parcela vencida usa o template de atraso.
      if (!passo && passoAtrasoDiario && diasAtraso >= 1) {
        passo = passoAtrasoDiario;
      }
      if (!passo) continue;

      const cliente = parcela.venda.cliente;
      if (passo.canal === 'WHATSAPP' && !cliente.aceitaWhatsApp) continue;
      if (passo.canal === 'EMAIL' && !cliente.aceitaEmail) continue;

      const destinatario =
        passo.canal === 'EMAIL' ? cliente.email : cliente.telefone;
      if (!destinatario) continue;

      // Garante invoiceUrl + Pix ANTES de montar o contexto.
      const cobranca = await garantirCobrancaAsaasParaParcela(parcela.id);

      const ctx = {
        cliente: { nome: cliente.nome, telefone: cliente.telefone, email: cliente.email },
        parcela: {
          numero: String(parcela.numero),
          valor: formatBRL(Number(parcela.valor)),
          vencimento: formatDate(parcela.vencimento),
          invoiceUrl: cobranca.invoiceUrl ?? parcela.asaasInvoiceUrl ?? '',
          pixCode: cobranca.pixCode ?? parcela.asaasPixCode ?? '',
          boletoUrl: cobranca.boletoUrl ?? parcela.asaasBoletoUrl ?? '',
          diasAtraso: String(diasAtraso),
        },
        venda: { numero: String(parcela.venda.numero) },
        loteamento: { nome: parcela.venda.lote.loteamento.nome },
        loteadora: { nome: loteadora.nome },
      };

      const idem = buildIdempotencyKey([
        'regua',
        passo.id,
        parcela.id,
        hoje.toISOString().slice(0, 10),
      ]);

      const { jaExistia } = await enfileirar({
        loteadoraId: loteadora.id,
        canal: passo.canal,
        destinatario,
        assunto: passo.canal === 'EMAIL' ? `Lembrete: parcela ${parcela.numero}` : null,
        template: passo.template,
        contexto: ctx,
        parcelaId: parcela.id,
        idempotencyKey: idem,
      });

      if (!jaExistia) {
        enviosCriados++;
        await prisma.parcela.update({
          where: { id: parcela.id },
          data: {
            ultimaCobrancaEm: new Date(),
            cobrancasEnviadas: { increment: 1 },
          },
        });
      }
    }

    resultados.push({
      loteadora: loteadora.nome,
      parcelasAvaliadas: parcelas.length,
      enviosCriados,
    });
  }

  return resultados;
}

export async function marcarParcelasAtrasadas(): Promise<{ marcadas: number }> {
  const hoje = startOfDay(new Date());
  const r = await prisma.parcela.updateMany({
    where: {
      status: 'PENDENTE',
      vencimento: { lt: hoje },
      venda: { status: { in: ['ATIVA', 'INADIMPLENTE'] } },
    },
    data: { status: 'ATRASADO' },
  });
  return { marcadas: r.count };
}
