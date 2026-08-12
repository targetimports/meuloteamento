/**
 * Download autenticado de arquivos de formulário.
 * Só admin com acesso à loteadora dona do formulário pode baixar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';
import { lerDocumento } from '@/lib/storage-seguro';
import { logAcessoDocumento } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessao = await requireAdmin();

  const arquivo = await prisma.formularioArquivo.findUnique({
    where: { id: params.id },
    include: {
      resposta: {
        select: { formulario: { select: { loteadoraId: true } } },
      },
    },
  });
  if (!arquivo) {
    return new NextResponse('Não encontrado', { status: 404 });
  }
  const loteadoraId = arquivo.resposta.formulario.loteadoraId;
  if (loteadoraId && !(await canAccessLoteadora(loteadoraId))) {
    return new NextResponse('Sem permissão', { status: 403 });
  }

  // O arquivo vive no cofre, fora do webroot, e cifrado. `lerDocumento` decifra
  // quando preciso, ainda aceita o lugar antigo enquanto a migração não termina,
  // e recusa caminho que tente escapar da raiz.
  let buffer: Buffer<ArrayBuffer>;
  try {
    buffer = await lerDocumento(arquivo.caminho);
  } catch {
    return new NextResponse('Arquivo não encontrado em disco', { status: 410 });
  }

  const download = req.nextUrl.searchParams.has('download');

  // Rastro de quem viu o documento de quem.
  await logAcessoDocumento({
    entity: 'FormularioArquivo',
    arquivoId: arquivo.id,
    action: download ? 'BAIXOU' : 'VISUALIZOU',
    userId: sessao.sub,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    contexto: { respostaId: arquivo.respostaId, campoId: arquivo.campoId },
  });
  const headers = new Headers();
  headers.set('Content-Type', arquivo.mimeType || 'application/octet-stream');
  headers.set('Content-Length', String(buffer.length));
  headers.set('Cache-Control', 'private, no-store');
  if (download) {
    const fname = arquivo.nomeOriginal.replace(/[^a-zA-Z0-9._-]+/g, '_');
    headers.set('Content-Disposition', `attachment; filename="${fname}"`);
  } else {
    headers.set('Content-Disposition', 'inline');
  }
  return new NextResponse(buffer, { status: 200, headers });
}
