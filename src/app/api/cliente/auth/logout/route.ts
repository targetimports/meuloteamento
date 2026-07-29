import { NextResponse } from 'next/server';
import { clearClienteCookie } from '@/lib/auth-cliente';

export async function POST() {
  await clearClienteCookie();
  return NextResponse.json({ ok: true });
}
