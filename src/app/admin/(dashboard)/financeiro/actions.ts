'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, canAccessLoteamento, requireAdmin, tenantId } from '@/lib/tenant';
import { mudarStatusLote } from '@/lib/lote-status';
import { getLoteadoraAsaasContext } from '@/lib/asaas-context';
import { ensureAsaasCustomerForCliente } from '@/lib/asaas-cliente';
import { createPayment, createPaymentForParcela, getPixQrCode, deletePayment, AsaasError } from '@/lib/asaas';
import {
  liberarComissoesDaParcela,
  rebloquearComissoesDaParcela,
} from '@/lib/comissao';

/**
 * Marca uma parcela como paga manualmente (sem passar pelo Asaas).
 * Se for a última parcela em aberto da venda, marca a venda como QUITADA
 * e o lote como VENDIDO automaticamente.
 */
export async function marcarParcelaPaga(parcelaId: string): Promise<void> {
  const session = await requireAdmin();

  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: {
      venda: {
        include: {
          parcelas: { select: { id: true, status: true } },
          lote: { include: { loteamento: { select: { loteadoraId: true, slug: true } } } },
        },
      },
    },
  });
  if (!parcela) throw new Error('Parcela não encontrada');
  if (!(await canAccessLoteamento(parcela.venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para esta parcela');
  }
  if (parcela.status === 'PAGO') {
    throw new Error('Esta parcela já foi paga');
  }
  if (parcela.status === 'CANCELADO' || parcela.status === 'ESTORNADO') {
    throw new Error('Parcela está cancelada/estornada — reabra primeiro');
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.parcela.update({
      where: { id: parcelaId },
      data: {
        status: 'PAGO',
        valorPago: parcela.valor,
        pagoEm: now,
      },
    });

    // Conta parcelas ainda em aberto APÓS esta baixa
    const aindaAbertas = parcela.venda.parcelas.filter(
      (p) => p.id !== parcelaId && (p.status === 'PENDENTE' || p.status === 'ATRASADO')
    ).length;

    if (aindaAbertas === 0) {
      // Quita a venda
      await tx.venda.update({
        where: { id: parcela.vendaId },
        data: { status: 'QUITADA', dataQuitacao: now },
      });
      await mudarStatusLote({
        loteId: parcela.venda.loteId,
        novoStatus: 'VENDIDO',
        motivo: `Venda ${parcela.venda.numero} quitada manualmente por ${session.email}`,
        userId: session.sub,
        userType: 'ADMIN',
        tx,
      });
    } else if (parcela.venda.status === 'INADIMPLENTE') {
      // Se estava inadimplente e ainda há parcelas, recoloca como ATIVA
      await tx.venda.update({
        where: { id: parcela.vendaId },
        data: { status: 'ATIVA' },
      });
    }
  });

  // Libera comissões vinculadas a esta parcela (BLOQUEADA → LIBERADA)
  // Fora da transação porque é idempotente e não afeta a integridade da venda.
  await liberarComissoesDaParcela(parcelaId);

  revalidatePath('/admin/financeiro');
  revalidatePath(`/admin/vendas/${parcela.vendaId}`);
  revalidatePath('/admin/vendas');
  revalidatePath(`/${parcela.venda.lote.loteamento.slug}`);
  revalidatePath('/admin/comissoes');
}

/**
 * Reabre uma parcela paga (caso de erro de lançamento manual).
 * Se a venda estava QUITADA, volta para ATIVA e libera o lote.
 */
