/**
 * Resolve qual chave Asaas usar para cada cenário:
 *
 *  - assinatura SaaS (cobrar das loteadoras)  → chave da plataforma
 *  - venda/cobrança de cliente final           → chave DA LOTEADORA (com fallback p/ plataforma)
 */

import { prisma } from './prisma';
import type { AsaasContext } from './asaas';
import { envContext } from './asaas';

/**
 * Chave Asaas DA LOTEADORA.
 *
 * Para emitir cobranças de clientes finais. Usa a chave da loteadora.
 * Se a loteadora não tem chave configurada, faz fallback para:
 *   1. EmpresaConfig (chave da plataforma)
 *   2. .env
 *
 * Retorna null se nenhuma chave estiver disponível.
 */
export async function getLoteadoraAsaasContext(
  loteadoraId: string
): Promise<AsaasContext | null> {
  const loteadora = await prisma.loteadora.findUnique({
    where: { id: loteadoraId },
    select: { asaasApiKey: true, asaasSandbox: true },
  });

  if (loteadora?.asaasApiKey) {
    return {
      apiKey: loteadora.asaasApiKey,
      sandbox: loteadora.asaasSandbox,
    };
  }

  return getPlatformAsaasContext();
}

/**
 * Chave Asaas DA PLATAFORMA (meuloteamento).
 *
 * Usada para cobrar a assinatura SaaS das loteadoras. Lê do EmpresaConfig
 * primeiro, faz fallback para .env.
 */
export async function getPlatformAsaasContext(): Promise<AsaasContext | null> {
  const cfg = await prisma.empresaConfig.findUnique({
    where: { id: 'singleton' },
    select: { asaasApiKey: true, asaasSandbox: true },
  });

  if (cfg?.asaasApiKey) {
    return {
      apiKey: cfg.asaasApiKey,
      sandbox: cfg.asaasSandbox,
    };
  }

  return envContext();
}
