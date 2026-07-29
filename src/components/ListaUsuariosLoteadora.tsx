'use client';

import { useState, useTransition } from 'react';

interface UserUI {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  ultimoLogin: Date | null;
}

interface Props {
  loteadoraId: string;
  usuarios: UserUI[];
  meuId: string;
  resetSenhaAction: (
    loteadoraId: string,
    userId: string
  ) => Promise<{ ok: boolean; senha?: string; error?: string }>;
  toggleAtivoAction: (loteadoraId: string, userId: string) => Promise<void>;
  excluirAction: (loteadoraId: string, userId: string) => Promise<void>;
}

const ROLE_BG: Record<string, string> = {
  SUPER_ADMIN: 'bg-violet-100 text-violet-700',
  ADMIN: 'bg-primary-100 text-primary-700',
  OPERADOR: 'bg-slate-100 text-slate-700',
  FINANCEIRO: 'bg-amber-100 text-amber-700',
};

export function ListaUsuariosLoteadora({
  loteadoraId,
  usuarios,
  meuId,
  resetSenhaAction,
  toggleAtivoAction,
  excluirAction,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [senhaReset, setSenhaReset] = useState<{ userId: string; senha: string; email: string } | null>(null);

  function handleReset(userId: string, email: string) {
    if (!confirm(`Gerar uma NOVA senha para ${email}? A senha atual será invalidada.`)) return;
    startTransition(async () => {
      const res = await resetSenhaAction(loteadoraId, userId);
      if (res.ok && res.senha) {
        setSenhaReset({ userId, senha: res.senha, email });
      } else {
        alert(res.error ?? 'Falha ao resetar');
      }
    });
  }

  function handleToggle(userId: string) {
    startTransition(async () => {
      try {
        await toggleAtivoAction(loteadoraId, userId);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Falha');
      }
    });
  }

  function handleDelete(userId: string, email: string) {
    if (!confirm(`Excluir o usuário ${email}? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      try {
        await excluirAction(loteadoraId, userId);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Falha');
      }
    });
  }

  if (usuarios.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
        Nenhum usuário cadastrado para esta loteadora ainda. Use o formulário acima para criar o primeiro.
      </div>
    );
  }

  return (
    <>
      {senhaReset && (
        <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
          <p className="font-bold text-amber-900 mb-2">🔑 Nova senha gerada para {senhaReset.email}</p>
          <div className="bg-white rounded-lg p-3 font-mono text-sm border border-amber-200">
            <p className="text-slate-500 text-xs">Senha:</p>
            <p className="text-amber-700 font-bold text-lg">{senhaReset.senha}</p>
          </div>
          <p className="text-xs text-amber-800 mt-2">
            ⚠️ Esta senha só é mostrada uma vez. Compartilhe com {senhaReset.email} e peça que troque no primeiro login.
          </p>
          <button
            onClick={() => setSenhaReset(null)}
            className="mt-3 text-xs text-amber-900 hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Usuário</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Último login</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => {
              const isMe = u.id === meuId;
              return (
                <tr key={u.id} className={isMe ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {u.nome} {isMe && <span className="text-xs text-blue-600 font-normal">(você)</span>}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${ROLE_BG[u.role] ?? 'bg-slate-100'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded ${
                        u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {u.ativo ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => handleReset(u.id, u.email)}
                        disabled={pending}
                        className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded transition"
                      >
                        🔑 Resetar senha
                      </button>
                      {!isMe && (
                        <>
                          <button
                            onClick={() => handleToggle(u.id)}
                            disabled={pending}
                            className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded transition"
                          >
                            {u.ativo ? 'Inativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.email)}
                            disabled={pending}
                            className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition"
                          >
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
