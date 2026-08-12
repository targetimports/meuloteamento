'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { apagarMensagem, conectar, enviarTexto, marcarLida, reagir } from '@/lib/evolution-go';
import { pedirHistoricoDasConversas } from '@/lib/whatsapp-ingestao';

type Resultado = { ok: boolean; erro?: string };

/**
 * A instância de quem está pedindo.
 *
 * Todo acesso ao chat passa por aqui: a conversa pertence a uma instância, e a
 * instância a uma pessoa. Não existe consulta "por id de conversa" sem antes
 * amarrar no dono — server action é endpoint POST próprio, e um id de conversa
 * é fácil de adivinhar.
 */
async function minhaInstancia() {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true, token: true, status: true },
  });
  return { sessao, instancia };
}

export interface MensagemUI {
  id: string;
  messageId: string;
  daMim: boolean;
  tipo: string;
  texto: string | null;
  temMidia: boolean;
  midiaMime: string | null;
  nomeArquivo: string | null;
  status: string;
  editada: boolean;
  enviadaEm: string;
  transcricao: string | null;
  transcricaoStatus: string | null;
  participanteNome: string | null;
}

/** Mensagens de uma conversa, da mais antiga para a mais recente. */
export async function mensagensDaConversa(conversaId: string): Promise<MensagemUI[]> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return [];

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true },
  });
  if (!conversa) return [];

  const mensagens = await prisma.whatsappMensagem.findMany({
    where: { conversaId },
    orderBy: { enviadaEm: 'asc' },
    take: 300,
  });

  return mensagens.map((m) => ({
    id: m.id,
    messageId: m.messageId,
    daMim: m.daMim,
    tipo: m.tipo,
    texto: m.texto,
    temMidia: Boolean(m.midiaCaminho),
    midiaMime: m.midiaMime,
    nomeArquivo: m.nomeArquivo,
    status: m.status,
    editada: m.editada,
    enviadaEm: m.enviadaEm.toISOString(),
    transcricao: m.transcricao,
    transcricaoStatus: m.transcricaoStatus,
    participanteNome: m.participanteNome,
  }));
}

/**
 * Envia texto e grava a bolha na hora.
 *
 * A mensagem é gravada com o id que o gateway devolve, então o eco que volta
 * pelo webhook cai na deduplicação e não vira bolha repetida. Se o gateway não
 * devolver id, gravamos com um id local — perder a mensagem da tela seria pior
 * que arriscar uma duplicata que a dedup por (conversa, messageId) ainda pega.
 */
export async function enviarMensagem(conversaId: string, texto: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Você não tem WhatsApp conectado.' };
  if (instancia.status !== 'CONECTADA') {
    return { ok: false, erro: 'Seu WhatsApp está desconectado.' };
  }

  const conteudo = texto.trim();
  if (!conteudo) return { ok: false, erro: 'Mensagem vazia.' };

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };

  const r = await enviarTexto(instancia.token, conversa.remoteJid, conteudo);
  if (!r.ok) return { ok: false, erro: `O WhatsApp recusou o envio: ${r.error}` };

  const messageId = r.data?.id ?? r.data?.ID ?? `local-${Date.now()}`;
  const agora = new Date();

  try {
    await prisma.$transaction([
      prisma.whatsappMensagem.create({
        data: {
          conversaId,
          messageId,
          daMim: true,
          tipo: 'TEXTO',
          texto: conteudo,
          enviadaEm: agora,
          status: 'ENVIADA',
        },
      }),
      prisma.whatsappConversa.update({
        where: { id: conversaId },
        data: {
          ultimaMensagemEm: agora,
          ultimaMensagemMinha: true,
          ultimaMensagemPreview: conteudo.slice(0, 120),
          naoLidas: 0,
        },
      }),
    ]);
  } catch (e) {
    // O eco do webhook pode ter chegado antes desta gravação.
    if ((e as { code?: string }).code !== 'P2002') throw e;
  }

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/** Zera o contador e avisa o WhatsApp (é o que fica azul do outro lado). */
export async function marcarConversaLida(conversaId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, remoteJid: true, naoLidas: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };
  if (conversa.naoLidas === 0) return { ok: true };

  const ultima = await prisma.whatsappMensagem.findFirst({
    where: { conversaId, daMim: false },
    orderBy: { enviadaEm: 'desc' },
    select: { messageId: true },
  });

  // Best-effort: falhar em avisar o WhatsApp não pode impedir a fila daqui de
  // parar de mostrar "não lida" para quem acabou de ler.
  if (ultima) {
    void marcarLida(instancia.token, ultima.messageId, conversa.remoteJid).catch(() => {});
  }

  await prisma.whatsappConversa.update({ where: { id: conversaId }, data: { naoLidas: 0 } });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

export async function reagirMensagem(mensagemId: string, emoji: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const m = await prisma.whatsappMensagem.findFirst({
    where: { id: mensagemId, conversa: { instanciaId: instancia.id } },
    select: { messageId: true, daMim: true, conversa: { select: { remoteJid: true } } },
  });
  if (!m) return { ok: false, erro: 'Mensagem não encontrada.' };

  const r = await reagir(instancia.token, {
    destino: m.conversa.remoteJid,
    messageId: m.messageId,
    daMim: m.daMim,
    emoji,
  });
  return r.ok ? { ok: true } : { ok: false, erro: String(r.error) };
}

