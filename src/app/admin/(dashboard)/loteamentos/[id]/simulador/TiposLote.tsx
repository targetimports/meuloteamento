'use client';

/**
 * Tipos de lote do simulador: lista, ordem e cadastro em modal.
 *
 * A ordem importa mais do que parece — é a ordem das abas que o visitante vê,
 * e a primeira abre por padrão. Por isso mover está na própria linha, não
 * escondido dentro do modal de edição.
 */

import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPortal } from 'react-dom';

export interface TipoUI {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  entradaMinima: string;
  parcelas: number;
  valorParcela: string;
  entradasSugeridas: string;
  simulavel: boolean;
  ativo: boolean;
}

type Estado = { ok?: boolean; error?: string };

interface Props {
  loteamentoId: string;
  tipos: TipoUI[];
  salvarAction: (loteamentoId: string, prev: Estado, fd: FormData) => Promise<Estado>;
  excluirAction: (loteamentoId: string, tipoId: string) => Promise<void>;
  alternarAction: (loteamentoId: string, tipoId: string) => Promise<void>;
  moverAction: (loteamentoId: string, tipoId: string, direcao: 'cima' | 'baixo') => Promise<void>;
}

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

const brl = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function BotaoSalvar({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando…' : editando ? 'Salvar tipo' : 'Adicionar tipo'}
    </button>
  );
}

