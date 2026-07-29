import { NextRequest, NextResponse } from 'next/server';
import { CRON_TOKEN } from '@/lib/env';
import { rodarReguaCobranca, marcarParcelasAtrasadas } from '@/lib/regua-cobranca';
import { processarFila } from '@/lib/comunicacao';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCK = 'regua-cobranca';

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get('x-cron-token');
  const queryToken = req.nextUrl.searchParams.get('token');
  if (headerToken !== CRON_TOKEN && queryToken !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Trava anti-sobreposição (atômica): só UMA execução por vez. Se uma rodada
  // demorar e o cron disparar de novo, a segunda PULA — evita reenviar a mesma
  // cobrança. A trava expira sozinha em 10 min (auto-cura se o processo morrer).
  const got = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO cron_locks (name, locked_until)
    VALUES (${LOCK}, now() + interval '10 minutes')
    ON CONFLICT (name) DO UPDATE
      SET locked_until = now() + interval '10 minutes'
      WHERE cron_locks.locked_until IS NULL OR cron_locks.locked_until < now()
    RETURNING name;
  `;
  if (!got.length) {
    return NextResponse.json({ ok: true, skipped: 'execucao anterior ainda em andamento' });
  }

  try {
    const atrasadas = await marcarParcelasAtrasadas();
    const resultados = await rodarReguaCobranca();
    const fila = await processarFila(100);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      parcelasMarcadasAtrasadas: atrasadas.marcadas,
      reguas: resultados,
      fila,
    });
  } finally {
    await prisma.$executeRaw`UPDATE cron_locks SET locked_until = NULL WHERE name = ${LOCK};`;
  }
}
