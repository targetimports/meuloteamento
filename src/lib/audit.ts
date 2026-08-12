import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type UserType = 'ADMIN' | 'CLIENTE' | 'SYSTEM';

/**
 * Registra quem abriu o documento pessoal de quem.
 *
 * Documento de identidade não é um arquivo qualquer: quem o vê, quando e de
 * onde é informação que a LGPD espera que exista, e é o que permite responder
 * "houve acesso indevido?" — pergunta que ficou sem resposta no incidente de
 * 11/08/2026, porque o nginx servia esses arquivos com `access_log off`.
 *
 * Nunca derruba a requisição: falhar a leitura de um documento porque o log
 * não gravou seria trocar um problema pequeno por um grande. O erro sobe para
 * o log do processo e a vida segue.
 */
export async function logAcessoDocumento(input: {
  entity: 'FormularioArquivo' | 'VendaArquivo';
  arquivoId: string;
  action?: 'VISUALIZOU' | 'BAIXOU' | 'EXCLUIU';
  userId?: string | null;
  ip?: string | null;
  contexto?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userType: 'ADMIN',
        action: `DOCUMENTO_${input.action ?? 'VISUALIZOU'}`,
        entity: input.entity,
        entityId: input.arquivoId,
        ip: input.ip ?? null,
        diff: (input.contexto as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (e) {
    console.error('[audit] falha ao registrar acesso a documento', e);
  }
}

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
