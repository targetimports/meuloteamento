'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, whereClienteDaLoteadora } from '@/lib/tenant';
import { listarContatos } from '@/lib/evolution-go';
import { telefoneDoJid } from '@/lib/whatsapp-evento';
import { nomeMelhor } from '@/lib/whatsapp-ingestao';

type Resultado = { ok: boolean; erro?: string };

async function minhaInstancia() {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true, token: true, status: true },
  });
  return { sessao, instancia };
}

/** Compara ignorando acento: "joao" acha "João". */
function semAcento(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export interface AchadoBusca {
  conversaId: string;
  conversaNome: string;
  mensagemId: string;
  trecho: string;
  daMim: boolean;
  enviadaEm: string;
}

/**
 * Busca dentro das mensagens, devolvendo o trecho em volta do que casou.
 *
 * O trecho é o que torna a busca útil: uma lista de conversas que "contêm a
 * palavra" obriga a abrir cada uma para descobrir qual serve — que é o mesmo
 * trabalho que a busca deveria evitar.
 */
export async function buscarNasMensagens(termo: string): Promise<AchadoBusca[]> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return [];

  const q = termo.trim();
  if (q.length < 2) return [];

  const mensagens = await prisma.whatsappMensagem.findMany({
    where: {
      conversa: { instanciaId: instancia.id },
      texto: { contains: q, mode: 'insensitive' },
    },
    orderBy: { enviadaEm: 'desc' },
    take: 60,
    select: {
      id: true,
      texto: true,
      daMim: true,
      enviadaEm: true,
      conversa: { select: { id: true, nome: true, telefone: true } },
    },
  });

  const alvo = semAcento(q);
  return mensagens.map((m) => {
    const texto = m.texto ?? '';
    const pos = semAcento(texto).indexOf(alvo);
    const de = Math.max(0, (pos < 0 ? 0 : pos) - 40);
    const ate = Math.min(texto.length, (pos < 0 ? 0 : pos) + alvo.length + 40);
    const trecho = `${de > 0 ? '…' : ''}${texto.slice(de, ate)}${ate < texto.length ? '…' : ''}`;
    return {
      conversaId: m.conversa.id,
      conversaNome: m.conversa.nome || m.conversa.telefone || 'Sem nome',
      mensagemId: m.id,
      trecho,
      daMim: m.daMim,
      enviadaEm: m.enviadaEm.toISOString(),
    };
  });
}

/**
 * Puxa a agenda do WhatsApp e melhora os nomes das conversas.
 *
 * É a fonte de nome mais confiável que existe: o `pushName` só aparece quando o
 * contato manda mensagem, e some quando fomos nós que iniciamos a conversa —
 * daí a fila cheia de contatos chamados "557599394960".
 *
 * Nome manual nunca é sobrescrito (a regra vive em `nomeMelhor`).
 */
/** Só os últimos 11 dígitos: o 55 e o nono dígito variam entre as fontes. */
function chaveTelefone(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-11) : null;
}

/**
 * Recupera o telefone das conversas em modo LID cruzando com os envios da
 * régua.
 *
 * Conversa que nasceu na sincronia de histórico só tem o LID — 15 dígitos que
 * não contêm telefone nenhum, e que o gateway não resolve (devolve `LID:
 * null`). Mas o corpo da mensagem que a régua disparou é único por pessoa:
 * carrega nome, valor, vencimento e link de pagamento. Casar o texto exato com
 * `envios_comunicacao` devolve o destinatário.
 *
 * Conversa cujo texto casa com destinatários diferentes é descartada: preferir
 * "Sem nome" a um nome trocado, que é pior porque parece certo.
 */
async function recuperarTelefonesPelosEnvios(instanciaId: string): Promise<number> {
  const linhas = await prisma.$queryRaw<{ conversaId: string; tel: string }[]>`
    SELECT DISTINCT m."conversaId" AS "conversaId",
           regexp_replace(e.destinatario, '[^0-9]', '', 'g') AS tel
    FROM whatsapp_mensagens m
    JOIN whatsapp_conversas c ON c.id = m."conversaId"
    JOIN envios_comunicacao e ON btrim(e.corpo) = btrim(m.texto)
    WHERE c."instanciaId" = ${instanciaId}
      AND c.telefone IS NULL
      AND c."ehGrupo" = false
      AND m."daMim" = true
      AND m.texto IS NOT NULL
      AND length(m.texto) > 40
  `;

  const porConversa = new Map<string, Set<string>>();
  for (const l of linhas) {
    const tel = String(l.tel ?? '').replace(/\D/g, '');
    if (!tel) continue;
    (porConversa.get(l.conversaId) ?? porConversa.set(l.conversaId, new Set()).get(l.conversaId)!).add(tel);
  }

  let recuperados = 0;
  for (const [conversaId, tels] of porConversa) {
    if (tels.size !== 1) continue;
    await prisma.whatsappConversa.update({
      where: { id: conversaId },
      data: { telefone: [...tels][0] },
    });
    recuperados++;
  }
  return recuperados;
}

