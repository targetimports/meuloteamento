'use client';

/**
 * Formulários do perfil, empilhados em largura total.
 *
 * Lado a lado, os dois cartões ficavam metade da tela cada e os campos
 * estreitos demais para o conteúdo — um e-mail longo não cabia. Empilhados,
 * cada seção usa a largura inteira e distribui os campos numa grade interna:
 * o bloco cresce, os campos não viram linhas gigantes de ponta a ponta.
 */

import { useFormState, useFormStatus } from 'react-dom';

type EstadoForm = { error?: string; ok?: string };

interface Props {
  atualizarAction: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  trocarSenhaAction: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial: { nome: string; email: string };
}

const campo =
  'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

const rotulo = 'block text-xs font-medium text-slate-600 mb-1.5';

function Botao({ rotuloBotao }: { rotuloBotao: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando…' : rotuloBotao}
    </button>
  );
}

function Aviso({ estado }: { estado: EstadoForm }) {
  if (estado.error) {
    return (
      <div className="mb-5 flex items-start gap-2.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
        <span>{estado.error}</span>
      </div>
    );
  }
  if (estado.ok) {
    return (
      <div className="mb-5 flex items-start gap-2.5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        <span>{estado.ok}</span>
      </div>
    );
  }
  return null;
}

/** Cabeçalho de seção: título à esquerda, explicação logo abaixo. */
function Cabecalho({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="px-6 py-5 border-b border-slate-100">
      <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
      <p className="text-xs text-slate-500 mt-1 max-w-xl">{descricao}</p>
    </div>
  );
}

export function FormsPerfil({ atualizarAction, trocarSenhaAction, inicial }: Props) {
  const [estadoDados, acaoDados] = useFormState<EstadoForm, FormData>(atualizarAction, {});
  const [estadoSenha, acaoSenha] = useFormState<EstadoForm, FormData>(trocarSenhaAction, {});

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ---------------- Meus dados ---------------- */}
      <section className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Cabecalho
          titulo="Meus dados"
          descricao="O e-mail aqui é o mesmo que você usa para entrar. Alterá-lo muda o seu login."
        />
        <form action={acaoDados} className="p-6">
          <Aviso estado={estadoDados} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="nome" className={rotulo}>
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
              <label htmlFor="email" className={rotulo}>
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

          <div className="mt-6 pt-5 border-t border-slate-100">
            <Botao rotuloBotao="Salvar dados" />
          </div>
        </form>
      </section>

      {/* ---------------- Trocar senha ---------------- */}
      <section className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Cabecalho
          titulo="Trocar senha"
          descricao="Pede a senha atual de propósito — assim uma sessão esquecida aberta não vira porta de entrada."
        />
        <form action={acaoSenha} className="p-6">
          <Aviso estado={estadoSenha} />

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="senhaAtual" className={rotulo}>
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
              <label htmlFor="novaSenha" className={rotulo}>
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
              <p className="text-[11px] text-slate-400 mt-1.5">Ao menos 8 caracteres.</p>
            </div>
            <div>
              <label htmlFor="confirmar" className={rotulo}>
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

          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-4">
            <Botao rotuloBotao="Trocar senha" />
            {/* Consequência que só se descobre no dia seguinte, se não for
                dita aqui: não há recuperação por e-mail neste painel. */}
            <p className="text-xs text-slate-500">
              Guarde a nova senha: o painel não tem recuperação por e-mail.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
