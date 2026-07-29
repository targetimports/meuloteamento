'use client';

import { useFormState } from 'react-dom';
import { SubmitButton, ErrorBox, inputClass } from './ui';

type FormState = { error?: string; ok?: boolean };

interface TabelaInitial {
  nome: string;
  descricao: string | null;
  descontoPct: number | null;
  entradaPct: number | null;
  parcelasMin: number;
  parcelasMax: number;
  ativo: boolean;
  ordem: number;
}

export function NovaTabelaForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-slate-900">Nova condição de pagamento</h3>
      <ErrorBox message={state.error} />
      {state.ok && (
        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          Tabela criada.
        </div>
      )}

      <FormFields />
      <SubmitButton label="Criar tabela" />
    </form>
  );
}

export function EditarTabelaForm({
  initial,
  action,
  onDelete,
}: {
  initial: TabelaInitial;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onDelete: () => Promise<void>;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <form action={formAction} className="space-y-3">
        <ErrorBox message={state.error} />
        {state.ok && (
          <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            Atualizada.
          </div>
        )}
        <FormFields initial={initial} />
        <div className="flex gap-3">
          <SubmitButton label="Salvar" />
        </div>
      </form>
      <form action={onDelete} className="mt-3 pt-3 border-t border-slate-100">
        <button
          type="submit"
          className="text-xs text-red-600 hover:text-red-700 font-medium"
          onClick={(e) => {
            if (!confirm('Excluir esta tabela?')) e.preventDefault();
          }}
        >
          Excluir tabela
        </button>
      </form>
    </div>
  );
}

function FormFields({ initial }: { initial?: TabelaInitial }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nome *</label>
          <input
            name="nome"
            required
            defaultValue={initial?.nome ?? ''}
            className={inputClass}
            placeholder="Ex: À vista, 60x sem entrada"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Ordem</label>
          <input
            name="ordem"
            type="number"
            defaultValue={initial?.ordem ?? 0}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
        <input
          name="descricao"
          defaultValue={initial?.descricao ?? ''}
          className={inputClass}
          placeholder="Detalhes desta condição"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Desconto (%)</label>
          <input
            name="descontoPct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={initial?.descontoPct ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Entrada mín. (%)</label>
          <input
            name="entradaPct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={initial?.entradaPct ?? ''}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Parcelas mín.</label>
          <input
            name="parcelasMin"
            type="number"
            min="1"
            defaultValue={initial?.parcelasMin ?? 1}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Parcelas máx.</label>
          <input
            name="parcelasMax"
            type="number"
            min="1"
            defaultValue={initial?.parcelasMax ?? 1}
            required
            className={inputClass}
          />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          name="ativo"
          type="checkbox"
          defaultChecked={initial?.ativo ?? true}
          className="rounded"
        />
        Tabela ativa (visível no site)
      </label>
    </>
  );
}
