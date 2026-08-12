import path from 'path';
import crypto from 'crypto';
import { readFile, writeFile, mkdir, stat, chmod } from 'fs/promises';

import { limparMetadados } from './limpar-metadados';

/**
 * Cofre de documentos pessoais.
 *
 * Foto de identidade e comprovante de residência NUNCA podem morar em
 * `public/`: o Next serve aquela pasta inteira como estática e o nginx a
 * entrega direto do disco, então o arquivo fica a uma URL de distância de
 * qualquer pessoa — sem sessão, sem log, sem chance de o código intervir. Foi
 * exatamente o que aconteceu aqui até 11/08/2026.
 *
 * Aqui os arquivos ficam fora do webroot, num diretório que o servidor web não
 * conhece. A única porta são as rotas `/api/admin/.../arquivo/<id>`, que
 * conferem sessão e empresa antes de ler um byte.
 *
 * O caminho gravado no banco continua sendo `/uploads/<sub>/<arquivo>` — a
 * mudança é só de onde essa raiz aponta. Isso evita reescrever centenas de
 * linhas em `formulario_arquivos` e `venda_arquivos`, e permite que a migração
 * dos arquivos físicos aconteça depois do deploy, sem janela de indisponibilidade.
 */

/** Raiz do cofre. Fora de /var/www de propósito. */
export const RAIZ_COFRE = process.env.UPLOADS_DIR || '/var/lib/meuloteamento/uploads';

/** Raiz antiga, dentro do webroot. Só leitura, durante a transição. */
const RAIZ_LEGADA = path.join(process.cwd(), 'public');

const PREFIXO = '/uploads/';

/**
 * Traduz o caminho do banco para um caminho absoluto dentro da raiz indicada,
 * recusando qualquer coisa que tente escapar dela.
 *
 * O valor vem do banco, não do usuário — mas `..` que chegue lá por qualquer
 * via (importação, correção manual em SQL, bug futuro) viraria leitura de
 * arquivo arbitrário do servidor, com a resposta entregue pela rota. A
 * checagem custa uma comparação de string e fecha a classe inteira.
 */
function resolverDentroDe(raiz: string, caminhoBanco: string): string | null {
  if (!caminhoBanco.startsWith(PREFIXO)) return null;
  const relativo = caminhoBanco.slice(PREFIXO.length);
  const absoluto = path.resolve(raiz, relativo);
  const raizNormalizada = path.resolve(raiz);
  if (absoluto !== raizNormalizada && !absoluto.startsWith(raizNormalizada + path.sep)) {
    return null;
  }
  return absoluto;
}

/** Caminho absoluto do documento dentro do cofre. */
export function caminhoNoCofre(caminhoBanco: string): string | null {
  return resolverDentroDe(RAIZ_COFRE, caminhoBanco);
}

/**
 * Onde este documento está, de fato.
 *
 * Procura no cofre e, se não achar, no lugar antigo. O fallback é o que torna
 * a migração dos arquivos independente do deploy: enquanto um documento não
 * tiver sido movido, ele continua sendo entregue normalmente pela rota
 * autenticada — que é segura de qualquer forma, porque a porta pública já está
 * fechada no nginx.
 *
 * Retorna null quando o arquivo não existe em lugar nenhum.
 */
export async function localizarDocumento(caminhoBanco: string): Promise<string | null> {
  const noCofre = caminhoNoCofre(caminhoBanco);
  if (noCofre) {
    try {
      await stat(noCofre);
      return noCofre;
    } catch {
      // segue para o legado
    }
  }

  const noLegado = resolverDentroDe(RAIZ_LEGADA, caminhoBanco);
  if (noLegado) {
    try {
      await stat(noLegado);
      return noLegado;
    } catch {
      return null;
    }
  }
  return null;
}

// =====================================================================
// Criptografia em repouso (AES-256-GCM)
// =====================================================================

/**
 * Marca no início do arquivo cifrado. Existe para que a leitura saiba, sem
 * consultar o banco, se aquele conteúdo passou pela cifra — é o que permite
 * conviver com os arquivos antigos ainda em claro enquanto a migração roda.
 */
const MAGIC = Buffer.from('MLC1', 'ascii');
const TAM_IV = 12; // 96 bits, o tamanho nativo do GCM
const TAM_TAG = 16;

/**
 * Chave de 32 bytes em base64, vinda de `DOCS_ENCRYPTION_KEY`.
 *
 * ⚠️ Perder esta chave é perder os documentos — não há recuperação. Ela deve
 * viver no `.env` do servidor e numa cópia offline (gerenciador de senhas),
 * NUNCA no mesmo lugar que o backup dos arquivos: guardar a chave junto do
 * cofre é o mesmo que deixar a chave na fechadura.
 */