/** Apaga para todos. O texto vira "Mensagem apagada", como no WhatsApp. */
export async function apagarParaTodos(mensagemId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const m = await prisma.whatsappMensagem.findFirst({
    where: { id: mensagemId, conversa: { instanciaId: instancia.id } },
    select: { id: true, messageId: true, daMim: true, conversa: { select: { remoteJid: true } } },
  });
  if (!m) return { ok: false, erro: 'Mensagem não encontrada.' };
  if (!m.daMim) return { ok: false, erro: 'Só dá para apagar as suas mensagens.' };

  const r = await apagarMensagem(instancia.token, {
    destino: m.conversa.remoteJid,
    messageId: m.messageId,
    daMim: true,
  });
  if (!r.ok) return { ok: false, erro: String(r.error) };

  await prisma.whatsappMensagem.update({
    where: { id: m.id },
    data: { texto: 'Mensagem apagada', tipo: 'SISTEMA', midiaCaminho: null },
  });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/**
 * Liga a conversa a um lead do funil.
 *
 * É o encontro dos dois módulos: quem está no WhatsApp normalmente é (ou vira)
 * um lead, e sem esse vínculo o atendimento e o funil contam histórias
 * separadas sobre a mesma pessoa.
 */
export async function vincularAoLead(conversaId: string, leadId: string | null): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };

  await prisma.whatsappConversa.update({
    where: { id: conversaId },
    data: { leadId },
  });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/**
 * Puxa o histórico das conversas conhecidas.
 *
 * O resultado não chega aqui: o WhatsApp responde depois, pelo webhook, como
 * HISTORY_SYNC. Por isso a tela diz "pedido enviado" e não "N mensagens
 * importadas" — prometer o número que ainda não existe seria mentir.
 */
export async function sincronizarHistorico(): Promise<
  Resultado & { conversas?: number; pedidos?: number }
> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };
  if (instancia.status !== 'CONECTADA') {
    return { ok: false, erro: 'Conecte seu número antes de sincronizar.' };
  }

  // Reconectar reassina os eventos: sem HISTORY_SYNC assinado, o pedido sai e
  // a resposta é descartada pelo próprio gateway.
  const conexao = await conectar(instancia.token);
  if (conexao.ok && conexao.data?.eventString === '') {
    return { ok: false, erro: 'O gateway não aceitou os eventos — o histórico não chegaria.' };
  }

  const r = await pedirHistoricoDasConversas(instancia);
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true, ...r };
}

/**
 * Liga conversas soltas aos leads do funil pelo telefone.
 *
 * 🔴 Casa pelos ÚLTIMOS 8 DÍGITOS, não pelo número inteiro. O mesmo celular
 * aparece como 5575984904920, 557598490492, (75) 98490-4920 e 75984904920 —
 * DDI que entra e sai, nono dígito que existe no cadastro e não no WhatsApp.
 * Comparar a string inteira não casaria quase nada, e casar por igualdade de
 * sufixo curto demais (4 ou 6) traria gente errada.
 */
export async function vincularConversasAosLeads(): Promise<Resultado & { vinculadas?: number }> {
  const { sessao, instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const conversas = await prisma.whatsappConversa.findMany({
    where: { instanciaId: instancia.id, leadId: null, ehGrupo: false, telefone: { not: null } },
    select: { id: true, telefone: true },
  });
  if (conversas.length === 0) return { ok: true, vinculadas: 0 };

  const leads = await prisma.lead.findMany({
    where: {
      ...(sessao.loteadoraId ? { loteamento: { loteadoraId: sessao.loteadoraId } } : {}),
      telefone: { not: '' },
    },
    select: { id: true, telefone: true },
  });

  const sufixo = (v: string) => v.replace(/\D/g, '').slice(-8);
  const porSufixo = new Map<string, string>();
  for (const l of leads) {
    const s = sufixo(l.telefone);
    // Dois leads com o mesmo final: não dá para escolher, então nenhum é
    // vinculado automaticamente. Vincular o errado é pior que não vincular.
    if (s.length === 8) porSufixo.set(s, porSufixo.has(s) ? '' : l.id);
  }

  let vinculadas = 0;
  for (const c of conversas) {
    const leadId = porSufixo.get(sufixo(c.telefone ?? ''));
    if (!leadId) continue;
    await prisma.whatsappConversa.update({ where: { id: c.id }, data: { leadId } });
    vinculadas++;
  }

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true, vinculadas };
}

/** Renomeia o contato. Marca como manual: nenhuma sincronização desfaz. */
export async function renomearConversa(conversaId: string, nome: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const limpo = nome.trim();
  if (!limpo) return { ok: false, erro: 'Nome vazio.' };

  const r = await prisma.whatsappConversa.updateMany({
    where: { id: conversaId, instanciaId: instancia.id },
    data: { nome: limpo, nomeOrigem: 'manual', nomeManual: true },
  });
  if (r.count === 0) return { ok: false, erro: 'Conversa não encontrada.' };

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}
