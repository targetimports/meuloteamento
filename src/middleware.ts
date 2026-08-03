import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { jwtVerify } from 'jose';

const adminSecret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-troque-em-producao-com-no-minimo-32-chars'
);
const clienteSecret = new TextEncoder().encode(
  process.env.JWT_SECRET_CLIENTE || 'dev-only-cliente-troque-em-producao-com-32-chars'
);
const ADMIN_COOKIE = process.env.SESSION_COOKIE_NAME || 'meuloteamento_session';
const CLIENTE_COOKIE = process.env.CLIENTE_COOKIE_NAME || 'meuloteamento_cliente';
const BASE_DOMAIN = (process.env.BASE_DOMAIN || 'meuloteamento.com').toLowerCase();

function parseCustomDomains(): Record<string, string> {
  const raw = process.env.CUSTOM_DOMAINS || '';
  const map: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [host, slug] = pair.split(':').map((s) => s?.trim().toLowerCase());
    if (host && slug) map[host] = slug;
  }
  return map;
}
const CUSTOM_DOMAINS = parseCustomDomains();
const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'app']);

/**
 * LOG DE ACESSO — envelope em volta da lógica de roteamento.
 *
 * A função `rotear` abaixo é o middleware que já existia, sem uma linha
 * alterada. Este envelope só a chama e, depois, despacha um registro do que
 * aconteceu. Fiz assim em vez de espalhar chamadas dentro dela porque este
 * arquivo decide se o site responde: quanto menos ele for tocado, melhor.
 *
 * Três cuidados, nesta ordem de importância:
 *
 *  1. O log NUNCA pode derrubar uma requisição. Tudo em try/catch, e a
 *     resposta é devolvida antes de qualquer tentativa de registro.
 *  2. Não segura o usuário: `event.waitUntil` deixa o envio acontecer depois
 *     que a resposta já saiu.
 *  3. Não gera recursão: o matcher exclui /api, então a chamada para
 *     /api/log-acesso não passa por aqui.
 *
 * O que este ponto NÃO consegue saber é o status final da página — 200, 404
 * e 500 são decididos depois, e o middleware não vê a resposta pronta. Por
 * isso registramos o que ele de fato determina: seguiu, redirecionou (307)
 * ou reescreveu. Inventar "200" seria preencher o campo com ficção.
 */
export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const inicio = Date.now();
  const res = await rotear(req);

  try {
    await registrarAcesso(req, res, event, Date.now() - inicio);
  } catch {
    // Uma falha aqui não pode afetar a navegação de ninguém.
  }

  return res;
}

const LOG_TOKEN =
  process.env.LOG_INGEST_TOKEN ||
  process.env.JWT_SECRET ||
  'dev-log-token';

function areaDaRota(pathname: string): string {
  if (pathname.startsWith('/backoffice')) return 'backoffice';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/minha-conta')) return 'cliente';
  return 'publico';
}

/**
 * ENVIO SÍNCRONO, E NÃO event.waitUntil — aprendido na prática.
 *
 * A primeira versão despachava com waitUntil, para não somar latência. Em
 * teste local funcionou; em produção, nada da navegação real era registrado.
 * O motivo: neste servidor a promise do waitUntil é abandonada quando a
 * resposta sai antes dela terminar. Os testes iam para 127.0.0.1 e concluíam
 * em ~5 ms, a tempo; a navegação de verdade disparava para o domínio público,
 * com TLS e nginx no caminho (~43 ms), e morria antes de gravar.
 *
 * Agora o envio é aguardado, com duas defesas para o custo não virar problema:
 * vai direto ao 127.0.0.1 (sem TLS, sem nginx) e tem timeout curto. Se
 * estourar, a requisição segue sem log — perder uma linha é aceitável, segurar
 * a página de alguém não é.
 */
