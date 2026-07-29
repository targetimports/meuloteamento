import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET_CLIENTE, CLIENTE_COOKIE } from './env';

const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export interface ClienteSession {
  sub: string;
  email: string;
  nome: string;
}

export async function signClienteSession(payload: ClienteSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET_CLIENTE);
}

export async function verifyClienteToken(token: string): Promise<ClienteSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_CLIENTE);
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      nome: String(payload.nome),
    };
  } catch {
    return null;
  }
}

export async function setClienteCookie(token: string): Promise<void> {
  cookies().set(CLIENTE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearClienteCookie(): Promise<void> {
  cookies().delete(CLIENTE_COOKIE);
}

export async function getClienteSession(): Promise<ClienteSession | null> {
  const token = cookies().get(CLIENTE_COOKIE)?.value;
  if (!token) return null;
  return verifyClienteToken(token);
}
