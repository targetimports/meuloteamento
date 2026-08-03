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

// =====================================================================
// LOG DO NGINX — complemento, não duplicata
// ---------------------------------------------------------------------
// O middleware não vê /api: webhooks do Asaas, crons e integrações passam
// longe dele. O nginx vê tudo e sabe o status real.
//
// Nada é escrito aqui: só leitura do arquivo que o nginx já mantém. Alterar
// a configuração de um nginx que serve treze projetos, para ganhar um campo,
// não valeria o risco.
//
// Deste arquivo lemos APENAS /api. As páginas já vêm do app.log, com e-mail e
// empresa; trazer as duas fontes para as mesmas rotas só geraria linha
// repetida com metade da informação.
// =====================================================================

const NGINX_LOG =
  process.env.NGINX_ACCESS_LOG || '/var/log/nginx/meuloteamento-access.log';

/** Teto de leitura: o logrotate corta diariamente, mas um pico não pode virar OOM. */
const NGINX_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Esconde segredos que viajam na querystring.
 *
 * O CRON_TOKEN vai na URL dos crons e, por isso, fica gravado em texto claro
 * no access.log — quem abre a tela de logs não precisa vê-lo, e uma captura
 * de tela dessa página não pode virar vazamento de credencial.
 */
function mascararSegredos(rota: string): string {
  return rota.replace(
    /([?&](?:token|apikey|api_key|secret|senha|password|access_token)=)[^&]+/gi,
    '$1***'
  );
}

const RE_COMBINED =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*?) [^"]*" (\d{3}) (\d+|-) "([^"]*)" "([^"]*)"/;

/** "03/Aug/2026:16:30:04 -0300" -> Date */
function dataNginx(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!m) return null;
  const meses: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const mes = meses[m[2]];
  if (mes === undefined) return null;
  const off = m[7];
  const iso = `${m[3]}-${String(mes + 1).padStart(2, '0')}-${m[1]}T${m[4]}:${m[5]}:${m[6]}${off.slice(0, 3)}:${off.slice(3)}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function lerNginxApi(): EventoLog[] {
  let bruto = '';
  try {
    const st = fs.statSync(NGINX_LOG);
    const fd = fs.openSync(NGINX_LOG, 'r');
    try {
      // Lê só o fim quando o arquivo é grande: o recente é o que importa.
      const inicio = Math.max(0, st.size - NGINX_MAX_BYTES);
      const tam = st.size - inicio;
      const buf = Buffer.alloc(tam);
      fs.readSync(fd, buf, 0, tam, inicio);
      bruto = buf.toString('utf8');
      if (inicio > 0) bruto = bruto.slice(bruto.indexOf('\n') + 1);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }

  const eventos: EventoLog[] = [];
  const linhas = bruto.split('\n');

  for (let i = linhas.length - 1; i >= 0; i--) {
    const linha = linhas[i];
    if (!linha) continue;
    const m = linha.match(RE_COMBINED);
    if (!m) continue;

    const rotaCrua = m[4];
    if (!rotaCrua.startsWith('/api/')) continue;

    const quando = dataNginx(m[2]);
    if (!quando) continue;

    const status = Number(m[5]);

    eventos.push({
      ts: quando.toISOString(),
      metodo: m[3],
      rota: mascararSegredos(rotaCrua),
      resultado: status >= 300 && status < 400 ? 'redirect' : 'ok',
      status,
      ip: m[1],
      email: null,
      loteadoraId: null,
      area: 'integracao',
      ua: m[8] === '-' ? null : m[8],
      ms: null,
    });
  }

  return eventos;
}

export interface FiltroLogs {
  /** null = todas; 'backoffice' = só plataforma; id = uma empresa. */
  loteadoraId?: string | null;
  /** false esconde as chamadas de /api vindas do nginx. */
  incluirIntegracoes?: boolean;
  pagina: number;
  porPagina: number;
}

export interface ResultadoLogs {
  itens: EventoLog[];
  total: number;
  tamanhoBytes: number;
  arquivo: string;
  /** Quantos vieram do nginx (integrações) no conjunto filtrado. */
  totalIntegracoes: number;
}

/**
 * Lê o arquivo e devolve a página pedida, do mais recente para o mais antigo.
 *
 * Lê tudo de uma vez porque o teto é 20 MB — cabe em memória com folga, e a
 * alternativa (ler de trás para frente por blocos) só se justificaria com
 * arquivo muito maior.
 */
export function lerLogs(filtro: FiltroLogs): ResultadoLogs {
  let bruto = '';
  let tamanho = 0;
  try {
    tamanho = fs.statSync(ARQUIVO).size;
    bruto = fs.readFileSync(ARQUIVO, 'utf8');
  } catch {
    bruto = '';
  }

  const linhas = bruto.split('\n');
  const eventos: EventoLog[] = [];

  // De trás para frente: o fim do arquivo é o mais recente.
  for (let i = linhas.length - 1; i >= 0; i--) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    try {
      eventos.push(JSON.parse(linha) as EventoLog);
    } catch {
      // Linha corrompida (escrita interrompida): ignora e segue.
    }
  }

  // As integrações vêm do nginx e não carregam empresa — o nginx não conhece
  // sessão. Por isso só entram quando não há filtro de empresa: exibi-las sob
  // o nome de uma loteadora afirmaria uma origem que ninguém verificou.
  const semFiltroDeEmpresa = !filtro.loteadoraId;
  const integracoes =
    filtro.incluirIntegracoes !== false && semFiltroDeEmpresa ? lerNginxApi() : [];

  const juntos = [...eventos, ...integracoes].filter((e) => {
    if (filtro.loteadoraId === 'backoffice') return e.loteadoraId === null;
    if (filtro.loteadoraId) return e.loteadoraId === filtro.loteadoraId;
    return true;
  });

  // Ordena pelo horário, do mais recente para o mais antigo: as duas fontes
  // chegam ordenadas isoladamente, mas intercaladas no tempo.
  juntos.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  const inicio = (filtro.pagina - 1) * filtro.porPagina;
  return {
    itens: juntos.slice(inicio, inicio + filtro.porPagina),
    total: juntos.length,
    tamanhoBytes: tamanho,
    arquivo: ARQUIVO,
    totalIntegracoes: integracoes.length,
  };
}
