/**
 * Recebe os eventos de acesso do middleware e grava em arquivo.
 *
 * POR QUE ESTA ROTA EXISTE: o middleware roda em Edge Runtime, que não tem
 * `fs`. Ele coleta os dados (é onde o JWT já está sendo verificado, então
 * e-mail e empresa saem de graça) e despacha para cá, que roda em Node.
 *
 * O middleware chama com `event.waitUntil`, ou seja, sem segurar a resposta
 * do usuário. Esta rota nunca deve responder erro de forma barulhenta nem
 * demorar: é observabilidade, não funcionalidade.
 *
 * O matcher do middleware exclui /api, então esta rota não gera log de si
 * mesma — não há recursão.
 */

import { NextRequest, NextResponse } from 'next/server';
import { registrarLog, type EventoLog } from '@/lib/logger';

// Precisa de Node: Edge não tem acesso a arquivos.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Segredo compartilhado com o middleware. Sem isto, qualquer um poderia
 * escrever linhas falsas no log da plataforma — um log em que se pode
 * injetar não serve como registro de nada.
 */
const SEGREDO =
  process.env.LOG_INGEST_TOKEN || process.env.JWT_SECRET || 'dev-log-token';

export async function POST(req: NextRequest) {
  if (req.headers.get('x-log-token') !== SEGREDO) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const corpo = (await req.json()) as Partial<EventoLog>;

    registrarLog({
      ts: typeof corpo.ts === 'string' ? corpo.ts : new Date().toISOString(),
      metodo: String(corpo.metodo ?? '—').slice(0, 10),
      rota: String(corpo.rota ?? '—').slice(0, 500),
      resultado:
        corpo.resultado === 'redirect' || corpo.resultado === 'rewrite'
          ? corpo.resultado
          : 'ok',
      status: typeof corpo.status === 'number' ? corpo.status : null,
      ip: corpo.ip ? String(corpo.ip).slice(0, 60) : null,
      email: corpo.email ? String(corpo.email).slice(0, 200) : null,
      loteadoraId: corpo.loteadoraId ? String(corpo.loteadoraId).slice(0, 40) : null,
      area: String(corpo.area ?? 'publico').slice(0, 20),
      ua: corpo.ua ? String(corpo.ua).slice(0, 300) : null,
      ms: typeof corpo.ms === 'number' ? corpo.ms : null,
    });
  } catch {
    // Corpo inválido não vira erro: o cliente é o próprio middleware e não
    // tem o que fazer com a resposta.
  }

  return new NextResponse(null, { status: 204 });
}
