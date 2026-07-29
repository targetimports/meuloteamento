'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

type State = { ok?: boolean; error?: string; mensagem?: string };

export function SenhaVendaSemEntradaForm({
  action,
  jaTemSenha,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  jaTemSenha: boolean;
}) {
  const [state, formAction] = useFormState<State, FormData>(action, {});
  const [mostrar, setMostrar] = useState(false);

  return (
    <section className="bg-white border border-amber-200 rounded-xl p-6">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-bold text-slate-900 flex items-center gap-2">
          🔐 Senha de autorização — venda SEM entrada
        </h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            jaTemSenha
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {jaTemSenha ? '✓ Definida' : '✗ Não definida — vendas sem entrada bloqueadas'}
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-4">
        Quando essa senha está definida, o admin pode lançar uma venda com{' '}
        <strong>entrada R$ 0,00</strong> desde que digite essa senha no formulário.
        Sem ela, o sistema bloqueia. Nesses casos as parcelas usam o{' '}
        <strong>valor total do lote</strong> como base (sem subtração de entrada).
      </p>

      {state.mensagem && (
        <div className="p-3 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          ✓ {state.mensagem}
        </div>
      )}
      {state.error && (
        <div className="p-3 mb-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          ⚠ {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="acao" value="set" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {jaTemSenha ? 'Nova senha' : 'Senha'}
            </label>
            <input
              type={mostrar ? 'text' : 'password'}
              name="senha"
              minLength={4}
              maxLength={120}
              autoComplete="new-password"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
              placeholder="Mínimo 4 caracteres"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirme a senha
            </label>
            <input
              type={mostrar ? 'text' : 'password'}
              name="senhaConfirma"
              minLength={4}
              maxLength={120}
              autoComplete="new-password"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
              required
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrar}
            onChange={(e) => setMostrar(e.target.checked)}
            className="rounded"
          />
          Mostrar senha
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <SubmitBtn label={jaTemSenha ? 'Atualizar senha' : 'Definir senha'} />
          {jaTemSenha && (
            <RemoverForm action={formAction} />
          )}
        </div>
      </form>
    </section>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
    >
      {pending ? 'Salvando…' : label}
    </button>
  );
}

function RemoverForm({
  action,
}: {
  action: (fd: FormData) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (
          confirm(
            'Remover a senha? Após remover, NENHUM admin conseguirá lançar venda sem entrada — vai precisar redefinir.'
          )
        ) {
          const fd = new FormData();
          fd.set('acao', 'remover');
          action(fd);
        }
      }}
      className="bg-white border border-red-300 hover:bg-red-50 text-red-700 text-sm font-medium px-3 py-2 rounded-lg"
    >
      Remover senha
    </button>
  );
}
