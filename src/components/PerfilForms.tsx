'use client';

import { useFormState } from 'react-dom';
import { Field, SubmitButton, ErrorBox, SuccessBox, inputClass } from './ui';

type FormState = { error?: string; ok?: string };

interface Props {
  initial: { nome: string; email: string; role: string };
  atualizarPerfilAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  trocarSenhaAction: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function PerfilForms({ initial, atualizarPerfilAction, trocarSenhaAction }: Props) {
  const [perfilState, perfilAction] = useFormState<FormState, FormData>(atualizarPerfilAction, {});
  const [senhaState, senhaAction] = useFormState<FormState, FormData>(trocarSenhaAction, {});

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Dados</h2>
        <p className="text-xs text-slate-500 mb-4">
          Função: <span className="font-medium text-slate-700">{initial.role}</span>
        </p>

        <form action={perfilAction} className="space-y-4">
          <ErrorBox message={perfilState.error} />
          {perfilState.ok && <SuccessBox message={perfilState.ok} />}

          <Field label="Nome" required>
            <input name="nome" defaultValue={initial.nome} required className={inputClass} />
          </Field>
          <Field label="E-mail" required>
            <input name="email" type="email" defaultValue={initial.email} required className={inputClass} />
          </Field>

          <SubmitButton label="Salvar perfil" />
        </form>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Trocar senha</h2>

        <form action={senhaAction} className="space-y-4">
          <ErrorBox message={senhaState.error} />
          {senhaState.ok && <SuccessBox message={senhaState.ok} />}

          <Field label="Senha atual" required>
            <input
              name="senhaAtual"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Nova senha" required hint="Mínimo 8 caracteres.">
            <input
              name="novaSenha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Confirmar nova senha" required>
            <input
              name="confirmar"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </Field>

          <SubmitButton label="Trocar senha" />
        </form>
      </section>
    </div>
  );
}
