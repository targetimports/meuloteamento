'use server';

/**
 * Upload das mídias do loteamento: capa, planta, galeria, vídeos e pôsteres.
 *
 * Diferente das fotos do lote, aqui o upload NÃO grava no banco. O formulário
 * do loteamento salva tudo de uma vez no "Salvar alterações", e gravar o
 * arquivo por fora criaria um estado meio salvo — a imagem já no ar e o resto
 * do formulário ainda por confirmar. A action devolve a URL, o campo passa a
 * apontar para ela, e o salvamento do formulário decide se aquilo vale.
 */

import { requireAdmin } from '@/lib/tenant';
import { saveUploadedFile, saveUploadedVideo, ehVideo } from '@/lib/upload';

/** Imagem: 8 MB. Vídeo: 25 MB, abaixo dos 30 MB que o nginx e o Next aceitam. */
const MAX_IMAGEM = 8 * 1024 * 1024;
const MAX_VIDEO = 25 * 1024 * 1024;

const TIPOS_IMAGEM = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export async function enviarMidiaLoteamento(
  formData: FormData
): Promise<{ ok: boolean; url?: string; erro?: string }> {
  await requireAdmin();

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: 'Nenhum arquivo enviado.' };
  }

  // O subdiretório vem do slug do loteamento; saveUploaded* sanitiza o que
  // chega, então um slug estranho vira nome de pasta seguro em vez de erro.
  const subdir = String(formData.get('subdir') ?? '').trim() || 'loteamentos';

  const video = ehVideo(arquivo.type);
  const imagem = TIPOS_IMAGEM.has(arquivo.type);
  if (!video && !imagem) {
    return { ok: false, erro: 'Use PNG, JPG, WebP, MP4 ou WebM.' };
  }

  const limite = video ? MAX_VIDEO : MAX_IMAGEM;
  if (arquivo.size > limite) {
    return {
      ok: false,
      erro: `Arquivo acima de ${Math.round(limite / 1024 / 1024)} MB.`,
    };
  }

  const base = `${video ? 'video' : 'img'}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  try {
    const { url } = video
      ? await saveUploadedVideo({ file: arquivo, subdir, filenameBase: base, maxBytes: limite })
      : await saveUploadedFile({ file: arquivo, subdir, filenameBase: base });
    return { ok: true, url };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha ao enviar.' };
  }
}
