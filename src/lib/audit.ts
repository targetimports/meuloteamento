import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type UserType = 'ADMIN' | 'CLIENTE' | 'SYSTEM';

export async function logVenda(input: {
  vendaId: string;
  action: string;
  diff?: Record<string, unknown> | null;
  motivo?: string | null;
  userId?: string | null;
  userType?: UserType;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  await db.vendaHistorico.create({
    data: {
      vendaId: input.vendaId,
      action: input.action,
      diff: (input.diff as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      motivo: input.motivo ?? null,
      userId: input.userId ?? null,
      userType: input.userType ?? 'SYSTEM',
    },
  });
}

export async function logParcela(input: {
  parcelaId: string;
  action: string;
  diff?: Record<string, unknown> | null;
  motivo?: string | null;
  userId?: string | null;
  userType?: UserType;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  await db.parcelaHistorico.create({
    data: {
      parcelaId: input.parcelaId,
      action: input.action,
      diff: (input.diff as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      motivo: input.motivo ?? null,
      userId: input.userId ?? null,
      userType: input.userType ?? 'SYSTEM',
    },
  });
}

export function buildDiff<T extends Record<string, unknown>>(antes: T, depois: T): Record<string, { antes: unknown; depois: unknown }> {
  const diff: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const k of Object.keys(depois)) {
    if (antes[k] !== depois[k]) {
      diff[k] = { antes: antes[k], depois: depois[k] };
    }
  }
  return diff;
}