function chave(): Buffer | null {
  const bruta = process.env.DOCS_ENCRYPTION_KEY;
  if (!bruta) return null;
  const buf = Buffer.from(bruta, 'base64');
  if (buf.length !== 32) {
    throw new Error('DOCS_ENCRYPTION_KEY inválida: precisa de 32 bytes em base64.');
  }
  return buf;
}

export function estaCifrado(conteudo: Buffer): boolean {
  return conteudo.length > MAGIC.length && conteudo.subarray(0, MAGIC.length).equals(MAGIC);
}

/** MAGIC | IV | authTag | ciphertext */
export function cifrar(claro: Buffer, k: Buffer): Buffer {
  const iv = crypto.randomBytes(TAM_IV);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const cifrado = Buffer.concat([cipher.update(claro), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), cifrado]);
}

/**
 * Decifra. A tag do GCM é verificada pelo Node: arquivo corrompido ou
 * adulterado falha aqui em vez de devolver lixo — autenticidade, não só sigilo.
 */
export function decifrar(conteudo: Buffer, k: Buffer): Buffer {
  const iv = conteudo.subarray(MAGIC.length, MAGIC.length + TAM_IV);
  const tag = conteudo.subarray(MAGIC.length + TAM_IV, MAGIC.length + TAM_IV + TAM_TAG);
  const dados = conteudo.subarray(MAGIC.length + TAM_IV + TAM_TAG);
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]);
}

/**
 * Lê o conteúdo do documento, decifrando quando necessário.
 *
 * Aceita arquivo em claro (os que existiam antes da cifra) — a migração pode
 * ser retomada sem que nada pare de funcionar no meio.
 */
export async function lerDocumento(caminhoBanco: string): Promise<Buffer<ArrayBuffer>> {
  const absoluto = await localizarDocumento(caminhoBanco);
  if (!absoluto) throw new Error('Arquivo não encontrado');

  const bruto = await readFile(absoluto);
  if (!estaCifrado(bruto)) return bruto;

  const k = chave();
  if (!k) {
    throw new Error(
      'Documento está cifrado mas DOCS_ENCRYPTION_KEY não está configurada no servidor.'
    );
  }
  // `Buffer.concat` devolve o genérico amplo (ArrayBufferLike, que admite
  // SharedArrayBuffer); aqui o dado sempre veio de leitura de arquivo, então é
  // ArrayBuffer comum — e é isso que `NextResponse` aceita como corpo.
  return decifrar(bruto, k) as Buffer<ArrayBuffer>;
}

/**
 * Grava um documento no cofre e devolve o caminho a guardar no banco.
 *
 * Permissões fechadas na escrita (0600 no arquivo, 0700 no diretório): num
 * servidor que hospeda mais de uma aplicação, o modo padrão deixaria os
 * documentos legíveis por qualquer processo da máquina.
 */
export async function gravarDocumento(input: {
  subdir: string;
  nomeArquivo: string;
  conteudo: Buffer;
  /** Usado para decidir como limpar os metadados da imagem. */
  mimeType?: string | null;
}): Promise<string> {
  const subdirSeguro = input.subdir
    .split('/')
    .map((p) => p.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('/');
  const nomeSeguro = input.nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_');

  const dir = path.join(RAIZ_COFRE, subdirSeguro);
  await mkdir(dir, { recursive: true, mode: 0o700 });

  // Tira EXIF/GPS antes de guardar: o endereço de casa do cliente vem embutido
  // na foto e não serve para nada aqui.
  const semMetadados = limparMetadados(input.conteudo, input.mimeType);

  // Cifra antes de tocar o disco. Em produção a chave é obrigatória: gravar em
  // claro por falta de configuração seria a falha silenciosa mais cara possível
  // — ninguém percebe até o dia em que o disco vaza.
  const k = chave();
  if (!k && process.env.NODE_ENV === 'production') {
    throw new Error(
      'DOCS_ENCRYPTION_KEY não configurada — recusando gravar documento pessoal sem criptografia.'
    );
  }
  const conteudoFinal = k ? cifrar(semMetadados, k) : semMetadados;

  const absoluto = path.join(dir, nomeSeguro);
  await writeFile(absoluto, conteudoFinal, { mode: 0o600 });
  await chmod(absoluto, 0o600).catch(() => {});

  return `${PREFIXO}${subdirSeguro}/${nomeSeguro}`;
}
