'use server';

/**
 * Perfil do usuário logado no backoffice.
 *
 * Wrappers sobre as actions de /admin/perfil, não cópias. Aquelas já fazem o
 * certo e não são específicas de loteadora: trabalham sobre a sessão, checam
 * e-mail duplicado e — o detalhe fácil de esquecer — reemitem o cookie de
 * sessão quando nome ou e-mail mudam, senão o cabeçalho segue mostrando o
 * dado velho até o próximo login.
 *
 * O que os wrappers acrescentam é o guard do backoffice e a invalidação
 * desta rota.
 */

import { revalidatePath } from 'next/cache';
import { requireBackoffice } from '@/lib/backoffice';
import {
  atualizarPerfil as _atualizarPerfil,
  trocarSenha as _trocarSenha,
} from '@/app/admin/(dashboard)/perfil/actions';

type EstadoForm = { error?: string; ok?: string };

export async function atualizarMeuPerfil(
  prev: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  await requireBackoffice();
  const r = await _atualizarPerfil(prev, formData);
  revalidatePath('/backoffice/perfil');
  revalidatePath('/backoffice');
  return r;
}

export async function trocarMinhaSenha(
  prev: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  await requireBackoffice();
  return _trocarSenha(prev, formData);
}
