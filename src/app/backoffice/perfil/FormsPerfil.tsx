'use client';

import { useFormState, useFormStatus } from 'react-dom';

type EstadoForm = { error?: string; ok?: string };

interface Props {
  atualizarAction: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  trocarSenhaAction: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial: { nome: string; email: string };
}

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function Botao({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando…' : rotulo}
    </button>
  );
}

function Aviso({ estado }: { estado: EstadoForm }) {
  if (estado.error) {
    return (
      <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        {estado.ok}
      </p>
    );
  }
  return null;
}

export function FormsPerfil({ atualizarAction, trocarSenhaAction, inicial }: Props) {
  const [estadoDados, acaoDados] = useFormState<EstadoForm, FormData>(atualizarAction, {});
  const [estadoSenha, acaoSenha] = useFormState<EstadoForm, FormData>(trocarSenhaAction, {});

  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900">Meus dados</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-5">
          O e-mail aqui é o que você usa para entrar.
        </p>

        <form action={acaoDados}>
          <Aviso estado={estadoDados} />

          <div className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-xs font-medium text-slate-600 mb-1">
                Nome *
              </label>
              <input
                id="nome"
                name="nome"
                required
                minLength={2}
                defaultValue={inicial.nome}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-600 mb-1">
                E-mail *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={inicial.email}
                className={campo}
              />
            </div>
          </div>

          <div className="mt-6">
            <Botao rotulo="Salvar dados" />
          </div>
        </form>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900">Trocar senha</h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-5">
          Pede a senha atual — assim uma sessão esquecida aberta não vira porta
          de entrada.
        </p>

        <form action={acaoSenha}>
          <Aviso estado={estadoSenha} />

          <div className="space-y-4">
            <div>
              <label htmlFor="senhaAtual" className="block text-xs font-medium text-slate-600 mb-1">
                Senha atual *
              </label>
              <input
                id="senhaAtual"
                name="senhaAtual"
                type="password"
                required
                autoComplete="current-password"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="novaSenha" className="block text-xs font-medium text-slate-600 mb-1">
                Nova senha *
              </label>
              <input
                id="novaSenha"
                name="novaSenha"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={campo}
              />
              <p className="text-[11px] text-slate-400 mt-1">Ao menos 8 caracteres.</p>
            </div>
            <div>
              <label htmlFor="confirmar" className="block text-xs font-medium text-slate-600 mb-1">
                Confirmar nova senha *
              </label>
              <input
                id="confirmar"
                name="confirmar"
                type="password"
                required
                autoComplete="new-password"
                className={campo}
              />
            </div>
          </div>

          <div className="mt-6">
            <Botao rotulo="Trocar senha" />
          </div>
        </form>
      </section>
    </div>
  );
}
