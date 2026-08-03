'use server';

/**
 * Gestão de empresas-cliente pelo backoffice.
 *
 * POR QUE NÃO REUSA as actions de /admin/loteadoras: aquelas redirecionam
 * para /admin/loteadoras/<id> no fim, o que jogaria o super admin de volta
 * no painel do cliente. E o schema de validação de lá não pode ser
 * importado — o arquivo é 'use server', que só exporta funções async.
 *
 * O cadastro aqui é DELIBERADAMENTE enxuto: identificação e contato, que é
 * o que o provedor precisa para abrir a conta. Chaves de Asaas, WhatsApp,
 * assinatura digital e representante legal continuam sendo configuradas na
 * tela própria da loteadora, que já existe e é onde o cliente mexe. Duplicar
 * aqueles 35 campos só criaria dois lugares para a mesma coisa divergir.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

const soDigitos = (v?: string | null) => (v ? v.replace(/\D/g, '') || null : null);
const limpo = (v?: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

const empresaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório'),
  slug: z.string().trim().optional(),
  razaoSocial: z.string().trim().optional(),
  cnpj: z.string().trim().optional(),
  email: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  estado: z.string().trim().optional(),
});

export type EstadoForm = { error?: string; ok?: boolean };

export async function criarEmpresa(
  _prev: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  await requireBackoffice();

  const parsed = empresaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;
  const slug = slugify(d.slug?.trim() ? d.slug : d.nome);
  if (!slug) return { error: 'Não foi possível gerar o endereço (slug) a partir do nome.' };

  // O slug vira subdomínio da empresa, então colisão não é detalhe.
  if (await prisma.loteadora.findUnique({ where: { slug } })) {
    return { error: `Já existe empresa com o endereço "${slug}". Informe outro.` };
  }

  const cnpj = soDigitos(d.cnpj);
  if (cnpj && (await prisma.loteadora.findUnique({ where: { cnpj } }))) {
    return { error: 'Já existe empresa com este CNPJ.' };
  }

  const criada = await prisma.loteadora.create({
    data: {
      nome: d.nome.trim(),
      slug,
      razaoSocial: limpo(d.razaoSocial),
      cnpj,
      email: limpo(d.email),
      telefone: limpo(d.telefone),
      cidade: limpo(d.cidade),
      estado: limpo(d.estado)?.toUpperCase() ?? null,
      ativo: true,
    },
  });

  revalidatePath('/backoffice/empresas');
  revalidatePath('/backoffice');
  redirect(`/backoffice/empresas/${criada.id}`);
}

/**
 * Liga/desliga a empresa. `ativo=false` já impedia o login dos usuários dela
 * antes deste backoffice existir — é um corte de acesso de verdade, não um
 * rótulo. Diferente do bloqueio por inadimplência, que ainda não corta nada.
 */
export async function alternarEmpresaAtiva(id: string): Promise<void> {
  await requireBackoffice();

  const empresa = await prisma.loteadora.findUnique({
    where: { id },
    select: { ativo: true },
  });
  if (!empresa) throw new Error('Empresa não encontrada.');

  await prisma.loteadora.update({ where: { id }, data: { ativo: !empresa.ativo } });

  revalidatePath(`/backoffice/empresas/${id}`);
  revalidatePath('/backoffice/empresas');
}

/**
 * Atualiza só os dados cadastrais que o backoffice controla. Os campos
 * técnicos (chaves, branding, representante) não são tocados — ficam como
 * estão, sob responsabilidade da tela da própria loteadora.
 */
export async function atualizarDadosEmpresa(
  _prev: EstadoForm,
  formData: FormData
): Promise<EstadoForm> {
  await requireBackoffice();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { error: 'Empresa não informada.' };

  const parsed = empresaSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const d = parsed.data;

  const slug = slugify(d.slug?.trim() ? d.slug : d.nome);
  const conflitoSlug = await prisma.loteadora.findFirst({
    where: { slug, NOT: { id } },
    select: { id: true },
  });
  if (conflitoSlug) return { error: `O endereço "${slug}" já está em uso.` };

  const cnpj = soDigitos(d.cnpj);
  if (cnpj) {
    const conflitoCnpj = await prisma.loteadora.findFirst({
      where: { cnpj, NOT: { id } },
      select: { id: true },
    });
    if (conflitoCnpj) return { error: 'CNPJ já cadastrado em outra empresa.' };
  }

  await prisma.loteadora.update({
    where: { id },
    data: {
      nome: d.nome.trim(),
      slug,
      razaoSocial: limpo(d.razaoSocial),
      cnpj,
      email: limpo(d.email),
      telefone: limpo(d.telefone),
      cidade: limpo(d.cidade),
      estado: limpo(d.estado)?.toUpperCase() ?? null,
    },
  });

  revalidatePath(`/backoffice/empresas/${id}`);
  revalidatePath('/backoffice/empresas');
  return { ok: true };
}
