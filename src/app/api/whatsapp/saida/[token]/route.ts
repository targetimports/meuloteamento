import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lerDocumento } from '@/lib/storage-seguro';
import { validarTokenDeSaida } from '@/lib/whatsapp-url-temporaria';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Entrega UM arquivo ao gateway, por poucos minutos, sem sessão.
 *
 * É a única porta sem login do módulo, e ela existe porque o `/send/media` do
 * Evolution GO busca o anexo por URL em vez de aceitar base64. Toda a proteção
 * está no token: assinado com HMAC, preso a um id de mensagem e com expiração
 * curta (ver lib/whatsapp-url-temporaria).
 *
 * `noindex` no cabeçalho: mesmo com validade de minutos, este endereço não deve
 * acabar em índice de busca se vazar num log.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const valido = validarTokenDeSaida(params.token);
  // 404 e não 403: não confirma que a rota existe para quem chutou o token.
  if (!valido) return new NextResponse('Não encontrado', { status: 404 });

  const mensagem = await prisma.whatsappMensagem.findUnique({
    where: { id: valido.mensagemId },
    select: { midiaCaminho: true, midiaMime: true, nomeArquivo: true },
  });
  if (!mensagem?.midiaCaminho) return new NextResponse('Não encontrado', { status: 404 });

  let buffer: Buffer<ArrayBuffer>;
  try {
    buffer = await lerDocumento(mensagem.midiaCaminho);
  } catch {
    return new NextResponse('Não encontrado', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', mensagem.midiaMime || 'application/octet-stream');
  headers.set('Content-Length', String(buffer.length));
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new NextResponse(buffer, { status: 200, headers });
}
