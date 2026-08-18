import type { Prisma, WhatsappTipoMensagem } from '@prisma/client';
import { prisma } from './prisma';
import { gravarDocumento } from './storage-seguro';
import { baixarMidia, solicitarHistorico, obterFotoPerfil, infoDoGrupo } from './evolution-go';
import { paraData, telefoneDoJid, ehGrupo, type EventoNormalizado } from './whatsapp-evento';
import { transcricaoConfigurada, transcreverMensagem } from './whatsapp-transcricao';

/**
 * Ingestão de eventos do WhatsApp — o que o webhook faz depois de responder.
 *
 * Portado do módulo equivalente do Target Import Manager, que roda em produção
 * há meses. Cada regra aqui tem um defeito atrás dela; os comentários dizem
 * qual, porque sem isso a próxima pessoa "simplifica" e o defeito volta.
 */

// ── Leitura do conteúdo ─────────────────────────────────────────────────────

interface ConteudoLido {
  tipo: WhatsappTipoMensagem | 'PROTOCOLO';
  texto: string;
  mime?: string;
  nomeArquivo?: string;
  protocolo?: Record<string, any>;
}

export function lerConteudo(msg: Record<string, any> = {}): ConteudoLido {
  if (msg.conversation) return { tipo: 'TEXTO', texto: msg.conversation };
  if (msg.extendedTextMessage) {
    return { tipo: 'TEXTO', texto: msg.extendedTextMessage.text || '' };
  }
  if (msg.imageMessage) {
    return {
      tipo: 'IMAGEM',
      texto: msg.imageMessage.caption || '',
      mime: msg.imageMessage.mimetype,
    };
  }
  if (msg.videoMessage) {
    return {
      tipo: 'VIDEO',
      texto: msg.videoMessage.caption || '',
      mime: msg.videoMessage.mimetype,
    };
  }
  if (msg.audioMessage) return { tipo: 'AUDIO', texto: '', mime: msg.audioMessage.mimetype };
  if (msg.documentMessage) {
    return {
      tipo: 'DOCUMENTO',
      texto: msg.documentMessage.caption || '',
      mime: msg.documentMessage.mimetype,
      nomeArquivo: msg.documentMessage.fileName,
    };
  }
  if (msg.stickerMessage) return { tipo: 'STICKER', texto: '', mime: msg.stickerMessage.mimetype };

  /**
   * 🔴 Mensagem de PROTOCOLO não é mensagem — é uma ordem sobre outra mensagem.
   *
   * Editar e apagar chegam assim. Sem reconhecer, caem como tipo desconhecido
   * sem texto e sem mídia, e a bolha anuncia "arquivo não baixado": o cliente
   * corrige um preço e a conversa exibe um aviso de anexo perdido que nunca
   * existiu, no meio do histórico.
   */
  if (msg.protocolMessage || msg.editedMessage) {
    return {
      tipo: 'PROTOCOLO',
      texto: '',
      protocolo: msg.protocolMessage || { editedMessage: msg.editedMessage },
    };
  }
  if (msg.locationMessage) {
    const l = msg.locationMessage;
    return {
      tipo: 'LOCALIZACAO',
      texto: `📍 Localização: ${l.degreesLatitude}, ${l.degreesLongitude}`,
    };
  }
  if (msg.contactMessage || msg.contactsArrayMessage) {
    return { tipo: 'CONTATO', texto: msg.contactMessage?.displayName || 'Contato' };
  }
  return { tipo: 'TEXTO', texto: '' };
}

/**
 * 🔴 Grupo NÃO tem telefone — e fingir que tem é perigoso.
 *
 * O JID de grupo é `120363143104495367@g.us`. Sem esta saída ele viraria o
 * "telefone" 120363143104495367, cujos últimos dígitos entram no mesmo
 * casamento que liga conversa a lead. Um grupo poderia ser fundido na conversa
 * de um cliente real por coincidência numérica — e mensagem de grupo dentro do
 * histórico de um cliente é o tipo de erro que ninguém percebe.
 */