/** Nomes da nossa base — clientes e leads da própria loteadora. */
async function nomesDaBase(loteadoraId: string | null): Promise<Map<string, string>> {
  const [clientes, leads] = await Promise.all([
    prisma.cliente.findMany({
      where: whereClienteDaLoteadora(loteadoraId),
      select: { nome: true, telefone: true },
    }),
    prisma.lead.findMany({
      where: loteadoraId ? { loteamento: { loteadoraId } } : {},
      select: { nome: true, telefone: true },
    }),
  ]);

  // Cliente por último: ele sobrescreve o lead, e comprador é o dado mais
  // confiável que temos sobre a pessoa.
  const mapa = new Map<string, string>();
  for (const l of leads) {
    const k = chaveTelefone(l.telefone);
    if (k && l.nome) mapa.set(k, l.nome);
  }
  for (const c of clientes) {
    const k = chaveTelefone(c.telefone);
    if (k && c.nome) mapa.set(k, c.nome);
  }
  return mapa;
}

/**
 * Preenche os nomes das conversas, em três etapas.
 *
 * A agenda do WhatsApp sozinha não resolvia: ela tem os contatos pessoais de
 * quem conectou o número, e os compradores da loteadora não estão lá. Por isso
 * a nossa base entrou como fonte, acima da agenda.
 */
export async function sincronizarContatos(): Promise<
  Resultado & { atualizados?: number; telefonesRecuperados?: number }
> {
  const { sessao, instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };
  if (instancia.status !== 'CONECTADA') return { ok: false, erro: 'Conecte seu número antes.' };

  // 1) Sem telefone não há como cruzar nada — esta etapa vem primeiro.
  const telefonesRecuperados = await recuperarTelefonesPelosEnvios(instancia.id);

  // 2) Agenda do WhatsApp. Falha aqui não aborta: a base ainda tem o que dar.
  const daAgenda = new Map<string, string>();
  const r = await listarContatos(instancia.token);
  if (r.ok && Array.isArray(r.data)) {
    for (const c of r.data) {
      const k = chaveTelefone(telefoneDoJid(c.Jid ?? ''));
      const nome = c.FullName || c.FirstName || c.BusinessName || c.PushName || '';
      if (k && nome) daAgenda.set(k, nome);
    }
  }

  // 3) Nossa base.
  const daBase = await nomesDaBase(sessao.loteadoraId);

  const conversas = await prisma.whatsappConversa.findMany({
    where: { instanciaId: instancia.id, ehGrupo: false, nomeManual: false },
    select: { id: true, nome: true, telefone: true, nomeOrigem: true, nomeManual: true },
  });

  let atualizados = 0;
  for (const c of conversas) {
    const k = chaveTelefone(c.telefone);
    if (!k) continue;

    // Base antes da agenda, e o próprio nomeMelhor recusa o rebaixamento.
    const candidatos: [string | undefined, string][] = [
      [daBase.get(k), 'base'],
      [daAgenda.get(k), 'contatos'],
    ];

    for (const [candidato, origem] of candidatos) {
      const melhor = nomeMelhor(c, candidato, origem);
      if (!melhor) continue;
      await prisma.whatsappConversa.update({
        where: { id: c.id },
        data: { nome: melhor, nomeOrigem: origem },
      });
      atualizados++;
      break;
    }
  }

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true, atualizados, telefonesRecuperados };
}

/** Arquiva ou desarquiva. Arquivada some da fila sem perder o histórico. */
export async function alternarArquivada(conversaId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const c = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, arquivada: true },
  });
  if (!c) return { ok: false, erro: 'Conversa não encontrada.' };

  await prisma.whatsappConversa.update({
    where: { id: c.id },
    data: { arquivada: !c.arquivada },
  });
  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/**
 * Marca como não lida.
 *
 * Serve para o "volto nisso depois": quem abriu a conversa sem tempo de
 * responder precisa devolvê-la à fila, senão ela some do radar exatamente por
 * ter sido aberta.
 */
export async function marcarNaoLida(conversaId: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const c = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, naoLidas: true },
  });
  if (!c) return { ok: false, erro: 'Conversa não encontrada.' };

  // Conversa que já tem não-lidas fica como está: gravar 1 aqui apagaria a
  // contagem real, e "5 não lidas" viraria "1" por causa de um clique que
  // pedia justamente para ela continuar não lida.
  if (c.naoLidas === 0) {
    await prisma.whatsappConversa.update({
      where: { id: c.id },
      data: { naoLidas: 1 },
    });
  }

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/** Adiciona ou remove uma etiqueta. */
export async function alternarEtiqueta(conversaId: string, etiqueta: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const c = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, etiquetas: true },
  });
  if (!c) return { ok: false, erro: 'Conversa não encontrada.' };

  const atual = (c.etiquetas as string[] | null) ?? [];
  const e = etiqueta.trim().toLowerCase();
  if (!e) return { ok: false, erro: 'Etiqueta vazia.' };

  const nova = atual.includes(e) ? atual.filter((x) => x !== e) : [...atual, e];
  await prisma.whatsappConversa.update({ where: { id: c.id }, data: { etiquetas: nova } });

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/** Muda a situação do atendimento (novo, em atendimento, encerrado…). */
export async function mudarSituacao(conversaId: string, situacao: string): Promise<Resultado> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const r = await prisma.whatsappConversa.updateMany({
    where: { id: conversaId, instanciaId: instancia.id },
    data: { situacao: situacao.trim().toLowerCase() || 'novo' },
  });
  if (r.count === 0) return { ok: false, erro: 'Conversa não encontrada.' };

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true };
}