export async function reabrirParcela(parcelaId: string): Promise<void> {
  const session = await requireAdmin();

  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: {
      venda: {
        include: { lote: { include: { loteamento: { select: { loteadoraId: true } } } } },
      },
    },
  });
  if (!parcela) throw new Error('Parcela não encontrada');
  if (!(await canAccessLoteamento(parcela.venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão');
  }
  if (parcela.status !== 'PAGO') {
    throw new Error('Só dá pra reabrir parcelas pagas');
  }

  await prisma.$transaction(async (tx) => {
    await tx.parcela.update({
      where: { id: parcelaId },
      data: { status: 'PENDENTE', valorPago: null, pagoEm: null },
    });
    // Se a venda estava QUITADA, volta pra ATIVA
    if (parcela.venda.status === 'QUITADA') {
      await tx.venda.update({
        where: { id: parcela.vendaId },
        data: { status: 'ATIVA', dataQuitacao: null },
      });
      await mudarStatusLote({
        loteId: parcela.venda.loteId,
        novoStatus: 'EM_PAGAMENTO',
        motivo: `Parcela ${parcela.numero} reaberta — venda volta a EM_PAGAMENTO (por ${session.email})`,
        userId: session.sub,
        userType: 'ADMIN',
        tx,
      });
    }
  });

  // Reabrir parcela → devolve comissões liberadas (mas não pagas) para BLOQUEADA
  await rebloquearComissoesDaParcela(parcelaId);

  revalidatePath('/admin/financeiro');
  revalidatePath(`/admin/vendas/${parcela.vendaId}`);
  revalidatePath('/admin/comissoes');
}

// =====================================================================
// COBRANÇA PIX AVULSA — não vinculada a Venda
// =====================================================================

const cobrancaPixSchema = z
  .object({
    // cliente
    clienteMode: z.enum(['existente', 'adhoc']).default('adhoc'),
    clienteId: z.string().optional(),
    nome: z.string().trim().optional(),
    cpfCnpj: z.string().trim().optional(),
    email: z.string().trim().toLowerCase().optional().or(z.literal('')),
    telefone: z.string().trim().optional(),
    // valor
    valor: z.coerce.number().positive('Valor deve ser positivo'),
    // lote opcional (só pra rastreio interno)
    loteId: z.string().optional(),
    // descrição
    descricao: z.string().trim().optional(),
    vencimento: z.string().optional(),
    loteadoraId: z.string().optional(),
    // forma de cobrança: PIX (só Pix) ou LINK (link completo: Pix + boleto + cartão)
    formaCobranca: z.enum(['PIX', 'LINK']).default('PIX'),
  })
  .refine(
    (d) =>
      d.clienteMode === 'existente'
        ? !!d.clienteId
        : !!(d.nome && d.cpfCnpj),
    { message: 'Selecione um cliente cadastrado ou preencha nome + CPF/CNPJ' }
  );

export interface CobrancaPixResult {
  error?: string;
  ok?: boolean;
  cobrancaId?: string;
  qrCode?: {
    encodedImage: string; // base64
    payload: string; // copia-cola
    expirationDate: string;
  };
  invoiceUrl?: string;
  valor?: number;
  descricao?: string;
  clienteNome?: string;
}

function onlyDigits(s?: string | null) {
  return (s || '').replace(/\D/g, '');
}

/**
 * Cria uma cobrança PIX avulsa (sem vinculo com Venda).
 * Aceita cliente cadastrado ou ad-hoc (nome+CPF apenas).
 * Retorna QR code base64 + copia-e-cola para exibir na UI.
 */
export async function criarCobrancaPixAvulsa(
  input: Record<string, unknown>
): Promise<CobrancaPixResult> {
  const session = await requireAdmin();
  const parsed = cobrancaPixSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = parsed.data;

  // Resolve loteadora (tenant ou super-admin escolhendo)
  const tid = await tenantId();
  const loteadoraId = tid ?? data.loteadoraId;
  if (!loteadoraId) {
    return { error: 'Selecione a loteadora para emitir a cobrança' };
  }
  if (!(await canAccessLoteadora(loteadoraId))) {
    return { error: 'Sem permissão para esta loteadora' };
  }

  // Contexto Asaas
  const ctx = await getLoteadoraAsaasContext(loteadoraId);
  if (!ctx) {
    return {
      error:
        'Loteadora não tem chave Asaas configurada. Acesse Configurações → Asaas.',
    };
  }

  // Cliente — cria/encontra registro local
  let clienteLocal: {
    id: string;
    nome: string;
    cpfCnpj: string;
    email: string | null;
    telefone: string;
    asaasCustomerId: string | null;
  } | null = null;
  let nomeAdHoc: string | null = null;
  let cpfAdHoc: string | null = null;
  let emailAdHoc: string | null = null;
  let telefoneAdHoc: string | null = null;

  if (data.clienteMode === 'existente' && data.clienteId) {
    const c = await prisma.cliente.findUnique({
      where: { id: data.clienteId },
      select: {
        id: true,
        nome: true,
        cpfCnpj: true,
        email: true,
        telefone: true,
        asaasCustomerId: true,
      },
    });
    if (!c) return { error: 'Cliente não encontrado' };
    clienteLocal = c;
  } else {
    // ad-hoc: tenta achar por CPF p/ reuso, senão guarda só os dados
    const cpfClean = onlyDigits(data.cpfCnpj);
    if (cpfClean.length !== 11 && cpfClean.length !== 14) {
      return { error: 'CPF/CNPJ inválido' };
    }
    const ja = await prisma.cliente.findUnique({
      where: { cpfCnpj: cpfClean },
      select: {
        id: true,
        nome: true,
        cpfCnpj: true,
        email: true,
        telefone: true,
        asaasCustomerId: true,
      },
    });
    if (ja) {
      // Reaproveita: atualiza só nome/telefone/email se vieram
      await prisma.cliente.update({
        where: { id: ja.id },
        data: {
          nome: data.nome || ja.nome,
          telefone: data.telefone || ja.telefone,
          email: data.email || ja.email,
        },
      });
      clienteLocal = ja;
    } else {
      // Persiste como ad-hoc no CobrancaAvulsa (não cria Cliente cheio só pra cobrar
      // uma vez — mas precisamos de customer no Asaas).
      nomeAdHoc = data.nome ?? null;
      cpfAdHoc = cpfClean;
      emailAdHoc = data.email || null;
      telefoneAdHoc = data.telefone || null;
    }
  }

  // Garante customer no Asaas
  let asaasCustomerId: string;
  try {
    if (clienteLocal) {
      asaasCustomerId = await ensureAsaasCustomerForCliente(ctx, clienteLocal);
    } else {
      asaasCustomerId = await ensureAsaasCustomerForCliente(ctx, {
        nome: nomeAdHoc!,
        cpfCnpj: cpfAdHoc!,
        email: emailAdHoc,
        telefone: telefoneAdHoc,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar cliente no Asaas';
    return { error: `Asaas (cliente): ${msg}` };
  }

  // Vencimento default: amanhã
  const venc = data.vencimento ? new Date(data.vencimento) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dueDate = venc.toISOString().slice(0, 10);

  // Cria registro local PRIMEIRO (sem paymentId), depois preenche
  const cobranca = await prisma.cobrancaAvulsa.create({
    data: {
      loteadoraId,
      clienteId: clienteLocal?.id ?? null,
      nomeAdHoc,
      cpfCnpjAdHoc: cpfAdHoc,
      emailAdHoc,
      telefoneAdHoc,
      loteId: data.loteId || null,
      valor: data.valor,
      descricao: data.descricao || null,
      vencimento: venc,
      asaasCustomerId,
      status: 'PENDENTE',
      createdBy: session.sub,
    },
  });

  // Cria cobrança PIX no Asaas
  let asaasPayment;
  try {
    asaasPayment = await createPayment(ctx, {
      customer: asaasCustomerId,
      // PIX = só Pix. LINK = UNDEFINED (link de pagamento aceita Pix, boleto e cartão).
      billingType: data.formaCobranca === 'LINK' ? 'UNDEFINED' : 'PIX',
      value: data.valor,
      dueDate,
      description: data.descricao || `Cobrança avulsa #${cobranca.id.slice(-6)}`,
      // prefixo permite o webhook diferenciar avulsa de parcela
      externalReference: `avulsa:${cobranca.id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar cobrança no Asaas';
    // Limpa registro local pra não deixar lixo
    await prisma.cobrancaAvulsa.delete({ where: { id: cobranca.id } }).catch(() => {});
    return { error: `Asaas (cobrança): ${msg}` };
  }

  // Busca o Pix copia-e-cola (funciona p/ PIX e p/ UNDEFINED). NÃO-FATAL:
  // no modo "link", se a cobrança não tiver Pix, seguimos só com o link.
  let qr: { encodedImage: string; payload: string; expirationDate: string } | null = null;
  try {
    qr = await getPixQrCode(ctx, asaasPayment.id);
  } catch {
    qr = null;
  }

  // Persiste tudo
  await prisma.cobrancaAvulsa.update({
    where: { id: cobranca.id },
    data: {
      asaasPaymentId: asaasPayment.id,
      asaasInvoiceUrl: asaasPayment.invoiceUrl ?? null,
      asaasPixCode: qr?.payload ?? null,
      asaasPixQrCode: qr?.encodedImage ?? null,
    },
  });

  revalidatePath('/admin/financeiro');
  revalidatePath('/admin/cobranca-avulsa');

  return {
    ok: true,
    cobrancaId: cobranca.id,
    qrCode: qr ?? undefined,
    invoiceUrl: asaasPayment.invoiceUrl,
    valor: data.valor,
    descricao: data.descricao,
    clienteNome: clienteLocal?.nome ?? nomeAdHoc ?? undefined,
  };
}

// =====================================================================
// REGENERAR PIX DA PARCELA — útil quando o PIX expirou e o cliente quer pagar
// =====================================================================

export interface RegerarPixResult {
  error?: string;
  ok?: boolean;
  qrCode?: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  };
  invoiceUrl?: string;
  valor?: number;
  parcelaNumero?: number;
}

/**
 * Regenera o PIX de uma parcela (apaga o antigo no Asaas, cria novo, devolve QR).
 * Use quando o PIX expirou e o cliente quer pagar.
 */
export async function regerarPixParcela(parcelaId: string): Promise<RegerarPixResult> {
  await requireAdmin();

  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: {
      venda: {
        include: {
          cliente: true,
          lote: {
            select: {
              codigo: true,
              loteamento: { select: { loteadoraId: true, slug: true, nome: true } },
            },
          },
        },
      },
    },
  });
  if (!parcela) return { error: 'Parcela não encontrada' };
  if (!(await canAccessLoteamento(parcela.venda.lote.loteamento.loteadoraId))) {
    return { error: 'Sem permissão para esta parcela' };
  }
  if (parcela.status === 'PAGO') {
    return { error: 'Parcela já está paga — não precisa regenerar PIX' };
  }
  if (parcela.status === 'CANCELADO' || parcela.status === 'ESTORNADO') {
    return { error: 'Parcela cancelada/estornada — reabra antes de regenerar' };
  }

  const loteadoraId = parcela.venda.lote.loteamento.loteadoraId;
  const ctx = await getLoteadoraAsaasContext(loteadoraId);
  if (!ctx) {
    return {
      error:
        'Loteadora sem chave Asaas configurada. Acesse Configurações para vincular.',
    };
  }

  // Apaga PIX antigo (se houver) — ignora erro 404/already deleted
  if (parcela.asaasPaymentId) {
    try {
      await deletePayment(ctx, parcela.asaasPaymentId);
    } catch (err) {
      if (!(err instanceof AsaasError) || (err.status !== 404 && err.status !== 400)) {
        console.warn('[regerarPixParcela] falha ao apagar antigo', err);
      }
    }
  }

  // Garante cliente no Asaas
  let customerId: string;
  try {
    customerId = await ensureAsaasCustomerForCliente(ctx, {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro com cliente Asaas';
    return { error: `Asaas (cliente): ${msg}` };
  }

  // Calcula valor + nova data de vencimento (mantém vencimento original se futuro,
  // ou +3 dias se já passou — dá tempo do cliente pagar).
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(parcela.vencimento);
  venc.setHours(0, 0, 0, 0);
  const dueDate =
    venc >= hoje
      ? parcela.vencimento.toISOString().slice(0, 10)
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const valor = Number(parcela.valor);
  const tipoLabel =
    parcela.tipo === 'ENTRADA' ? 'Entrada' : `Parcela ${parcela.numero}`;
  const desc = `${tipoLabel} — Lote ${parcela.venda.lote.codigo} (${parcela.venda.lote.loteamento.nome})`;

  // Cria novo payment + busca QR
  try {
    const payment = await createPaymentForParcela(ctx, {
      customer: customerId,
      billingType: 'PIX',
      value: valor,
      dueDate,
      parcelaId: parcela.id,
      description: desc,
    });
    const qr = await getPixQrCode(ctx, payment.id);

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: {
        asaasPaymentId: payment.id,
        asaasInvoiceUrl: payment.invoiceUrl ?? null,
        asaasPixCode: qr.payload,
        asaasPixQrCode: qr.encodedImage,
        // Se estava ATRASADO e o vencimento foi empurrado, volta pra PENDENTE
        ...(parcela.status === 'ATRASADO' && dueDate !== parcela.vencimento.toISOString().slice(0, 10)
          ? { status: 'PENDENTE' as const, vencimento: new Date(dueDate + 'T00:00:00') }
          : {}),
      },
    });

    revalidatePath('/admin/financeiro');
    revalidatePath(`/admin/vendas/${parcela.vendaId}`);

    return {
      ok: true,
      qrCode: qr,
      invoiceUrl: payment.invoiceUrl,
      valor,
      parcelaNumero: parcela.numero,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Falha ao criar PIX no Asaas';
    return { error: `Asaas: ${msg}` };
  }
}
void createPayment; // silencia warning de import não usado

// =====================================================================
// SINCRONIZAÇÃO MANUAL COM ASAAS
// (redundância — não depende do webhook)
// =====================================================================

export interface SyncManualResult {
  ok: boolean;
  totalAtualizacoes: number;
  totalErros: number;
  duracaoMs: number;
  resumo: Array<{
    loteadora: string;
    verificadas: number;
    atualizadas: number;
    erros: number;
    detalhes: Array<{
      paymentId: string;
      statusLocal: string;
      statusAsaas: string;
      acao: string;
    }>;
  }>;
  error?: string;
}

/**
 * Server action que dispara a sincronização ativa de pagamentos.
 *
 * Modo "full" varre /payments?status=RECEIVED dos últimos 30 dias
 * (mais pesado mas pega órfãos sem asaasPaymentId no banco).
 */
export async function sincronizarPagamentosManual(
  modo: 'quick' | 'full' = 'quick'
): Promise<SyncManualResult> {
  await requireAdmin();
  try {
    const { sincronizarTodasLoteadoras } = await import('@/lib/asaas-sync');
    const r = await sincronizarTodasLoteadoras(modo);
    revalidatePath('/admin/financeiro');
    revalidatePath('/admin/vendas');
    return {
      ok: true,
      totalAtualizacoes: r.totalAtualizacoes,
      totalErros: r.totalErros,
      duracaoMs: r.duracaoMs,
      resumo: r.loteadoras.map((l) => ({
        loteadora: l.loteadoraNome,
        verificadas: l.parcelasVerificadas,
        atualizadas: l.atualizacoes,
        erros: l.erros.length,
        detalhes: l.detalhes
          .filter((d) => d.acao !== 'IGNORADO')
          .slice(0, 50)
          .map((d) => ({
            paymentId: d.paymentId,
            statusLocal: d.statusLocal,
            statusAsaas: d.statusAsaas,
            acao: d.acao,
          })),
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      totalAtualizacoes: 0,
      totalErros: 1,
      duracaoMs: 0,
      resumo: [],
      error: msg,
    };
  }
}

