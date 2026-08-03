'use client';

/**
 * Tabela de usuários de uma empresa — versão do backoffice.
 *
 * Cópia deliberada do ListaUsuariosLoteadora: aquele é usado por
 * /admin/loteadoras, em produção para a Germanos. Tirar os emojis e mudar o
 * visual lá alteraria a tela deles sem pedido.
 *
 * A paginação é feita no cliente. Uma empresa tem punhado de usuários, não
 * milhares — buscar página a página no servidor custaria uma ida ao banco a
 * cada clique para economizar nada.
 */

import { useMemo, useState, useTransition } from 'react';

interface UsuarioUI {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  ultimoLogin: Date | null;
}

interface Props {
  loteadoraId: string;
  usuarios: UsuarioUI[];
  meuId: string;
  resetSenhaAction: (
    loteadoraId: string,
    userId: string
  ) => Promise<{ ok: boolean; senha?: string; error?: string }>;
  alternarAtivoAction: (loteadoraId: string, userId: string) => Promise<void>;
  excluirAction: (loteadoraId: string, userId: string) => Promise<void>;
}

const POR_PAGINA = 8;

const PAPEL: Record<string, { rotulo: string; cls: string }> = {
  SUPER_ADMIN: { rotulo: 'Super admin', cls: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  ADMIN: { rotulo: 'Admin', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  OPERADOR: { rotulo: 'Operador', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  FINANCEIRO: { rotulo: 'Financeiro', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
};

export function TabelaUsuarios({
  loteadoraId,
  usuarios,
  meuId,
  resetSenhaAction,
  alternarAtivoAction,
  excluirAction,
}: Props) {
  const [pagina, setPagina] = useState(1);
  const [pending, startTransition] = useTransition();
  const [senhaNova, setSenhaNova] = useState<{ email: string; senha: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const totalPaginas = Math.max(1, Math.ceil(usuarios.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const visiveis = useMemo(
    () => usuarios.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [usuarios, paginaAtual]
  );

  function resetar(userId: string, email: string) {
    if (!confirm(`Gerar uma nova senha para ${email}?\n\nA senha atual deixa de funcionar.`)) return;
    setErro(null);
    startTransition(async () => {
      const r = await resetSenhaAction(loteadoraId, userId);
      if (r.ok && r.senha) setSenhaNova({ email, senha: r.senha });
      else setErro(r.error ?? 'Não foi possível gerar a senha.');
    });
  }

  function alternar(userId: string) {
    startTransition(async () => {
      await alternarAtivoAction(loteadoraId, userId);
    });
  }

  function excluir(userId: string, email: string) {
    if (!confirm(`Excluir ${email}?\n\nEsta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      await excluirAction(loteadoraId, userId);
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
    <div className={pending ? 'opacity-60 pointer-events-none transition' : 'transition'}>
      {senhaNova && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Nova senha de {senhaNova.email}
          </p>
          <p className="mt-2 font-mono text-base font-semibold text-amber-900 tracking-wide">
            {senhaNova.senha}
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Mostrada uma única vez. Envie à pessoa e peça que troque no primeiro acesso.
          </p>
          <button
            type="button"
            onClick={() => setSenhaNova(null)}
            className="mt-3 text-xs font-medium text-amber-900 underline"
          >
            Já anotei, esconder
          </button>
        </div>
      )}

      {erro && (
        <p className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {erro}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-5 py-3">Usuário</th>
                <th className="text-left font-medium px-5 py-3">Papel</th>
                <th className="text-left font-medium px-5 py-3">Último acesso</th>
                <th className="text-right font-medium px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiveis.map((u) => {
                const papel = PAPEL[u.role] ?? {
                  rotulo: u.role,
                  cls: 'bg-slate-100 text-slate-600 ring-slate-500/20',
                };
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
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${papel.cls}`}
                      >
                        {papel.rotulo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {dataHora(u.ultimoLogin)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => resetar(u.id, u.email)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                        >
                          Resetar senha
                        </button>
                        <button
                          type="button"
                          onClick={() => alternar(u.id)}
                          disabled={souEu}
                          title={souEu ? 'Você não pode desativar a própria conta' : undefined}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {u.ativo ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => excluir(u.id, u.email)}
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

              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                    Nenhum usuário cadastrado para esta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação some quando cabe tudo numa página: controle que nunca faz
            nada só ocupa espaço e sugere que há mais conteúdo. */}
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
    </div>
  );
}
