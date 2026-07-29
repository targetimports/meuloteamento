import path from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const ALLOWED_PDF_TYPES = new Set(['application/pdf']);

/**
 * Salva o arquivo enviado em public/uploads/<subdir>/.
 * Se for PDF, converte primeira página para PNG via pdftoppm.
 *
 * Retorna a URL pública (relativa) da imagem final.
 */
export async function saveUploadedFile(input: {
  file: File;
  subdir: string;
  filenameBase?: string;
}): Promise<{ url: string; absolutePath: string }> {
  const { file, subdir, filenameBase } = input;

  if (file.size > MAX_BYTES) {
    throw new Error(`Arquivo muito grande (máx ${MAX_BYTES / 1024 / 1024} MB).`);
  }

  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
  const isPdf = ALLOWED_PDF_TYPES.has(file.type);
  if (!isImage && !isPdf) {
    throw new Error('Tipo de arquivo não suportado. Use PNG, JPG, WebP ou PDF.');
  }

  // Sanitiza subdir
  const safeSubdir = subdir.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dirPath = path.join(PUBLIC_UPLOADS_DIR, safeSubdir);
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }

  const stamp = Date.now();
  const base = filenameBase
    ? filenameBase.replace(/[^a-zA-Z0-9_-]/g, '_')
    : `file-${stamp}`;

  if (isImage) {
    const ext = mimeToExt(file.type);
    const filename = `${base}.${ext}`;
    const absPath = path.join(dirPath, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);
    return {
      url: `/uploads/${safeSubdir}/${filename}`,
      absolutePath: absPath,
    };
  }

  // PDF: salva temporário, converte, remove o PDF
  const tmpPdfPath = path.join(dirPath, `${base}-tmp-${stamp}.pdf`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(tmpPdfPath, buffer);

  const outPrefix = path.join(dirPath, base);
  // -singlefile renderiza só a primeira página e omite o sufixo "-1"
  // -r 200 = 200 DPI (boa qualidade pra mapas)
  try {
    await execAsync(
      `pdftoppm -png -r 200 -singlefile "${tmpPdfPath}" "${outPrefix}"`,
      { timeout: 60_000 }
    );
  } catch (err) {
    await unlink(tmpPdfPath).catch(() => {});
    throw new Error(
      'Falha ao converter PDF. Verifique se poppler-utils está instalado no servidor.'
    );
  }

  await unlink(tmpPdfPath).catch(() => {});

  const pngName = `${base}.png`;
  return {
    url: `/uploads/${safeSubdir}/${pngName}`,
    absolutePath: path.join(dirPath, pngName),
  };
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}
