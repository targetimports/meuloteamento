import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizarEvento } from '@/lib/whatsapp-evento';
import { tratarMensagem, tratarRecibo, tratarHistorico } from '@/lib/whatsapp-ingestao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recebe os eventos do gateway Evolution GO.
 *
 * O token no caminho é a autenticação: qualquer um consegue fazer POST aqui, e
 * é ele que separa o gateway de um curioso. Como é o mesmo token que autentica
 * a instância no gateway, ele já existe e não precisa de segredo adicional.
 *
 * 🔴 RESPONDE ANTES DE PROCESSAR. O gateway reenvia o evento quando a resposta
 * demora, e reenvio vira mensagem duplicada na tela. Gravar leva algumas
 * consultas ao banco; o "ok" não pode esperar por elas.
 *
 * A idempotência é garantida de qualquer forma pelo par
 * (conversa, messageId) — reenvio que escape da corrida não duplica a bolha.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!token || token.length < 16) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let corpo: Record<string, unknown> | null = null;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'json inválido' }, { status: 400 });
  }

  // Processa fora do caminho da resposta. `void` é deliberado: não esperamos.
  void processar(token, corpo).catch((e) => {
    console.error('[whatsapp:webhook] falha ao processar evento:', e);
  });

  return NextResponse.json({ ok: true });
}

async function processar(token: string, corpo: Record<string, any> | null): Promise<void> {
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { token },
    select: { id: true, token: true },
  });
  // Token desconhecido: instância excluída aqui e ainda viva no gateway. Ignora
  // em silêncio — responder erro faria o gateway reenviar para sempre.
  if (!instancia) return;

  const tipoTopo = String(
    typeof corpo?.event === 'string' ? corpo.event : corpo?.type || ''
  ).toUpperCase();

  // Uma linha por evento, com o tipo. Sem isto, "chegou 200 mas não gravou
  // nada" é indistinguível de "não chegou nada" — foi exatamente a dúvida que
  // custou uma investigação no log do nginx para responder.
  console.log(`[whatsapp] evento ${tipoTopo || '(sem tipo)'}`);

  // Histórico tem formato próprio — trata antes do normalizador de mensagem.
  if (tipoTopo.includes('HISTORY')) {
    await tratarHistorico(instancia, corpo?.data, normalizarEvento);
    return;
  }

  // Recibo de entrega/leitura — é o que acende o segundo tique e o azul.
  if (tipoTopo.includes('RECEIPT')) {
    await tratarRecibo(instancia.id, corpo?.data);
    return;
  }

  const evento = normalizarEvento(corpo);
  if (!evento) {
    // Formato não reconhecido: registra o começo do payload para ajustar o
    // leitor sem precisar adivinhar. Sem isso a falha seria invisível.
    console.warn('[whatsapp] payload não reconhecido:', JSON.stringify(corpo).slice(0, 600));
    return;
  }

  if (!evento.tipo || evento.tipo.includes('MESSAGE')) {
    await tratarMensagem(instancia, evento);
  }
}
