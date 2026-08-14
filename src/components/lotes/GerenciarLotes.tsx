'use client';

/**
 * Tela de lotes: tabela + cadastro e edição em modal.
 *
 * Antes a página empilhava o formulário de edição inteiro de cada lote, um
 * embaixo do outro. Com 200 lotes isso eram 200 formulários montados de uma
 * vez — a página não terminava de rolar, e achar um lote específico exigia
 * procurar com o Ctrl+F do navegador.
 *
 * A tabela mostra o que se olha (código, área, preço, situação) e guarda o que
 * se edita atrás de um clique. O formulário só existe no DOM quando alguém
 * abre o modal.
 */

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL, formatArea } from '@/lib/format';
import {
  NovoLoteForm,
  NovosLotesEmMassaForm,
  EditarLoteForm,
  type TipoLoteUI,
} from '@/components/LoteForms';
import {
  atualizarLote,
  criarLote,
  criarLotesEmMassa,
  excluirLote,
} from '@/app/admin/(dashboard)/loteamentos/[id]/lotes/actions';

export interface LoteLinha {
  id: string;
  codigo: string;
  quadra: string;
  area: number;
  preco: number;
  status: string;
  tipo: string;
  descricao: string | null;
  motivoBloqueio: string | null;
  orientacaoSolar: string | null;
  esquina: boolean;
  fronteAreaVerde: boolean;
  fotos: string[];
}

interface Filtros {
  quadra: string;
  numero: string;
  /** Id do tipo do simulador — casa pelo preço, que é o vínculo que existe. */
  tipoId: string;
  categoria: string;
  status: string;
  precoMin: string;
  precoMax: string;
  areaMin: string;
  areaMax: string;
  esquina: boolean;
  areaVerde: boolean;
}

const FILTRO_VAZIO: Filtros = {
  quadra: '',
  numero: '',
  tipoId: '',
  categoria: '',
  status: '',
  precoMin: '',
  precoMax: '',
  areaMin: '',
  areaMax: '',
  esquina: false,
  areaVerde: false,
};

/** Quantos critérios estão em uso — vira o número ao lado do botão. */
function contarFiltros(f: Filtros): number {
  return Object.entries(f).filter(([, v]) => (typeof v === 'boolean' ? v : v !== '')).length;
}

const num = (v: string): number | null => {
  const n = Number(String(v).replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : null;
};

const campoClass =
  'w-full min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function Campo({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{rotulo}</label>
      {children}
      {ajuda && <p className="text-[11px] text-slate-400 mt-1">{ajuda}</p>}
    </div>
  );
}