export function telefoneDe(remoteJid: string, jidAlternativo?: string): string | null {
  if (ehGrupo(remoteJid)) return null;
  const ehLid = String(remoteJid || '').includes('@lid');
  if (ehLid && jidAlternativo) return telefoneDoJid(jidAlternativo);
  if (ehLid) return null;
  return telefoneDoJid(remoteJid);
}

// ── Nome do contato ─────────────────────────────────────────────────────────

/** Nome de verdade tem letra. "557599394960" e "+55 75 9939-4960" não têm. */
const temLetra = (v: string | null | undefined) => /\p{L}/u.test(String(v || ''));

/**
 * Confiança da origem do nome. Nome vindo da agenda do WhatsApp não pode ser
 * rebaixado pelo `pushName` da próxima mensagem, que é o apelido escolhido pela
 * pessoa — muitas vezes só um emoji ou o nome da loja.
 */
/**
 * `base` fica acima de `contatos` porque a nossa tabela de clientes é a fonte
 * certa para quem compra da loteadora: a agenda do celular do responsável tem
 * os contatos pessoais dele, e ninguém salva duzentos compradores no telefone.
 * Medido em produção — dos 63 números recuperados, zero estavam na agenda e 62
 * estavam na base.
 */
const FORCA_NOME: Record<string, number> = {
  manual: 4,
  base: 3,
  contatos: 2,
  push: 1,
  numero: 0,
};

/**
 * Decide se `candidato` deve virar o novo nome. `null` quando não há nada
 * melhor, para quem chama gravar só o que muda.
 *
 * Duas regras que existem para não estragar o que já está certo: candidato sem
 * letra é descartado (um número JAMAIS substitui um nome), e nome manual é
 * intocável — quem renomeou tinha um motivo, e a sincronização não desfaz isso
 * a cada 24h.
 */
export function nomeMelhor(
  conversa: { nome: string | null; nomeOrigem: string; nomeManual: boolean },
  candidato: string | null | undefined,
  origem: string
): string | null {
  const nome = String(candidato || '').trim();
  if (!nome || !temLetra(nome)) return null;
  if (conversa.nomeManual) return null;

  const atual = String(conversa.nome || '').trim();
  if (nome === atual) return null;

  // Sem letra no nome atual = ainda é o número; qualquer nome de verdade ganha.
  const forcaAtual = temLetra(atual) ? (FORCA_NOME[conversa.nomeOrigem] ?? FORCA_NOME.push) : FORCA_NOME.numero;
  if ((FORCA_NOME[origem] ?? 0) < forcaAtual) return null;
  return nome;
}

// ── Mídia ───────────────────────────────────────────────────────────────────

const ROTULO_MIDIA: Record<string, string> = {
  IMAGEM: '📷 Foto',
  AUDIO: '🎤 Áudio',
  VIDEO: '🎬 Vídeo',
  DOCUMENTO: '📎 Documento',
  STICKER: 'Figurinha',
  LOCALIZACAO: '📍 Localização',
  CONTATO: '👤 Contato',
};

/**
 * Grava a mídia no cofre e devolve o caminho.
 *
 * 🔴 Vai para o cofre (fora do webroot, cifrado), NUNCA para `public/`.
 * Cliente manda foto de RG por WhatsApp com naturalidade, e `public/` é
 * exatamente o vazamento que este sistema já teve por outra porta.
 *
 * Best-effort de propósito: mídia que não baixa não pode impedir a mensagem de
 * ser gravada. Perder o áudio é ruim; perder a mensagem inteira é pior.
 */
