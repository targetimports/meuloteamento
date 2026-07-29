'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import {
  evolutionConfigured,
  evolutionBaseUrl,
  ensureInstance,
  fetchInstance,
  getConnectionState,
  getConnectQR,
  logoutInstance,
  sendTextViaEvolution,
  instanceNameForLoteadora,
} from '@/lib/evolution';

/**
 * Resolve a loteadora alvo respeitando o escopo da sessão:
 *  - admin de loteadora → só a própria
 *  - super admin → precisa informar loteadoraId
 */
async function resolveLoteadora(loteadoraId?: string) {
  const session = await requireAdmin();
  let id = session.loteadoraId;
  if (!id) {
    if (!loteadoraId) throw new Error('Selecione uma loteadora.');
    id = loteadoraId;
  } else if (loteadoraId && loteadoraId !== id) {
    throw new Error('Acesso negado a esta loteadora.');
  }
  const loteadora = await prisma.loteadora.findUnique({ where: { id } });
  if (!loteadora) throw new Error('Loteadora não encontrada.');
  return loteadora;
}

export type ConexaoResult =
  | { ok: true; qrBase64: string | null; pairingCode: string | null }
  | { ok: false; erro: string };

/** Cria/garante a instância e devolve o QR + código de pareamento. */
export async function iniciarConexaoWhatsApp(loteadoraId?: string): Promise<ConexaoResult> {
  if (!evolutionConfigured()) {
    return { ok: false, erro: 'Evolution não está configurada no servidor.' };
  }
  try {
    const loteadora = await resolveLoteadora(loteadoraId);
    const instanceName = instanceNameForLoteadora(loteadora.id, loteadora.whatsappInstance);
    const { apikey } = await ensureInstance(instanceName);

    // Persiste já o endereço/instância (NÃO ativa a cobrança aqui).
    await prisma.loteadora.update({
      where: { id: loteadora.id },
      data: {
        whatsappInstance: instanceName,
        whatsappBaseUrl: evolutionBaseUrl(),
        ...(apikey ? { whatsappToken: apikey } : {}),
      },
    });

    const qr = await getConnectQR(instanceName);
    return { ok: true, qrBase64: qr.base64, pairingCode: qr.pairingCode };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type StatusResult =
  | { ok: true; state: 'open' | 'connecting' | 'close' | 'unknown'; number: string | null }
  | { ok: false; erro: string };

/**
 * Checa o status da conexão. Quando conecta (open), configura o provider
 * 'evolution' na loteadora — mas NÃO liga a cobrança automática (isso é
 * controlado separadamente por ativarCobranca/desativarCobranca).
 */
export async function checarConexaoWhatsApp(loteadoraId?: string): Promise<StatusResult> {
  if (!evolutionConfigured()) return { ok: false, erro: 'Evolution não configurada.' };
  try {
    const loteadora = await resolveLoteadora(loteadoraId);
    const instanceName = instanceNameForLoteadora(loteadora.id, loteadora.whatsappInstance);
    const st = await getConnectionState(instanceName);

    if (st.state === 'open') {
      const fi = await fetchInstance(instanceName);
      await prisma.loteadora.update({
        where: { id: loteadora.id },
        data: {
          whatsappProvider: 'evolution',
          whatsappBaseUrl: evolutionBaseUrl(),
          whatsappInstance: instanceName,
          ...(fi.apikey ? { whatsappToken: fi.apikey } : {}),
          ...(st.number ? { whatsapp: st.number } : {}),
        },
      });
      revalidatePath('/admin/envios');
      return { ok: true, state: 'open', number: st.number };
    }
    return { ok: true, state: st.state, number: null };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Desconecta o WhatsApp: faz logout, limpa o provider E pausa a cobrança
 * (pra não gerar envios que falhariam sem WhatsApp).
 */
export async function desconectarWhatsApp(
  loteadoraId?: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const loteadora = await resolveLoteadora(loteadoraId);
    const instanceName = instanceNameForLoteadora(loteadora.id, loteadora.whatsappInstance);
    try {
      await logoutInstance(instanceName);
    } catch {
      /* logout pode falhar se já desconectado — segue */
    }
    await prisma.loteadora.update({
      where: { id: loteadora.id },
      data: { whatsappProvider: null },
    });
    if (loteadora.reguaCobrancaId) {
      await prisma.reguaCobranca.update({
        where: { id: loteadora.reguaCobrancaId },
        data: { ativa: false },
      });
    }
    revalidatePath('/admin/envios');
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * ATIVA a cobrança automática (liga a régua). Só permite se o WhatsApp já
 * estiver conectado — evita gerar envios que falhariam.
 */
export async function ativarCobranca(
  loteadoraId?: string
): Promise<{ ok: boolean; ativa?: boolean; erro?: string }> {
  try {
    const loteadora = await resolveLoteadora(loteadoraId);
    if (loteadora.whatsappProvider !== 'evolution') {
      return { ok: false, erro: 'Conecte o WhatsApp antes de ativar a cobrança.' };
    }
    if (!loteadora.reguaCobrancaId) {
      return { ok: false, erro: 'Nenhuma régua de cobrança vinculada a esta loteadora.' };
    }
    await prisma.reguaCobranca.update({
      where: { id: loteadora.reguaCobrancaId },
      data: { ativa: true },
    });
    revalidatePath('/admin/envios');
    return { ok: true, ativa: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** DESATIVA a cobrança automática (pausa a régua). Mantém o WhatsApp conectado. */
export async function desativarCobranca(
  loteadoraId?: string
): Promise<{ ok: boolean; ativa?: boolean; erro?: string }> {
  try {
    const loteadora = await resolveLoteadora(loteadoraId);
    if (!loteadora.reguaCobrancaId) return { ok: true, ativa: false };
    await prisma.reguaCobranca.update({
      where: { id: loteadora.reguaCobrancaId },
      data: { ativa: false },
    });
    revalidatePath('/admin/envios');
    return { ok: true, ativa: false };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Envia uma mensagem de teste (sem link, só confirma a conexão). */
export async function enviarTesteWhatsApp(
  numero: string,
  loteadoraId?: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const loteadora = await resolveLoteadora(loteadoraId);
    const instanceName = instanceNameForLoteadora(loteadora.id, loteadora.whatsappInstance);
    const d = String(numero).replace(/\D/g, '');
    if (!d) return { ok: false, erro: 'Número inválido.' };
    const intl = d.length <= 11 ? `55${d}` : d;
    const text =
      `✅ Teste de conexão — ${loteadora.nome}.\n` +
      `O WhatsApp da régua de cobrança está funcionando!`;
    return await sendTextViaEvolution(instanceName, intl, text);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
