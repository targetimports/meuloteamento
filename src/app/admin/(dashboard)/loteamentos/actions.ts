'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireAdmin, canAccessLoteadora } from '@/lib/tenant';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function parseLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());
const optNumber = z.preprocess(
  (v) => (v === '' || v == null ? undefined : Number(v)),
  z.number().optional()
);

const loteamentoSchema = z.object({
  loteadoraId: z.string().trim().min(1, 'Selecione uma loteadora'),
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string().trim().optional(),
  tagline: z.string().trim().optional().nullable(),
  subtagline: z.string().trim().optional().nullable(),
  descricao: z.string().trim().optional().nullable(),
  parcelaAPartirDe: optNumber,

  endereco: z.string().trim().min(3, 'Endereço obrigatório'),
  cidade: z.string().trim().min(2, 'Cidade obrigatória'),
  estado: z.string().trim().length(2, 'UF com 2 letras'),
  cep: z.string().trim().optional().nullable(),
  lat: optNumber,
  lng: optNumber,
  cartorio: z.string().trim().optional().nullable(),
  comarca: z.string().trim().optional().nullable(),

  imagemCapa: z.string().trim().optional().or(z.literal('')),
  imagemMapa: z.string().trim().optional().or(z.literal('')),
  imagensGaleria: z.string().optional(), // JSON ou lines
  diferenciais: z.string().optional(), // JSON ou lines
  documentos: z.string().optional(), // JSON [{nome,url}]
  videoApresentacao: z.string().trim().optional().or(z.literal('')),
  videoApresentacaoPoster: z.string().trim().optional().or(z.literal('')),
  videoHero: z.string().trim().optional().or(z.literal('')),
  videoHeroPoster: z.string().trim().optional().or(z.literal('')),

  contatoNome: z.string().trim().optional().nullable(),
  contatoTelefone: z.string().trim().optional().nullable(),
  contatoEmail: z.string().trim().optional().nullable(),

  reservaMinutos: z.coerce.number().int().min(5).max(180).default(15),
  maxParcelas: z.coerce.number().int().min(1).max(360).default(120),
  permiteFinanciamento: checkbox.default(true),
  ativo: checkbox.default(true),
  publicado: checkbox.default(false),
});

type FormState = { error?: string; ok?: boolean };

function buildData(parsed: z.infer<typeof loteamentoSchema>) {
  const slug = parsed.slug?.trim() ? slugify(parsed.slug) : slugify(parsed.nome);

  // Galeria pode vir como JSON array ou linhas
  let galeria: string[] = [];
  if (parsed.imagensGaleria) {
    const trimmed = parsed.imagensGaleria.trim();
    if (trimmed.startsWith('[')) {
      galeria = parseJsonArray<string>(trimmed).filter((s) => typeof s === 'string');
    } else {
      galeria = parseLines(trimmed);
    }
  }

  // Diferenciais idem
  let diferenciais: string[] = [];
  if (parsed.diferenciais) {
    const trimmed = parsed.diferenciais.trim();
    if (trimmed.startsWith('[')) {
      diferenciais = parseJsonArray<string>(trimmed).filter((s) => typeof s === 'string');
    } else {
      diferenciais = parseLines(trimmed);
    }
  }

  // Documentos: SEMPRE JSON agora
  let documentos: { nome: string; url: string }[] = [];
  if (parsed.documentos) {
    const trimmed = parsed.documentos.trim();
    if (trimmed.startsWith('[')) {
      documentos = parseJsonArray<{ nome: string; url: string }>(trimmed).filter(
        (d) => d && typeof d.nome === 'string' && typeof d.url === 'string'
      );
    } else {
      // fallback compat: "nome | url" por linha
      documentos = parseLines(trimmed)
        .map((line) => {
          const [nome, url] = line.split('|').map((s) => s.trim());
          if (!nome || !url) return null;
          return { nome, url };
        })
        .filter((x): x is { nome: string; url: string } => x !== null);
    }
  }

  return {
    slug,
    loteadoraId: parsed.loteadoraId,
    nome: parsed.nome,
    tagline: parsed.tagline || null,
    subtagline: parsed.subtagline || null,
    descricao: parsed.descricao || null,
    parcelaAPartirDe: parsed.parcelaAPartirDe ?? null,
    endereco: parsed.endereco,
    cidade: parsed.cidade,
    estado: parsed.estado.toUpperCase(),
    cep: parsed.cep || null,
    lat: parsed.lat ?? null,
    lng: parsed.lng ?? null,
    cartorio: parsed.cartorio || null,
    comarca: parsed.comarca || null,
    imagemCapa: parsed.imagemCapa || null,
    imagemMapa: parsed.imagemMapa || null,
    imagensGaleria: galeria,
    diferenciais,
    documentos,
    videoApresentacao: parsed.videoApresentacao || null,
    videoApresentacaoPoster: parsed.videoApresentacaoPoster || null,
    videoHero: parsed.videoHero || null,
    videoHeroPoster: parsed.videoHeroPoster || null,
    contatoNome: parsed.contatoNome || null,
    contatoTelefone: parsed.contatoTelefone || null,
    contatoEmail: parsed.contatoEmail || null,
    reservaMinutos: parsed.reservaMinutos,
    maxParcelas: parsed.maxParcelas,
    permiteFinanciamento: parsed.permiteFinanciamento,
    ativo: parsed.ativo,
    publicado: parsed.publicado,
  };
}

