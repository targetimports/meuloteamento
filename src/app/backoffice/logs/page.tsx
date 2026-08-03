/**
 * Logs de acesso do sistema.
 *
 * Lê o app.log direto do disco — não há tabela envolvida. Log em banco
 * competiria por I/O com a operação real do cliente justamente nos picos,
 * que é quando o registro mais importa.
 *
 * Paginação e filtro por querystring (e não por estado no cliente) para que
 * uma tela específica possa ser compartilhada por link.
 */

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { lerLogs } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 50;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; pagina?: string; integracoes?: string }>;
}) {
  await requireBackoffice();
  const sp = await searchParams;

  const empresaFiltro = sp.empresa ?? '';
  const semIntegracoes = sp.integracoes === 'nao';
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const [empresas, dados] = await Promise.all([
    prisma.loteadora.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    Promise.resolve(
      lerLogs({
        loteadoraId: empresaFiltro || null,
        incluirIntegracoes: !semIntegracoes,
        pagina,
        porPagina: POR_PAGINA,
      })
    ),
  ]);

  const nomePorId = new Map(empresas.map((e) => [e.id, e.nome]));
  const totalPaginas = Math.max(1, Math.ceil(dados.total / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const link = (p: number, empresa = empresaFiltro) =>
    `/backoffice/logs?empresa=${encodeURIComponent(empresa)}&integracoes=${
      semIntegracoes ? 'nao' : 'sim'
    }&pagina=${p}`;

  const mb = (dados.tamanhoBytes / 1024 / 1024).toFixed(1);
  const pctUso = Math.min(100, (dados.tamanhoBytes / (20 * 1024 * 1024)) * 100);

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Logs do sistema</h1>
          <span className="text-sm text-slate-500">
            {dados.total.toLocaleString('pt-BR')} registro(s)
          </span>
        </div>

        {/* Filtro por GET: recarrega a página e mantém o estado na URL. */}
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="empresa" className="text-xs font-medium text-slate-600">
            Origem
          </label>
          <select
            id="empresa"
            name="empresa"
            defaultValue={empresaFiltro}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas as origens</option>
            <option value="backoffice">Backoffice e visitantes</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>

          {/* Só faz sentido sem filtro de empresa: o nginx não sabe de qual
              loteadora é a chamada, então integrações não têm empresa. */}
          <label
            className={`flex items-center gap-1.5 text-xs ${
              empresaFiltro ? 'text-slate-300' : 'text-slate-600'
            }`}
            title={
              empresaFiltro
                ? 'As integrações não têm empresa associada, então ficam fora ao filtrar por uma'
                : undefined
            }
          >
            <input
              type="checkbox"
              name="integracoes"
              value="nao"
              defaultChecked={semIntegracoes}
              disabled={Boolean(empresaFiltro)}
              className="rounded border-slate-300"
            />
            Ocultar integrações
          </label>

          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
          >
            Filtrar
          </button>
        </form>
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

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {dados.itens.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">Nenhum registro encontrado.</p>
              <p className="text-xs text-slate-400 mt-1">
                {dados.total === 0
                  ? 'O arquivo ainda está vazio — os acessos aparecem aqui conforme acontecem.'
                  : 'Nenhum registro para este filtro.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Quando</th>
                    <th className="text-left font-medium px-4 py-3">Rota</th>
                    <th className="text-left font-medium px-4 py-3">Usuário</th>
                    <th className="text-left font-medium px-4 py-3">Origem</th>
                    <th className="text-left font-medium px-4 py-3">IP</th>
                    <th className="text-right font-medium px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dados.itens.map((e, i) => (
                    <tr key={`${e.ts}-${i}`} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap tabular-nums text-xs">
                        {new Date(e.ts).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2.5 max-w-md">
                        <span className="text-[10px] font-medium text-slate-400 mr-1.5">
                          {e.metodo}
                        </span>
                        <span className="font-mono text-xs text-slate-900 break-all">
                          {e.rota}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {e.email ? (
                          <span className="text-xs text-slate-700">{e.email}</span>
                        ) : (
                          <span className="text-xs text-slate-400">anônimo</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Origem
                          area={e.area}
                          nomeEmpresa={e.loteadoraId ? nomePorId.get(e.loteadoraId) : undefined}
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {e.ip ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <Resultado resultado={e.resultado} status={e.status} ms={e.ms} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500 tabular-nums">
                {(paginaAtual - 1) * POR_PAGINA + 1}–
                {Math.min(paginaAtual * POR_PAGINA, dados.total)} de{' '}
                {dados.total.toLocaleString('pt-BR')}
              </p>
              <div className="flex items-center gap-1">
                {paginaAtual > 1 ? (
                  <Link
                    href={link(paginaAtual - 1)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-100">
                    Anterior
                  </span>
                )}
                <span className="px-2 text-xs text-slate-500 tabular-nums">
                  {paginaAtual} / {totalPaginas}
                </span>
                {paginaAtual < totalPaginas ? (
                  <Link
                    href={link(paginaAtual + 1)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Próxima
                  </Link>
                ) : (
                  <span className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-100">
                    Próxima
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">
            Sobre o que este registro alcança
          </h2>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
            <li>
              <strong>Duas fontes, sem sobreposição.</strong> A navegação vem do
              app.log, que sabe quem estava logado e de qual empresa. As
              chamadas de <code className="font-mono">/api</code> — webhooks do
              Asaas, crons e integrações — vêm do log do nginx, que enxerga o
              que o roteamento não vê e traz o status HTTP real.
            </li>
            <li>
              O app.log é único e nunca gera cópias: ao passar de 20 MB, a
              metade mais antiga é descartada e o mesmo arquivo continua. O log
              do nginx é apenas lido; a configuração dele não foi alterada.
            </li>
            <li>
              Nas linhas de navegação, <strong>Resultado</strong> mostra o que o
              roteamento decidiu (seguiu, redirect, rewrite): o status final da
              página é definido depois desse ponto. Nas integrações, o status é
              o real.
            </li>
            <li>
              Integrações não têm empresa associada — o nginx não conhece
              sessão. Por isso somem ao filtrar por uma empresa específica.
            </li>
            <li>
              Tokens em querystring aparecem mascarados: os crons levam o
              CRON_TOKEN na URL, e ele fica gravado em texto claro no arquivo do
              nginx.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Origem({ area, nomeEmpresa }: { area: string; nomeEmpresa?: string }) {
  if (nomeEmpresa) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20">
        {nomeEmpresa}
      </span>
    );
  }
  const tons: Record<string, string> = {
    backoffice: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    admin: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    cliente: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    publico: 'bg-slate-100 text-slate-500 ring-slate-500/20',
    sistema: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    integracao: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  };
  const rotulos: Record<string, string> = {
    backoffice: 'Backoffice',
    admin: 'Painel',
    cliente: 'Área do cliente',
    publico: 'Site público',
    sistema: 'Sistema',
    integracao: 'Integração',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
        tons[area] ?? tons.publico
      }`}
    >
      {rotulos[area] ?? area}
    </span>
  );
}

function Resultado({
  resultado,
  status,
  ms,
}: {
  resultado: string;
  status: number | null;
  ms: number | null;
}) {
  const mapa: Record<string, { txt: string; cls: string }> = {
    ok: { txt: 'seguiu', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
    redirect: {
      txt: status ? `redirect ${status}` : 'redirect',
      cls: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    },
    rewrite: { txt: 'rewrite', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  };
  const r = mapa[resultado] ?? mapa.ok;
  return (
    <span className="inline-flex items-center gap-2">
      {ms != null && <span className="text-[10px] text-slate-400 tabular-nums">{ms}ms</span>}
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${r.cls}`}
      >
        {r.txt}
      </span>
    </span>
  );
}
