'use client';

/**
 * Formulários em tabela, com o cadastro em modal.
 *
 * Em cards, cada formulário ocupava um retângulo com dois números grandes
 * dentro — e comparar "quantas respostas novas" entre eles exigia varrer a
 * grade com o olho. Em coluna, a comparação é a leitura.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormBuilder, type LoteamentoOpcao } from '@/components/FormBuilder';

export interface FormularioLinha {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  loteamentoNome: string | null;
  ativo: boolean;
  respostas: number;
  novas: number;
  /** AAAA-MM-DD para ordenar. */
  atualizado: string;
  atualizadoLabel: string;
}

interface Filtros {
  busca: string;
  situacao: string;
  respostas: string;
}

const FILTRO_VAZIO: Filtros = { busca: '', situacao: '', respostas: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'nome' | 'loteamentoNome' | 'respostas' | 'novas' | 'atualizado' | 'ativo';

const campoClass =
  'w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function semAcento(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

export function TabelaFormularios({
  formularios,
  loteamentos,
}: {
  formularios: FormularioLinha[];
  loteamentos: LoteamentoOpcao[];
}) {
  const [criando, setCriando] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'atualizado',
    asc: false,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    const termo = semAcento(filtros.busca.trim());
    return formularios.filter((f) => {
      if (termo) {
        const alvo = semAcento(`${f.nome} ${f.descricao ?? ''} ${f.loteamentoNome ?? ''}`);
        if (!alvo.includes(termo)) return false;
      }
      if (filtros.situacao === 'ativos' && !f.ativo) return false;
      if (filtros.situacao === 'pausados' && f.ativo) return false;
      if (filtros.respostas === 'novas' && f.novas === 0) return false;
      if (filtros.respostas === 'sem' && f.respostas > 0) return false;
      return true;
    });
  }, [formularios, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    return [...visiveis].sort((a, b) => {
      if (campo === 'respostas' || campo === 'novas') return (a[campo] - b[campo]) * sinal;
      if (campo === 'ativo') return (Number(a.ativo) - Number(b.ativo)) * sinal;
      return String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''), 'pt-BR') * sinal;
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function ordenarPor(campo: CampoOrdem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
  }

  function Cabecalho({
    campo,
    rotulo,
    alinhamento = 'text-left',
  }: {
    campo: CampoOrdem;
    rotulo: string;
    alinhamento?: string;
  }) {
    const ativa = ordem.campo === campo;
    return (
      <th className={`${alinhamento} px-4 py-3 font-semibold`}>
        <button
          type="button"
          onClick={() => ordenarPor(campo)}
          className="inline-flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
          title={`Ordenar por ${rotulo.toLowerCase()}`}
        >
          {rotulo}
          <span className={ativa ? 'text-slate-600 dark:text-slate-300' : 'invisible'} aria-hidden>
            {ativa && !ordem.asc ? '▾' : '▴'}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRascunho(filtros);
              setFiltrando(true);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
              className="text-xs text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
            >
              Limpar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCriando(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Novo formulário
        </button>
      </div>

      {ordenados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {formularios.length === 0
              ? 'Nenhum formulário criado ainda'
              : 'Nenhum formulário atende aos filtros.'}
          </p>
          {formularios.length === 0 && (
            <>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                Formulários servem para coletar dados, fotos de documentos e o lote de interesse
                antes mesmo de o cliente fechar a venda.
              </p>
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Criar o primeiro
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <Cabecalho campo="nome" rotulo="Formulário" />
                  <Cabecalho campo="loteamentoNome" rotulo="Loteamento" />
                  <Cabecalho campo="respostas" rotulo="Respostas" alinhamento="text-right" />
                  <Cabecalho campo="novas" rotulo="Novas" alinhamento="text-right" />
                  <Cabecalho campo="atualizado" rotulo="Atualizado" />
                  <Cabecalho campo="ativo" rotulo="Situação" />
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daPagina.map((f) => (
                  <tr
                    key={f.id}
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      f.ativo ? '' : 'opacity-60'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/formularios/${f.id}`}
                        className="font-medium text-slate-900 hover:text-primary-600 dark:text-slate-100"
                      >
                        {f.nome}
                      </Link>
                      {f.descricao && (
                        <span className="mt-0.5 block max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
                          {f.descricao}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {f.loteamentoNome ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                      {f.respostas}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* Zero em cinza: sem isso, uma coluna de zeros chama a
                          mesma atenção que as respostas que ninguém leu. */}
                      <span
                        className={`tabular-nums ${
                          f.novas > 0
                            ? 'font-medium text-amber-700 dark:text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {f.novas}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {f.atualizadoLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          f.ativo
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                        }`}
                      >
                        {f.ativo ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/formularios/${f.id}`}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          Respostas
                        </Link>
                        <Link
                          href={`/admin/formularios/${f.id}/editar`}
                          className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-400"
                        >
                          Editar
                        </Link>
                        <a
                          href={`/f/${f.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-400"
                        >
                          Link público
                        </a>
                      </div>
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {ordenados.length}
            {ordenados.length !== formularios.length && ` (${formularios.length} no total)`}
          </p>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400">
                {paginaAtual} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
            <DialogTitle>Filtrar formulários</DialogTitle>
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
                <Campo rotulo="Nome, descrição ou loteamento">
                  <input
                    value={rascunho.busca}
                    onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
                    className={campoClass}
                    autoFocus
                  />
                </Campo>
              </div>
              <Campo rotulo="Situação">
                <select
                  value={rascunho.situacao}
                  onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="pausados">Pausados</option>
                </select>
              </Campo>
              <Campo rotulo="Respostas">
                <select
                  value={rascunho.respostas}
                  onChange={(e) => setRascunho({ ...rascunho, respostas: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  <option value="novas">Com resposta nova</option>
                  <option value="sem">Sem resposta</option>
                </select>
              </Campo>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => setRascunho(FILTRO_VAZIO)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Limpar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* O construtor inteiro cabe aqui: são muitos campos, então o modal é
          largo e rola por dentro. Ao salvar ele navega para o formulário
          criado, o que fecha isto sozinho. */}
      <Dialog open={criando} onOpenChange={setCriando}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo formulário</DialogTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Defina os campos que o cliente vai preencher. Depois copie o link público e envie
              por WhatsApp.
            </p>
          </DialogHeader>

          <FormBuilder modo="novo" loteamentos={loteamentos} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