async function salvarMidia(
  token: string,
  conversaId: string,
  messageId: string,
  conteudo: Record<string, any>,
  lido: ConteudoLido,
  base64Evento: string | null
): Promise<{ caminho: string; tamanho: number } | null> {
  try {
    let b64 = base64Evento;

    // 🔴 Na prática o evento quase nunca traz base64 — no ERP foram 26 de 26
    // mensagens de mídia sem arquivo, aparecendo como bolha vazia. O download
    // explícito é o caminho que funciona; o base64 do evento fica como atalho
    // caso uma versão do servidor passe a mandá-lo.
    if (!b64) {
      const r = await baixarMidia(token, conteudo);
      if (!r.ok) {
        console.warn('[whatsapp] download de mídia falhou:', JSON.stringify(r.detalhe ?? r.error).slice(0, 200));
        return null;
      }
      const d = (r.data ?? {}) as Record<string, any>;

      // 🔴 Diagnóstico SEMPRE, não só no fracasso. No ERP, quando um campo
      // casou com o conteúdo ERRADO (uma chave de 20 caracteres em vez do
      // áudio), gravaram-se 14 bytes de lixo e o player aparecia mudo, sem uma
      // linha de log para explicar. Falha silenciosa com aparência de sucesso.
      if (typeof d === 'object' && d !== null) {
        const forma = Object.entries(d)
          .map(([k, v]) => `${k}:${typeof v === 'string' ? v.length + 'ch' : typeof v}`)
          .join(' ');
        console.log('[whatsapp] resposta do download →', forma.slice(0, 300));
      }

      b64 =
        d.base64 || d.Base64 || d.media || d.Media || d.data || d.Data ||
        d.buffer || d.Buffer || (typeof d === 'string' ? d : null);
    }

    if (!b64 || typeof b64 !== 'string') return null;

    const limpo = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
    const buffer = Buffer.from(limpo, 'base64');
    // Conteúdo pequeno demais para ser mídia: quase sempre é uma chave ou um
    // erro serializado que casou com o nome do campo.
    if (buffer.length < 100) {
      console.warn(`[whatsapp] mídia de ${buffer.length} bytes descartada (não é arquivo)`);
      return null;
    }

    const ext = (lido.mime || '').split('/')[1]?.split(';')[0] || 'bin';
    const nome = `${Date.now()}-${messageId.slice(-12) || 'midia'}.${ext}`;
    const caminho = await gravarDocumento({
      subdir: `whatsapp/${conversaId}`,
      nomeArquivo: nome,
      conteudo: buffer,
      mimeType: lido.mime ?? null,
    });
    return { caminho, tamanho: buffer.length };
  } catch (e) {
    console.error('[whatsapp] falha ao salvar mídia:', e);
    return null;
  }
}

// ── Conversa ────────────────────────────────────────────────────────────────

/**
 * Acha a conversa deste contato ou cria.
 *
 * 🔴 Procura também pelo TELEFONE, não só pelo JID.
 *
 * O mesmo contato chega ora como `…@s.whatsapp.net`, ora como `…@lid`. Sem
 * casar pelo telefone, cada forma vira uma conversa: a pessoa aparece duas
 * vezes na fila, com metade das mensagens em cada uma, e o histórico fica
 * partido sem que ninguém entenda por quê.
 */
async function acharOuCriarConversa(input: {
  instanciaId: string;
  remoteJid: string;
  nome: string | null;
  /**
   * Nome que custa uma consulta ao servidor do WhatsApp — usado só quando a
   * conversa vai mesmo ser criada.
   *
   * 🔴 É FUNÇÃO, não valor, e isso não é preciosismo. Nome de grupo não vem no
   * evento: é preciso perguntar. Resolvendo antes de saber se a conversa já
   * existe, cada mensagem de grupo virava uma pergunta ao WhatsApp, e o
   * WhatsApp responde 429 quando se pergunta demais. Um grupo com 388
   * mensagens gerou 388 perguntas — e como todas falharam, ele ficou sem nome
   * e continuou perguntando.
   */
  nomeSobDemanda?: () => Promise<string | null>;
  telefone: string | null;
}) {
  const porJid = await prisma.whatsappConversa.findUnique({
    where: {
      instanciaId_remoteJid: { instanciaId: input.instanciaId, remoteJid: input.remoteJid },
    },
  });
  if (porJid) {
    /**
     * A conversa pode ter nascido na sincronia de histórico, que entrega só o
     * LID — um identificador de 15 dígitos, sem telefone nenhum. O número real
     * aparece depois, no `senderAlt` do primeiro evento ao vivo, e este é o
     * único momento em que dá para gravá-lo.
     *
     * Sem isto a conversa fica sem número para sempre, e sem número a agenda
     * do WhatsApp não tem como lhe dar nome: era a causa das 218 conversas
     * listadas como "Sem nome" mesmo com a agenda inteira sincronizada.
     */
    if (input.telefone && !porJid.telefone) {
      return prisma.whatsappConversa.update({
        where: { id: porJid.id },
        data: { telefone: input.telefone },
      });
    }
    return porJid;
  }

  if (input.telefone) {
    const irma = await prisma.whatsappConversa.findFirst({
      where: { instanciaId: input.instanciaId, telefone: input.telefone, ehGrupo: false },
      orderBy: { ultimaMensagemEm: 'desc' },
    });
    // Adota o JID novo: a partir daqui as duas formas caem na mesma conversa.
    if (irma) {
      return prisma.whatsappConversa.update({
        where: { id: irma.id },
        data: { remoteJid: input.remoteJid },
      });
    }
  }

  const nome = input.nome ?? (input.nomeSobDemanda ? await input.nomeSobDemanda() : null);

  return prisma.whatsappConversa.create({
    data: {
      instanciaId: input.instanciaId,
      remoteJid: input.remoteJid,
      telefone: input.telefone,
      nome,
      nomeOrigem: nome ? 'push' : 'numero',
      ehGrupo: ehGrupo(input.remoteJid),
    },
  });
}

