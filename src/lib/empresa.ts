import { prisma } from '@/lib/prisma';
import type { EmpresaConfig } from '@prisma/client';

const SINGLETON_ID = 'singleton';

/**
 * Sempre retorna a config — cria se não existir (linha singleton).
 */
export async function getEmpresaConfig(): Promise<EmpresaConfig> {
  const existing = await prisma.empresaConfig.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (existing) return existing;

  return prisma.empresaConfig.create({
    data: { id: SINGLETON_ID },
  });
}
