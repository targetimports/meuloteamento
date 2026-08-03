'use client';

/**
 * Menu de ações por empresa na listagem do backoffice.
 *
 * Menu em vez de botões soltos na linha: as ações já são quatro e vão
 * crescer (emitir fatura, ver histórico), e uma fileira de botões por linha
 * transforma a tabela em ruído. O que é destrutivo fica separado no rodapé
 * do menu, longe do clique acidental.
 *
 * Segue o padrão do ListaUsuariosLoteadora: confirm() nativo antes do que
 * corta acesso, e useTransition para o estado de "aplicando".
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';

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
  const [pending, startTransition] = useTransition();
  const caixaRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc — menu que só fecha no próprio botão
  // fica preso na tela quando o usuário desiste e clica em outro lugar.
  useEffect(() => {
    if (!aberto) return;
    function onClique(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', onClique);
    document.addEventListener('keydown', onTecla);
    return () => {
      document.removeEventListener('mousedown', onClique);
      document.removeEventListener('keydown', onTecla);
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

  const item =
    'block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition';

  return (
    <div className="relative inline-block text-left" ref={caixaRef}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${empresaNome}`}
        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition"
      >
        {pending ? '···' : '⋯'}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
        >
          <Link
            href={`/backoffice/empresas/${empresaId}`}
            className={item}
            role="menuitem"
            onClick={() => setAberto(false)}
          >
            Ver detalhes
          </Link>
          <Link
            href={`/backoffice/empresas/${empresaId}#cadastro`}
            className={item}
            role="menuitem"
            onClick={() => setAberto(false)}
          >
            Editar cadastro
          </Link>
          <Link
            href={`/backoffice/empresas/${empresaId}#assinatura`}
            className={item}
            role="menuitem"
            onClick={() => setAberto(false)}
          >
            {temAssinatura ? 'Gerenciar assinatura' : 'Cadastrar assinatura'}
          </Link>
          <Link
            href={`/backoffice/empresas/${empresaId}/usuarios`}
            className={item}
            role="menuitem"
            onClick={() => setAberto(false)}
          >
            Usuários de acesso
          </Link>

          <div className="border-t border-slate-100">
            <button
              type="button"
              onClick={alternarAtiva}
              role="menuitem"
              className={`${item} ${ativa ? 'text-red-700 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
            >
              {ativa ? 'Desativar empresa' : 'Reativar empresa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
