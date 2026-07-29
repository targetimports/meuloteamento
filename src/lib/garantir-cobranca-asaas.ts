/**
 * Garante que uma parcela tenha cobrança Asaas (invoiceUrl + asaasPaymentId).
 *
 * Quando o admin cria uma venda parcelada, normalmente só a ENTRADA gera
 * cobrança Asaas no ato (se ele marcou "Cobrar agora"). As 60 parcelas mensais
 * ficam só registradas no banco, sem invoiceUrl. Quando a régua de cobrança
 * vai mandar o WhatsApp pra uma dessas parcelas, precisamos do link.
 *
 * Esta função é IDEMPOTENTE: se a parcela já tem invoiceUrl, retorna o
 * cached. Se não tem, cria no Asaas e salva no banco.
 *
 * Sempre tenta garantir o Pix copia-e-cola (payload), inclusive em cobranças
 * antigas que só tinham boleto (backfill).
 *
 * Falha silenciosa: se a loteadora não tem chave Asaas, retorna null e
 * o template usa fallback (mensagem sem link).
 */
import { prisma } from './prisma';
import { getLoteadoraAsaasContext } from './asaas-context';
import { ensureAsaasCustomerForCliente } from './asaas-cliente';
import { createPaymentForParcela, getPixQrCode } from './asaas';

export interface CobrancaInfo {
  invoiceUrl: string | null;
  pixCode: string | null;
  boletoUrl: string | null;
  paymentId: string | null;
}

export async function garantirCobrancaAsaasParaParcela(
  parcelaId: string
): Promise<CobrancaInfo> {
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: {
      venda: {
        include: {
          cliente: true,
          lote: {
            select: {
              codigo: true,
              loteamento: {
                select: { loteadoraId: true, nome: true },
              },
            },
          },
        },
      },
    },
  });
  if (!parcela) return { invoiceUrl: null, pixCode: null, boletoUrl: null, paymentId: null };

  const loteadoraId = parcela.venda.lote.loteamento.loteadoraId;

  // Se já existe invoiceUrl, retorna o que está no banco. invoiceUrl não muda
  // com o tempo (é o link público do Asaas), então é seguro reaproveitar.
  if (parcela.asaasInvoiceUrl) {
    // Backfill do Pix copia-e-cola: cobranças antigas (boleto) podem não ter.
    if (!parcela.asaasPixCode && parcela.asaasPaymentId) {
      const ctx = await getLoteadoraAsaasContext(loteadoraId);
      if (ctx) {
        const qr = await getPixQrCode(ctx, parcela.asaasPaymentId).catch(() => null);
        if (qr?.payload) {
          await prisma.parcela.update({
            where: { id: parcela.id },
            data: { asaasPixCode: qr.payload },
          });
          return {
            invoiceUrl: parcela.asaasInvoiceUrl,
            pixCode: qr.payload,
            boletoUrl: parcela.asaasBoletoUrl,
            paymentId: parcela.asaasPaymentId,
          };
        }
      }
    }
    return {
      invoiceUrl: parcela.asaasInvoiceUrl,
      pixCode: parcela.asaasPixCode,
      boletoUrl: parcela.asaasBoletoUrl,
      paymentId: parcela.asaasPaymentId,
    };
  }

  // Tenta criar. Falha silenciosamente se loteadora não tem Asaas configurado.
  const ctx = await getLoteadoraAsaasContext(loteadoraId);
  if (!ctx) {
    return { invoiceUrl: null, pixCode: null, boletoUrl: null, paymentId: null };
  }

  try {
    const customerId = await ensureAsaasCustomerForCliente(ctx, {
      id: parcela.venda.cliente.id,
      nome: parcela.venda.cliente.nome,
      cpfCnpj: parcela.venda.cliente.cpfCnpj,
      email: parcela.venda.cliente.email,
      telefone: parcela.venda.cliente.telefone,
      asaasCustomerId: parcela.venda.cliente.asaasCustomerId,
      cep: parcela.venda.cliente.cep,
      logradouro: parcela.venda.cliente.logradouro,
      numero: parcela.venda.cliente.numero,
      complemento: parcela.venda.cliente.complemento,
      bairro: parcela.venda.cliente.bairro,
    });

    // Decide o billingType. Default = forma da própria parcela, fallback BOLETO.
    const forma = parcela.formaPagamento;
    let billingType: 'PIX' | 'BOLETO' = 'BOLETO';
    if (forma === 'PARCELADO_PIX' || forma === 'A_VISTA') {
      billingType = 'PIX';
    } else if (forma === 'PARCELADO_BOLETO') {
      billingType = 'BOLETO';
    }

    const dueDate = parcela.vencimento.toISOString().slice(0, 10);
    const tipoLabel =
      parcela.tipo === 'ENTRADA' ? 'Entrada' : `Parcela ${parcela.numero}`;
    const desc = `${tipoLabel} — Lote ${parcela.venda.lote.codigo} (${parcela.venda.lote.loteamento.nome})`;

    const payment = await createPaymentForParcela(ctx, {
      customer: customerId,
      billingType,
      value: Number(parcela.valor),
      dueDate,
      parcelaId: parcela.id,
      description: desc,
    });

    const boletoUrl: string | null =
      billingType === 'BOLETO' ? payment.bankSlipUrl ?? null : null;

    // Sempre tenta o Pix copia-e-cola, independente do billingType
    // (cobranças Asaas com Pix habilitado retornam payload mesmo no boleto).
    const qr = await getPixQrCode(ctx, payment.id).catch(() => null);
    const pixCode: string | null = qr?.payload ?? null;

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: {
        asaasPaymentId: payment.id,
        asaasInvoiceUrl: payment.invoiceUrl ?? null,
        asaasPixCode: pixCode,
        asaasBoletoUrl: boletoUrl,
      },
    });

    return {
      invoiceUrl: payment.invoiceUrl ?? null,
      pixCode,
      boletoUrl,
      paymentId: payment.id,
    };
  } catch (err) {
    console.error(
      '[garantirCobrancaAsaasParaParcela] erro criando payment',
      parcela.id,
      err
    );
    return { invoiceUrl: null, pixCode: null, boletoUrl: null, paymentId: null };
  }
}
