'use server';

/**
 * Usuários de uma empresa-cliente, vistos pelo backoffice.
 *
 * São WRAPPERS finos sobre as actions que já existem em /admin/loteadoras —
 * não cópias. A regra de quem pode criar, resetar senha e excluir usuário já
 * está escrita e em uso pela Germanos; reescrevê-la aqui criaria dois donos
 * da mesma regra, e um deles ficaria para trás na primeira mudança.
 *
 * O que os wrappers acrescentam é só o revalidatePath desta rota: as
 * originais invalidam o cache de /admin/loteadoras, que não é onde estamos.
 */

import { revalidatePath } from 'next/cache';
import { requireBackoffice } from '@/lib/backoffice';
import {
  criarUsuarioLoteadora,
  resetarSenhaUsuario,
  toggleAtivoUsuario,
  excluirUsuarioLoteadora,
} from '@/app/admin/(dashboard)/loteadoras/[id]/usuarios/actions';

type FormState = {
  error?: string;
  ok?: boolean;
  senhaGerada?: string;
  emailCriado?: string;
};

function revalidar(loteadoraId: string) {
  revalidatePath(`/backoffice/empresas/${loteadoraId}/usuarios`);
  revalidatePath(`/backoffice/empresas/${loteadoraId}`);
}

export async function criarUsuario(
  loteadoraId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBackoffice();
  const r = await criarUsuarioLoteadora(loteadoraId, prev, formData);
  revalidar(loteadoraId);
  return r;
}

export async function resetarSenha(
  loteadoraId: string,
  userId: string
): Promise<{ ok: boolean; senha?: string; error?: string }> {
  await requireBackoffice();
  const r = await resetarSenhaUsuario(loteadoraId, userId);
  revalidar(loteadoraId);
  return r;
}

export async function alternarAtivo(loteadoraId: string, userId: string): Promise<void> {
  await requireBackoffice();
  await toggleAtivoUsuario(loteadoraId, userId);
  revalidar(loteadoraId);
}

export async function excluirUsuario(loteadoraId: string, userId: string): Promise<void> {
  await requireBackoffice();
  await excluirUsuarioLoteadora(loteadoraId, userId);
  revalidar(loteadoraId);
}
