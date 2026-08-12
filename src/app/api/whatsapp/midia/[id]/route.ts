import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { lerDocumento } from '@/lib/storage-seguro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Entrega a mídia de uma mensagem — a única porta para o que veio pelo WhatsApp.
 *
 * O arquivo vive no cofre, cifrado e fora do webroot, porque foto de documento
 * chega por WhatsApp o tempo todo. Aqui ele é decifrado em memória e entregue
 * só para quem é dono da instância.
 *
 * 🔴 O acesso é do DONO, não da empresa. Caixa de entrada não é documento
 * corporativo: é a conversa de um número com seus clientes. Ver a de outra
 * pessoa não é "permissão a mais", é a caixa errada — nem admin entra por
 * padrão, como no ERP, onde o modelo aberto foi defeito relatado em produção.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await requireAdmin();

  const mensagem = await prisma.whatsappMensagem.findUnique({
    where: { id: params.id },
    select: {
      midiaCaminho: true,
      midiaMime: true,
      nomeArquivo: true,
      conversa: { select: { instancia: { select: { userId: true } } } },
    },
  });

  if (!mensagem?.midiaCaminho) {
    return new NextResponse('Sem mídia', { status: 404 });
  }
  if (mensagem.conversa.instancia.userId !== sessao.sub) {
    return new NextResponse('Sem permissão', { status: 403 });
  }

  let buffer: Buffer<ArrayBuffer>;
  try {
    buffer = await lerDocumento(mensagem.midiaCaminho);
  } catch {
    return new NextResponse('Arquivo não está no disco', { status: 410 });
  }

  const headers = new Headers();
  headers.set('Content-Type', mensagem.midiaMime || 'application/octet-stream');
  headers.set('Content-Length', String(buffer.length));
  // `private`: a mídia não pode ficar em cache de proxy compartilhado.
  headers.set('Cache-Control', 'private, max-age=3600');
  if (req.nextUrl.searchParams.has('download')) {
    const nome = (mensagem.nomeArquivo || 'arquivo').replace(/[^a-zA-Z0-9._-]+/g, '_');
    headers.set('Content-Disposition', `attachment; filename="${nome}"`);
  }
  return new NextResponse(buffer, { status: 200, headers });
}
