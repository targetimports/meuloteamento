'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { arquivarNoWhatsapp, fixarNoWhatsapp, silenciarNoWhatsapp } from '@/lib/evolution-go';
import { transcreverMensagem, transcricaoConfigurada } from '@/lib/whatsapp-transcricao';

type Resultado = { ok: boolean; erro?: string };

async function minhaInstancia() {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true, token: true, status: true },
  });
  return { sessao, instancia };
}

// =====================================================================
// Modelos de mensagem
// =====================================================================

export interface ModeloUI {
  id: string;
  titulo: string;
  texto: string;
  atalho: string | null;
  usos: number;
}

/**
 * Substitui {{campo}} pelos dados do contato.
 *
 * Token que não casa fica como está, de propósito: `{{cpf}}` visível no texto
 * enviado é feio, mas some silenciosamente seria pior — a pessoa mandaria
 * "Olá , tudo bem?" sem perceber que o nome não entrou.
 */
export async function aplicarTokens(
  texto: string,
  dados: Record<string, string | null | undefined>
): Promise<string> {
  return String(texto || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (marca, chave: string) => {
    const v = dados[chave];
    return v == null || v === '' ? marca : String(v);
  });
}

export async function listarModelos(): Promise<ModeloUI[]> {
  const sessao = await requireAdmin();
  const modelos = await prisma.whatsappModelo.findMany({
    where: sessao.loteadoraId ? { loteadoraId: sessao.loteadoraId } : {},
    // Mais usados primeiro: a lista se organiza pelo próprio uso, sem ninguém
    // ter que arrastar nada.
    orderBy: [{ usos: 'desc' }, { titulo: 'asc' }],
    take: 50,
    select: { id: true, titulo: true, texto: true, atalho: true, usos: true },
  });
  return modelos;
}

