'use client';

/**
 * Contas financeiras: cadastro em modal e listagem em tabela.
 *
 * O cadastro era uma seção sanfonada no meio da página — nove campos que
 * ficavam empurrando a lista para baixo toda vez que alguém abria por engano.
 * Como se cadastra conta raramente e se consulta saldo o tempo todo, o
 * formulário virou modal e a lista ficou com a página inteira.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL } from '@/lib/format';
import { criarConta, toggleAtivaConta, excluirConta } from '@/app/admin/(dashboard)/contas/actions';

export interface ContaLinha {
  id: string;
  nome: string;
  tipo: string;
  banco: string | null;
  agencia: string | null;
  numeroConta: string | null;
  chavePix: string | null;
  titular: string | null;
  descricao: string | null;
  cor: string | null;
  ativa: boolean;
  saldoInicial: number;
  recebido: number;
  parcelas: number;
}

const TIPO_LABEL: Record<string, string> = {
  ASAAS: 'Asaas',
  CAIXA: 'Caixa (espécie)',
  BANCO: 'Banco',
  OUTROS: 'Outros',
};

const TIPO_BG: Record<string, string> = {
  ASAAS: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  CAIXA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  BANCO: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  OUTROS: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

interface Filtros {
  tipo: string;
  situacao: string;
  nome: string;
}

const FILTRO_VAZIO: Filtros = { tipo: '', situacao: '', nome: '' };

const POR_PAGINA = 20;

type CampoOrdem = 'nome' | 'tipo' | 'saldoInicial' | 'recebido' | 'saldo' | 'parcelas' | 'ativa';

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

export function GerenciarContas({
  contas,
  loteadoras,
}: {
  contas: ContaLinha[];
  /** Preenchida só para superadmin: é ela que decide de quem é a conta nova. */
  loteadoras: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: CampoOrdem; asc: boolean }>({
    campo: 'nome',
    asc: true,
  });

  const ativos = Object.values(filtros).filter((v) => v !== '').length;

  const visiveis = useMemo(() => {
    return contas.filter((c) => {
      if (filtros.tipo && c.tipo !== filtros.tipo) return false;
      if (filtros.situacao === 'ativa' && !c.ativa) return false;
      if (filtros.situacao === 'inativa' && c.ativa) return false;
      if (filtros.nome && !semAcento(c.nome).includes(semAcento(filtros.nome.trim()))) return false;
      return true;
    });
  }, [contas, filtros]);

  const ordenados = useMemo(() => {
    const { campo, asc } = ordem;
    const sinal = asc ? 1 : -1;
    const saldo = (c: ContaLinha) => c.saldoInicial + c.recebido;
    return [...visiveis].sort((a, b) => {
      switch (campo) {
        case 'saldo':
          return (saldo(a) - saldo(b)) * sinal;
        case 'saldoInicial':
        case 'recebido':
        case 'parcelas':
          return (a[campo] - b[campo]) * sinal;
        case 'ativa':
          return (Number(a.ativa) - Number(b.ativa)) * sinal;
        default:
          return String(a[campo]).localeCompare(String(b[campo]), 'pt-BR') * sinal;
      }
    });
  }, [visiveis, ordem]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = ordenados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function ordenarPor(campo: CampoOrdem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
    setPagina(1);
  }

  function salvar(formData: FormData) {
    setErro(null);
    iniciar(async () => {
      const r = await criarConta({}, formData);
      if (r.error) {
        setErro(r.error);
        return;
      }
      setCadastrando(false);
      router.refresh();
    });
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        </div>

        <button
          type="button"
          onClick={() => {
            setErro(null);
            setCadastrando(true);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Nova conta
        </button>
      </div>

      {ordenados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {contas.length === 0
            ? 'Nenhuma conta cadastrada. Crie pelo menos uma conta de caixa e uma da Asaas para receber pagamentos.'
            : 'Nenhuma conta atende aos filtros.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <Cabecalho campo="nome" rotulo="Conta" />
                  <Cabecalho campo="tipo" rotulo="Tipo" />
                  <Cabecalho campo="saldoInicial" rotulo="Inicial" alinhamento="text-right" />
                  <Cabecalho campo="recebido" rotulo="Recebido" alinhamento="text-right" />
                  <Cabecalho campo="saldo" rotulo="Saldo atual" alinhamento="text-right" />
                  <Cabecalho campo="parcelas" rotulo="Parcelas" alinhamento="text-right" />
                  <Cabecalho campo="ativa" rotulo="Situação" />
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daPagina.map((c) => (
                  <tr
                    key={c.id}
                    className={`transition-colors hover:bg-slate-50 ${c.ativa ? '' : 'opacity-60'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {/* A cor é escolhida no cadastro e identifica a conta
                            nos saldos do financeiro — vale mantê-la à vista. */}
                        <span
                          className="mt-1 h-3 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: c.cor ?? '#cbd5e1' }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{c.nome}</p>
                          {(c.banco || c.agencia || c.numeroConta) && (
                            <p className="text-xs text-slate-500">
                              {c.banco}
                              {c.agencia && ` · Ag ${c.agencia}`}
                              {c.numeroConta && ` · Cc ${c.numeroConta}`}
                            </p>
                          )}
                          {c.chavePix && (
                            <p className="truncate text-xs text-slate-500" title={c.chavePix}>
                              Pix <span className="font-mono">{c.chavePix}</span>
                            </p>
                          )}
                          {c.titular && (
                            <p className="text-xs text-slate-400">Titular: {c.titular}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          TIPO_BG[c.tipo] ?? TIPO_BG.OUTROS
                        }`}
                      >
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatBRL(c.saldoInicial)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                      {formatBRL(c.recebido)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatBRL(c.saldoInicial + c.recebido)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {c.parcelas}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          c.ativa
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                            : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                        }`}
                      >
                        {c.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            iniciar(async () => {
                              await toggleAtivaConta(c.id);
                              router.refresh();
                            })
                          }
                          disabled={salvando}
                          className="text-xs font-medium text-slate-600 transition hover:underline disabled:opacity-50"
                        >
                          {c.ativa ? 'Desativar' : 'Reativar'}
                        </button>
                        {/* Excluir só sem parcela vinculada. Com movimento, a
                            conta é histórico de para onde o dinheiro foi. */}
                        {c.parcelas === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm(`Excluir a conta "${c.nome}"?`)) return;
                              iniciar(async () => {
                                await excluirConta(c.id);
                                router.refresh();
                              });
                            }}
                            disabled={salvando}
                            className="text-xs font-medium text-red-600 transition hover:underline disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        )}
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
          <p className="text-xs text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{(paginaAtual - 1) * POR_PAGINA + daPagina.length}{' '}
            de {ordenados.length}
            {ordenados.length !== contas.length && ` (${contas.length} no total)`}
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
            <DialogTitle>Filtrar contas</DialogTitle>
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
              <Campo rotulo="Tipo">
                <select
                  value={rascunho.tipo}
                  onChange={(e) => setRascunho({ ...rascunho, tipo: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Situação">
                <select
                  value={rascunho.situacao}
                  onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  <option value="ativa">Ativas</option>
                  <option value="inativa">Inativas</option>
                </select>
              </Campo>
              <div className="sm:col-span-2">
                <Campo rotulo="Nome">
                  <input
                    value={rascunho.nome}
                    onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                    className={campoClass}
                  />
                </Campo>
              </div>
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

      <Dialog open={cadastrando} onOpenChange={setCadastrando}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova conta financeira</DialogTitle>
          </DialogHeader>

          <form action={salvar} className="space-y-4">
            {erro && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {erro}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Superadmin não tem empresa na sessão: sem este campo o cadastro
                  era recusado com "Selecione a loteadora" e nada na tela
                  explicava onde escolher. */}
              {loteadoras.length > 0 && (
                <div className="sm:col-span-2">
                  <Campo rotulo="Empresa *">
                    <select name="loteadoraId" required className={campoClass}>
                      <option value="">Selecione…</option>
                      {loteadoras.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
              )}

              <Campo rotulo="Nome da conta *">
                <input
                  name="nome"
                  required
                  minLength={2}
                  placeholder="Conta Itaú 12345-6"
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Tipo *">
                <select name="tipo" required defaultValue="BANCO" className={campoClass}>
                  {Object.entries(TIPO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Banco">
                <input name="banco" placeholder="Banco do Brasil, Itaú…" className={campoClass} />
              </Campo>
              <Campo rotulo="Titular">
                <input name="titular" className={campoClass} />
              </Campo>
              <Campo rotulo="Agência">
                <input name="agencia" className={campoClass} />
              </Campo>
              <Campo rotulo="Número da conta">
                <input name="numeroConta" className={campoClass} />
              </Campo>
              <div className="sm:col-span-2">
                <Campo rotulo="Chave Pix">
                  <input
                    name="chavePix"
                    placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                    className={campoClass}
                  />
                </Campo>
              </div>
              <Campo rotulo="Saldo inicial">
                <input
                  name="saldoInicial"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                  className={campoClass}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  O que já havia na conta antes de entrar no sistema.
                </p>
              </Campo>
              <Campo rotulo="Cor">
                <input
                  name="cor"
                  type="color"
                  defaultValue="#0ea5e9"
                  className="h-[38px] w-full cursor-pointer rounded-lg border border-slate-300 px-1"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Identifica a conta nos saldos do financeiro.
                </p>
              </Campo>
              <div className="sm:col-span-2">
                <Campo rotulo="Descrição">
                  <input name="descricao" placeholder="Observações livres" className={campoClass} />
                </Campo>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {salvando ? 'Salvando…' : 'Cadastrar conta'}
              </button>
              <button
                type="button"
                onClick={() => setCadastrando(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
