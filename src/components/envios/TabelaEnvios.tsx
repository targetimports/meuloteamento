'use client';

/**
 * Histórico de envios da régua, com filtro em modal e paginação.
 *
 * A lista vinha inteira, sem recorte e cortada em 100 sem avisar. Quando um
 * envio falha, a pergunta é sempre "quais falharam e para quem" — e não havia
 * como perguntar isso.
 */

import { useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface EnvioLinha {
  id: string;
  /** AAAA-MM-DD para filtrar e ordenar. */
  data: string;
  dataLabel: string;
  canal: string;
  destinatario: string;
  clienteNome: string | null;
  referencia: string | null;
  status: string;
  erro: string | null;
}

const STATUS_BG: Record<string, string> = {
  ENVIADO: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ENTREGUE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  LIDO: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  FALHOU: 'bg-red-50 text-red-700 ring-red-600/20',
};

interface Filtros {
  busca: string;
  status: string;
  canal: string;
  de: string;
  ate: string;
}

const FILTRO_VAZIO: Filtros = { busca: '', status: '', canal: '', de: '', ate: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'data' | 'canal' | 'destinatario' | 'clienteNome' | 'status';

const campoClass =
  'w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

function semAcento(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{rotulo}</label>
      {children}
    </div>
  );
}

export function TabelaEnvios({ envios }: { envios: EnvioLinha[] }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'data',
    asc: false,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const statusDisponiveis = useMemo(
    () => [...new Set(envios.map((e) => e.status))].sort(),
    [envios]
  );
  const canaisDisponiveis = useMemo(
    () => [...new Set(envios.map((e) => e.canal))].sort(),
    [envios]
  );

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    const digitos = filtros.busca.replace(/\D/g, '');
    return envios.filter((e) => {
      if (termo) {
        const texto = semAcento(`${e.clienteNome ?? ''} ${e.referencia ?? ''}`);
        const numero = digitos.length > 0 && e.destinatario.replace(/\D/g, '').includes(digitos);
        if (!texto.includes(termo) && !numero) return false;
      }
      if (filtros.status && e.status !== filtros.status) return false;
      if (filtros.canal && e.canal !== filtros.canal) return false;
      if (filtros.de && e.data < filtros.de) return false;
      if (filtros.ate && e.data > filtros.ate) return false;
      return true;
    });
  }, [envios, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort(
      (a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'pt-BR') * sinal
    );
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const falhas = ordenados.filter((e) => e.status === 'FALHOU').length;

  function ordenarPor(campo: CampoOrdem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
  }

  function Cabecalho({
    campo,
    rotulo,
  }: {
    campo: CampoOrdem;
    rotulo: string;
  }) {
    const ativa = ordem.campo === campo;
    return (
      <th className="px-4 py-3 text-left font-semibold">
        <button
          type="button"
          onClick={() => ordenarPor(campo)}
          className="inline-flex items-center gap-1 transition-colors hover:text-slate-700"
          title={`Ordenar por ${rotulo.toLowerCase()}`}
        >
          {rotulo}
          <span className={ativa ? 'text-slate-600' : 'invisible'} aria-hidden>
            {ativa && !ordem.asc ? '▾' : '▴'}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRascunho(filtros);
            setFiltrando(true);
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Filtrar
          {ativos > 0 && (
            <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-semibold text-white">
              {ativos}
            </span>
          )}
        </button>
        {ativos > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiltros(FILTRO_VAZIO);
              setPagina(1);
            }}
            className="text-xs text-slate-500 transition hover:text-slate-800"
          >
            Limpar
          </button>
        )}
        {falhas > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiltros({ ...FILTRO_VAZIO, status: 'FALHOU' });
              setPagina(1);
            }}
            className="text-xs font-medium text-red-600 transition hover:underline"
          >
            {falhas} falha(s) — ver só elas
          </button>
        )}
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {envios.length === 0
            ? 'Nenhum envio registrado.'
            : 'Nenhum envio atende aos filtros.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Cabecalho campo="data" rotulo="Quando" />
                  <Cabecalho campo="canal" rotulo="Canal" />
                  <Cabecalho campo="destinatario" rotulo="Destinatário" />
                  <Cabecalho campo="clienteNome" rotulo="Cliente / Parcela" />
                  <Cabecalho campo="status" rotulo="Status" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daPagina.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {e.dataLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.canal}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.destinatario}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-900">
                        {e.clienteNome ?? <span className="text-slate-400">—</span>}
                      </span>
                      {e.referencia && (
                        <span className="block text-xs text-slate-500">{e.referencia}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          STATUS_BG[e.status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
                        }`}
                      >
                        {e.status}
                      </span>
                      {e.erro && (
                        <span className="mt-0.5 block max-w-xs text-xs text-red-600">{e.erro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {ordenados.length}
            {ordenados.length !== envios.length && ` (${envios.length} no total)`}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-500">
                {paginaAtual} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog open={filtrando} onOpenChange={setFiltrando}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Filtrar envios</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros(rascunho);
              setPagina(1);
              setFiltrando(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo rotulo="Cliente, contrato ou número">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                    autoFocus
                  />
                </Campo>
              </div>
              <Campo rotulo="Status">
                <select
                  value={rascunho.status}
                  onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {statusDisponiveis.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Canal">
                <select
                  value={rascunho.canal}
                  onChange={(e) => setRascunho({ ...rascunho, canal: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {canaisDisponiveis.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Enviado de">
                <input
                  type="date"
                  value={rascunho.de}
                  onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Enviado até">
                <input
                  type="date"
                  value={rascunho.ate}
                  onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })}
                  className={campoClass}
                />
              </Campo>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => setRascunho(FILTRO_VAZIO)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Limpar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
