#!/usr/bin/env node
/**
 * Cifra, no lugar, os documentos que já estavam no cofre em claro.
 *
 * Uso (na VPS, a partir de /var/www/meuloteamento):
 *   node scripts/cifrar-documentos.mjs --dry-run   # só relata
 *   node scripts/cifrar-documentos.mjs             # aplica
 *
 * Lê DOCS_ENCRYPTION_KEY e UPLOADS_DIR do .env.
 *
 * Três decisões deliberadas:
 *
 * 1. **Idempotente.** Arquivo que já começa com a marca `MLC1` é pulado. Rodar
 *    duas vezes não cifra duas vezes — e cifrar em cima de cifrado seria
 *    irreversível na prática, porque ninguém saberia quantas camadas desfazer.
 *
 * 2. **Escreve em arquivo temporário e só então renomeia** (rename é atômico no
 *    mesmo sistema de arquivos). Uma queda de energia no meio da escrita
 *    deixaria o documento truncado e ilegível para sempre; assim, ou o arquivo
 *    novo está inteiro, ou o antigo continua lá.
 *
 * 3. **Confere antes de trocar.** Cada arquivo é decifrado de volta e comparado
 *    byte a byte com o original em memória. Sem essa conferência, um erro de
 *    chave ou de formato só apareceria no dia em que alguém tentasse abrir o
 *    documento — quando o original já não existisse mais.
 *
 * NÃO remove EXIF dos arquivos existentes: são documentos já entregues pelo
 * cliente, e alterar o conteúdo de um documento arquivado é outra decisão, que
 * não cabe a um script de migração tomar sozinho.
 */

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAGIC = Buffer.from('MLC1', 'ascii');
const TAM_IV = 12;

function lerEnv(arquivo) {
  const env = {};
  try {
    const texto = readFileSync(arquivo, 'utf8');
    for (const linha of texto.split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* sem .env: usa process.env */
  }
  return env;
}

async function* caminharArquivos(dir) {
  for (const entrada of await fs.readdir(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) yield* caminharArquivos(completo);
    else if (entrada.isFile()) yield completo;
  }
}

function cifrar(claro, chave) {
  const iv = crypto.randomBytes(TAM_IV);
  const cipher = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const dados = Buffer.concat([cipher.update(claro), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), dados]);
}

function decifrar(conteudo, chave) {
  const iv = conteudo.subarray(MAGIC.length, MAGIC.length + TAM_IV);
  const tag = conteudo.subarray(MAGIC.length + TAM_IV, MAGIC.length + TAM_IV + 16);
  const dados = conteudo.subarray(MAGIC.length + TAM_IV + 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', chave, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]);
}

const simulacao = process.argv.includes('--dry-run');
const env = { ...lerEnv(path.join(process.cwd(), '.env')), ...process.env };

const raiz = env.UPLOADS_DIR || '/var/lib/meuloteamento/uploads';
const chaveBase64 = env.DOCS_ENCRYPTION_KEY;
if (!chaveBase64) {
  console.error('DOCS_ENCRYPTION_KEY não definida. Abortando.');
  process.exit(1);
}
const chave = Buffer.from(chaveBase64, 'base64');
if (chave.length !== 32) {
  console.error(`DOCS_ENCRYPTION_KEY tem ${chave.length} bytes; precisa de 32.`);
  process.exit(1);
}

let cifrados = 0;
let jaCifrados = 0;
let falhas = 0;
let bytes = 0;

console.log(`${simulacao ? '[simulação] ' : ''}cofre: ${raiz}\n`);

for await (const arquivo of caminharArquivos(raiz)) {
  const original = await fs.readFile(arquivo);

  if (original.length > MAGIC.length && original.subarray(0, MAGIC.length).equals(MAGIC)) {
    jaCifrados++;
    continue;
  }

  if (simulacao) {
    cifrados++;
    bytes += original.length;
    continue;
  }

  try {
    const conteudo = cifrar(original, chave);

    // Conferência: decifrar de volta tem que reproduzir o original exato.
    if (!decifrar(conteudo, chave).equals(original)) {
      throw new Error('verificação falhou: decifrado difere do original');
    }

    const temporario = `${arquivo}.cifrando`;
    await fs.writeFile(temporario, conteudo, { mode: 0o600 });
    await fs.rename(temporario, arquivo);

    cifrados++;
    bytes += original.length;
  } catch (e) {
    falhas++;
    console.error(`  FALHA em ${arquivo}: ${e.message}`);
  }
}

console.log(
  `\n${simulacao ? 'seriam cifrados' : 'cifrados'}: ${cifrados} · já cifrados: ${jaCifrados} · falhas: ${falhas} · ${(bytes / 1024 / 1024).toFixed(1)} MB`
);
process.exit(falhas > 0 ? 1 : 0);
