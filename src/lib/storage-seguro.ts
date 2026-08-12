import path from 'path';
import { readFile, writeFile, mkdir, stat, chmod } from 'fs/promises';

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

/** Lê o conteúdo do documento. Lança se não existir. */
export async function lerDocumento(caminhoBanco: string): Promise<Buffer> {
  const absoluto = await localizarDocumento(caminhoBanco);
  if (!absoluto) throw new Error('Arquivo não encontrado');
  return readFile(absoluto);
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
}): Promise<string> {
  const subdirSeguro = input.subdir
    .split('/')
    .map((p) => p.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .filter(Boolean)
    .join('/');
  const nomeSeguro = input.nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_');

  const dir = path.join(RAIZ_COFRE, subdirSeguro);
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const absoluto = path.join(dir, nomeSeguro);
  await writeFile(absoluto, input.conteudo, { mode: 0o600 });
  await chmod(absoluto, 0o600).catch(() => {});

  return `${PREFIXO}${subdirSeguro}/${nomeSeguro}`;
}