/**
 * Abre conversa com um número que ainda não escreveu.
 *
 * É o caso de quem pegou o telefone do lead no funil e quer puxar assunto — sem
 * isto o chat só serve para responder, nunca para iniciar.
 */
export async function novaConversa(
  telefone: string
): Promise<Resultado & { conversaId?: string }> {
  const { instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };
  if (instancia.status !== 'CONECTADA') {
    return { ok: false, erro: 'Seu WhatsApp está desconectado.' };
  }

  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return { ok: false, erro: 'Telefone incompleto.' };
  // Sem DDI, assume Brasil: é de onde vêm os clientes de loteamento.
  const completo = digitos.length <= 11 ? `55${digitos}` : digitos;
  const remoteJid = `${completo}@s.whatsapp.net`;

  const existente = await prisma.whatsappConversa.findUnique({
    where: { instanciaId_remoteJid: { instanciaId: instancia.id, remoteJid } },
    select: { id: true },
  });
  if (existente) return { ok: true, conversaId: existente.id };

  const criada = await prisma.whatsappConversa.create({
    data: { instanciaId: instancia.id, remoteJid, telefone: completo, ehGrupo: false },
    select: { id: true },
  });

  revalidatePath('/admin/whatsapp/chat');
  return { ok: true, conversaId: criada.id };
}

export interface LeadParaVincular {
  id: string;
  nome: string;
  telefone: string;
  etapa: string | null;
}

/** Leads da empresa, para o painel oferecer o vínculo manual. */
export async function leadsParaVincular(termo: string): Promise<LeadParaVincular[]> {
  const { sessao } = await minhaInstancia();
  const q = termo.trim();

  const leads = await prisma.lead.findMany({
    where: {
      ...(sessao.loteadoraId ? { loteamento: { loteadoraId: sessao.loteadoraId } } : {}),
      ...(q
        ? {
            OR: [
              { nome: { contains: q, mode: 'insensitive' as const } },
              { telefone: { contains: q.replace(/\D/g, '') } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, nome: true, telefone: true, stage: { select: { nome: true } } },
  });

  return leads.map((l) => ({
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    etapa: l.stage?.nome ?? null,
  }));
}

/**
 * Cria um lead a partir da conversa e já vincula.
 *
 * Fecha o caminho que faltava: alguém chega pelo WhatsApp, e hoje só entra no
 * funil se um humano lembrar de cadastrar à mão — o que significa que os leads
 * que chegam pelo canal mais usado são os que menos aparecem no funil.
 */
export async function criarLeadDaConversa(conversaId: string): Promise<Resultado & { leadId?: string }> {
  const { sessao, instancia } = await minhaInstancia();
  if (!instancia) return { ok: false, erro: 'Sem instância.' };

  const conversa = await prisma.whatsappConversa.findFirst({
    where: { id: conversaId, instanciaId: instancia.id },
    select: { id: true, nome: true, telefone: true, leadId: true, ehGrupo: true },
  });
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' };
  if (conversa.leadId) return { ok: false, erro: 'Esta conversa já tem lead.' };
  if (conversa.ehGrupo) return { ok: false, erro: 'Grupo não vira lead.' };
  if (!conversa.telefone) return { ok: false, erro: 'Conversa sem telefone.' };

  // O loteamento define a empresa dona do lead. Sem um, o lead ficaria órfão e
  // invisível para o admin da loteadora — pior que não criar.
  const loteamento = await prisma.loteamento.findFirst({
    where: sessao.loteadoraId ? { loteadoraId: sessao.loteadoraId } : {},
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!loteamento) return { ok: false, erro: 'Nenhum loteamento cadastrado para vincular o lead.' };

  const lead = await prisma.lead.create({
    data: {
      nome: conversa.nome || `WhatsApp ${conversa.telefone}`,
      telefone: conversa.telefone,
      // O formulário exige e-mail; quem chega pelo WhatsApp não tem um.
      email: '',
      origem: 'whatsapp',
      loteamentoId: loteamento.id,
      mensagem: 'Lead criado a partir de uma conversa no WhatsApp.',
    },
    select: { id: true },
  });

  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: { leadId: lead.id },
  });

  revalidatePath('/admin/whatsapp/chat');
  revalidatePath('/admin/leads');
  return { ok: true, leadId: lead.id };
}