export function TiposLote({
  loteamentoId,
  tipos,
  salvarAction,
  excluirAction,
  alternarAction,
  moverAction,
}: Props) {
  const [modal, setModal] = useState<{ editando?: TipoUI } | null>(null);
  const [montado, setMontado] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erroLinha, setErroLinha] = useState<string | null>(null);

  const editando = modal?.editando;
  const [estado, formAction] = useFormState<Estado, FormData>(
    salvarAction.bind(null, loteamentoId),
    {}
  );

  // Simulável controla quais campos aparecem: um tipo "sob consulta" não tem
  // parcela para configurar.
  const [simulavel, setSimulavel] = useState(true);

  useEffect(() => setMontado(true), []);
  useEffect(() => {
    if (estado.ok) setModal(null);
  }, [estado.ok]);

  useEffect(() => {
    if (!modal) return;
    setSimulavel(modal.editando ? modal.editando.simulavel : true);
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setModal(null);
    }
    document.addEventListener('keydown', onTecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = antes;
    };
  }, [modal]);

  function executar(fn: () => Promise<void>) {
    setErroLinha(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setErroLinha(e instanceof Error ? e.message : 'Não foi possível concluir.');
      }
    });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Tipos de lote</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cada tipo vira uma aba no simulador, na ordem abaixo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({})}
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
        >
          + Adicionar tipo
        </button>
      </div>

      {erroLinha && (
        <p className="mx-5 mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {erroLinha}
        </p>
      )}

      {tipos.length === 0 ? (
        <div className="py-12 px-5 text-center">
          <p className="text-sm text-slate-500">Nenhum tipo cadastrado.</p>
          <p className="text-xs text-slate-400 mt-1">
            Sem tipos, o simulador usa a condição única configurada abaixo.
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${pending ? 'opacity-60 pointer-events-none' : ''} transition`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-5 py-2.5 w-16">Ordem</th>
                <th className="text-left font-medium px-5 py-2.5">Tipo</th>
                <th className="text-right font-medium px-5 py-2.5">Preço</th>
                <th className="text-left font-medium px-5 py-2.5">Condição</th>
                <th className="text-center font-medium px-5 py-2.5">Situação</th>
                <th className="text-right font-medium px-5 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tipos.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => executar(() => moverAction(loteamentoId, t.id, 'cima'))}
                        disabled={i === 0}
                        title="Mover para cima"
                        className="px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => executar(() => moverAction(loteamentoId, t.id, 'baixo'))}
                        disabled={i === tipos.length - 1}
                        title="Mover para baixo"
                        className="px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{t.nome}</p>
                    {t.descricao && (
                      <p className="text-xs text-slate-500 mt-0.5">{t.descricao}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-900 whitespace-nowrap">
                    {brl(t.preco)}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {t.simulavel ? (
                      <>
                        Entrada {brl(t.entradaMinima)}
                        <span className="block text-slate-400">
                          {t.parcelas}x de {brl(t.valorParcela)}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">Sob consulta — sem simulação</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => executar(() => alternarAction(loteamentoId, t.id))}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset transition ${
                        t.ativo
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 ring-slate-500/20 hover:bg-slate-200'
                      }`}
                      title={t.ativo ? 'Visível no site — clique para ocultar' : 'Oculto — clique para exibir'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {t.ativo ? 'Visível' : 'Oculto'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModal({ editando: t })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => executar(() => excluirAction(loteamentoId, t.id))}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* -------------------- Modal -------------------- */}
      {montado &&
        modal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={editando ? `Editar ${editando.nome}` : 'Adicionar tipo de lote'}
          >
            <div
              className="modal-fundo absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              onClick={() => setModal(null)}
              aria-hidden
            />
            <div
              className="modal-painel relative w-full sm:max-w-[540px] max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5"
              style={{
                boxShadow: '0 1px 3px rgba(15,23,42,.08), 0 24px 48px -12px rgba(15,23,42,.25)',
              }}
            >
              <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100">
                <h2 className="text-[17px] font-semibold text-slate-900">
                  {editando ? editando.nome : 'Novo tipo de lote'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  O nome vira o rótulo da aba que o visitante vê.
                </p>
              </div>

              <form action={formAction} className="p-6">
                {editando && <input type="hidden" name="id" value={editando.id} />}

                {estado.error && (
                  <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {estado.error}
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="nome" className="block text-xs font-medium text-slate-600 mb-1">
                      Nome *
                    </label>
                    <input
                      id="nome"
                      name="nome"
                      required
                      defaultValue={editando?.nome ?? ''}
                      placeholder="Residencial"
                      className={campo}
                    />
                  </div>
                  <div>
                    <label htmlFor="descricao" className="block text-xs font-medium text-slate-600 mb-1">
                      Descrição
                    </label>
                    <input
                      id="descricao"
                      name="descricao"
                      defaultValue={editando?.descricao ?? ''}
                      placeholder="300 a 400 m²"
                      className={campo}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="preco" className="block text-xs font-medium text-slate-600 mb-1">
                      Preço à vista (R$) *
                    </label>
                    <input
                      id="preco"
                      name="preco"
                      required
                      inputMode="decimal"
                      defaultValue={editando?.preco ?? ''}
                      placeholder="50000"
                      className={campo}
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        name="simulavel"
                        checked={simulavel}
                        onChange={(e) => setSimulavel(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Permitir simular parcelas neste tipo
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Desmarcado, a aba mostra o preço e leva ao contato — para
                      lote negociado caso a caso.
                    </p>
                  </div>

                  {simulavel && (
                    <>
                      <div>
                        <label htmlFor="entradaMinima" className="block text-xs font-medium text-slate-600 mb-1">
                          Entrada mínima (R$) *
                        </label>
                        <input
                          id="entradaMinima"
                          name="entradaMinima"
                          inputMode="decimal"
                          defaultValue={editando?.entradaMinima ?? ''}
                          placeholder="1000"
                          className={campo}
                        />
                      </div>
                      <div>
                        <label htmlFor="parcelas" className="block text-xs font-medium text-slate-600 mb-1">
                          Prazo máximo (parcelas) *
                        </label>
                        <input
                          id="parcelas"
                          name="parcelas"
                          inputMode="numeric"
                          defaultValue={editando?.parcelas || ''}
                          placeholder="60"
                          className={campo}
                        />
                      </div>
                      <div>
                        <label htmlFor="valorParcela" className="block text-xs font-medium text-slate-600 mb-1">
                          Parcela nessa condição (R$) *
                        </label>
                        <input
                          id="valorParcela"
                          name="valorParcela"
                          inputMode="decimal"
                          defaultValue={editando?.valorParcela ?? ''}
                          placeholder="1000"
                          className={campo}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Junto com preço e entrada, define o juro embutido.
                        </p>
                      </div>
                      <div>
                        <label htmlFor="entradasSugeridas" className="block text-xs font-medium text-slate-600 mb-1">
                          Atalhos de entrada
                        </label>
                        <input
                          id="entradasSugeridas"
                          name="entradasSugeridas"
                          defaultValue={editando?.entradasSugeridas ?? ''}
                          placeholder="5000, 10000, 20000"
                          className={campo}
                        />
                      </div>
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ativo"
                        defaultChecked={editando ? editando.ativo : true}
                        className="rounded border-slate-300"
                      />
                      Visível no site
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100">
                  <BotaoSalvar editando={Boolean(editando)} />
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
