import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Evita cadastrar a mesma pessoa duas vezes.
 *
 * 🔴 Medido em produção em 12/08/2026: 47 leads para 19 telefones distintos.
 * As cópias nasciam SEGUNDOS depois da original (14:54:29 e 14:55:47 do mesmo
 * contato), ou seja, a pessoa mandava o formulário, achava que não tinha ido, e
 * mandava de novo. Nada no caminho impedia.
 *
 * O custo disso não é estético: o mesmo cliente aparece três vezes no funil, o
 * corretor liga duas vezes para quem já atendeu, a contagem de leads e a taxa
 * de conversão mentem, e a régua de cobrança dispara em duplicidade.
 *
 * A regra vem do `/api/leads/auto`, que já fazia certo — aqui ela vira função
 * única para todo mundo usar.
 */

/** Janela em que um novo envio é considerado o MESMO lead. */
const JANELA_DIAS = 7;

/**
 * Casa pelos últimos 9 dígitos, não pelo número inteiro.
 *
 * O mesmo celular chega como "75991446349", "(75) 99144-6349" e
 * "5575991446349" — máscara, DDI e espaços variam conforme o formulário e o
 * navegador. Comparar a string inteira não casaria quase nada, que é
 * exatamente por que os duplicados passaram.
 */
function sufixoTelefone(v: string): string | null {
  const digitos = (v || '').replace(/\D/g, '');
  return digitos.length >= 10 ? digitos.slice(-9) : null;
}

export interface LeadExistente {
  id: string;
  nome: string;
  email: string;
  mensagem: string | null;
  score: number;
}

/**
 * Procura um lead recente do mesmo contato no mesmo loteamento.
 *
 * E-mail primeiro (é identificador mais forte), telefone depois. Só olha os
 * últimos dias: quem volta meses depois é outra oportunidade, não a mesma.
 */
export async function acharLeadRecente(input: {
  loteamentoId: string;
  email?: string | null;
  telefone?: string | null;
  janelaDias?: number;
}): Promise<LeadExistente | null> {
  const desde = new Date(Date.now() - (input.janelaDias ?? JANELA_DIAS) * 86400000);
  const selecao = { id: true, nome: true, email: true, mensagem: true, score: true };

  const email = input.email?.trim().toLowerCase();
  if (email && email.includes('@')) {
    const porEmail = await prisma.lead.findFirst({
      where: { email, loteamentoId: input.loteamentoId, createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
      select: selecao,
    });
    if (porEmail) return porEmail;
  }

  const sufixo = input.telefone ? sufixoTelefone(input.telefone) : null;
  if (sufixo) {
    return prisma.lead.findFirst({
      where: {
        telefone: { contains: sufixo },
        loteamentoId: input.loteamentoId,
        createdAt: { gte: desde },
      },
      orderBy: { createdAt: 'desc' },
      select: selecao,
    });
  }

  return null;
}

/**
 * Enriquece o lead que já existe em vez de criar outro.
 *
 * O segundo envio quase sempre traz algo a mais (a pessoa completou o nome,
 * corrigiu o telefone, escreveu uma mensagem maior). Sobrescrever com o que
 * veio agora perderia o que já estava certo, então cada campo só melhora:
 * nome mais completo ganha, e-mail de verdade ganha de placeholder, mensagens
 * se acumulam com separador.
 */
export async function enriquecerLead(
  existente: LeadExistente,
  novo: {
    nome?: string;
    email?: string | null;
    telefone?: string;
    mensagem?: string | null;
    origem?: string | null;
    score?: number;
    tx?: Prisma.TransactionClient;
  }
): Promise<string> {
  const db = novo.tx ?? prisma;
  const email = novo.email?.trim().toLowerCase();

  const mensagem = novo.mensagem
    ? `${novo.origem ? `[${novo.origem}] ` : ''}${novo.mensagem}` +
      (existente.mensagem ? `\n---\n${existente.mensagem}` : '')
    : existente.mensagem;

  await db.lead.update({
    where: { id: existente.id },
    data: {
      ...(novo.nome && novo.nome.length > existente.nome.length ? { nome: novo.nome } : {}),
      ...(novo.telefone ? { telefone: novo.telefone } : {}),
      ...(email && email.includes('@') && !existente.email.includes('@') ? { email } : {}),
      ...(mensagem ? { mensagem: mensagem.slice(0, 2000) } : {}),
      ...(novo.score ? { score: Math.max(existente.score, novo.score) } : {}),
      updatedAt: new Date(),
    },
  });

  return existente.id;
}