/** Linhas por página. 25 cabe numa tela sem rolar a lista inteira. */
const POR_PAGINA = 25;

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  DISPONIVEL: { texto: 'Disponível', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  RESERVADO: { texto: 'Reservado', classe: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  EM_PAGAMENTO: { texto: 'Em pagamento', classe: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  VENDIDO: { texto: 'Vendido', classe: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  BLOQUEADO: { texto: 'Bloqueado', classe: 'bg-red-50 text-red-700 ring-red-600/20' },
};

export function GerenciarLotes({
  loteamentoId,
  lotes,
  tipos,
}: {
  loteamentoId: string;
  lotes: LoteLinha[];
  tipos: TipoLoteUI[];
}) {
  const router = useRouter();
  const [cadastrando, setCadastrando] = useState(false);
  const [aba, setAba] = useState<'individual' | 'massa'>('individual');
  const [editando, setEditando] = useState<LoteLinha | null>(null);
  const [excluindo, iniciarExclusao] = useTransition();

  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(FILTRO_VAZIO);
  const [filtrando, setFiltrando] = useState(false);
  /** Cópia editável enquanto o modal está aberto: fechar sem aplicar não muda a tabela. */
  const [rascunho, setRascunho] = useState<Filtros>(FILTRO_VAZIO);

  const quadras = useMemo(
    () => Array.from(new Set(lotes.map((l) => l.quadra))).sort(),
    [lotes]
  );

  const visiveis = useMemo(() => {
    const f = filtros;
    // O tipo do simulador não é uma coluna do lote: o vínculo entre os dois é o
    // preço, que o cadastro copia do tipo escolhido. Comparar por ele é o mais
    // próximo de "lotes deste tipo" que os dados permitem.
    const precoDoTipo = f.tipoId ? tipos.find((t) => t.id === f.tipoId)?.preco ?? null : null;
    const pMin = num(f.precoMin);
    const pMax = num(f.precoMax);
    const aMin = num(f.areaMin);
    const aMax = num(f.areaMax);

    return lotes.filter((l) => {
      if (f.quadra && l.quadra !== f.quadra) return false;
      if (f.numero && !l.codigo.toLowerCase().includes(f.numero.trim().toLowerCase())) return false;
      if (precoDoTipo !== null && l.preco !== precoDoTipo) return false;
      if (f.categoria && l.tipo !== f.categoria) return false;
      if (f.status && l.status !== f.status) return false;
      if (pMin !== null && l.preco < pMin) return false;
      if (pMax !== null && l.preco > pMax) return false;
      if (aMin !== null && l.area < aMin) return false;
      if (aMax !== null && l.area > aMax) return false;
      if (f.esquina && !l.esquina) return false;
      if (f.areaVerde && !l.fronteAreaVerde) return false;
      return true;
    });
  }, [lotes, filtros, tipos]);

  const ativos = contarFiltros(filtros);

  /**
   * Paginação no cliente: os lotes já vieram todos na carga da página, então
   * fatiar aqui é instantâneo e não cobra outra ida ao banco. Vale enquanto um
   * loteamento tiver centenas de lotes; se chegar a milhares, o recorte precisa
   * subir para a consulta.
   */
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  // Filtrar encurta a lista e pode deixar a página atual sem conteúdo: em vez
  // de mostrar tabela vazia, cai na última que existe.
  const paginaAtual = Math.min(pagina, totalPaginas);
  const daPagina = visiveis.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRascunho(filtros);
              setFiltrando(true);
            }}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
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
              className="text-xs text-slate-500 hover:text-slate-800 transition"
            >
              Limpar
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setAba('individual');
            setCadastrando(true);
          }}
          className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition"
        >
          + Cadastrar lotes
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {visiveis.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {lotes.length === 0
              ? 'Nenhum lote cadastrado ainda.'
              : 'Nenhum lote atende aos filtros.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Código</th>
                  <th className="text-left font-medium px-5 py-2.5">Quadra</th>
                  <th className="text-right font-medium px-5 py-2.5">Área</th>
                  <th className="text-right font-medium px-5 py-2.5">Preço</th>
                  <th className="text-left font-medium px-5 py-2.5">Tipo</th>
                  <th className="text-center font-medium px-5 py-2.5">Situação</th>
                  <th className="text-right font-medium px-5 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daPagina.map((l) => {
                  const s = ROTULO_STATUS[l.status] ?? {
                    texto: l.status,
                    classe: 'bg-slate-100 text-slate-600 ring-slate-500/20',
                  };
                  const vendavel = l.status === 'DISPONIVEL' || l.status === 'RESERVADO';
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-2.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {l.codigo}
                      </td>
                      <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{l.quadra}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600 whitespace-nowrap">
                        {formatArea(l.area)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-900 whitespace-nowrap">
                        {formatBRL(l.preco)}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">
                        {l.tipo === 'COMERCIAL' ? 'Comercial' : 'Residencial'}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span
                          className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${s.classe}`}
                        >
                          {s.texto}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {vendavel && (
                            <Link
                              href={`/admin/vendas/novo?lote=${l.id}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 hover:bg-primary-50 transition"
                            >
                              Vender
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditando(l)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {visiveis.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {`${(paginaAtual - 1) * POR_PAGINA + 1}–${(paginaAtual - 1) * POR_PAGINA + daPagina.length}`}{' '}
            de {visiveis.length}
            {visiveis.length !== lotes.length && ` (${lotes.length} no total)`}
          </p>

          {totalPaginas > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------------------- Filtro -------------------- */}
      <Dialog open={filtrando} onOpenChange={setFiltrando}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filtrar lotes</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFiltros(rascunho);
              // Sem isto, aplicar um filtro estando na página 5 mostraria uma
              // tabela vazia até a pessoa perceber que precisa voltar.
              setPagina(1);
              setFiltrando(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Quadra">
                <select
                  value={rascunho.quadra}
                  onChange={(e) => setRascunho({ ...rascunho, quadra: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  {quadras.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Código ou número">
                <input
                  value={rascunho.numero}
                  onChange={(e) => setRascunho({ ...rascunho, numero: e.target.value })}
                  placeholder="A-01, 07…"
                  className={campoClass}
                />
              </Campo>

              {/* Só existe para quem cadastrou tipos no simulador. */}
              {tipos.length > 0 && (
                <Campo
                  rotulo="Tipo do simulador"
                  ajuda="Casa pelo preço do tipo, que é o vínculo entre os dois."
                >
                  <select
                    value={rascunho.tipoId}
                    onChange={(e) => setRascunho({ ...rascunho, tipoId: e.target.value })}
                    className={campoClass}
                  >
                    <option value="">Todos</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} — {formatBRL(t.preco)}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}

              <Campo rotulo="Categoria">
                <select
                  value={rascunho.categoria}
                  onChange={(e) => setRascunho({ ...rascunho, categoria: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  <option value="RESIDENCIAL">Residencial</option>
                  <option value="COMERCIAL">Comercial</option>
                </select>
              </Campo>

              <Campo rotulo="Situação">
                <select
                  value={rascunho.status}
                  onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  {Object.entries(ROTULO_STATUS).map(([valor, s]) => (
                    <option key={valor} value={valor}>
                      {s.texto}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo rotulo="Preço (R$)">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={rascunho.precoMin}
                    onChange={(e) => setRascunho({ ...rascunho, precoMin: e.target.value })}
                    placeholder="mínimo"
                    className={campoClass}
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="number"
                    step="0.01"
                    value={rascunho.precoMax}
                    onChange={(e) => setRascunho({ ...rascunho, precoMax: e.target.value })}
                    placeholder="máximo"
                    className={campoClass}
                  />
                </div>
              </Campo>

              <Campo rotulo="Área (m²)">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={rascunho.areaMin}
                    onChange={(e) => setRascunho({ ...rascunho, areaMin: e.target.value })}
                    placeholder="mínima"
                    className={campoClass}
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="number"
                    step="0.01"
                    value={rascunho.areaMax}
                    onChange={(e) => setRascunho({ ...rascunho, areaMax: e.target.value })}
                    placeholder="máxima"
                    className={campoClass}
                  />
                </div>
              </Campo>

              <Campo rotulo="Características">
                <div className="flex flex-wrap items-center gap-4 pt-1.5">
                  <label className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={rascunho.esquina}
                      onChange={(e) => setRascunho({ ...rascunho, esquina: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Esquina
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={rascunho.areaVerde}
                      onChange={(e) => setRascunho({ ...rascunho, areaVerde: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Frente p/ área verde
                  </label>
                </div>
              </Campo>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => setRascunho(FILTRO_VAZIO)}
                className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
              >
                Limpar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------------------- Cadastro -------------------- */}
      <Dialog open={cadastrando} onOpenChange={setCadastrando}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cadastrar lotes</DialogTitle>
          </DialogHeader>

          {/* Duas formas de cadastrar o mesmo objeto: uma quadra inteira de uma
              vez, ou um lote com todos os detalhes. Abas em vez de dois
              formulários lado a lado — quem cadastra faz um ou outro. */}
          <div className="flex gap-1 border-b border-slate-200">
            {(
              [
                ['individual', 'Lote individual'],
                ['massa', 'Em massa'],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setAba(valor)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  aba === valor
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pt-1">
            {aba === 'individual' ? (
              <NovoLoteForm
                embutido
                tipos={tipos}
                action={criarLote.bind(null, loteamentoId)}
              />
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Cadastra uma quadra inteira de uma vez. Todos os lotes saem com a mesma
                  área e preço — ajuste depois os que fugirem do padrão.
                </p>
                <NovosLotesEmMassaForm
                  embutido
                  tipos={tipos}
                  action={criarLotesEmMassa.bind(null, loteamentoId)}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------- Edição -------------------- */}
      <Dialog open={editando !== null} onOpenChange={(a) => !a && setEditando(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lote {editando?.codigo}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="max-h-[65vh] overflow-y-auto">
              <EditarLoteForm
                embutido
                tipos={tipos}
                loteId={editando.id}
                initial={{
                  area: editando.area,
                  preco: editando.preco,
                  descricao: editando.descricao,
                  status: editando.status,
                  motivoBloqueio: editando.motivoBloqueio,
                  orientacaoSolar: editando.orientacaoSolar,
                  esquina: editando.esquina,
                  fronteAreaVerde: editando.fronteAreaVerde,
                  fotos: editando.fotos,
                }}
                action={atualizarLote.bind(null, editando.id)}
                onDelete={async () => {
                  const alvo = editando.id;
                  iniciarExclusao(async () => {
                    await excluirLote(alvo);
                    setEditando(null);
                    router.refresh();
                  });
                }}
              />
              {excluindo && <p className="mt-2 text-xs text-slate-500">Excluindo…</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
