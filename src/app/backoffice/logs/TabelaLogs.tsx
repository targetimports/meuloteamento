'use client';

/**
 * Tabela de logs com filtro e paginação no cliente.
 *
 * POR QUE NÃO NO SERVIDOR: antes, cada página e cada filtro eram uma volta
 * completa — o servidor relia o arquivo inteiro, reparseava tudo e o Next
 * remontava a rota, para no fim mostrar 50 linhas que já estavam a um passo
 * dali. Numa tela em que se navega batendo página atrás de um horário, isso
 * pesa a cada clique.
 *
 * Aqui o conjunto chega uma vez e o resto é memória: filtrar e paginar viram
 * instantâneos.
 *
 * O custo é o payload inicial, contido pelo teto de registros da página. Se o
 * arquivo passar disso, a tela avisa em vez de fingir que mostra tudo.
 */

import { useMemo, useState } from 'react';

export interface LinhaLog {
  ts: string;
  metodo: string;
  rota: string;
  resultado: string;
  status: number | null;
  ip: string | null;
  email: string | null;
  loteadoraId: string | null;
  area: string;
  ms: number | null;
}

interface Props {
  logs: LinhaLog[];
  empresas: { id: string; nome: string }[];
}

const POR_PAGINA = 50;

export function TabelaLogs({ logs, empresas }: Props) {
  const [origem, setOrigem] = useState('');
  const [mostrarIntegracoes, setMostrarIntegracoes] = useState(true);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  const nomePorId = useMemo(
    () => new Map(empresas.map((e) => [e.id, e.nome])),
    [empresas]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return logs.filter((e) => {
      const ehIntegracao = e.area === 'integracao';

      if (!mostrarIntegracoes && ehIntegracao) return false;

      if (origem === 'backoffice') {
        // Plataforma e visitantes: tudo que não pertence a uma empresa. As
        // integrações têm empresa desconhecida, então ficam de fora daqui.
        if (e.loteadoraId !== null || ehIntegracao) return false;
      } else if (origem === 'integracao') {
        if (!ehIntegracao) return false;
      } else if (origem) {
        if (e.loteadoraId !== origem) return false;
      }

      if (termo) {
        const alvo = `${e.rota} ${e.email ?? ''} ${e.ip ?? ''} ${e.metodo}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }

      return true;
    });
  }, [logs, origem, mostrarIntegracoes, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  );

  // Mudar filtro com a página lá no fim deixaria a tabela vazia sem motivo
  // aparente. Qualquer mudança de filtro volta para a primeira.
  function aoFiltrar<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPagina(1);
    };
  }

  const campo =
    'px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* -------------------- Filtros -------------------- */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="origem" className="text-xs font-medium text-slate-600">
            Origem
          </label>
          <select
            id="origem"
            value={origem}
            onChange={(e) => aoFiltrar(setOrigem)(e.target.value)}
            className={campo}
          >
            <option value="">Todas as origens</option>
            <option value="backoffice">Backoffice e visitantes</option>
            <option value="integracao">Somente integrações</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <input
          type="search"
          value={busca}
          onChange={(e) => aoFiltrar(setBusca)(e.target.value)}
          placeholder="Buscar rota, e-mail ou IP…"
          className={`${campo} flex-1 min-w-[200px]`}
        />

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarIntegracoes}
            onChange={(e) => aoFiltrar(setMostrarIntegracoes)(e.target.checked)}
            className="rounded border-slate-300"
          />
          Mostrar integrações
        </label>

        <span className="text-xs text-slate-500 tabular-nums ml-auto">
          {filtrados.length.toLocaleString('pt-BR')}
          {filtrados.length !== logs.length && (
            <span className="text-slate-400"> de {logs.length.toLocaleString('pt-BR')}</span>
          )}
        </span>
      </div>

      {/* -------------------- Tabela -------------------- */}
      {visiveis.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-500">Nenhum registro para este filtro.</p>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOrigem('');
                setBusca('');
                setMostrarIntegracoes(true);
                setPagina(1);
              }}
              className="mt-3 text-xs font-medium text-primary-600 hover:underline"
            >
              Limpar filtros
            </button>
          )}
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
              {visiveis.map((e, i) => (
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

      {/* -------------------- Paginação -------------------- */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500 tabular-nums">
            {(paginaAtual - 1) * POR_PAGINA + 1}–
            {Math.min(paginaAtual * POR_PAGINA, filtrados.length)} de{' '}
            {filtrados.length.toLocaleString('pt-BR')}
          </p>
          <div className="flex items-center gap-1">
            <BotaoPagina
              onClick={() => setPagina(1)}
              disabled={paginaAtual === 1}
              rotulo="Primeira"
            />
            <BotaoPagina
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              rotulo="Anterior"
            />
            <span className="px-2 text-xs text-slate-500 tabular-nums">
              {paginaAtual} / {totalPaginas}
            </span>
            <BotaoPagina
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              rotulo="Próxima"
            />
            <BotaoPagina
              onClick={() => setPagina(totalPaginas)}
              disabled={paginaAtual === totalPaginas}
              rotulo="Última"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function BotaoPagina({
  onClick,
  disabled,
  rotulo,
}: {
  onClick: () => void;
  disabled: boolean;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {rotulo}
    </button>
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
  const cls =
    status && status >= 500
      ? 'bg-red-50 text-red-700 ring-red-600/20'
      : status && status >= 400
        ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
        : resultado === 'redirect'
          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
          : resultado === 'rewrite'
            ? 'bg-sky-50 text-sky-700 ring-sky-600/20'
            : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';

  const txt = status
    ? resultado === 'redirect'
      ? `redirect ${status}`
      : String(status)
    : resultado === 'rewrite'
      ? 'rewrite'
      : 'seguiu';

  return (
    <span className="inline-flex items-center gap-2">
      {ms != null && <span className="text-[10px] text-slate-400 tabular-nums">{ms}ms</span>}
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${cls}`}
      >
        {txt}
      </span>
    </span>
  );
}
