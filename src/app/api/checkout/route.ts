/**
 * POST /api/checkout
 *
 * Fluxo de compra do cliente final no site público:
 *   1. Valida payload (lote, cliente, simulação, forma pagto)
 *   2. Lock pessimista do lote — se não está DISPONIVEL/RESERVADO, falha
 *   3. Cria/atualiza Cliente no banco
 *   4. (se houver chave Asaas) cria customer no Asaas
 *   5. Cria Venda + Parcelas no banco (entrada + N mensais)
 *   6. Cria payment Asaas para a ENTRADA (PIX, BOLETO ou CREDIT_CARD)
 *      → grava asaasPaymentId / invoiceUrl / pixCode na parcela de entrada
 *   7. Atualiza lote para EM_PAGAMENTO
 *   8. Retorna: vendaId + URL do boleto/PIX + identificador pra redirect
 *
 * Resposta sucesso:
 *   { ok: true, vendaId, redirectUrl: '/checkout/sucesso/{vendaId}', invoiceUrl, pixQrCode }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { lockLote, mudarStatusLote } from '@/lib/lote-status';
import { getLoteadoraAsaasContext } from '@/lib/asaas-context';
import {
  createCustomer,
  createPayment,
  getPixQrCode,
  AsaasError,
  type AsaasBillingType,
} from '@/lib/asaas';

export const runtime = 'nodejs';

const schema = z.object({
  loteId: z.string().min(1),

  // Dados do comprador
  nome: z.string().trim().min(2),
  cpfCnpj: z.string().trim().min(11),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().trim().min(8),

  // Endereço (necessário pra boleto; opcional pra PIX)
  cep: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  complemento: z.string().trim().optional().nullable(),
  bairro: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  estado: z.string().trim().optional().nullable(),

  // Simulação escolhida
  valorTotal: z.number().positive(), // valor do lote (ex 55000)
  valorEntrada: z.number().min(0),
  qtdParcelas: z.number().int().positive(),
  valorParcela: z.number().min(0), // 0 quando à vista

  // Forma de pagamento da ENTRADA (ou do valor total se à vista)
  // Online só aceita PIX (decisão do negócio)
  billingType: z.enum(['PIX']),

  // Dia preferido de vencimento (1..28). Default 10.
  diaVencimento: z.number().int().min(1).max(28).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const cpfClean = data.cpfCnpj.replace(/\D/g, '');
  if (cpfClean.length !== 11 && cpfClean.length !== 14) {
    return NextResponse.json({ ok: false, error: 'CPF/CNPJ inválido' }, { status: 400 });
  }

  const aVista = data.valorEntrada >= data.valorTotal || data.qtdParcelas === 0 || data.valorParcela === 0;
  const diaVenc = data.diaVencimento ?? 10;

  try {
    // ============ 1. Tudo dentro de UMA transação no banco ============
    const result = await prisma.$transaction(async (tx) => {
      const locked = await lockLote(tx, data.loteId);
      if (!locked) throw new Error('Lote não encontrado');
      if (locked.status !== 'DISPONIVEL' && locked.status !== 'RESERVADO') {
        throw new Error('Este lote não está mais disponível para compra.');
      }
      const lote = await tx.lote.findUnique({
        where: { id: data.loteId },
        select: { id: true, codigo: true, preco: true, status: true },
      });
      if (!lote) throw new Error('Lote não encontrado');
      if (Number(lote.preco) !== data.valorTotal) {
        throw new Error(
          `O preço do lote foi atualizado. Recarregue a página (esperado: R$ ${Number(lote.preco).toFixed(2)}).`
        );
      }

      // Loteamento + loteadora (precisamos da loteadoraId pra Asaas)
      const loteamento = await tx.loteamento.findFirst({
        where: { lotes: { some: { id: data.loteId } } },
        select: {
          id: true,
          slug: true,
          nome: true,
          loteadoraId: true,
          loteadora: { select: { nome: true } },
        },
      });
      if (!loteamento) throw new Error('Loteamento não encontrado.');

      // ============ 2. Cliente — upsert por CPF ============
      let cliente = await tx.cliente.findUnique({ where: { cpfCnpj: cpfClean } });
      if (cliente) {
        cliente = await tx.cliente.update({
          where: { id: cliente.id },
          data: {
            nome: data.nome,
            telefone: data.telefone,
            email: data.email,
            cep: data.cep ?? cliente.cep,
            logradouro: data.endereco ?? cliente.logradouro,
            numero: data.numero ?? cliente.numero,
            complemento: data.complemento ?? cliente.complemento,
            bairro: data.bairro ?? cliente.bairro,
            cidade: data.cidade ?? cliente.cidade,
            estado: data.estado ?? cliente.estado,
          },
        });
      } else {
        const emailDup = await tx.cliente.findUnique({ where: { email: data.email } });
        if (emailDup) {
          throw new Error(
            'Já existe um cadastro com este e-mail e CPF diferente. Verifique seus dados.'
          );
        }
        cliente = await tx.cliente.create({
          data: {
            nome: data.nome,
            cpfCnpj: cpfClean,
            email: data.email,
            telefone: data.telefone,
            cep: data.cep,
            logradouro: data.endereco,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            cidade: data.cidade,
            estado: data.estado,
          },
        });
      }

      // ============ 3. Cria Venda + Parcelas ============
      const formaPagamento = aVista
        ? 'A_VISTA'
        : data.billingType === 'PIX'
          ? 'PARCELADO_PIX'
          : data.billingType === 'BOLETO'
            ? 'PARCELADO_BOLETO'
            : 'PARCELADO_CARTAO';

      const venda = await tx.venda.create({
        data: {
          loteId: data.loteId,
          clienteId: cliente.id,
          valorTotal: data.valorTotal,
          valorEntrada: data.valorEntrada,
          numeroParcelas: aVista ? 1 : data.qtdParcelas,
          valorParcela: aVista ? data.valorTotal : data.valorParcela,
          diaVencimento: diaVenc,
          formaPagamento,
          status: 'ATIVA',
          origem: 'CHECKOUT_ONLINE',
          observacoes: `Compra iniciada pelo site. Forma pagto inicial: ${data.billingType}.`,
        },
      });

      // Cria as parcelas no banco
      // PIX online: vencimento da PRIMEIRA cobrança = +60 minutos (mesmo prazo da reserva).
      // Mensais continuam com vencimento no dia escolhido do próximo mês em diante.
      const hoje = new Date();
      const pixExpira = new Date(hoje.getTime() + 60 * 60 * 1000); // +60 min
      const parcelas: { numero: number; tipo: 'ENTRADA' | 'MENSAL'; valor: number; vencimento: Date }[] = [];

      if (aVista) {
        // 1 única parcela = valor total (PIX 60min)
        parcelas.push({ numero: 1, tipo: 'ENTRADA', valor: data.valorTotal, vencimento: pixExpira });
      } else {
        // Entrada PIX 60min + N parcelas mensais começando próx. mês
        if (data.valorEntrada > 0) {
          parcelas.push({ numero: 1, tipo: 'ENTRADA', valor: data.valorEntrada, vencimento: pixExpira });
        }
        const offsetMensal = data.valorEntrada > 0 ? 2 : 1;
        for (let i = 0; i < data.qtdParcelas; i++) {
          const venc = setDayOfMonth(addMonths(hoje, i + 1), diaVenc);
          parcelas.push({
            numero: i + offsetMensal,
            tipo: 'MENSAL',
            valor: data.valorParcela,
            vencimento: venc,
          });
        }
      }

      const parcelasCreated = await Promise.all(
        parcelas.map((p) =>
          tx.parcela.create({
            data: {
              vendaId: venda.id,
              numero: p.numero,
              tipo: p.tipo,
              valor: p.valor,
              vencimento: p.vencimento,
              status: 'PENDENTE',
            },
          })
        )
      );

      // Lote vai pra EM_PAGAMENTO (entrada ainda não paga)
      await mudarStatusLote({
        loteId: data.loteId,
        novoStatus: 'EM_PAGAMENTO',
        motivo: `Checkout iniciado por ${data.nome} (CPF ${cpfClean}) — venda #${venda.numero}`,
        userType: 'CLIENTE',
        tx,
      });

      // Cria lead pra equipe comercial
      await tx.lead.create({
        data: {
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          mensagem: `Cliente iniciou compra do lote ${lote.codigo}. Forma: ${data.billingType}.`,
          loteamentoId: loteamento.id,
          loteId: data.loteId,
          origem: 'checkout',
          status: 'EM_ATENDIMENTO',
        },
      });

      return {
        venda,
        parcelas: parcelasCreated,
        cliente,
        loteamento,
        lote,
      };
    });

    // ============ 4. Asaas — fora da transação porque é chamada externa ============
    // (pode falhar de forma graceful — a venda continua válida e dá pra emitir depois manualmente no admin)
    const ctx = await getLoteadoraAsaasContext(result.loteamento.loteadoraId);
    let invoiceUrl: string | null = null;
    let pixCopiaCola: string | null = null;
    let asaasWarning: string | null = null;

    if (ctx) {
      try {
        const asaasCustomer = await createCustomer(ctx, {
          name: data.nome,
          email: data.email,
          cpfCnpj: cpfClean,
          mobilePhone: data.telefone.replace(/\D/g, ''),
          postalCode: data.cep ?? undefined,
          address: data.endereco ?? undefined,
          addressNumber: data.numero ?? undefined,
          complement: data.complemento ?? undefined,
          province: data.bairro ?? undefined,
          externalReference: result.cliente.id,
        });

        await prisma.cliente.update({
          where: { id: result.cliente.id },
          data: { asaasCustomerId: asaasCustomer.id },
        });

        // Cobra a PRIMEIRA parcela (entrada se houver, ou valor total à vista)
        const primeiraParcela = result.parcelas[0];
        const payment = await createPayment(ctx, {
          customer: asaasCustomer.id,
          billingType: data.billingType as AsaasBillingType,
          value: Number(primeiraParcela.valor),
          dueDate: toYMD(primeiraParcela.vencimento),
          description: `${aVista ? 'Pagamento à vista' : 'Entrada'} - Lote ${result.lote.codigo} - ${result.loteamento.nome}`,
          externalReference: primeiraParcela.id,
        });

        // Pega o QR PIX se for PIX
        if (data.billingType === 'PIX') {
          try {
            const qr = await getPixQrCode(ctx, payment.id);
            pixCopiaCola = qr.payload;
            invoiceUrl = payment.invoiceUrl ?? null;
            await prisma.parcela.update({
              where: { id: primeiraParcela.id },
              data: {
                asaasPaymentId: payment.id,
                asaasInvoiceUrl: payment.invoiceUrl,
                asaasPixCode: qr.payload,
                asaasPixQrCode: qr.encodedImage,
              },
            });
          } catch {
            await prisma.parcela.update({
              where: { id: primeiraParcela.id },
              data: {
                asaasPaymentId: payment.id,
                asaasInvoiceUrl: payment.invoiceUrl,
              },
            });
            invoiceUrl = payment.invoiceUrl ?? null;
          }
        } else {
          invoiceUrl = payment.invoiceUrl ?? null;
          await prisma.parcela.update({
            where: { id: primeiraParcela.id },
            data: {
              asaasPaymentId: payment.id,
              asaasInvoiceUrl: payment.invoiceUrl,
              asaasBoletoUrl: payment.bankSlipUrl,
            },
          });
        }
      } catch (e) {
        const msg = e instanceof AsaasError ? `Asaas ${e.status}: ${e.body}` : (e as Error).message;
        console.error('[checkout] Asaas falhou:', msg);
        asaasWarning =
          'Sua compra foi registrada, mas houve uma falha ao gerar a cobrança automática. ' +
          'Nosso time vai entrar em contato em até 24h para regularizar.';
      }
    } else {
      asaasWarning =
        'A loteadora ainda não configurou a integração de pagamento. ' +
        'Sua compra foi registrada e nosso time vai entrar em contato em até 24h.';
    }

    revalidatePath(`/${result.loteamento.slug}`);
    revalidatePath(`/admin/vendas`);

    return NextResponse.json({
      ok: true,
      vendaId: result.venda.id,
      redirectUrl: `/checkout/sucesso/${result.venda.id}`,
      invoiceUrl,
      pixCopiaCola,
      warning: asaasWarning,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao processar a compra';
    console.error('[checkout] erro:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

// Helpers de data
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function setDayOfMonth(d: Date, dom: number) {
  const r = new Date(d);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(dom, lastDay));
  return r;
}
function toYMD(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