/** Padrão de situações encerradas, quando a empresa não configurou as suas. */
const ENCERRADAS_PADRAO = ['encerrado', 'ganho', 'perdido'];

/**
 * Situações que contam como atendimento encerrado — mensagem do cliente reabre.
 *
 * Configurável por empresa porque cada operação chama as coisas de um jeito:
 * "finalizado", "resolvido", "vendido". Com a lista errada, ou toda mensagem
 * reabre um atendimento que não estava encerrado, ou nenhuma reabre o que
 * estava — e a fila deixa de refletir o que precisa de resposta.
 */
async function situacoesEncerradas(instanciaId: string): Promise<Set<string>> {
  const inst = await prisma.whatsappInstancia.findUnique({
    where: { id: instanciaId },
    select: { loteadora: { select: { whatsappSituacoesEncerradas: true } } },
  });
  const config = inst?.loteadora?.whatsappSituacoesEncerradas as string[] | null | undefined;
  const lista = Array.isArray(config) && config.length > 0 ? config : ENCERRADAS_PADRAO;
  return new Set(lista.map((s) => String(s).toLowerCase()));
}

/**
 * Nome do grupo, perguntado ao WhatsApp.
 *
 * O `pushName` de uma mensagem de grupo é de QUEM FALOU, não do grupo. Sem
 * perguntar, o grupo fica na fila como o JID cru — `120363143104495367` — que
 * não diz nada a ninguém.
 */
async function nomeDoGrupo(token: string, jid: string): Promise<string | null> {
  try {
    const r = await infoDoGrupo(token, jid);
    if (!r.ok) return null;
    return r.data?.Name || r.data?.name || r.data?.Subject || null;
  } catch {
    return null;
  }
}

/**
 * Acha o lead da empresa cujo telefone bate com o da conversa.
 *
 * 🔴 Casa pelos ÚLTIMOS 8 DÍGITOS. O mesmo celular aparece como 5575984904920,
 * 557598490492 e 75984904920 — DDI e nono dígito entram e saem conforme a
 * origem do cadastro. Comparar a string inteira não casaria quase nada.
 *
 * Dois leads com o mesmo final não vinculam nenhum: vincular o errado põe a
 * conversa de um cliente no histórico de outro, que é pior que não vincular.
 */
async function acharLeadPorTelefone(
  instanciaId: string,
  telefone: string
): Promise<string | null> {
  const sufixo = telefone.replace(/\D/g, '').slice(-8);
  if (sufixo.length < 8) return null;

  const inst = await prisma.whatsappInstancia.findUnique({
    where: { id: instanciaId },
    select: { loteadoraId: true },
  });

  const candidatos = await prisma.lead.findMany({
    where: {
      ...(inst?.loteadoraId ? { loteamento: { loteadoraId: inst.loteadoraId } } : {}),
      telefone: { endsWith: sufixo },
    },
    select: { id: true },
    take: 2,
  });

  return candidatos.length === 1 ? candidatos[0].id : null;
}

// ── Tratadores ──────────────────────────────────────────────────────────────

