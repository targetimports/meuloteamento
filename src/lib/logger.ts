/**
 * Log de acesso do sistema, em arquivo único.
 *
 * Um arquivo só, `app.log`, no formato JSONL (uma linha JSON por evento).
 * JSONL porque a tela de logs precisa filtrar por empresa e paginar: parsear
 * linha a linha é trivial e não exige carregar tudo em memória de uma vez.
 *
 * ROTAÇÃO SEM ARQUIVOS NOVOS: ao passar do teto, o arquivo é reescrito com a
 * metade mais recente. Truncar por completo seria mais simples, mas perderia
 * todo o histórico de uma vez, e logo depois de um pico de tráfego é
 * justamente quando se quer olhar para trás. Metade preserva o passado
 * recente e mantém a promessa de não criar arquivo nenhum além do app.log.
 *
 * NADA AQUI PODE DERRUBAR UMA REQUISIÇÃO. Todas as falhas são engolidas: um
 * disco cheio ou uma permissão errada não valem uma página fora do ar.
 */

import fs from 'fs';
import path from 'path';

const TETO_BYTES = Number(process.env.LOG_MAX_MB || 20) * 1024 * 1024;

/** Fora do projeto de propósito: deploy troca a pasta do build, log não. */
const ARQUIVO =
  process.env.LOG_ARQUIVO || '/var/log/meuloteamento/app.log';

export interface EventoLog {
  /** ISO 8601 com fuso — ordenável como string e legível sem conversão. */
  ts: string;
  metodo: string;
  rota: string;
  /** O que o middleware decidiu: segue, redireciona, reescreve. */
  resultado: 'ok' | 'redirect' | 'rewrite';
  /** Status quando o middleware o determina (307 no redirect). */
  status: number | null;
  ip: string | null;
  email: string | null;
  /** null = super admin ou visitante não autenticado. */
  loteadoraId: string | null;
  /** publico | admin | backoffice | cliente */
  area: string;
  ua: string | null;
  /** Milissegundos gastos no middleware. */
  ms: number | null;
}

function garantirPasta() {
  const dir = path.dirname(ARQUIVO);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Corta o arquivo pela metade quando passa do teto, mantendo o fim (o mais
 * recente). Lê e reescreve o mesmo caminho — nenhum arquivo novo é criado.
 */
function rotacionarSePreciso() {
  try {
    const st = fs.statSync(ARQUIVO);
    if (st.size <= TETO_BYTES) return;

    const conteudo = fs.readFileSync(ARQUIVO, 'utf8');
    const metade = Math.floor(conteudo.length / 2);
    // Começa numa quebra de linha para não deixar meia linha inválida no topo.
    const corte = conteudo.indexOf('\n', metade);
    const restante = corte === -1 ? '' : conteudo.slice(corte + 1);

    const marca =
      JSON.stringify({
        ts: new Date().toISOString(),
        metodo: 'SISTEMA',
        rota: '(rotação)',
        resultado: 'ok',
        status: null,
        ip: null,
        email: null,
        loteadoraId: null,
        area: 'sistema',
        ua: `arquivo passou de ${Math.round(TETO_BYTES / 1024 / 1024)} MB; metade mais antiga descartada`,
        ms: null,
      }) + '\n';

    fs.writeFileSync(ARQUIVO, marca + restante, 'utf8');
  } catch {
    // Se a rotação falhar, seguir gravando é melhor que parar de logar.
  }
}

export function registrarLog(evento: EventoLog): void {
  try {
    garantirPasta();
    rotacionarSePreciso();
    // append com O_APPEND: linhas curtas de processos concorrentes não se
    // misturam, então não é preciso lock.
    fs.appendFileSync(ARQUIVO, JSON.stringify(evento) + '\n', 'utf8');
  } catch {
    // Log é observabilidade, não funcionalidade. Falhar aqui é silencioso.
  }
}

export interface FiltroLogs {
  /** null = todas; 'backoffice' = só plataforma; id = uma empresa. */
  loteadoraId?: string | null;
  pagina: number;
  porPagina: number;
}

export interface ResultadoLogs {
  itens: EventoLog[];
  total: number;
  tamanhoBytes: number;
  arquivo: string;
}

/**
 * Lê o arquivo e devolve a página pedida, do mais recente para o mais antigo.
 *
 * Lê tudo de uma vez porque o teto é 20 MB — cabe em memória com folga, e a
 * alternativa (ler de trás para frente por blocos) só se justificaria com
 * arquivo muito maior.
 */
export function lerLogs(filtro: FiltroLogs): ResultadoLogs {
  const vazio: ResultadoLogs = { itens: [], total: 0, tamanhoBytes: 0, arquivo: ARQUIVO };

  let bruto = '';
  let tamanho = 0;
  try {
    tamanho = fs.statSync(ARQUIVO).size;
    bruto = fs.readFileSync(ARQUIVO, 'utf8');
  } catch {
    return vazio;
  }

  const linhas = bruto.split('\n');
  const eventos: EventoLog[] = [];

  // De trás para frente: o fim do arquivo é o mais recente, e é o que
  // interessa primeiro.
  for (let i = linhas.length - 1; i >= 0; i--) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    try {
      const e = JSON.parse(linha) as EventoLog;

      if (filtro.loteadoraId === 'backoffice') {
        if (e.loteadoraId !== null) continue;
      } else if (filtro.loteadoraId) {
        if (e.loteadoraId !== filtro.loteadoraId) continue;
      }

      eventos.push(e);
    } catch {
      // Linha corrompida (escrita interrompida): ignora e segue.
    }
  }

  const inicio = (filtro.pagina - 1) * filtro.porPagina;
  return {
    itens: eventos.slice(inicio, inicio + filtro.porPagina),
    total: eventos.length,
    tamanhoBytes: tamanho,
    arquivo: ARQUIVO,
  };
}
