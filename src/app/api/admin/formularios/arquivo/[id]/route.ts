/**
 * Download autenticado de arquivos de formulário.
 * Só admin com acesso à loteadora dona do formulário pode baixar.
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile, stat } from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';

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

  // Caminho absoluto a partir do "caminho" (relativo a /public)
  // Ex: arquivo.caminho = "/uploads/formularios/abc123/789-doc-rg.jpg"
  const rel = arquivo.caminho.replace(/^\/+/, '');
  const abs = path.join(process.cwd(), 'public', rel);

  try {
    await stat(abs);
  } catch {
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
