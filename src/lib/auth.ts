import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { AdminRole } from '@prisma/client';
import { JWT_SECRET, ADMIN_COOKIE } from './env';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AdminSession {
  sub: string;
  email: string;
  nome: string;
  role: AdminRole;
  loteadoraId: string | null;
}

export async function signSession(payload: AdminSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      nome: String(payload.nome),
      role: payload.role as AdminRole,
      loteadoraId: payload.loteadoraId ? String(payload.loteadoraId) : null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  cookies().delete(ADMIN_COOKIE);
}

export async function getSession(): Promise<AdminSession | null> {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
