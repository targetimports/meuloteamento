import { prisma } from './prisma';
import { lerDocumento } from './storage-seguro';

/**
 * Transcrição de áudio das mensagens de WhatsApp.
 *
 * ── Por que um serviço externo ──────────────────────────────────────────────
 * Nenhuma das chaves que o sistema já tem recebe áudio. O provedor é o **Groq**
 * rodando `whisper-large-v3-turbo`: compatível com o formato da API da OpenAI
 * (mesma rota, mesmo multipart), custa cerca de US$ 0,04 por HORA de áudio e
 * responde em 1-3 segundos. Trocar de provedor é mudar `BASE` e `MODELO`.
 *
 * ── Por que best-effort, sempre ─────────────────────────────────────────────
 * Transcrição é conveniência sobre uma mensagem que JÁ existe e JÁ tem o áudio
 * tocável na tela. Nenhuma falha aqui pode impedir a mensagem de ser gravada
 * nem atrasar a resposta ao webhook — perder a transcrição custa um clique no
 * play; perder a mensagem custa o atendimento.
 *
 * ── Por que roda DEPOIS ─────────────────────────────────────────────────────
 * A ordem é: mensagem gravada e tocável primeiro, legenda depois. Enfiar alguns
 * segundos de transcrição no caminho da gravação atrasaria a bolha na tela para
 * render um texto que é comodidade.
 */

const BASE = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODELO = 'whisper-large-v3-turbo';
const TIMEOUT_MS = 60_000;
/** Acima disso, transcrever custa mais espera do que vale. */
const MAX_BYTES = 20 * 1024 * 1024;

export function transcricaoConfigurada(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Transcreve o áudio de uma mensagem já gravada e guarda o texto nela.
 *
 * 🔴 Roda DEPOIS de a mensagem existir, nunca antes.
 */
export async function transcreverMensagem(mensagemId: string): Promise<void> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return;

  const mensagem = await prisma.whatsappMensagem.findUnique({
    where: { id: mensagemId },
    select: { id: true, midiaCaminho: true, midiaMime: true, midiaTamanho: true, tipo: true },
  });
  if (!mensagem?.midiaCaminho || mensagem.tipo !== 'AUDIO') return;
  if ((mensagem.midiaTamanho ?? 0) > MAX_BYTES) {
    await marcarErro(mensagem.id, 'Áudio grande demais para transcrever');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const audio = await lerDocumento(mensagem.midiaCaminho);

    const form = new FormData();
    form.set(
      'file',
      new Blob([new Uint8Array(audio)], { type: mensagem.midiaMime || 'audio/ogg' }),
      'audio.ogg'
    );
    form.set('model', MODELO);
    // O WhatsApp brasileiro é português; sem dizer, o Whisper às vezes decide
    // que um áudio curto é espanhol e devolve uma tradução aproximada.
    form.set('language', 'pt');
    form.set('response_format', 'json');

    const res = await fetch(BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const detalhe = (await res.text()).slice(0, 200);
      await marcarErro(mensagem.id, `Provedor recusou (${res.status})`);
      console.warn('[whatsapp:transcricao] falhou:', detalhe);
      return;
    }

    const dados = (await res.json()) as { text?: string };
    const texto = (dados.text || '').trim();

    await prisma.whatsappMensagem.update({
      where: { id: mensagem.id },
      data: {
        transcricao: texto || null,
        transcricaoStatus: texto ? 'pronta' : 'vazia',
      },
    });
  } catch (e) {
    const err = e as Error;
    await marcarErro(mensagem.id, err.name === 'AbortError' ? 'Tempo esgotado' : err.message);
  } finally {
    clearTimeout(timer);
  }
}

async function marcarErro(id: string, motivo: string): Promise<void> {
  await prisma.whatsappMensagem
    .update({ where: { id }, data: { transcricaoStatus: `erro: ${motivo}`.slice(0, 120) } })
    .catch(() => {});
}
