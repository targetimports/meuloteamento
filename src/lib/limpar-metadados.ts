/**
 * Remoção de metadados de imagem antes de guardar.
 *
 * A foto de um documento tirada com celular costuma vir com EXIF completo:
 * modelo do aparelho, data, e com frequência **as coordenadas de onde foi
 * tirada** — quase sempre a casa do cliente. Isso é dado pessoal que ninguém
 * pediu, que não serve para nada no processo de venda e que vaza junto se a
 * imagem vazar. Guardar é assumir um risco sem contrapartida.
 *
 * Implementado à mão, sem dependência: as bibliotecas de imagem que fazem isso
 * (sharp, jimp) trazem binário nativo ou dezenas de megabytes, e aqui basta
 * podar segmentos — os pixels não são tocados, então não há recompressão nem
 * perda de qualidade.
 *
 * O que NÃO é tratado: PDF (estrutura própria, e nossos PDFs viram PNG antes)
 * e formatos fora de JPEG/PNG. Nesses casos o conteúdo volta intacto — melhor
 * guardar com metadado que recusar o documento do cliente.
 */

/** Segmentos JPEG que carregam metadado e podem sair sem afetar a imagem. */
function ehSegmentoDescartavelJpeg(marcador: number): boolean {
  // APP1..APP15 (0xE1–0xEF): EXIF, XMP, IPTC, Photoshop.
  // APP0 (0xE0) fica: é o JFIF, que descreve densidade/aspecto.
  if (marcador >= 0xe1 && marcador <= 0xef) return true;
  // COM (0xFE): comentário livre.
  if (marcador === 0xfe) return true;
  return false;
}

function limparJpeg(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;

  const partes: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let i = 2;

  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break; // fora de sincronia: devolve o que der

    const marcador = buf[i + 1];

    // Início do dado comprimido (SOS) ou fim: daqui em diante é imagem pura.
    if (marcador === 0xda || marcador === 0xd9) {
      partes.push(buf.subarray(i));
      return Buffer.concat(partes);
    }

    // Marcadores sem payload.
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) {
      partes.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (i + 4 > buf.length) break;
    const tamanho = buf.readUInt16BE(i + 2); // inclui os 2 bytes do próprio campo
    const fim = i + 2 + tamanho;
    if (tamanho < 2 || fim > buf.length) break; // malformado: não arrisca

    if (!ehSegmentoDescartavelJpeg(marcador)) {
      partes.push(buf.subarray(i, fim));
    }
    i = fim;
  }

  // Chegou aqui com estrutura inesperada: devolve o original, sem inventar.
  return partes.length > 1 ? Buffer.concat([...partes, buf.subarray(i)]) : buf;
}

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Chunks PNG que carregam texto/metadado. */
const CHUNKS_DESCARTAVEIS_PNG = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function limparPng(buf: Buffer): Buffer {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(ASSINATURA_PNG)) return buf;

  const partes: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;

  while (i + 8 <= buf.length) {
    const tamanho = buf.readUInt32BE(i);
    const tipo = buf.subarray(i + 4, i + 8).toString('ascii');
    const fim = i + 12 + tamanho; // tamanho + tipo + dados + CRC
    if (fim > buf.length) break; // malformado

    if (!CHUNKS_DESCARTAVEIS_PNG.has(tipo)) {
      partes.push(buf.subarray(i, fim));
    }
    i = fim;

    if (tipo === 'IEND') return Buffer.concat(partes);
  }

  return buf; // sem IEND íntegro: melhor não mexer
}

/**
 * Devolve a imagem sem metadados. Formato desconhecido volta intacto.
 */
export function limparMetadados(conteudo: Buffer, mimeType?: string | null): Buffer {
  const tipo = (mimeType ?? '').toLowerCase();
  try {
    if (tipo.includes('jpeg') || tipo.includes('jpg')) return limparJpeg(conteudo);
    if (tipo.includes('png')) return limparPng(conteudo);

    // Sem mime confiável: decide pela assinatura do arquivo.
    if (conteudo.length > 3 && conteudo[0] === 0xff && conteudo[1] === 0xd8) {
      return limparJpeg(conteudo);
    }
    if (conteudo.length > 8 && conteudo.subarray(0, 8).equals(ASSINATURA_PNG)) {
      return limparPng(conteudo);
    }
  } catch {
    // Nunca perder o documento por causa da limpeza.
    return conteudo;
  }
  return conteudo;
}
