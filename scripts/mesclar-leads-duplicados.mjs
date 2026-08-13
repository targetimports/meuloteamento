#!/usr/bin/env node
/**
 * Funde leads duplicados do mesmo contato.
 *
 * Uso (na VPS, a partir de /var/www/meuloteamento):
 *   node scripts/mesclar-leads-duplicados.mjs           # só mostra o plano
 *   node scripts/mesclar-leads-duplicados.mjs --aplicar # executa
 *
 * ── O que é "o mesmo contato" ───────────────────────────────────────────────
 * Mesmo loteamento + mesmos ÚLTIMOS 9 DÍGITOS do telefone. O número chega como
 * "75991446349", "(75) 99144-6349" e "5575991446349" conforme o formulário, o
 * navegador e o preenchimento automático — comparar a string inteira não casa
 * quase nada, que é justamente por que os duplicados existem.
 *
 * ── O que é preservado ──────────────────────────────────────────────────────
 * Fica o lead MAIS ANTIGO: é ele que carrega a data real do primeiro contato,
 * e essa data alimenta tempo de resposta e relatório de origem. Dos demais são
 * trazidos: interações, conversas de WhatsApp, corretor (se o principal não
 * tiver), a mensagem de cada um e o maior score.
 *
 * 🔴 Nenhum histórico é apagado. Interação e conversa MUDAM de dono; só o
 * registro duplicado do lead some. O status que fica é o MAIS AVANÇADO do
 * grupo: quem já estava em atendimento não volta a ser "novo" por causa de um
 * cadastro repetido.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

// A VPS roda com o .env ao lado; o Prisma não o lê sozinho fora do Next.
try {
  const env = readFileSync('.env', 'utf8');
  for (const linha of env.split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
} catch {
  /* usa o ambiente */
}

const prisma = new PrismaClient();

/** Do menos para o mais avançado. Na fusão, o mais avançado vence. */
const AVANCO = ['PERDIDO', 'NOVO', 'EM_ATENDIMENTO', 'AGENDADO', 'CONVERTIDO'];
const aplicar = process.argv.includes('--aplicar');

const sufixo = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-9) : null;
};

async function main() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      mensagem: true,
      score: true,
      corretorId: true,
      loteamentoId: true,
      loteId: true,
      status: true,
      createdAt: true,
      _count: { select: { interacoes: true } },
    },
  });

  const grupos = new Map();
  for (const l of leads) {
    const s = sufixo(l.telefone);
    if (!s || !l.loteamentoId) continue;
    const chave = `${l.loteamentoId}:${s}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(l);
  }

  const duplicados = [...grupos.values()].filter((g) => g.length > 1);
  if (duplicados.length === 0) {
    console.log('Nenhum lead duplicado.');
    return;
  }

  console.log(`${aplicar ? '' : '[simulação] '}${duplicados.length} contato(s) com duplicata:\n`);

  let fundidos = 0;
  let removidos = 0;
  let pulados = 0;

  for (const grupo of duplicados) {
    const [principal, ...extras] = grupo; // o mais antigo primeiro
    const ids = extras.map((e) => e.id);

    /**
     * Não se pula por causa de venda no lote.
     *
     * O vínculo Lead→Lote é INTERESSE, não compra: o lote pode ter sido vendido
     * para outra pessoa, e o duplicado continua sendo duplicado. Verificar
     * venda do lote pularia casos legítimos sem motivo — foi o que a primeira
     * versão deste script fez.
     *
     * O que a fusão precisa preservar é o AVANÇO: se um dos registros chegou
     * mais longe no funil, esse status é o que fica.
     */
    const totalInteracoes = grupo.reduce((a, g) => a + g._count.interacoes, 0);
    console.log(
      `  ${principal.nome} (${principal.telefone}) — ${grupo.length} registros → 1` +
        `, ${totalInteracoes} interação(ões) preservada(s)`
    );

    fundidos++;
    removidos += ids.length;
    if (!aplicar) continue;

    const mensagens = grupo
      .map((g) => g.mensagem)
      .filter(Boolean)
      .filter((m, i, arr) => arr.indexOf(m) === i) // mensagem repetida entra uma vez
      .join('\n---\n')
      .slice(0, 2000);

    await prisma.$transaction(async (tx) => {
      // Histórico muda de dono, não some.
      await tx.leadInteracao.updateMany({
        where: { leadId: { in: ids } },
        data: { leadId: principal.id },
      });
      await tx.whatsappConversa.updateMany({
        where: { leadId: { in: ids } },
        data: { leadId: principal.id },
      });

      await tx.lead.update({
        where: { id: principal.id },
        data: {
          // Cada campo só melhora: o nome mais completo, o e-mail de verdade,
          // o maior score, o corretor de quem já assumiu.
          nome: grupo.reduce((a, g) => (g.nome.length > a.length ? g.nome : a), principal.nome),
          email: grupo.find((g) => g.email?.includes('@'))?.email ?? principal.email,
          score: Math.max(...grupo.map((g) => g.score)),
          corretorId: principal.corretorId ?? grupo.find((g) => g.corretorId)?.corretorId ?? null,
          loteId: principal.loteId ?? grupo.find((g) => g.loteId)?.loteId ?? null,
          // O avanço no funil não pode retroceder na fusão: quem já estava em
          // atendimento não volta a ser "novo" por causa de um cadastro repetido.
          status: grupo
            .map((g) => g.status)
            .sort((a, b) => AVANCO.indexOf(b) - AVANCO.indexOf(a))[0],
          ...(mensagens ? { mensagem: mensagens } : {}),
        },
      });

      await tx.leadInteracao.create({
        data: {
          leadId: principal.id,
          tipo: 'NOTA',
          conteudo: `${extras.length} cadastro(s) duplicado(s) deste contato foram unidos a este lead.`,
        },
      });

      await tx.lead.deleteMany({ where: { id: { in: ids } } });
    });
  }

  console.log(
    `\n${aplicar ? 'fundidos' : 'seriam fundidos'}: ${fundidos} · pulados: ${pulados}` +
      `\ntotal de leads ${aplicar ? 'agora' : 'depois'}: ${leads.length - duplicados.reduce((a, g) => a + g.length - 1, 0)}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
