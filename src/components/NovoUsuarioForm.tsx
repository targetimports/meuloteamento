'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Field, SubmitButton, ErrorBox, inputClass } from './ui';

type FormState = {
  error?: string;
  ok?: boolean;
  senhaGerada?: string;
  emailCriado?: string;
};

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function NovoUsuarioForm({ action }: Props) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    if (!state.senhaGerada || !state.emailCriado) return;
    const texto = `URL: https://meuloteamento.com/admin/login\nE-mail: ${state.emailCriado}\nSenha: ${state.senhaGerada}`;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    });
  }

  if (state.ok && state.senhaGerada) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">✓</span>
          <div>
            <h4 className="font-bold text-emerald-900 mb-1">Usuário criado com sucesso</h4>
            <p className="text-sm text-emerald-800">
              Envie estas credenciais ao usuário. <strong>A senha só aparece agora</strong> —
              depois disso, só dá pra resetar.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-emerald-300 space-y-2 text-sm font-mono">
          <div>
            <span className="text-slate-500 text-xs uppercase tracking-wider">URL: </span>
            <span className="text-slate-900">https://meuloteamento.com/admin/login</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs uppercase tracking-wider">E-mail: </span>
            <span className="text-slate-900">{state.emailCriado}</span>
          </div>
          <div>
            <span className="text-slate-500 text-xs uppercase tracking-wider">Senha: </span>
            <span className="text-emerald-700 font-bold">{state.senhaGerada}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={copiar}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {copiado ? '✓ Copiado!' : '📋 Copiar credenciais'}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
          >
            Criar outro usuário
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div>
        <h4 className="font-bold text-slate-900">Adicionar usuário</h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Uma senha temporária será gerada automaticamente. Compartilhe com a pessoa pelo seu canal preferido.
        </p>
      </div>

      <ErrorBox message={state.error} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nome" required>
          <input name="nome" required minLength={2} className={inputClass} placeholder="João da Silva" />
        </Field>
        <Field label="E-mail" required>
          <input
            name="email"
            type="email"
            required
            className={inputClass}
            placeholder="joao@empresa.com.br"
          />
        </Field>
      </div>
      <Field label="Papel">
        <select name="role" defaultValue="ADMIN" className={inputClass}>
          <option value="ADMIN">Admin — acesso total à loteadora</option>
          <option value="OPERADOR">Operador — operação do dia a dia</option>
          <option value="FINANCEIRO">Financeiro — vendas e parcelas</option>
        </select>
      </Field>

      <SubmitButton label="Criar usuário e gerar senha" loadingLabel="Criando..." />
    </form>
  );
}
