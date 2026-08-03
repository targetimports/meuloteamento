'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';

/** Slug estável a partir do nome: "Profissional" -> "profissional". */
function paraSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Aceita "590", "590,00" e "1.234,56" — é o que se digita na prática. */
function paraNumero(v: FormDataEntryValue | null): number {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function paraInteiroOuNulo(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export type EstadoPlano = { error?: string; ok?: boolean };

/**
 * Devolve o erro em vez de lançar: o formulário vive num modal, e uma
 * exceção derrubaria a tela inteira em cima de quem só digitou um valor
 * errado. Com estado, o modal mostra a mensagem e mantém o que foi digitado.
 */
export async function salvarPlano(
  _prev: EstadoPlano,
  formData: FormData
): Promise<EstadoPlano> {
  await requireBackoffice();

  const id = String(formData.get('id') ?? '').trim();
  const nome = String(formData.get('nome') ?? '').trim();
  if (!nome) return { error: 'Informe o nome do plano.' };

  const valorMensal = paraNumero(formData.get('valorMensal'));
  if (valorMensal <= 0) return { error: 'Informe uma mensalidade maior que zero.' };

  const slug = paraSlug(nome);
  if (!slug) return { error: 'O nome precisa ter ao menos uma letra ou número.' };

  // Slug duplicado explodiria na constraint do banco com erro incompreensível.
  const conflito = await prisma.plano.findFirst({
    where: { slug, ...(id ? { NOT: { id } } : {}) },
    select: { nome: true },
  });
  if (conflito) {
    return { error: `Já existe um plano chamado "${conflito.nome}".` };
  }

  const dados = {
    nome,
    slug,
    valorMensal,
    descricao: String(formData.get('descricao') ?? '').trim() || null,
    maxLoteamentos: paraInteiroOuNulo(formData.get('maxLoteamentos')),
    maxLotes: paraInteiroOuNulo(formData.get('maxLotes')),
    maxUsuarios: paraInteiroOuNulo(formData.get('maxUsuarios')),
    ativo: formData.get('ativo') === 'on',
  };

  if (id) {
    await prisma.plano.update({ where: { id }, data: dados });
  } else {
    await prisma.plano.create({ data: dados });
  }

  revalidatePath('/backoffice/planos');
  revalidatePath('/backoffice/empresas');
  return { ok: true };
}

/**
 * Cria os planos que a landing já anuncia.
 *
 * Os planos vivem hoje como texto em landing-interactive.tsx e o visitante
 * escolhe um deles no modal de contato. Enquanto não existirem como dado,
 * a assinatura não tem a que se vincular — e digitar de novo o que já está
 * publicado é convite a divergir do site.
 *
 * Não sobrescreve nada: plano com o mesmo slug é pulado. Rodar duas vezes
 * não duplica.
 */
export async function criarPlanosDaLanding(): Promise<void> {
  await requireBackoffice();

  const daLanding = [
    {
      nome: 'Profissional',
      slug: 'profissional',
      valorMensal: 500,
      descricao: 'O escolhido por quem leva a sério',
      maxLoteamentos: 5,
      maxLotes: null,
      maxUsuarios: null,
      ordem: 1,
    },
    {
      nome: 'Empresarial',
      slug: 'empresarial',
      valorMensal: 1000,
      descricao: 'Pra grupos com várias loteadoras',
      maxLoteamentos: null,
      maxLotes: null,
      maxUsuarios: null,
      ordem: 2,
    },
  ];

  for (const p of daLanding) {
    const existe = await prisma.plano.findUnique({ where: { slug: p.slug } });
    if (existe) continue;
    await prisma.plano.create({ data: { ...p, ativo: true } });
  }

  revalidatePath('/backoffice/planos');
}

export async function alternarPlanoAtivo(id: string): Promise<void> {
  await requireBackoffice();
  const plano = await prisma.plano.findUnique({ where: { id }, select: { ativo: true } });
  if (!plano) return;
  await prisma.plano.update({ where: { id }, data: { ativo: !plano.ativo } });
  revalidatePath('/backoffice/planos');
}

/**
 * Excluir só é permitido enquanto ninguém assina o plano. Com assinatura
 * viva, o correto é desativar: apagar reescreveria o histórico de quem já
 * pagou por ele.
 */
export async function excluirPlano(id: string): Promise<void> {
  await requireBackoffice();
  const emUso = await prisma.assinatura.count({ where: { planoId: id } });
  if (emUso > 0) {
    throw new Error(
      `Este plano tem ${emUso} assinatura(s) vinculada(s). Desative-o em vez de excluir.`
    );
  }
  await prisma.plano.delete({ where: { id } });
  revalidatePath('/backoffice/planos');
}