/**
 * Uma mensagem chegou.
 *
 * 🔴 A MESMA mensagem pode chegar mais de uma vez: pelo webhook ao vivo, pelo
 * HISTORY_SYNC (que alcança mensagens recentes) e pelo eco do que nós mesmos
 * enviamos. No ERP mediram 27 ids com duas cópias — vários com a mesma
 * mensagem gravada uma vez como recebida e outra como enviada, o que além de
 * repetir a bolha embaralhava quem falou por último e, com isso, a espera por
 * resposta e a prévia da fila.
 */
export async function tratarMensagem(
  instancia: { id: string; token: string },
  evento: EventoNormalizado
): Promise<void> {
  const { remoteJid, daMim, messageId, pushName, timestamp, conteudo, base64, jidAlternativo, participante } = evento;
  if (!remoteJid) return;
  // Status/stories não são conversa.
  if (remoteJid === 'status@broadcast') return;

  const lido = lerConteudo(conteudo || {});

  // Editar/apagar age sobre uma mensagem existente e não cria bolha nova. Sai
  // ANTES de mexer na conversa: edição não é atividade nova, não deve reordenar
  // a fila nem reabrir atendimento encerrado.
  if (lido.tipo === 'PROTOCOLO') {
    await tratarProtocolo(instancia.id, lido.protocolo ?? {}, remoteJid);
    return;
  }

  const grupo = ehGrupo(remoteJid);
  const telefone = telefoneDe(remoteJid, jidAlternativo);

  const conversa = await acharOuCriarConversa({
    instanciaId: instancia.id,
    remoteJid,
    // Em grupo o `pushName` é de quem falou, não do grupo. O nome do grupo
    // vem do servidor, e só é perguntado se a conversa for nova.
    nome: grupo ? null : pushName || null,
    nomeSobDemanda: grupo ? () => nomeDoGrupo(instancia.token, remoteJid) : undefined,
    telefone,
  });

  // Liga ao funil na primeira mensagem, sem esperar alguém clicar. Quem chega
  // pelo WhatsApp e já é lead precisa aparecer com o contexto na hora — depois
  // que a resposta foi dada, o vínculo não muda mais o que foi respondido.
  if (!conversa.leadId && telefone) {
    const leadId = await acharLeadPorTelefone(instancia.id, telefone);
    if (leadId) await prisma.whatsappConversa.update({ where: { id: conversa.id }, data: { leadId } });
  }

  if (messageId) {
    const jaTem = await prisma.whatsappMensagem.findUnique({
      where: { conversaId_messageId: { conversaId: conversa.id, messageId } },
      select: { id: true },
    });
    // Sem messageId não há como comparar: nesse caso grava, porque perder é
    // pior que repetir.
    if (jaTem) return;
  }

  // Primeira mensagem deste contato: pede o histórico do chat ao WhatsApp, com
  // esta mensagem como referência. A marca é gravada ANTES de disparar —
  // pedido que falha é melhor que pedido que se repete sozinho para sempre.
  if (!conversa.historicoPedido && messageId) {
    await prisma.whatsappConversa.update({
      where: { id: conversa.id },
      data: { historicoPedido: new Date() },
    });
    void solicitarHistorico(instancia.token, {
      count: 50,
      messageInfo: { Chat: remoteJid, ID: messageId, IsFromMe: daMim, Sender: remoteJid },
    }).catch(() => {});
  }

  let midia: { caminho: string; tamanho: number } | null = null;
  if (lido.mime) {
    midia = await salvarMidia(instancia.token, conversa.id, messageId, conteudo, lido, base64);
  }

  const quando = paraData(timestamp);
  const previa = (lido.texto || ROTULO_MIDIA[lido.tipo] || 'Mensagem').slice(0, 120);

  // Áudio recebido com arquivo salvo nasce como "transcrevendo…": a tela diz
  // isso desde a primeira vez que a mensagem aparece, em vez de um player mudo
  // que ganha texto do nada oito segundos depois.
  const vaiTranscrever =
    lido.tipo === 'AUDIO' && !daMim && Boolean(midia) && transcricaoConfigurada();

  const gravada = await prisma.whatsappMensagem.create({
    data: {
      conversaId: conversa.id,
      messageId: messageId || `sem-id-${Date.now()}`,
      daMim,
      tipo: lido.tipo as WhatsappTipoMensagem,
      texto: lido.texto || null,
      midiaCaminho: midia?.caminho ?? null,
      midiaMime: lido.mime ?? null,
      midiaTamanho: midia?.tamanho ?? null,
      nomeArquivo: lido.nomeArquivo ?? null,
      enviadaEm: quando,
      status: daMim ? 'ENVIADA' : 'ENTREGUE',
      // Só em grupo: quem falou, com o nome que valia no momento.
      ...(grupo && !daMim
        ? { participante: telefoneDoJid(participante), participanteNome: pushName || null }
        : {}),
      ...(vaiTranscrever ? { transcricaoStatus: 'pendente' } : {}),
    },
  });

  // O pushName é a fonte mais fraca de nome, e em GRUPO nunca vale: ali ele é
  // de quem falou, e aplicá-lo faria o grupo se chamar "Jerônimo" depois de uma
  // mensagem e "Maria" depois da seguinte — a fila trocaria de nome sozinha.
  const nomeNovo = grupo ? null : nomeMelhor(conversa, pushName, 'push');

  await prisma.whatsappConversa.update({
    where: { id: conversa.id },
    data: {
      ultimaMensagemEm: quando,
      ultimaMensagemPreview: previa,
      ultimaMensagemMinha: daMim,
      naoLidas: daMim ? 0 : { increment: 1 },
      // Mensagem do cliente reabre atendimento já encerrado.
      ...(daMim
        ? {}
        : (await situacoesEncerradas(instancia.id)).has(conversa.situacao)
          ? { situacao: 'novo' }
          : {}),
      ...(nomeNovo ? { nome: nomeNovo, nomeOrigem: 'push' } : {}),
      // Conversa LID criada antes de sabermos o número: assim que um evento
      // traz o JID alternativo, o telefone entra sem recriar a conversa.
      ...(!conversa.telefone && telefone ? { telefone } : {}),
    },
  });

  // 🔴 A URL da foto vem do CDN do WhatsApp e EXPIRA — sem revalidar, a imagem
  // quebra sozinha semanas depois, e o sintoma aparece longe da causa. Grupo
  // fica de fora: a rota de avatar espera um telefone, e o JID de grupo não é.
  if (!grupo) {
    void renovarAvatar(instancia.token, conversa.id, remoteJid, conversa.fotoAtualizadaEm);
  }

  // Depois da mensagem existir e ser tocável — nunca antes.
  if (vaiTranscrever) void transcreverMensagem(gravada.id).catch(() => {});
}

