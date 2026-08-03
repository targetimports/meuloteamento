/**
 * Logs de acesso do sistema.
 *
 * Duas fontes: o app.log, escrito pelo middleware (sabe quem estava logado e
 * de qual empresa), e o access.log do nginx, de onde vêm as chamadas de /api
 * — webhooks, crons e integrações, que não passam pelo middleware e trazem o
 * status HTTP real.
 *
 * A leitura é feita aqui, uma vez; o filtro e a paginação vivem no cliente.
 * Antes cada clique de página era uma volta ao servidor que relia o arquivo
 * inteiro para mostrar 50 linhas — numa tela em que se navega batendo página
 * atrás de um horário, isso pesava a cada clique.
 */

import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { lerLogs } from '@/lib/logger';
import { TabelaLogs } from './TabelaLogs';

export const dynamic = 'force-dynamic';

/** Teto do que vai para o navegador de uma vez. */
const LIMITE = 3000;

export default async function LogsPage() {
  await requireBackoffice();

  const [empresas, dados] = await Promise.all([
    prisma.loteadora.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    Promise.resolve(lerLogs({ limite: LIMITE })),
  ]);

  const mb = (dados.tamanhoBytes / 1024 / 1024).toFixed(1);
  const pctUso = Math.min(100, (dados.tamanhoBytes / (20 * 1024 * 1024)) * 100);

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Logs do sistema</h1>
          <span className="text-sm text-slate-500">
            {dados.total.toLocaleString('pt-BR')} registro(s)
          </span>
        </div>
      </header>

      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Navegação de <code className="font-mono">{dados.arquivo}</code>
            {dados.totalIntegracoes > 0 && (
              <>
                {' '}· {dados.totalIntegracoes.toLocaleString('pt-BR')} chamada(s) de
                integração vindas do nginx
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${pctUso > 80 ? 'bg-amber-500' : 'bg-slate-400'}`}
                style={{ width: `${Math.max(2, pctUso)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 tabular-nums">{mb} / 20 MB</span>
          </div>
        </div>

        {dados.truncado && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            Mostrando os {LIMITE.toLocaleString('pt-BR')} registros mais recentes de{' '}
            {dados.total.toLocaleString('pt-BR')}. O histórico completo continua nos
            arquivos.
          </p>
        )}

        <TabelaLogs logs={dados.itens} empresas={empresas} />
      </div>
    </div>
  );
}
