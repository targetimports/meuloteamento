'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

const empresaSchema = z.object({
  razaoSocial: z.string().trim().optional().nullable(),
  nomeFantasia: z.string().trim().optional().nullable(),
  cnpj: z.string().trim().optional().nullable(),
  inscricaoEstadual: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  estado: z.string().trim().optional().nullable(),
  cep: z.string().trim().optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
  logo: z.string().trim().optional().nullable(),

  asaasApiKey: z.string().trim().optional().nullable(),
  asaasSandbox: checkbox.default(true),

  bannerImagem: z.string().trim().optional().nullable(),
  bannerTitulo: z.string().trim().optional().nullable(),
  bannerSubtitulo: z.string().trim().optional().nullable(),
  sobreTexto: z.string().trim().optional().nullable(),
  contatoTexto: z.string().trim().optional().nullable(),
});

type FormState = { error?: string; ok?: boolean };

export async function salvarConfiguracoes(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: 'Não autorizado' };

  // Apenas SUPER_ADMIN e ADMIN podem alterar configurações da empresa
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return { error: 'Você não tem permissão para alterar as configurações da empresa.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = empresaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const data = parsed.data;
  const cleanString = (s: string | null | undefined) => (s && s.length > 0 ? s : null);

  await prisma.empresaConfig.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      ...mapClean(data, cleanString),
    },
    update: mapClean(data, cleanString),
  });

  revalidatePath('/admin/configuracoes');
  revalidatePath('/');
  revalidatePath('/sobre');
  revalidatePath('/contato');
  return { ok: true };
}

function mapClean(
  data: z.infer<typeof empresaSchema>,
  clean: (s: string | null | undefined) => string | null
) {
  return {
    razaoSocial: clean(data.razaoSocial),
    nomeFantasia: clean(data.nomeFantasia),
    cnpj: clean(data.cnpj),
    inscricaoEstadual: clean(data.inscricaoEstadual),
    endereco: clean(data.endereco),
    cidade: clean(data.cidade),
    estado: clean(data.estado),
    cep: clean(data.cep),
    telefone: clean(data.telefone),
    email: clean(data.email),
    whatsapp: clean(data.whatsapp),
    logo: clean(data.logo),
    asaasApiKey: clean(data.asaasApiKey),
    asaasSandbox: data.asaasSandbox,
    bannerImagem: clean(data.bannerImagem),
    bannerTitulo: clean(data.bannerTitulo),
    bannerSubtitulo: clean(data.bannerSubtitulo),
    sobreTexto: clean(data.sobreTexto),
    contatoTexto: clean(data.contatoTexto),
  };
}
