'use client';

import { useFormState } from 'react-dom';
import { Field, SubmitButton, ErrorBox, SuccessBox, inputClass } from './ui';

type FormState = { error?: string; ok?: boolean };

interface Props {
  initial: {
    status: string;
    corretorId: string | null;
    observacoesInternas: string | null;
  };
  corretores: { id: string; nome: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function LeadAtualizarForm({ initial, corretores, action }: Props) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBox message={state.error} />
      {state.ok && <SuccessBox message="Lead atualizado." />}

      <Field label="Status">
        <select name="status" defaultValue={initial.status} className={inputClass}>
          <option value="NOVO">Novo</option>
          <option value="EM_ATENDIMENTO">Em atendimento</option>
          <option value="AGENDADO">Agendado</option>
          <option value="CONVERTIDO">Convertido</option>
          <option value="PERDIDO">Perdido</option>
        </select>
      </Field>

      <Field label="Corretor responsável">
        <select name="corretorId" defaultValue={initial.corretorId ?? ''} className={inputClass}>
          <option value="">— Não atribuído —</option>
          {corretores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Observações internas">
        <textarea
          name="observacoesInternas"
          rows={4}
          defaultValue={initial.observacoesInternas ?? ''}
          className={inputClass}
          placeholder="Notas privadas do time comercial..."
        />
      </Field>

      <SubmitButton label="Atualizar" />
    </form>
  );
}