export async function salvarModelo(input: {
  id?: string;
  titulo: string;
  texto: string;
  atalho?: string;
}): Promise<Resultado> {
  const sessao = await requireAdmin();
  const titulo = input.titulo.trim();
  const texto = input.texto.trim();
  if (!titulo || !texto) return { ok: false, erro: 'Título e texto são obrigatórios.' };

  const atalho = input.atalho?.trim().replace(/^\/*/, '') || null;

  if (input.id) {
    const r = await prisma.whatsappModelo.updateMany({
      where: {
        id: input.id,
        ...(sessao.loteadoraId ? { loteadoraId: sessao.loteadoraId } : {}),
      },
      data: { titulo, texto, atalho },
    });
    if (r.count === 0) return { ok: false, erro: 'Modelo não encontrado.' };
  } else {
    await prisma.whatsappModelo.create({
      data: { loteadoraId: sessao.loteadoraId ?? null, titulo, texto, atalho },
    });
  }

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

export async function excluirModelo(id: string): Promise<Resultado> {
  const sessao = await requireAdmin();
  const r = await prisma.whatsappModelo.deleteMany({
    where: { id, ...(sessao.loteadoraId ? { loteadoraId: sessao.loteadoraId } : {}) },
  });
  if (r.count === 0) return { ok: false, erro: 'Modelo não encontrado.' };
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/** Marca o uso e devolve o texto já com os tokens do contato aplicados. */
export async function usarModelo(
  modeloId: string,
  conversaId: string
): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const { sessao, instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const [modelo, conversa] = await Promise.all([
    prisma.whatsappModelo.findFirst({
      where: { id: modeloId, ...(sessao.loteadoraId ? { loteadoraId: sessao.loteadoraId } : {}) },
      select: { id: true, texto: true },
    }),
    prisma.whatsappConversa.findFirst({
      where: { id: conversaId, instanciaId: instancia.id },
      select: { nome: true, telefone: true, lead: { select: { nome: true } } },
    }),
  ]);
  if (!modelo) return { ok: false, erro: 'Modelo não encontrado.' };
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };

  const nome = conversa.lead?.nome || conversa.nome || '';
  const texto = await aplicarTokens(modelo.texto, {
    nome,
    primeiro_nome: nome.split(' ')[0] || '',
    telefone: conversa.telefone ?? '',
    atendente: sessao.nome ?? '',
  });

  await prisma.whatsappModelo.update({
    where: { id: modelo.id },
    data: { usos: { increment: 1 } },
  });

  return { ok: true, texto };
}

// =====================================================================
// Transcrição sob demanda
// =====================================================================

/**
 * Transcreve um áudio a pedido.
 *
 * A transcrição automática só roda em áudio RECEBIDO com a chave configurada.
 * Aqui é o caminho para o resto: áudio antigo, áudio que falhou, áudio que a
 * pessoa mandou e quer o texto para colar em outro lugar.
 */
export async function transcreverSobDemanda(mensagemId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };
  if (!transcricaoConfigurada()) {
    return { ok: false, erro: 'Transcrição não configurada no servidor (falta GROQ_API_KEY).' };
  }

  const m = await prisma.whatsappMensagem.findFirst({
    where: { id: mensagemId, conversa: { instanciaId: instancia.id } },
    select: { id: true, tipo: true, midiaCaminho: true },
  });
  if (!m) return { ok: false, erro: 'Mensagem não encontrada.' };
  if (m.tipo !== 'AUDIO') return { ok: false, erro: 'Só áudio pode ser transcrito.' };
  if (!m.midiaCaminho) return { ok: false, erro: 'O arquivo do áudio não está salvo.' };

  await prisma.whatsappMensagem.update({
    where: { id: m.id },
    data: { transcricaoStatus: 'pendente', transcricao: null },
  });

  // Espera aqui, ao contrário do caminho automático: quem clicou está olhando.
  await transcreverMensagem(m.id);

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

// =====================================================================
// Fixar, silenciar e arquivar — refletindo no WhatsApp
// =====================================================================

/**
 * Estas três ações existem no aparelho do cliente também.
 *
 * Fazer só do nosso lado criaria duas verdades: a conversa fixada aqui e solta
 * no celular. Quem atende usa os dois, e a divergência vira desconfiança na
 * ferramenta. O gateway é avisado; se ele recusar, desfazemos aqui — melhor
 * nada acontecer que acontecer pela metade.
 */
export async function fixarConversa(conversaId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const c = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true, fixada: true },
  });
  if (!c) return { ok: false, erro: 'Conversa não encontrada.' };

  const r = await fixarNoWhatsapp(instancia.token, c.remoteJid, !c.fixada);
  if (!r.ok) return { ok: false, erro: `O WhatsApp recusou: ${r.error}` };

  await prisma.whatsappConversa.update({ where: { id: c.id }, data: { fixada: !c.fixada } });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

export async function silenciarConversa(conversaId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const c = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true, silenciada: true },
  });
  if (!c) return { ok: false, erro: 'Conversa não encontrada.' };

  const r = await silenciarNoWhatsapp(instancia.token, c.remoteJid, !c.silenciada);
  if (!r.ok) return { ok: false, erro: `O WhatsApp recusou: ${r.error}` };

  await prisma.whatsappConversa.update({
    where: { id: c.id },
    data: { silenciada: !c.silenciada },
  });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/** Arquiva aqui e no WhatsApp. */
export async function arquivarConversa(conversaId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const c = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true, arquivada: true },
  });
  if (!c) return { ok: false, erro: 'Conversa não encontrada.' };

  // O aviso ao WhatsApp é best-effort: arquivar aqui organiza a NOSSA fila, e
  // falhar lá não pode impedir isso.
  void arquivarNoWhatsapp(instancia.token, c.remoteJid, !c.arquivada).catch(() => {});

  await prisma.whatsappConversa.update({
    where: { id: c.id },
    data: { arquivada: !c.arquivada },
  });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}
