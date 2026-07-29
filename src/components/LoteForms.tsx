'use client';

import { useFormState, useFormStatus } from 'react-dom';

type FormState = { error?: string; ok?: boolean; criados?: number };

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg"
    >
      {pending ? loadingLabel ?? 'Salvando...' : label}
    </button>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm';

// =====================================================================
// CRIAR LOTE INDIVIDUAL
// =====================================================================

export function NovoLoteForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900 mb-3">Adicionar lote individual</h3>

      {state.error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          Lote criado.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Quadra *</label>
          <input name="quadra" required className={inputClass} placeholder="A" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Número *</label>
          <input name="numero" required className={inputClass} placeholder="01" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Área (m²) *</label>
          <input name="area" type="number" step="0.01" required className={inputClass} placeholder="300.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Preço (R$) *</label>
          <input name="preco" type="number" step="0.01" required className={inputClass} placeholder="120000.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Testada (m)</label>
          <input name="testada" type="number" step="0.01" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fundo (m)</label>
          <input name="fundo" type="number" step="0.01" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Orientação solar</label>
          <select name="orientacaoSolar" className={inputClass} defaultValue="">
            <option value="">—</option>
            <option value="NORTE">Norte</option>
            <option value="SUL">Sul</option>
            <option value="LESTE">Leste</option>
            <option value="OESTE">Oeste</option>
            <option value="NORDESTE">Nordeste</option>
            <option value="NOROESTE">Noroeste</option>
            <option value="SUDESTE">Sudeste</option>
            <option value="SUDOESTE">Sudoeste</option>
          </select>
        </div>
        <div className="flex items-end gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="esquina" type="checkbox" className="rounded" />
            <span>Esquina</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="fronteAreaVerde" type="checkbox" className="rounded" />
            <span>Frente p/ área verde</span>
          </label>
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
          <input name="descricao" className={inputClass} placeholder="Observações adicionais" />
        </div>
      </div>

      <SubmitButton label="Adicionar lote" loadingLabel="Criando..." />
    </form>
  );
}

// =====================================================================
// CRIAR LOTES EM MASSA
// =====================================================================

export function NovosLotesEmMassaForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900 mb-1">Criar lotes em massa</h3>
      <p className="text-xs text-slate-500 mb-3">
        Útil para cadastrar uma quadra inteira de uma vez. Todos os lotes terão a mesma área e preço — ajuste individualmente depois se necessário.
      </p>

      {state.error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          {state.criados} lote(s) criado(s).
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Quadra *</label>
          <input name="quadra" required className={inputClass} placeholder="A" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nº inicial *</label>
          <input name="numeroInicial" type="number" min="1" defaultValue="1" required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Quantidade *</label>
          <input name="quantidade" type="number" min="1" max="200" defaultValue="20" required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Área (m²) *</label>
          <input name="area" type="number" step="0.01" required className={inputClass} placeholder="300.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Preço (R$) *</label>
          <input name="preco" type="number" step="0.01" required className={inputClass} placeholder="120000.00" />
        </div>
      </div>

      <SubmitButton label="Criar lotes em massa" loadingLabel="Criando..." />
    </form>
  );
}

// =====================================================================
// EDITAR LOTE
// =====================================================================

export function EditarLoteForm({
  loteId,
  initial,
  action,
  onDelete,
}: {
  loteId: string;
  initial: {
    area: number;
    preco: number;
    descricao: string | null;
    status: string;
    motivoBloqueio: string | null;
    orientacaoSolar: string | null;
    esquina: boolean;
    fronteAreaVerde: boolean;
    fotos: string[];
  };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onDelete: () => Promise<void>;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <form action={formAction} className="space-y-3">
        {state.error && (
          <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            Atualizado.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Área (m²)</label>
            <input name="area" type="number" step="0.01" defaultValue={initial.area} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Preço (R$)</label>
            <input name="preco" type="number" step="0.01" defaultValue={initial.preco} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select name="status" defaultValue={initial.status} className={inputClass}>
              <option value="DISPONIVEL">Disponível</option>
              <option value="RESERVADO">Reservado</option>
              <option value="EM_PAGAMENTO">Em pagamento</option>
              <option value="VENDIDO">Vendido</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Orientação</label>
            <select name="orientacaoSolar" defaultValue={initial.orientacaoSolar ?? ''} className={inputClass}>
              <option value="">—</option>
              <option value="NORTE">Norte</option>
              <option value="SUL">Sul</option>
              <option value="LESTE">Leste</option>
              <option value="OESTE">Oeste</option>
              <option value="NORDESTE">Nordeste</option>
              <option value="NOROESTE">Noroeste</option>
              <option value="SUDESTE">Sudeste</option>
              <option value="SUDOESTE">Sudoeste</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Motivo do bloqueio (se status = Bloqueado)</label>
          <input
            name="motivoBloqueio"
            defaultValue={initial.motivoBloqueio ?? ''}
            className={inputClass}
            placeholder="Ex: reserva interna, manutenção"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="esquina" type="checkbox" defaultChecked={initial.esquina} className="rounded" />
            <span>Esquina</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="fronteAreaVerde" type="checkbox" defaultChecked={initial.fronteAreaVerde} className="rounded" />
            <span>Frente para área verde</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fotos (uma URL por linha)</label>
          <textarea
            name="fotos"
            defaultValue={initial.fotos.join('\n')}
            rows={2}
            className={inputClass}
            placeholder="https://exemplo.com/foto1.jpg"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
          <input name="descricao" defaultValue={initial.descricao ?? ''} className={inputClass} />
        </div>

        <SubmitButton label="Salvar" />
      </form>

      <form action={onDelete} className="mt-3 pt-3 border-t border-slate-100">
        <button
          type="submit"
          className="text-xs text-red-600 hover:text-red-700 font-medium"
          onClick={(e) => {
            if (!confirm('Excluir este lote? A ação é irreversível.')) e.preventDefault();
          }}
        >
          Excluir lote
        </button>
      </form>
    </div>
  );
}
