function readSecret(name: string, devFallback: string): Uint8Array {
  const raw = process.env[name];
  if (process.env.NODE_ENV === 'production') {
    if (!raw || raw.length < 32) {
      throw new Error(
        `[env] ${name} é obrigatório em produção e deve ter pelo menos 32 caracteres`
      );
    }
    return new TextEncoder().encode(raw);
  }
  return new TextEncoder().encode(raw || devFallback);
}

export const JWT_SECRET = readSecret(
  'JWT_SECRET',
  'dev-only-troque-em-producao-com-no-minimo-32-chars'
);

export const JWT_SECRET_CLIENTE = readSecret(
  'JWT_SECRET_CLIENTE',
  'dev-only-cliente-troque-em-producao-com-32-chars'
);

export const ADMIN_COOKIE = process.env.SESSION_COOKIE_NAME || 'meuloteamento_session';
export const CLIENTE_COOKIE = process.env.CLIENTE_COOKIE_NAME || 'meuloteamento_cliente';

export function requireProdEnv(name: string): string {
  const v = process.env[name];
  if (process.env.NODE_ENV === 'production' && !v) {
    throw new Error(`[env] ${name} é obrigatório em produção`);
  }
  return v || '';
}

export const CRON_TOKEN = (() => {
  const v = process.env.CRON_TOKEN;
  if (process.env.NODE_ENV === 'production' && (!v || v.length < 24)) {
    throw new Error('[env] CRON_TOKEN obrigatório em produção (>= 24 chars)');
  }
  return v || 'dev-cron-token-mude-em-producao';
})();
