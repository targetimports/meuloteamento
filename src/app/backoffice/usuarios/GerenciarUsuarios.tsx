'use client';

/**
 * Usuários do backoffice: tabela, modal de cadastro/edição e ações.
 *
 * Um componente só porque as três partes compartilham o mesmo estado —
 * qual usuário está sendo editado, qual senha acabou de ser gerada. Separar
 * exigiria levantar esse estado para um pai que não faria mais nada.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPortal } from 'react-dom';

interface UsuarioUI {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  ultimoLogin: Date | null;
  criadoEm: Date;
}

type EstadoForm = {
  error?: string;
  ok?: boolean;
  senhaGerada?: string;
  emailCriado?: string;
};

interface Props {
  usuarios: UsuarioUI[];
  meuId: string;
  criarAction: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  atualizarAction: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  resetarSenhaAction: (id: string) => Promise<{ ok: boolean; senha?: string; error?: string }>;
  alternarAtivoAction: (id: string) => Promise<void>;
  excluirAction: (id: string) => Promise<void>;
}

const POR_PAGINA = 8;

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function BotaoSalvar({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar usuário'}
    </button>
  );
}

export function GerenciarUsuarios({
  usuarios,
  meuId,
  criarAction,
  atualizarAction,
  resetarSenhaAction,
  alternarAtivoAction,
  excluirAction,
}: Props) {
  const [modal, setModal] = useState<{ editando?: UsuarioUI } | null>(null);
  const [montado, setMontado] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [pending, startTransition] = useTransition();
  const [credenciais, setCredenciais] = useState<{ email: string; senha: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);

  const editando = modal?.editando;
  const [estado, formAction] = useFormState<EstadoForm, FormData>(
    editando ? atualizarAction : criarAction,
    {}
  );

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!estado.ok) return;
    setModal(null);
    if (estado.senhaGerada && estado.emailCriado) {
      setCredenciais({ email: estado.emailCriado, senha: estado.senhaGerada });
    }
  }, [estado]);

  useEffect(() => {
    if (!modal) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setModal(null);
    }
    document.addEventListener('keydown', onTecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primeiroCampo.current?.focus();
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = antes;
    };
  }, [modal]);

  const totalPaginas = Math.max(1, Math.ceil(usuarios.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = useMemo(
    () => usuarios.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [usuarios, paginaAtual]
  );

  // Uma ação que falha por regra de negócio (último super admin) precisa
  // mostrar o motivo, não sumir em silêncio.
  function executar(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      }
    });
  }

  function resetar(u: UsuarioUI) {
    if (!confirm(`Gerar nova senha para ${u.email}?\n\nA senha atual deixa de funcionar.`)) return;
    setErro(null);
    startTransition(async () => {
      const r = await resetarSenhaAction(u.id);
      if (r.ok && r.senha) setCredenciais({ email: u.email, senha: r.senha });
      else setErro(r.error ?? 'Não foi possível gerar a senha.');
    });
  }

  function copiar() {
    if (!credenciais) return;
    const texto = `URL: https://meuloteamento.com/admin/login\nE-mail: ${credenciais.email}\nSenha: ${credenciais.senha}`;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    });
  }

  const dataHora = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Nunca acessou';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          {usuarios.length} no total · {usuarios.filter((u) => u.ativo).length} ativo(s)
        </p>
        <button
          type="button"
          onClick={() => setModal({})}
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
        >
          + Cadastrar usuário
        </button>
      </div>

      {credenciais && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Credenciais de {credenciais.email}
          </p>
          <p className="mt-2 font-mono text-base font-semibold text-emerald-800 tracking-wide">
            {credenciais.senha}
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Mostrada uma única vez. Envie à pessoa e peça que troque no primeiro acesso.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={copiar}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition"
            >
              {copiado ? 'Copiado' : 'Copiar credenciais'}
            </button>
            <button
              type="button"
              onClick={() => setCredenciais(null)}
              className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-medium transition"
            >
              Já anotei
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {erro}
        </p>
      )}

      <div
        className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${
          pending ? 'opacity-60 pointer-events-none' : ''
        } transition`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-5 py-3">Usuário</th>
                <th className="text-left font-medium px-5 py-3">Último acesso</th>
                <th className="text-right font-medium px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiveis.map((u) => {
                const souEu = u.id === meuId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{u.nome}</span>
                        {!u.ativo && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            inativo
                          </span>
                        )}
                        {souEu && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-900 text-white">
                            você
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {dataHora(u.ultimoLogin)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setModal({ editando: u })}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => resetar(u)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                        >
                          Resetar senha
                        </button>
                        <button
                          type="button"
                          onClick={() => executar(() => alternarAtivoAction(u.id))}
                          disabled={souEu}
                          title={souEu ? 'Você não pode desativar a própria conta' : undefined}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {u.ativo ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Excluir ${u.email}?\n\nEsta ação não pode ser desfeita.`)) return;
                            executar(() => excluirAction(u.id));
                          }}
                          disabled={souEu}
                          title={souEu ? 'Você não pode excluir a própria conta' : undefined}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              {(paginaAtual - 1) * POR_PAGINA + 1}–
              {Math.min(paginaAtual * POR_PAGINA, usuarios.length)} de {usuarios.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-500 tabular-nums">
                {paginaAtual} / {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------- Modal -------------------- */}
      {montado &&
        modal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={editando ? `Editar ${editando.nome}` : 'Cadastrar usuário'}
          >
            <div
              className="modal-fundo absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              onClick={() => setModal(null)}
              aria-hidden
            />
            <div
              className="modal-painel relative w-full sm:max-w-[460px] bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5"
              style={{
                boxShadow:
                  '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
              }}
            >
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <h2 className="text-[17px] font-semibold text-slate-900 leading-tight">
                  {editando ? editando.nome : 'Novo usuário do backoffice'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {editando
                    ? 'Alterar nome e e-mail. A senha é trocada pelo botão de resetar.'
                    : 'Terá acesso a todas as empresas e ao financeiro da plataforma.'}
                </p>
              </div>

              <form action={formAction} className="p-6">
                {editando && <input type="hidden" name="id" value={editando.id} />}

                {estado.error && (
                  <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {estado.error}
                  </p>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="nome" className="block text-xs font-medium text-slate-600 mb-1">
                      Nome *
                    </label>
                    <input
                      id="nome"
                      ref={primeiroCampo}
                      name="nome"
                      required
                      minLength={2}
                      defaultValue={editando?.nome ?? ''}
                      placeholder="Maria Souza"
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
                      defaultValue={editando?.email ?? ''}
                      placeholder="maria@meuloteamento.com"
                      className={campo}
                    />
                  </div>
                </div>

                {!editando && (
                  <p className="mt-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    A senha é gerada automaticamente e mostrada uma única vez
                    depois de criar.
                  </p>
                )}

                <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-100">
                  <BotaoSalvar editando={Boolean(editando)} />
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