export async function criarLoteamento(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = loteamentoSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = buildData(parsed.data);

  const loteadora = await prisma.loteadora.findUnique({ where: { id: data.loteadoraId } });
  if (!loteadora) return { error: 'Loteadora inválida.' };

  // O loteadoraId vem do formulário, e formulário é dado do cliente: sem esta
  // checagem, um POST montado à mão criaria loteamento dentro de outra
  // empresa. Filtrar o select não basta — a action é um endpoint próprio.
  if (!(await canAccessLoteadora(data.loteadoraId))) {
    return { error: 'Sem permissão para cadastrar loteamento nesta loteadora.' };
  }

  const existing = await prisma.loteamento.findUnique({ where: { slug: data.slug } });
  if (existing) return { error: `Já existe um loteamento com slug "${data.slug}".` };

  const created = await prisma.loteamento.create({ data });

  revalidatePath('/admin/loteamentos');
  redirect(`/admin/loteamentos/${created.id}`);
}

export async function atualizarLoteamento(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const raw = Object.fromEntries(formData.entries());
  const parsed = loteamentoSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = buildData(parsed.data);

  // Duas checagens, porque são dois riscos distintos: editar o loteamento de
  // outra empresa (o atual) e mover o próprio para outra empresa (o destino).
  const atual = await prisma.loteamento.findUnique({
    where: { id },
    select: { loteadoraId: true },
  });
  if (!atual) return { error: 'Loteamento não encontrado.' };

  if (!(await canAccessLoteadora(atual.loteadoraId))) {
    return { error: 'Sem permissão para editar este loteamento.' };
  }
  if (!(await canAccessLoteadora(data.loteadoraId))) {
    return { error: 'Sem permissão para mover o loteamento para esta loteadora.' };
  }

  const conflict = await prisma.loteamento.findFirst({
    where: { slug: data.slug, NOT: { id } },
  });
  if (conflict) return { error: `Já existe outro loteamento com slug "${data.slug}".` };

  await prisma.loteamento.update({ where: { id }, data });

  revalidatePath('/admin/loteamentos');
  revalidatePath(`/admin/loteamentos/${id}`);
  return { ok: true };
}

export async function excluirLoteamento(id: string): Promise<void> {
  await requireAdmin();

  const alvo = await prisma.loteamento.findUnique({
    where: { id },
    select: { loteadoraId: true },
  });
  if (!alvo) throw new Error('Loteamento não encontrado.');
  if (!(await canAccessLoteadora(alvo.loteadoraId))) {
    throw new Error('Sem permissão para excluir este loteamento.');
  }

  const vendas = await prisma.venda.count({ where: { lote: { loteamentoId: id } } });
  if (vendas > 0) {
    throw new Error(`Não é possível excluir: loteamento possui ${vendas} venda(s).`);
  }
  await prisma.loteamento.delete({ where: { id } });
  revalidatePath('/admin/loteamentos');
  redirect('/admin/loteamentos');
}
