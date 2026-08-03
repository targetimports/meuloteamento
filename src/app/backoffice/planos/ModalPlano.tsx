'use client';

/**
 * Cadastro e edição de plano num modal.
 *
 * O formulário estava fixo abaixo da tabela, competindo com ela por atenção
 * numa tela que é, antes de tudo, uma lista. No modal ele aparece quando é
 * chamado e some quando termina.
 *
 * O mesmo componente serve para criar e editar — a única diferença é o
 * registro que chega em `plano`. Dois componentes quase iguais divergiriam
 * no primeiro campo novo que alguém esquecesse de adicionar nos dois.
 */

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPortal } from 'react-dom';
import type { EstadoPlano } from './actions';

export interface PlanoParaEditar {
  id: string;
  nome: string;
  descricao: string | null;
  valorMensal: string;
  maxLoteamentos: number | null;
  maxLotes: number | null;
  maxUsuarios: number | null;
  ativo: boolean;
}

interface Props {
  action: (prev: EstadoPlano, formData: FormData) => Promise<EstadoPlano>;
  plano?: PlanoParaEditar;
  /** Como o gatilho aparece: botão sólido no topo ou link discreto na linha. */
  variante?: 'primario' | 'linha';
}

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function Botao({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar plano'}
    </button>
  );
}

export function ModalPlano({ action, plano, variante = 'primario' }: Props) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [estado, formAction] = useFormState<EstadoPlano, FormData>(action, {});
  const primeiroCampo = useRef<HTMLInputElement>(null);
  const editando = Boolean(plano);

  useEffect(() => setMontado(true), []);

  // Fecha sozinho quando a action confirma. Sem isto o modal ficaria aberto
  // sobre uma tabela já atualizada, e a pessoa não saberia se salvou.
  useEffect(() => {
    if (estado.ok) setAberto(false);
  }, [estado.ok]);

  useEffect(() => {
    if (!aberto) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('keydown', onTecla);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primeiroCampo.current?.focus();
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberto]);

  const gatilho =
    variante === 'primario' ? (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
      >
        + Cadastrar plano
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
      >
        Editar
      </button>
    );

  return (
    <>
      {gatilho}

      {montado &&
        aberto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={editando ? `Editar plano ${plano?.nome}` : 'Cadastrar plano'}
          >
            <div
              className="modal-fundo absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              onClick={() => setAberto(false)}
              aria-hidden
            />

            <div
              className="modal-painel relative w-full sm:max-w-[560px] max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5"
              style={{
                boxShadow:
                  '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
              }}
            >
              <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-semibold text-slate-900 leading-tight">
                      {editando ? plano?.nome : 'Novo plano'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {editando
                        ? 'Alterar aqui não muda os valores já cobrados nas assinaturas.'
                        : 'Preço e limites que as empresas-cliente vão assinar.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar"
                    className="flex-shrink-0 -mr-1.5 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              <form action={formAction} className="p-6">
                {plano?.id && <input type="hidden" name="id" value={plano.id} />}

                {estado.error && (
                  <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {estado.error}
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="nome" className="block text-xs font-medium text-slate-600 mb-1">
                      Nome *
                    </label>
                    <input
                      id="nome"
                      ref={primeiroCampo}
                      name="nome"
                      required
                      defaultValue={plano?.nome ?? ''}
                      placeholder="Profissional"
                      className={campo}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="descricao" className="block text-xs font-medium text-slate-600 mb-1">
                      Descrição
                    </label>
                    <input
                      id="descricao"
                      name="descricao"
                      defaultValue={plano?.descricao ?? ''}
                      placeholder="O escolhido por quem leva a sério"
                      className={campo}
                    />
                  </div>

                  <div>
                    <label htmlFor="valorMensal" className="block text-xs font-medium text-slate-600 mb-1">
                      Mensalidade (R$) *
                    </label>
                    <input
                      id="valorMensal"
                      name="valorMensal"
                      required
                      inputMode="decimal"
                      defaultValue={plano?.valorMensal ?? ''}
                      placeholder="500,00"
                      className={campo}
                    />
                  </div>

                  <div className="flex items-end pb-2.5">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ativo"
                        defaultChecked={plano ? plano.ativo : true}
                        className="rounded border-slate-300"
                      />
                      Disponível para contratação
                    </label>
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-600 mb-3">
                      Limites{' '}
                      <span className="font-normal text-slate-400">
                        — deixe vazio para ilimitado
                      </span>
                    </p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label htmlFor="maxLoteamentos" className="block text-xs text-slate-500 mb-1">
                          Loteamentos
                        </label>
                        <input
                          id="maxLoteamentos"
                          name="maxLoteamentos"
                          inputMode="numeric"
                          defaultValue={plano?.maxLoteamentos ?? ''}
                          placeholder="∞"
                          className={campo}
                        />
                      </div>
                      <div>
                        <label htmlFor="maxLotes" className="block text-xs text-slate-500 mb-1">
                          Lotes
                        </label>
                        <input
                          id="maxLotes"
                          name="maxLotes"
                          inputMode="numeric"
                          defaultValue={plano?.maxLotes ?? ''}
                          placeholder="∞"
                          className={campo}
                        />
                      </div>
                      <div>
                        <label htmlFor="maxUsuarios" className="block text-xs text-slate-500 mb-1">
                          Usuários
                        </label>
                        <input
                          id="maxUsuarios"
                          name="maxUsuarios"
                          inputMode="numeric"
                          defaultValue={plano?.maxUsuarios ?? ''}
                          placeholder="∞"
                          className={campo}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100">
                  <Botao editando={editando} />
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
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
    </>
  );
}
