/**
 * GET    /api/admin/vendas/arquivo/[id]            → visualiza inline
 * GET    /api/admin/vendas/arquivo/[id]?download=1 → força download
 * DELETE /api/admin/vendas/arquivo/[id]            → remove arquivo (DB + disco)
 *
 * Auth: admin com acesso à loteadora dona da venda.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';
import { localizarDocumento } from '@/lib/storage-seguro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function carregarArquivoComScope(id: string) {
  const arquivo = await prisma.vendaArquivo.findUnique({
    where: { id },
    include: {
      venda: {
        select: {
          id: true,
          lote: { select: { loteamento: { select: { loteadoraId: true } } } },
        },
      },
    },
  });
  if (!arquivo) return null;
  return arquivo;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAdmin();
  const arquivo = await carregarArquivoComScope(params.id);
  if (!arquivo) {
    return new NextResponse('Arquivo não encontrado', { status: 404 });
  }
  const loteadoraId = arquivo.venda.lote.loteamento.loteadoraId;
  if (!(await canAccessLoteadora(loteadoraId))) {
    return new NextResponse('Sem permissão', { status: 403 });
  }

  // O arquivo vive no cofre, fora do webroot (ver lib/storage-seguro).
  const abs = await localizarDocumento(arquivo.caminho);
  if (!abs) {
    return new NextResponse('Arquivo não está no disco', { status: 410 });
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await requireAdmin();
  const arquivo = await carregarArquivoComScope(params.id);
  if (!arquivo) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }
  const loteadoraId = arquivo.venda.lote.loteamento.loteadoraId;
  if (!(await canAccessLoteadora(loteadoraId))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  // Apaga do disco (best-effort — se não existir, segue removendo do DB).
  // `localizarDocumento` acha tanto no cofre quanto no lugar antigo, então
  // exclusão feita durante a migração não deixa arquivo órfão para trás.
  const abs = await localizarDocumento(arquivo.caminho);
  if (abs) await unlink(abs).catch(() => {});

  await prisma.vendaArquivo.delete({ where: { id: arquivo.id } });
  return NextResponse.json({ ok: true });
}
