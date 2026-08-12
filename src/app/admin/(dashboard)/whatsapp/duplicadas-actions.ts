'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';

type Resultado = { ok: boolean; erro?: string };

async function minhaInstancia() {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true },
  });
  return { sessao, instancia };
}

export interface GrupoDuplicado {
  telefone: string;
  conversas: Array<{
    id: string;
    nome: string | null;
    remoteJid: string;
    mensagens: number;
    ultimaEm: string | null;
  }>;
}

/**
 * Conversas duplicadas: o mesmo telefone em mais de uma conversa.
 *
 * Acontece porque o mesmo contato chega ora como `…@s.whatsapp.net`, ora como
 * `…@lid` (o identificador interno do WhatsApp). A ingestão já casa pelo
 * telefone quando pode, mas conversas criadas antes dessa regra — ou quando o
 * telefone ainda não era conhecido — ficaram partidas: metade das mensagens em
 * cada uma, e o histórico incompleto nas duas.
 *
 * 🔴 A mesclagem NÃO é automática, e nunca será. Fundir a conversa errada
 * mistura o histórico de dois clientes, e não há como separar depois. O sistema
 * mostra o que encontrou e quem decide é quem conhece os contatos.
 */
export async function acharDuplicadas(): Promise<GrupoDuplicado[]> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return [];

  const conversas = await prisma.whatsappConversa.findMany({
    where: { instanciaId: instancia.id, ehGrupo: false, telefone: { not: null } },
    select: {
      id: true,
      nome: true,
      telefone: true,
      remoteJid: true,
      ultimaMensagemEm: true,
      _count: { select: { mensagens: true } },
    },
  });

  const porTelefone = new Map<string, GrupoDuplicado['conversas']>();
  for (const c of conversas) {
    // Agrupa pelos últimos 8 dígitos, mesma regra do vínculo com lead: DDI e
    // nono dígito entram e saem conforme a origem.
    const chave = (c.telefone ?? '').replace(/\D/g, '').slice(-8);
    if (chave.length < 8) continue;
    const lista = porTelefone.get(chave) ?? [];
    lista.push({
      id: c.id,
      nome: c.nome,
      remoteJid: c.remoteJid,
      mensagens: c._count.mensagens,
      ultimaEm: c.ultimaMensagemEm?.toISOString() ?? null,
    });
    porTelefone.set(chave, lista);
  }

  return Array.from(porTelefone.entries())
    .filter(([, lista]) => lista.length > 1)
    .map(([telefone, lista]) => ({
      telefone,
      // A que tem mais mensagens primeiro: é a candidata natural a principal.
      conversas: lista.sort((a, b) => b.mensagens - a.mensagens),
    }));
}

/**
 * Funde conversas duplicadas numa só.
 *
 * As mensagens das secundárias passam para a principal e as secundárias são
 * removidas. Só o registro da conversa some — nenhuma mensagem é apagada, e a
 * mídia continua no cofre, apontada pelas mensagens que se mudaram.
 *
 * Mensagem repetida nas duas (mesmo `messageId`) é descartada em vez de
 * derrubar a operação: o histórico se sobrepõe com frequência, e falhar a
 * mesclagem inteira por causa de uma bolha repetida seria desproporcional.
 */
export async function mesclarConversas(
  principalId: string,
  secundariasIds: string[]
): Promise<Resultado & { movidas?: number }> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };
  if (secundariasIds.length === 0) return { ok: false, erro: 'Nenhuma conversa para fundir.' };
  if (secundariasIds.includes(principalId)) {
    return { ok: false, erro: 'A principal não pode estar entre as secundárias.' };
  }

  const todas = await prisma.whatsappConversa.findMany({
    where: { id: { in: [principalId, ...secundariasIds] }, instanciaId: instancia.id },
    select: { id: true },
  });
  if (todas.length !== secundariasIds.length + 1) {
    return { ok: false, erro: 'Alguma conversa não é sua ou não existe.' };
  }

  const jaNaPrincipal = await prisma.whatsappMensagem.findMany({
    where: { conversaId: principalId },
    select: { messageId: true },
  });
  const existentes = new Set(jaNaPrincipal.map((m) => m.messageId));

  const aMover = await prisma.whatsappMensagem.findMany({
    where: { conversaId: { in: secundariasIds } },
    select: { id: true, messageId: true },
  });

  const mover = aMover.filter((m) => !existentes.has(m.messageId)).map((m) => m.id);

  await prisma.$transaction(async (tx) => {
    if (mover.length > 0) {
      await tx.whatsappMensagem.updateMany({
        where: { id: { in: mover } },
        data: { conversaId: principalId },
      });
    }
    // O que sobrou é duplicata literal (mesmo messageId): sai junto com a
    // conversa secundária, na cascata.
    await tx.whatsappConversa.deleteMany({ where: { id: { in: secundariasIds } } });

    // Reajusta a prévia com o que ficou sendo a última mensagem de fato.
    const ultima = await tx.whatsappMensagem.findFirst({
      where: { conversaId: principalId },
      orderBy: { enviadaEm: 'desc' },
      select: { texto: true, daMim: true, enviadaEm: true, tipo: true },
    });
    if (ultima) {
      await tx.whatsappConversa.update({
        where: { id: principalId },
        data: {
          ultimaMensagemEm: ultima.enviadaEm,
          ultimaMensagemMinha: ultima.daMim,
          ultimaMensagemPreview: (ultima.texto ?? ultima.tipo).slice(0, 120),
        },
      });
    }
  });

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true, movidas: mover.length };
}