async function registrarAcesso(
  req: NextRequest,
  res: NextResponse,
  _event: NextFetchEvent,
  ms: number
): Promise<void> {
  const pathname = req.nextUrl.pathname;

  // Ruído que não diz nada sobre uso: arquivos estáticos e o favicon.
  if (/\.(ico|png|jpe?g|svg|webp|gif|css|js|map|txt|xml|woff2?)$/i.test(pathname)) {
    return;
  }

  const status = res.status;
  const resultado: 'ok' | 'redirect' | 'rewrite' =
    status >= 300 && status < 400
      ? 'redirect'
      : res.headers.get('x-middleware-rewrite')
        ? 'rewrite'
        : 'ok';

  const enviar = async () => {
    let email: string | null = null;
    let loteadoraId: string | null = null;

    // Verifica de novo em vez de reaproveitar o resultado do fluxo: assim o
    // e-mail no log vem sempre de um token válido, nunca de um forjado.
    try {
      const token = req.cookies.get(ADMIN_COOKIE)?.value;
      if (token) {
        const { payload } = await jwtVerify(token, adminSecret);
        email = typeof payload.email === 'string' ? payload.email : null;
        loteadoraId =
          typeof payload.loteadoraId === 'string' ? payload.loteadoraId : null;
      } else {
        const tokenCliente = req.cookies.get(CLIENTE_COOKIE)?.value;
        if (tokenCliente) {
          const { payload } = await jwtVerify(tokenCliente, clienteSecret);
          email = typeof payload.email === 'string' ? payload.email : null;
        }
      }
    } catch {
      // Token ausente, expirado ou inválido: acesso anônimo do ponto de
      // vista do log, que é exatamente o que se quer registrar.
    }

    // Loopback, não o domínio público: o pedido nem sai da máquina, então
    // não paga TLS nem passa pelo nginx.
    const base =
      process.env.LOG_INGEST_URL ||
      `http://127.0.0.1:${process.env.PORT || 3000}`;

    await fetch(new URL('/api/log-acesso', base), {
      method: 'POST',
      signal: AbortSignal.timeout(500),
      headers: {
        'Content-Type': 'application/json',
        'x-log-token': LOG_TOKEN,
      },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        metodo: req.method,
        rota: pathname + (req.nextUrl.search || ''),
        resultado,
        status: resultado === 'ok' ? null : status,
        ip:
          req.headers.get('x-real-ip') ||
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          null,
        email,
        loteadoraId,
        area: areaDaRota(pathname),
        ua: req.headers.get('user-agent'),
        ms,
      }),
    }).catch(() => {});
  };

  await enviar();
}

async function rotear(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;
  const hostHeader = (req.headers.get('host') || '').toLowerCase();
  const host = hostHeader.split(':')[0];

  // ============ ADMIN PROTECTION ============
  if (pathname.startsWith('/admin')) {
    if (pathname.startsWith('/admin/login')) {
      return NextResponse.next();
    }
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) {
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    try {
      await jwtVerify(token, adminSecret);
      return NextResponse.next();
    } catch {
      url.pathname = '/admin/login';
      url.search = '';
      const res = NextResponse.redirect(url);
      res.cookies.delete(ADMIN_COOKIE);
      return res;
    }
  }

  // ============ ÁREA DO CLIENTE ============
  if (pathname.startsWith('/minha-conta')) {
    if (pathname === '/minha-conta/login' || pathname === '/minha-conta/cadastro' || pathname === '/minha-conta/recuperar-senha') {
      return NextResponse.next();
    }
    const token = req.cookies.get(CLIENTE_COOKIE)?.value;
    if (!token) {
      url.pathname = '/minha-conta/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    try {
      await jwtVerify(token, clienteSecret);
      return NextResponse.next();
    } catch {
      url.pathname = '/minha-conta/login';
      url.search = '';
      const res = NextResponse.redirect(url);
      res.cookies.delete(CLIENTE_COOKIE);
      return res;
    }
  }

  // ============ FORMULÁRIOS PÚBLICOS ============
  // /f/<slug> nunca é tocado pelo subdomain rewrite
  if (pathname.startsWith('/f/')) {
    return NextResponse.next();
  }

  // ============ STAND TOUCH 3D ============
  // /touch/<slug> também é rota pública direta (não rewritea por subdomain)
  if (pathname.startsWith('/touch/')) {
    return NextResponse.next();
  }

  // ============ SUBDOMÍNIO / DOMÍNIO CUSTOMIZADO ============
  if (req.headers.get('x-meu-rewritten') === '1') {
    return NextResponse.next();
  }
  if (/\.[a-zA-Z0-9]{2,5}$/.test(pathname)) {
    return NextResponse.next();
  }

  let slug: string | null = null;
  if (CUSTOM_DOMAINS[host]) {
    slug = CUSTOM_DOMAINS[host];
  } else if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = host.slice(0, -(BASE_DOMAIN.length + 1));
    if (sub && !RESERVED_SUBDOMAINS.has(sub) && !sub.includes('.')) {
      slug = sub;
    }
  }

  if (slug) {
    const newPath = pathname === '/' ? `/${slug}` : `/${slug}${pathname}`;
    url.pathname = newPath;
    const headers = new Headers(req.headers);
    headers.set('x-meu-rewritten', '1');
    return NextResponse.rewrite(url, { request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|api).*)',
  ],
};