/**
 * Recibo de entrega/leitura — é o que acende o segundo tique e o azul.
 */
export async function tratarRecibo(instanciaId: string, data: Record<string, any>): Promise<void> {
  if (!data) return;

  const ids: string[] = data.MessageIDs || data.messageIds || data.IDs || data.ids || [];
  const tipo = String(data.Type || data.type || '').toLowerCase();
  if (!Array.isArray(ids) || ids.length === 0) return;

  // "read"/"played" = azul; qualquer outro recibo = entregue.
  const status = tipo.includes('read') || tipo.includes('play') ? 'LIDA' : 'ENTREGUE';

  await prisma.whatsappMensagem.updateMany({
    where: {
      messageId: { in: ids },
      conversa: { instanciaId },
      daMim: true,
      // Nunca rebaixa: uma mensagem lida não volta a "entregue" porque chegou
      // um recibo de entrega atrasado.
      ...(status === 'ENTREGUE' ? { status: { in: ['PENDENTE', 'ENVIADA'] } } : {}),
    },
    data: { status },
  });
}

/**
 * Acha a lista de conversas dentro do payload de histórico.
 *
 * O envelope muda de forma entre versões do servidor, então procuramos a chave
 * `conversations` em profundidade em vez de apostar num caminho fixo — um
 * caminho fixo que erra devolve "sem conversas" e o histórico simplesmente não
 * entra, sem erro nenhum.
 */
