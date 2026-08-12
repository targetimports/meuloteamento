/**
 * Download autenticado de arquivos de formulário.
 * Só admin com acesso à loteadora dona do formulário pode baixar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';
import { localizarDocumento } from '@/lib/storage-seguro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAdmin();

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

  // O arquivo vive no cofre, fora do webroot. `localizarDocumento` ainda aceita
  // o lugar antigo enquanto a migração não termina, e recusa caminho que tente
  // escapar da raiz.
  const abs = await localizarDocumento(arquivo.caminho);
  if (!abs) {
    return new NextResponse('Arquivo não encontrado em disco', { status: 410 });
  }
  const buffer = await readFile(abs);

  const download = req.nextUrl.searchParams.has('download');
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
