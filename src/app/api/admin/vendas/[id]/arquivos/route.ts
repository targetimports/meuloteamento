/**
 * Upload de documentos para uma venda específica.
 *
 * POST  /api/admin/vendas/[id]/arquivos
 *   Body: multipart/form-data
 *     - arquivo: File (um ou mais, múltiplas keys "arquivo")
 *     - categoria: string opcional (RG | CPF | COMPROVANTE_RESIDENCIA | CONTRATO | RECIBO | CHEQUE | OUTRO)
 *     - descricao: string opcional
 *
 * Arquivos vão para o cofre, FORA do webroot (ver lib/storage-seguro), e só
 * saem pela rota autenticada /api/admin/vendas/arquivo/<id>.
 * Aceita qualquer tipo (PDF, imagens, doc, xls, etc.) — sem conversão.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, requireAdmin } from '@/lib/tenant';
import { gravarDocumento } from '@/lib/storage-seguro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB por arquivo
const MAX_FILES_POR_UPLOAD = 20;

// Lista de mime-types permitidos. Inclui PDFs, imagens, e docs/xls comuns
// pra cobrir a maior parte dos casos (RG, CPF, comprovantes, contratos).
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin();

  // Carrega venda + scope tenant
  const venda = await prisma.venda.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      lote: { select: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) {
    return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
  }
  const loteadoraId = venda.lote.loteamento.loteadoraId;
  if (!(await canAccessLoteadora(loteadoraId))) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch (err) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const categoria = (fd.get('categoria') as string | null)?.trim() || null;
  const descricao = (fd.get('descricao') as string | null)?.trim() || null;

  // Aceita tanto 1 arquivo quanto múltiplos (mesma key "arquivo")
  const files: File[] = [];
  for (const [key, value] of fd.entries()) {
    if (key === 'arquivo' && value instanceof File && value.size > 0) {
      files.push(value);
    }
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  }
  if (files.length > MAX_FILES_POR_UPLOAD) {
    return NextResponse.json(
      { error: `Máximo ${MAX_FILES_POR_UPLOAD} arquivos por upload` },
      { status: 413 }
    );
  }

  // Valida todos antes de salvar qualquer um (atomicidade light)
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo "${f.name}" excede ${MAX_FILE_BYTES / 1024 / 1024} MB` },
        { status: 413 }
      );
    }
    if (f.type && !ALLOWED_MIME.has(f.type)) {
      return NextResponse.json(
        { error: `Tipo "${f.type}" não permitido para "${f.name}"` },
        { status: 415 }
      );
    }
  }

  // Documentos de venda (RG, CPF, comprovantes, contratos assinados) vão para o
  // cofre fora do webroot — ver lib/storage-seguro.
  const criados: Array<{ id: string; nome: string }> = [];
  for (const f of files) {
    const safeName = sanitizeFilename(f.name) || `arquivo-${Date.now()}`;
    const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const caminho = await gravarDocumento({
      subdir: `vendas/${venda.id}`,
      nomeArquivo: finalName,
      conteudo: buf,
      mimeType: f.type || null,
    });
    const row = await prisma.vendaArquivo.create({
      data: {
        vendaId: venda.id,
        nomeOriginal: f.name,
        caminho,
        mimeType: f.type || null,
        tamanho: f.size,
        categoria,
        descricao,
        uploadedById: session.sub ?? null,
      },
      select: { id: true, nomeOriginal: true },
    });
    criados.push({ id: row.id, nome: row.nomeOriginal });
  }

  return NextResponse.json({ ok: true, criados });
}
