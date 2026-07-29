'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

function onlyDigits(s?: string | null) {
  return (s ?? '').replace(/\D/g, '');
}

const baseSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  cpfCnpj: z
    .string()
    .trim()
    .min(11, 'CPF/CNPJ obrigatório')
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length === 11 || v.length === 14, {
      message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos',
    }),
  telefone: z
    .string()
    .trim()
    .min(8, 'Telefone obrigatório')
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length >= 10 && v.length <= 11, {
      message: 'Telefone deve ter 10 ou 11 dígitos (com DDD)',
    }),
  rg: z.string().trim().optional().nullable(),
  dataNascimento: z.string().trim().optional().nullable(),

  nacionalidade: z.string().trim().optional().nullable(),
  estadoCivil: z.string().trim().optional().nullable(),
  profissao: z.string().trim().optional().nullable(),

  cep: z.string().trim().optional().nullable(),
  logradouro: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  complemento: z.string().trim().optional().nullable(),
  bairro: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  estado: z.string().trim().optional().nullable(),

  aceitaWhatsApp: checkbox.default(true),
  aceitaEmail: checkbox.default(true),
});

type FormState = { error?: string; ok?: boolean; clienteId?: string };

function buildData(parsed: z.infer<typeof baseSchema>) {
  const dataNasc = parsed.dataNascimento
    ? new Date(parsed.dataNascimento + 'T00:00:00')
    : null;
  return {
    nome: parsed.nome,
    email: parsed.email,
    cpfCnpj: parsed.cpfCnpj,
    telefone: parsed.telefone,
    rg: parsed.rg?.trim() || null,
    dataNascimento: dataNasc && !isNaN(dataNasc.getTime()) ? dataNasc : null,
    nacionalidade: parsed.nacionalidade?.trim() || null,
    estadoCivil: parsed.estadoCivil?.trim() || null,
    profissao: parsed.profissao?.trim() || null,
    cep: parsed.cep ? onlyDigits(parsed.cep) : null,
    logradouro: parsed.logradouro?.trim() || null,
    numero: parsed.numero?.trim() || null,
    complemento: parsed.complemento?.trim() || null,
    bairro: parsed.bairro?.trim() || null,
    cidade: parsed.cidade?.trim() || null,
    estado: parsed.estado?.trim().toUpperCase() || null,
    aceitaWhatsApp: parsed.aceitaWhatsApp,
    aceitaEmail: parsed.aceitaEmail,
  };
}

export async function criarCliente(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = buildData(parsed.data);

  // Verifica duplicidade (cpf OU email)
  const existente = await prisma.cliente.findFirst({
    where: {
      OR: [{ cpfCnpj: data.cpfCnpj }, { email: data.email }],
    },
    select: { id: true, cpfCnpj: true, email: true },
  });
  if (existente) {
    const motivo =
      existente.cpfCnpj === data.cpfCnpj
        ? 'Já existe cliente com este CPF/CNPJ'
        : 'Já existe cliente com este e-mail';
    return { error: `${motivo}. ID existente: ${existente.id}` };
  }

  const novo = await prisma.cliente.create({ data });

  revalidatePath('/admin/clientes');
  redirect(`/admin/clientes/${novo.id}?msg=criado`);
}

export async function atualizarCliente(
  clienteId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = buildData(parsed.data);

  const atual = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!atual) return { error: 'Cliente não encontrado' };

  // Conflito com OUTRO cliente?
  const conflito = await prisma.cliente.findFirst({
    where: {
      AND: [
        { NOT: { id: clienteId } },
        { OR: [{ cpfCnpj: data.cpfCnpj }, { email: data.email }] },
      ],
    },
    select: { cpfCnpj: true, email: true },
  });
  if (conflito) {
    const motivo =
      conflito.cpfCnpj === data.cpfCnpj
        ? 'Outro cliente já usa este CPF/CNPJ'
        : 'Outro cliente já usa este e-mail';
    return { error: motivo };
  }

  await prisma.cliente.update({ where: { id: clienteId }, data });

  revalidatePath('/admin/clientes');
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { ok: true, clienteId };
}