function acharConversas(raiz: any, profundidade = 0): any[] | null {
  if (!raiz || typeof raiz !== 'object' || profundidade > 3) return null;
  for (const [chave, valor] of Object.entries(raiz)) {
    if (chave.toLowerCase() === 'conversations' && Array.isArray(valor)) return valor;
  }
  for (const valor of Object.values(raiz)) {
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      const achado = acharConversas(valor, profundidade + 1);
      if (achado) return achado;
    }
  }
  return null;
}

/**
 * Sincronia de histórico: o WhatsApp devolve as conversas antigas em lote.
 *
 * O formato é aninhado — uma lista de conversas, cada uma com suas mensagens em
 * `WebMessageInfo` — e não uma lista plana de eventos. Tratar como plana faz o
 * histórico inteiro ser descartado em silêncio.
 *
 * O histórico NÃO traz mídia: só o texto e os metadados. A bolha de uma foto
 * antiga aparece como "Imagem não baixada", que é a verdade — melhor do que
 * bolha vazia.
 */
export async function tratarHistorico(
  instancia: { id: string; token: string },
  data: Record<string, any>
): Promise<void> {
  if (!data) return;

  const conversas = acharConversas(data);
  if (!Array.isArray(conversas) || conversas.length === 0) {
    console.warn('[whatsapp] history-sync sem conversas:', JSON.stringify(data).slice(0, 600));
    return;
  }

  let gravadas = 0;

  for (const conv of conversas) {
    const jid: string = conv.ID || conv.Id || conv.id || conv.JID || conv.jid || '';
    if (!jid || jid === 'status@broadcast') continue;

    const mensagens: any[] = conv.Messages || conv.messages || [];
    // O nome do grupo vem aqui — é a única forma de saber o nome de um grupo do
    // qual ainda não recebemos mensagem ao vivo.
    const nomeDaConversa: string = conv.Name || conv.name || '';

    const conversa = await acharOuCriarConversa({
      instanciaId: instancia.id,
      remoteJid: jid,
      nome: nomeDaConversa || null,
      telefone: telefoneDe(jid),
    });

    let ultima: { quando: Date; previa: string; daMim: boolean } | null = null;

    for (const item of mensagens.slice(0, 200)) {
      const wmi = item.Message || item.message || item; // WebMessageInfo
      const key = wmi.Key || wmi.key || {};
      const messageId: string = key.ID || key.Id || key.id || '';
      if (!messageId) continue;

      // O histórico se sobrepõe ao que o webhook já entregou ao vivo.
      const existe = await prisma.whatsappMensagem.findUnique({
        where: { conversaId_messageId: { conversaId: conversa.id, messageId } },
        select: { id: true },
      });
      if (existe) continue;

      const conteudo = wmi.Message || wmi.message || {};
      const lido = lerConteudo(conteudo);
      if (lido.tipo === 'PROTOCOLO') continue;

      const daMim = Boolean(key.FromMe ?? key.fromMe);
      const quando = paraData(wmi.MessageTimestamp || wmi.messageTimestamp || 0);

      await prisma.whatsappMensagem.create({
        data: {
          conversaId: conversa.id,
          messageId,
          daMim,
          tipo: lido.tipo as WhatsappTipoMensagem,
          texto: lido.texto || null,
          // Histórico vem sem a mídia; a bolha dirá "não baixado".
          midiaMime: lido.mime ?? null,
          nomeArquivo: lido.nomeArquivo ?? null,
          enviadaEm: quando,
          status: daMim ? 'ENVIADA' : 'ENTREGUE',
          // Quem falou, quando o histórico é de grupo. Sem isto, um histórico
          // de grupo é um monólogo de dez vozes diferentes.
          ...(ehGrupo(jid) && !daMim
            ? {
                participante: telefoneDoJid(
                  wmi.participant || wmi.Participant || key.participant || ''
                ),
              }
            : {}),
        },
      });
      gravadas++;

      if (!ultima || quando > ultima.quando) {
        ultima = {
          quando,
          previa: lido.texto || ROTULO_MIDIA[lido.tipo] || 'Mensagem',
          daMim,
        };
      }
    }

    // Atualiza a prévia só se o histórico for MAIS NOVO que o que já está lá —
    // senão uma sincronização jogaria a fila para trás no tempo.
    if (ultima && (!conversa.ultimaMensagemEm || ultima.quando > conversa.ultimaMensagemEm)) {
      await prisma.whatsappConversa.update({
        where: { id: conversa.id },
        data: {
          ultimaMensagemEm: ultima.quando,
          ultimaMensagemPreview: ultima.previa.slice(0, 120),
          ultimaMensagemMinha: ultima.daMim,
        },
      });
    }
  }

  if (gravadas > 0) {
    console.log(`[whatsapp] history-sync: ${gravadas} mensagem(ns) do histórico gravadas`);
  }
}

