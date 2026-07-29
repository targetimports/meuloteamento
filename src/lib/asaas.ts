/**
 * Cliente da API Asaas.
 * Docs: https://docs.asaas.com/reference
 *
 * Suporta CHAVE POR LOTEADORA: cada chamada pode passar a apiKey + sandbox
 * flags explicitamente (via objeto AsaasContext). Quando omitido, cai no .env.
 */

const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';
const PROD_URL = 'https://api.asaas.com/v3';

export interface AsaasContext {
  apiKey: string;
  sandbox: boolean;
}

/** Contexto padrão a partir das variáveis de ambiente. */
export function envContext(): AsaasContext | null {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return null;
  const sandbox = (process.env.ASAAS_API_URL || SANDBOX_URL).includes('sandbox');
  return { apiKey: key, sandbox };
}

export class AsaasError extends Error {
  constructor(public status: number, public body: string) {
    super(`Asaas ${status}: ${body}`);
    this.name = 'AsaasError';
  }
}

export async function request<T>(
  path: string,
  ctx: AsaasContext,
  init?: RequestInit
): Promise<T> {
  if (!ctx?.apiKey) throw new Error('Asaas: apiKey ausente neste contexto');

  const baseUrl = ctx.sandbox ? SANDBOX_URL : PROD_URL;
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: ctx.apiKey,
      'User-Agent': 'meuloteamento/0.1',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AsaasError(res.status, body);
  }
  return res.json() as Promise<T>;
}

// =====================================================================
// CLIENTES
// =====================================================================

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export function createCustomer(ctx: AsaasContext, input: CreateCustomerInput) {
  return request<AsaasCustomer>('/customers', ctx, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCustomer(ctx: AsaasContext, id: string) {
  return request<AsaasCustomer>(`/customers/${id}`, ctx);
}

export function updateCustomer(
  ctx: AsaasContext,
  id: string,
  input: Partial<CreateCustomerInput>
) {
  return request<AsaasCustomer>(`/customers/${id}`, ctx, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// =====================================================================
// COBRANÇAS (payments)
// =====================================================================

export type AsaasBillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

export interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  externalReference?: string;
  description?: string;
}

export interface CreatePaymentInput {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  totalValue?: number;
  postalService?: boolean;
}

export function createPayment(ctx: AsaasContext, input: CreatePaymentInput) {
  return request<AsaasPayment>('/payments', ctx, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Helper que sempre envia o externalReference para facilitar reconciliação.
 * O Asaas devolve esse campo no payload do webhook.
 */
export function createPaymentForParcela(
  ctx: AsaasContext,
  input: {
    customer: string;
    billingType: AsaasBillingType;
    value: number;
    dueDate: string;
    parcelaId: string;
    description?: string;
    /**
     * Número de parcelas no CARTÃO DE CRÉDITO (1..12). Quando > 1, manda
     * `totalValue` + `installmentCount` ao invés de `value` simples — o Asaas
     * cria um plano de parcelas no cartão e o cliente paga em N vezes.
     * Ignorado se billingType !== 'CREDIT_CARD'.
     */
    installmentCount?: number;
  }
) {
  const base: CreatePaymentInput = {
    customer: input.customer,
    billingType: input.billingType,
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.parcelaId, // ← chave para reconciliar via webhook
  };
  // Cartão parcelado: a API do Asaas exige totalValue + installmentCount
  // (não passa value sozinho). value vira opcional nesse caso, mas mantemos
  // por defensive default — o Asaas prioriza totalValue/installmentCount.
  if (
    input.billingType === 'CREDIT_CARD' &&
    input.installmentCount &&
    input.installmentCount > 1
  ) {
    base.totalValue = input.value;
    base.installmentCount = input.installmentCount;
  }
  return createPayment(ctx, base);
}

export function getPayment(ctx: AsaasContext, id: string) {
  return request<AsaasPayment>(`/payments/${id}`, ctx);
}

export function deletePayment(ctx: AsaasContext, id: string) {
  return request<{ deleted: boolean; id: string }>(`/payments/${id}`, ctx, {
    method: 'DELETE',
  });
}

// =====================================================================
// PIX
// =====================================================================

export interface PixQrCode {
  encodedImage: string; // base64
  payload: string; // copia-e-cola
  expirationDate: string;
}

export function getPixQrCode(ctx: AsaasContext, paymentId: string) {
  return request<PixQrCode>(`/payments/${paymentId}/pixQrCode`, ctx);
}

// =====================================================================
// WEBHOOK — tipos do payload recebido
// =====================================================================

export type AsaasWebhookEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_RESTORED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_RECEIVED_IN_CASH_UNDONE'
  | 'PAYMENT_CHARGEBACK_REQUESTED'
  | 'PAYMENT_CHARGEBACK_DISPUTE'
  | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
  | 'PAYMENT_DUNNING_RECEIVED'
  | 'PAYMENT_DUNNING_REQUESTED'
  | 'PAYMENT_BANK_SLIP_VIEWED'
  | 'PAYMENT_CHECKOUT_VIEWED';

export interface AsaasWebhookPayload {
  event: AsaasWebhookEvent;
  payment: AsaasPayment;
}
