'use client';

/**
 * Ações de uma empresa na listagem do backoffice.
 *
 * POR QUE MODAL, E NÃO DROPDOWN: a tabela vive dentro de um container com
 * overflow-x-auto (para rolar em tela estreita), e qualquer elemento
 * absoluto dentro dela é recortado na borda desse container. O modal é
 * renderizado por portal direto no <body>, então nenhum overflow de
 * ancestral o alcança.
 *
 * Decisões de desenho, para não virarem "gosto" numa revisão futura:
 *
 *  - Cada ação tem ícone + rótulo + uma linha do que faz. Uma lista de
 *    rótulos iguais obriga a ler os quatro para achar um; com ícone e
 *    descrição, a varredura é quase instantânea.
 *  - A ação destrutiva não fica com as outras. Vermelho não basta como
 *    aviso quando o item tem a mesma forma e o mesmo peso dos vizinhos.
 *  - O status vira etiqueta com ponto colorido, não texto corrido: é o dado
 *    que responde "posso mexer nesta empresa?" antes de qualquer clique.
 */

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

interface Props {
  empresaId: string;
  empresaNome: string;
  ativa: boolean;
  temAssinatura: boolean;
  alternarAtivaAction: (id: string) => Promise<void>;
}

/* Ícones locais: os do projeto são de navegação (24px, traço grosso) e ficam
   pesados em item de lista. Estes são 18px, traço 1.5. */
const ico = 'w-[18px] h-[18px]';

function IcoOlho() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.036 12.322a1 1 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 0 1 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IcoLapis() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
      <path d="M19.5 14.25v4.75A2 2 0 0 1 17.5 21h-11A2 2 0 0 1 4.5 19V8a2 2 0 0 1 2-2h4.75" />
    </svg>
  );
}
function IcoCartao() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 15h3" />
    </svg>
  );
}
function IcoPessoas() {
  return (
    <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 19.5a6 6 0 0 0-12 0" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M21 19a5 5 0 0 0-4-4.9" />
      <path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
    </svg>
  );
}
function IcoFechar() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function IcoSeta() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
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

  const acoes = [
    {
      href: `/backoffice/empresas/${empresaId}`,
      Icone: IcoOlho,
      titulo: 'Ver detalhes',
      desc: 'Cadastro, uso e faturas',
    },
    {
      href: `/backoffice/empresas/${empresaId}#cadastro`,
      Icone: IcoLapis,
      titulo: 'Editar cadastro',
      desc: 'Nome, CNPJ, contato e endereço',
    },
    {
      href: `/backoffice/empresas/${empresaId}#assinatura`,
      Icone: IcoCartao,
      titulo: temAssinatura ? 'Gerenciar assinatura' : 'Cadastrar assinatura',
      desc: temAssinatura ? 'Plano, valor e vencimento' : 'Definir plano e mensalidade',
      destaque: !temAssinatura,
    },
    {
      href: `/backoffice/empresas/${empresaId}/usuarios`,
      Icone: IcoPessoas,
      titulo: 'Usuários de acesso',
      desc: 'Quem entra no sistema por esta empresa',
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={pending}
        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 disabled:opacity-50 transition whitespace-nowrap"
      >
        {pending ? 'Aplicando…' : 'Ações'}
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
              className="modal-fundo absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
              onClick={() => setAberto(false)}
              aria-hidden
            />

            {/* Sombra em duas camadas: uma curta e densa que assenta a borda,
                outra longa e difusa que dá a altura. Uma sombra só sempre
                escolhe entre parecer chapada ou parecer borrada. */}
            <div
              className="modal-painel relative w-full sm:max-w-[420px] bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden ring-1 ring-slate-900/5"
              style={{
                boxShadow:
                  '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
              }}
            >
              {/* -------- Cabeçalho -------- */}
              <div className="px-6 pt-6 pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-slate-900 leading-tight truncate">
                      {empresaNome}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Etiqueta
                        tom={ativa ? 'verde' : 'cinza'}
                        texto={ativa ? 'Ativa' : 'Desativada'}
                        ponto
                      />
                      <Etiqueta
                        tom={temAssinatura ? 'azul' : 'ambar'}
                        texto={temAssinatura ? 'Com assinatura' : 'Sem assinatura'}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar"
                    className="flex-shrink-0 -mr-1.5 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    <IcoFechar />
                  </button>
                </div>
              </div>

              {/* -------- Ações -------- */}
              <div className="px-3 pb-2 space-y-0.5">
                {acoes.map((a) => (
                  <Link
                    key={a.titulo}
                    href={a.href}
                    onClick={() => setAberto(false)}
                    className="group flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition"
                  >
                    <span
                      className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border transition ${
                        a.destaque
                          ? 'bg-gold-50 border-gold-200 text-gold-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700'
                      }`}
                    >
                      <a.Icone />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 leading-tight">
                        {a.titulo}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 truncate">
                        {a.desc}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition">
                      <IcoSeta />
                    </span>
                  </Link>
                ))}
              </div>

              {/* -------- Zona destrutiva -------- */}
              <div className="mt-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {ativa ? 'Desativar empresa' : 'Reativar empresa'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ativa
                        ? 'Impede o login de todos os usuários.'
                        : 'Devolve o acesso aos usuários.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={alternarAtiva}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                      ativa
                        ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {ativa ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Etiqueta({
  texto,
  tom,
  ponto,
}: {
  texto: string;
  tom: 'verde' | 'cinza' | 'azul' | 'ambar';
  ponto?: boolean;
}) {
  const tons = {
    verde: { cx: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', p: 'bg-emerald-500' },
    cinza: { cx: 'bg-slate-100 text-slate-600 ring-slate-500/20', p: 'bg-slate-400' },
    azul: { cx: 'bg-sky-50 text-sky-700 ring-sky-600/20', p: 'bg-sky-500' },
    ambar: { cx: 'bg-amber-50 text-amber-700 ring-amber-600/20', p: 'bg-amber-500' },
  }[tom];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${tons.cx}`}
    >
      {ponto && <span className={`w-1.5 h-1.5 rounded-full ${tons.p}`} />}
      {texto}
    </span>
  );
}
