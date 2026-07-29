'use client';

import { useFormState } from 'react-dom';
import { Section, Field, SubmitButton, ErrorBox, SuccessBox, inputClass } from './ui';

interface CorretorInitial {
  nome?: string;
  email?: string;
  telefone?: string | null;
  cpfCnpj?: string | null;
  creci?: string | null;
  comissaoPadrao?: number;
  ativo?: boolean;
  observacoes?: string | null;
}

type FormState = { error?: string; ok?: boolean };

export function CorretorForm({
  action,
  initial,
  submitLabel = 'Salvar',
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: CorretorInitial;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <ErrorBox message={state.error} />
      {state.ok && <SuccessBox message="Alterações salvas." />}

      <Section title="Dados do corretor">
        <Field label="Nome completo" required wide>
          <input name="nome" defaultValue={initial?.nome ?? ''} required className={inputClass} />
        </Field>
        <Field label="E-mail" required>
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ''}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Telefone">
          <input name="telefone" defaultValue={initial?.telefone ?? ''} className={inputClass} />
        </Field>
        <Field label="CPF / CNPJ">
          <input name="cpfCnpj" defaultValue={initial?.cpfCnpj ?? ''} className={inputClass} />
        </Field>
        <Field label="CRECI">
          <input name="creci" defaultValue={initial?.creci ?? ''} className={inputClass} />
        </Field>
      </Section>

      <Section title="Comissão">
        <Field label="% padrão por venda" hint="Pode ser sobrescrito em cada venda.">
          <input
            name="comissaoPadrao"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={initial?.comissaoPadrao ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Ativo">
          <label className="inline-flex items-center gap-2">
            <input name="ativo" type="checkbox" defaultChecked={initial?.ativo ?? true} className="rounded" />
            <span className="text-sm text-slate-700">Recebe novas vendas</span>
          </label>
        </Field>
        <Field label="Observações" wide>
          <textarea
            name="observacoes"
            rows={3}
            defaultValue={initial?.observacoes ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