/**
 * Pede ao WhatsApp o histórico das conversas que já conhecemos.
 *
 * Cada pedido precisa de uma mensagem de referência — o WhatsApp devolve o que
 * veio ANTES dela. Por isso usamos a mensagem mais ANTIGA de cada conversa:
 * pedir a partir da mais recente traria o que já temos.
 *
 * O retorno não é síncrono: chega depois, pelo webhook, como HISTORY_SYNC.
 */
export async function pedirHistoricoDasConversas(
  instancia: { id: string; token: string },
  limite = 20
): Promise<{ conversas: number; pedidos: number }> {
  const conversas = await prisma.whatsappConversa.findMany({
    where: { instanciaId: instancia.id },
    orderBy: { ultimaMensagemEm: 'desc' },
    take: limite,
    select: { id: true, remoteJid: true },
  });

  let pedidos = 0;
  for (const c of conversas) {
    const referencia = await prisma.whatsappMensagem.findFirst({
      where: { conversaId: c.id },
      orderBy: { enviadaEm: 'asc' },
      select: { messageId: true, daMim: true },
    });
    if (!referencia?.messageId) continue;

    const r = await solicitarHistorico(instancia.token, {
      count: 50,
      messageInfo: {
        Chat: c.remoteJid,
        ID: referencia.messageId,
        IsFromMe: referencia.daMim,
        Sender: c.remoteJid,
      },
    });
    if (r.ok) pedidos++;
  }

  return { conversas: conversas.length, pedidos };
}

/** Editar e apagar: agem sobre uma mensagem que já existe. */
async function tratarProtocolo(
  instanciaId: string,
  protocolo: Record<string, any>,
  remoteJid: string
): Promise<void> {
  const alvo =
    protocolo?.key?.id || protocolo?.Key?.ID || protocolo?.editedMessage?.key?.id || null;
  if (!alvo) return;

  const tipo = String(protocolo?.type || protocolo?.Type || '').toUpperCase();

  // REVOKE = apagada para todos.
  if (tipo.includes('REVOKE')) {
    await prisma.whatsappMensagem.updateMany({
      where: { messageId: alvo, conversa: { instanciaId, remoteJid } },
      data: { texto: 'Mensagem apagada', tipo: 'SISTEMA', midiaCaminho: null },
    });
    return;
  }

  const novo =
    protocolo?.editedMessage?.message?.conversation ||
    protocolo?.editedMessage?.conversation ||
    protocolo?.EditedMessage?.Message?.Conversation ||
    null;
  if (novo) {
    await prisma.whatsappMensagem.updateMany({
      where: { messageId: alvo, conversa: { instanciaId, remoteJid } },
      data: { texto: novo, editada: true },
    });
  }
}

/** Foto do contato: renova quando vencida (>24h) ou quando nunca foi buscada. */
async function renovarAvatar(
  token: string,
  conversaId: string,
  remoteJid: string,
  atualizadaEm: Date | null
): Promise<void> {
  const VENCIMENTO_MS = 24 * 60 * 60 * 1000;
  if (atualizadaEm && Date.now() - atualizadaEm.getTime() < VENCIMENTO_MS) return;

  try {
    const r = await obterFotoPerfil(token, remoteJid);
    const url = r.ok ? (r.data?.url ?? r.data?.URL ?? null) : null;
    await prisma.whatsappConversa.update({
      where: { id: conversaId },
      // Carimba a data mesmo sem foto: contato sem avatar não pode virar uma
      // chamada externa por mensagem recebida, para sempre.
      data: { fotoAtualizadaEm: new Date(), ...(url ? { fotoUrl: url } : {}) },
    });
  } catch {
    /* best-effort */
  }
}

export type { Prisma };
