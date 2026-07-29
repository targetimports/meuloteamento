/**
 * Helpers para garantir que um Cliente local tenha um asaasCustomerId
 * válido no provedor Asaas. Cria no Asaas se ainda não existir.
 */

import { prisma } from './prisma';
import type { AsaasContext } from './asaas';
import { createCustomer, getCustomer, AsaasError } from './asaas';

interface ClienteLike {
  id?: string;
  nome: string;
  email?: string | null;
  cpfCnpj: string;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  asaasCustomerId?: string | null;
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

/**
 * Garante que o cliente local possui asaasCustomerId.
 *  - Se já existe, valida que ainda responde no Asaas. Se 404, recria.
 *  - Se ainda não existe, cria no Asaas e persiste no banco.
 *
 * Aceita um cliente já persistido (com id) — neste caso atualiza o registro.
 */
export async function ensureAsaasCustomerForCliente(
  ctx: AsaasContext,
  cliente: ClienteLike
): Promise<string> {
  // Valida existente
  if (cliente.asaasCustomerId) {
    try {
      const c = await getCustomer(ctx, cliente.asaasCustomerId);
      if (c?.id) return c.id;
    } catch (err) {
      if (!(err instanceof AsaasError) || err.status !== 404) {
        throw err;
      }
      // 404 → cliente foi apagado no Asaas, recriamos
    }
  }

  const created = await createCustomer(ctx, {
    name: cliente.nome,
    email: cliente.email || `${onlyDigits(cliente.cpfCnpj)}@semcontato.local`,
    cpfCnpj: onlyDigits(cliente.cpfCnpj),
    mobilePhone: cliente.telefone ? onlyDigits(cliente.telefone) : undefined,
    postalCode: cliente.cep ? onlyDigits(cliente.cep) : undefined,
    address: cliente.logradouro || undefined,
    addressNumber: cliente.numero || undefined,
    complement: cliente.complemento || undefined,
    province: cliente.bairro || undefined,
    externalReference: cliente.id,
    notificationDisabled: false,
  });

  if (cliente.id) {
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { asaasCustomerId: created.id },
    });
  }

  return created.id;
}
