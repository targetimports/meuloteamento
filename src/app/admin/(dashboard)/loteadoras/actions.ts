'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

const loteadoraSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório'),
  slug: z.string().trim().optional(),
  razaoSocial: z.string().trim().optional().nullable(),
  nomeFantasia: z.string().trim().optional().nullable(),
  cnpj: z.string().trim().optional().nullable(),
  inscricaoEstadual: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  estado: z.string().trim().optional().nullable(),
  cep: z.string().trim().optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  site: z.string().trim().optional().nullable(),
  logo: z.string().trim().optional().nullable(),
  corPrimaria: z.string().trim().optional().nullable(),
  corSecundaria: z.string().trim().optional().nullable(),
  asaasApiKey: z.string().trim().optional().nullable(),
  asaasSandbox: checkbox.default(true),
  sobreTexto: z.string().trim().optional().nullable(),
  ativo: checkbox.default(true),
  // Comunicação
  whatsappProvider: z.string().trim().optional().nullable(),
  whatsappToken: z.string().trim().optional().nullable(),
  whatsappInstance: z.string().trim().optional().nullable(),
  whatsappBaseUrl: z.string().trim().optional().nullable(),
  emailFromAddress: z.string().trim().optional().nullable(),
  emailReplyTo: z.string().trim().optional().nullable(),
  // Assinatura digital
  signProvider: z.string().trim().optional().nullable(),
  signApiToken: z.string().trim().optional().nullable(),
  signSandbox: checkbox.default(true),
  // Representante legal
  representanteNome: z.string().trim().optional().nullable(),
  representanteCpf: z.string().trim().optional().nullable(),
  representanteRg: z.string().trim().optional().nullable(),
  representanteCargo: z.string().trim().optional().nullable(),
});

type FormState = { error?: string; ok?: boolean };

function buildData(parsed: z.infer<typeof loteadoraSchema>) {
  const clean = (s: string | null | undefined) => (s && s.length > 0 ? s : null);
  const cleanDigits = (s: string | null | undefined) => {
    if (!s) return null;
    const d = s.replace(/\D/g, '');
    return d.length > 0 ? d : null;
  };
  return {
    nome: parsed.nome,
    razaoSocial: clean(parsed.razaoSocial),
    nomeFantasia: clean(parsed.nomeFantasia),
    cnpj: cleanDigits(parsed.cnpj),
    inscricaoEstadual: clean(parsed.inscricaoEstadual),
    endereco: clean(parsed.endereco),
    cidade: clean(parsed.cidade),
    estado: clean(parsed.estado?.toUpperCase() ?? null),
    cep: clean(parsed.cep),
    telefone: clean(parsed.telefone),
    whatsapp: clean(parsed.whatsapp),
    email: clean(parsed.email),
    site: clean(parsed.site),
    logo: clean(parsed.logo),
    corPrimaria: clean(parsed.corPrimaria),
    corSecundaria: clean(parsed.corSecundaria),
    asaasApiKey: clean(parsed.asaasApiKey),
    asaasSandbox: parsed.asaasSandbox,
    sobreTexto: clean(parsed.sobreTexto),
    ativo: parsed.ativo,
    whatsappProvider: clean(parsed.whatsappProvider),
    whatsappToken: clean(parsed.whatsappToken),
    whatsappInstance: clean(parsed.whatsappInstance),
    whatsappBaseUrl: clean(parsed.whatsappBaseUrl),
    emailFromAddress: clean(parsed.emailFromAddress),
    emailReplyTo: clean(parsed.emailReplyTo),
    signProvider: clean(parsed.signProvider),
    signApiToken: clean(parsed.signApiToken),
    signSandbox: parsed.signSandbox,
    representanteNome: clean(parsed.representanteNome),
    representanteCpf: cleanDigits(parsed.representanteCpf),
    representanteRg: clean(parsed.representanteRg),
    representanteCargo: clean(parsed.representanteCargo),
  };
}

