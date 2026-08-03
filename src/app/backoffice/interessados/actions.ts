'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { sendEmail } from '@/lib/comunicacao';

type FormState = { error?: string; ok?: boolean };

const STATUS = ['NOVO', 'NEGOCIANDO', 'CLIENTE', 'PERDIDO'] as const;

const mudarStatusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(STATUS),
});

/** Move o interessado no funil (Novo → Negociando → Cliente/Perdido). */
export async function mudarStatusInteressado(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBackoffice();

  const parsed = mudarStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Dados inválidos' };

  await prisma.interessado.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  revalidatePath('/backoffice/interessados');
  return { ok: true };
}

function escapar(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const responderSchema = z.object({
  id: z.string().trim().min(1),
  mensagem: z.string().trim().min(5, 'Escreva uma mensagem').max(5000),
});

/**
 * Responde o interessado por e-mail, pelo servidor (Resend), e registra o
 * envio. So marca como respondido se o provedor aceitou — senao o card diria
 * "respondido" para uma mensagem que nunca saiu.
 */
export async function responderInteressado(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBackoffice();

  const parsed = responderSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const interessado = await prisma.interessado.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, nome: true, email: true, plano: true, status: true },
  });
  if (!interessado) return { error: 'Interessado não encontrado' };

  const texto = parsed.data.mensagem;
  const assunto = `Sobre seu interesse no plano ${interessado.plano} — Meu Loteamento`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0f172a;max-width:560px">
      <p>Olá, ${escapar(interessado.nome.split(' ')[0])}!</p>
      <div style="white-space:pre-wrap">${escapar(texto)}</div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 12px" />
      <p style="color:#64748b;font-size:13px;margin:0">
        Meu Loteamento — plataforma para venda de loteamentos<br />
        <a href="https://meuloteamento.com" style="color:#64748b">meuloteamento.com</a>
      </p>
    </div>`;

  const resultado = await sendEmail({
    loteadoraId: null,
    destinatario: interessado.email,
    assunto,
    corpo: html,
  });

  // Guarda a resposta enviada (ou a tentativa falha) para virar historico.
  await prisma.envioComunicacao
    .create({
      data: {
        canal: 'EMAIL',
        destinatario: interessado.email,
        assunto,
        corpo: texto,
        status: resultado.ok ? 'ENVIADO' : 'FALHOU',
        providerId: resultado.providerId ?? null,
        erro: resultado.erro ?? null,
        tentativas: 1,
        enviadoEm: resultado.ok ? new Date() : null,
      },
    })
    .catch(() => {});

  if (!resultado.ok) {
    return { error: `Não foi possível enviar: ${resultado.erro ?? 'erro desconhecido'}` };
  }

  await prisma.interessado.update({
    where: { id: interessado.id },
    data: {
      respondidoEm: new Date(),
      // So promove quem ainda estava parado em NOVO; nao rebaixa quem ja
      // virou CLIENTE nem ressuscita PERDIDO.
      ...(interessado.status === 'NOVO' ? { status: 'NEGOCIANDO' as const } : {}),
    },
  });

  revalidatePath('/backoffice/interessados');
  return { ok: true };
}

const observacoesSchema = z.object({
  id: z.string().trim().min(1),
  observacoes: z.string().trim().max(2000),
});

/** Anotacao interna do time comercial. */
export async function salvarObservacoes(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBackoffice();

  const parsed = observacoesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: 'Dados inválidos' };

  await prisma.interessado.update({
    where: { id: parsed.data.id },
    data: { observacoes: parsed.data.observacoes || null },
  });

  revalidatePath('/backoffice/interessados');
  return { ok: true };
}
