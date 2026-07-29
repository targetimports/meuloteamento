import { NextRequest, NextResponse } from 'next/server';
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

export async function middleware(req: NextRequest) {
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
