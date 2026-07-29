import { NextRequest, NextResponse } from 'next/server';
import { CRON_TOKEN } from '@/lib/env';
import { processarFila } from '@/lib/comunicacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-cron-token');
  const queryToken = req.nextUrl.searchParams.get('token');
  if (headerToken !== CRON_TOKEN && queryToken !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const result = await processarFila(100);
  return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
}
