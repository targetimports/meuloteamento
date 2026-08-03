'use client';

/**
 * Ações de uma empresa na listagem do backoffice.
 *
 * POR QUE MODAL, E NÃO DROPDOWN: a tabela vive dentro de um container com
 * overflow-x-auto (para rolar em tela estreita). Qualquer menu posicionado
 * de forma absoluta dentro dela é recortado pela borda desse container — foi
 * exatamente o que aconteceu. Daria para contornar com position: fixed e
 * cálculo de coordenadas, mas isso quebra de novo ao rolar a página.
 *
 * O modal é renderizado por portal direto no <body>, então nenhum overflow
 * de ancestral o alcança. É o mesmo caminho que o InteressadosTabela já usa
 * neste projeto.
 */

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { IconX } from './icons';

interface Props {
  empresaId: string;
  empresaNome: string;
  ativa: boolean;
  temAssinatura: boolean;
  alternarAtivaAction: (id: string) => Promise<void>;
}

export function AcoesEmpresa({
  empresaId,
  empresaNome,
  ativa,
  temAssinatura,
  alternarAtivaAction,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [pending, startTransition] = useTransition();

  // createPortal precisa do document, que não existe na renderização do
  // servidor. Só liberamos o portal depois que o componente monta no cliente.
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('keydown', onTecla);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberto]);

  function alternarAtiva() {
    const pergunta = ativa
      ? `Desativar ${empresaNome}?\n\nNenhum usuário desta empresa conseguirá fazer login enquanto estiver desativada.`
      : `Reativar ${empresaNome}?\n\nOs usuários voltam a conseguir entrar.`;
    if (!confirm(pergunta)) return;
    setAberto(false);
    startTransition(async () => {
      await alternarAtivaAction(empresaId);
    });
  }

  const itemBase =
    'flex items-center justify-between w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition';

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={pending}
        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition whitespace-nowrap"
      >
        {pending ? 'Aplicando...' : 'Ações'}
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`Ações de ${empresaNome}`}
          >
            <div
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
              onClick={() => setAberto(false)}
              aria-hidden
            />

            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Empresa
                  </p>
                  <h2 className="text-base font-semibold text-slate-900 truncate">
                    {empresaNome}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ativa ? 'Ativa' : 'Desativada'} ·{' '}
                    {temAssinatura ? 'com assinatura' : 'sem assinatura'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="flex-shrink-0 p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  <IconX />
                </button>
              </div>

              <div className="p-4 space-y-2">
                <Link
                  href={`/backoffice/empresas/${empresaId}`}
                  className={itemBase}
                  onClick={() => setAberto(false)}
                >
                  <span className="text-sm font-medium text-slate-900">Ver detalhes</span>
                  <span className="text-slate-300">→</span>
                </Link>

                <Link
                  href={`/backoffice/empresas/${empresaId}#cadastro`}
                  className={itemBase}
                  onClick={() => setAberto(false)}
                >
                  <span className="text-sm font-medium text-slate-900">Editar cadastro</span>
                  <span className="text-slate-300">→</span>
                </Link>

                <Link
                  href={`/backoffice/empresas/${empresaId}#assinatura`}
                  className={itemBase}
                  onClick={() => setAberto(false)}
                >
                  <span className="text-sm font-medium text-slate-900">
                    {temAssinatura ? 'Gerenciar assinatura' : 'Cadastrar assinatura'}
                  </span>
                  <span className="text-slate-300">→</span>
                </Link>

                <Link
                  href={`/backoffice/empresas/${empresaId}/usuarios`}
                  className={itemBase}
                  onClick={() => setAberto(false)}
                >
                  <span className="text-sm font-medium text-slate-900">Usuários de acesso</span>
                  <span className="text-slate-300">→</span>
                </Link>
              </div>

              {/* Separado do resto: corta o login de todo mundo da empresa,
                  então não pode dividir espaço com "ver detalhes". */}
              <div className="px-4 pb-5 pt-1">
                <div className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={alternarAtiva}
                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition ${
                      ativa
                        ? 'bg-white border border-red-300 text-red-700 hover:bg-red-50'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {ativa ? 'Desativar empresa' : 'Reativar empresa'}
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2 text-center">
                    {ativa
                      ? 'Impede o login de todos os usuários desta empresa.'
                      : 'Devolve o acesso aos usuários desta empresa.'}
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
