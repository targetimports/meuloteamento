import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { consultarParcelas, lerParametros } from '@/lib/parcelas-consulta';

export const dynamic = 'force-dynamic';

/**
 * Serve a tabela de parcelas do financeiro.
 *
 * Existe para que ordenar, filtrar e virar página troquem só a tabela. Antes
 * cada clique num cabeçalho era uma navegação: a página inteira voltava do
 * servidor com os KPIs, os agregados de cheques, os saldos por conta e as
 * listas do modal de cobrança — tudo recalculado para reordenar 50 linhas.
 *
 * A empresa vem da sessão, nunca da query: quem manda `?loteadoraId=` na mão
 * não muda de tenant.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { filtros, campo, dir, pagina } = lerParametros((k) => searchParams.get(k));

  const { linhas, total } = await consultarParcelas({
    tid: session.loteadoraId ?? null,
    filtros,
    campo,
    dir,
    pagina,
  });

  return NextResponse.json({ linhas, total });
}
