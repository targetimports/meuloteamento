'use client';

/**
 * Formulário de novo usuário — versão do backoffice.
 *
 * Cópia deliberada do NovoUsuarioForm em vez de reuso: aquele componente é
 * usado por /admin/loteadoras, tela em produção para a Germanos. As mudanças
 * pedidas aqui (tirar emojis, alinhar ao visual do backoffice) alterariam a
 * tela deles sem que ninguém tenha pedido.
 *
 * A lógica é a mesma: a senha é gerada no servidor e devolvida uma única vez.
 */

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';

type EstadoForm = {
  error?: string;
  ok?: boolean;
  senhaGerada?: string;
  emailCriado?: string;
};

interface Props {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
}

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Criando…' : 'Criar usuário e gerar senha'}
    </button>
  );
}

export function FormNovoUsuario({ action }: Props) {
  const [estado, formAction] = useFormState<EstadoForm, FormData>(action, {});
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    if (!estado.senhaGerada || !estado.emailCriado) return;
    const texto = `URL: https://meuloteamento.com/admin/login\nE-mail: ${estado.emailCriado}\nSenha: ${estado.senhaGerada}`;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    });
  }

  // Credenciais recém-criadas: a senha não volta a aparecer, então esta tela
  // precisa ser difícil de fechar por engano e fácil de copiar.
  if (estado.ok && estado.senhaGerada) {
    return (
      <section className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200">
          <h2 className="text-sm font-semibold text-emerald-900">Usuário criado</h2>
          <p className="text-xs text-emerald-800 mt-0.5">
            A senha aparece só agora. Depois disso, só é possível gerar uma nova.
          </p>
        </div>

        <div className="p-6">
          <dl className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2.5">
              <dt className="w-20 flex-shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Endereço
              </dt>
              <dd className="text-sm text-slate-900 font-mono break-all">
                meuloteamento.com/admin/login
              </dd>
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5">
              <dt className="w-20 flex-shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                E-mail
              </dt>
              <dd className="text-sm text-slate-900 font-mono break-all">
                {estado.emailCriado}
              </dd>
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50">
              <dt className="w-20 flex-shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Senha
              </dt>
              <dd className="text-sm font-mono font-semibold text-emerald-700 tracking-wide">
                {estado.senhaGerada}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={copiar}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
            >
              {copiado ? 'Copiado' : 'Copiar credenciais'}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
            >
              Criar outro usuário
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-slate-900">Adicionar usuário</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-5">
        A senha temporária é gerada automaticamente e mostrada uma única vez.
      </p>

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
            minLength={2}
            placeholder="João da Silva"
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
            placeholder="joao@empresa.com.br"
            className={campo}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="role" className="block text-xs font-medium text-slate-600 mb-1">
            Papel
          </label>
          <select id="role" name="role" defaultValue="ADMIN" className={campo}>
            <option value="ADMIN">Admin — acesso total à empresa</option>
            <option value="OPERADOR">Operador — operação do dia a dia</option>
            <option value="FINANCEIRO">Financeiro — vendas e parcelas</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Botao />
        </div>
      </div>
    </form>
  );
}