export async function criarLoteadora(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loteadoraSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const data = buildData(parsed.data);
  const slug = parsed.data.slug?.trim() ? slugify(parsed.data.slug) : slugify(parsed.data.nome);

  const existing = await prisma.loteadora.findUnique({ where: { slug } });
  if (existing) return { error: `Já existe uma loteadora com slug "${slug}".` };

  if (data.cnpj) {
    const cnpjConflict = await prisma.loteadora.findUnique({ where: { cnpj: data.cnpj } });
    if (cnpjConflict) return { error: 'Já existe loteadora com este CNPJ.' };
  }

  const created = await prisma.loteadora.create({ data: { ...data, slug } });

  revalidatePath('/admin/loteadoras');
  redirect(`/admin/loteadoras/${created.id}`);
}

export async function atualizarLoteadora(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loteadoraSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

  const data = buildData(parsed.data);
  const slug = parsed.data.slug?.trim() ? slugify(parsed.data.slug) : slugify(parsed.data.nome);

  const slugConflict = await prisma.loteadora.findFirst({
    where: { slug, NOT: { id } },
  });
  if (slugConflict) return { error: `Slug "${slug}" já está em uso.` };

  if (data.cnpj) {
    const cnpjConflict = await prisma.loteadora.findFirst({
      where: { cnpj: data.cnpj, NOT: { id } },
    });
    if (cnpjConflict) return { error: 'CNPJ já cadastrado em outra loteadora.' };
  }

  await prisma.loteadora.update({ where: { id }, data: { ...data, slug } });

  revalidatePath('/admin/loteadoras');
  revalidatePath(`/admin/loteadoras/${id}`);
  return { ok: true };
}

export async function excluirLoteadora(id: string): Promise<void> {
  const count = await prisma.loteamento.count({ where: { loteadoraId: id } });
  if (count > 0) {
    throw new Error(`Não é possível excluir: loteadora tem ${count} loteamento(s) vinculado(s).`);
  }
  await prisma.loteadora.delete({ where: { id } });
  revalidatePath('/admin/loteadoras');
  redirect('/admin/loteadoras');
}

// ====================================================================
// SENHA DE AUTORIZAÇÃO — venda SEM entrada
// ====================================================================
// Bloqueia que o admin lance venda com valorEntrada=0 sem digitar
// uma senha pré-definida. Hash bcrypt salvo em Loteadora.vendaSemEntradaSenhaHash.
// NULL no banco = não autorizado (zera ENT é bloqueado totalmente).
// ====================================================================
import bcrypt from 'bcryptjs';
import { requireAdmin, canAccessLoteadora } from '@/lib/tenant';

type SenhaState = { ok?: boolean; error?: string; mensagem?: string };

export async function definirSenhaVendaSemEntrada(
  loteadoraId: string,
  _prev: SenhaState,
  formData: FormData
): Promise<SenhaState> {
  const session = await requireAdmin();
  if (!(await canAccessLoteadora(loteadoraId))) {
    return { error: 'Sem permissão para esta loteadora' };
  }
  // Só ADMIN e SUPER_ADMIN podem definir essa senha (não OPERADOR)
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return { error: 'Apenas administradores podem definir essa senha' };
  }

  const acao = String(formData.get('acao') || 'set').trim();

  if (acao === 'remover') {
    await prisma.loteadora.update({
      where: { id: loteadoraId },
      data: { vendaSemEntradaSenhaHash: null },
    });
    revalidatePath(`/admin/loteadoras/${loteadoraId}`);
    return { ok: true, mensagem: 'Senha removida — vendas sem entrada estão BLOQUEADAS.' };
  }

  const senha = String(formData.get('senha') || '').trim();
  const senha2 = String(formData.get('senhaConfirma') || '').trim();
  if (senha.length < 4) {
    return { error: 'A senha deve ter pelo menos 4 caracteres' };
  }
  if (senha !== senha2) {
    return { error: 'A confirmação não bate com a senha' };
  }

  const hash = await bcrypt.hash(senha, 10);
  await prisma.loteadora.update({
    where: { id: loteadoraId },
    data: { vendaSemEntradaSenhaHash: hash },
  });
  revalidatePath(`/admin/loteadoras/${loteadoraId}`);
  return {
    ok: true,
    mensagem: 'Senha definida — agora vendas sem entrada exigem esta senha.',
  };
}
