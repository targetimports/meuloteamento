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
 *  - Cada ação tem rótulo + uma linha do que faz. Uma lista de rótulos
 *    soltos obriga a abrir para descobrir o que cada um faz; a descrição
 *    resolve isso sem custar um clique.
 *  - A ação destrutiva não fica com as outras. Vermelho não basta como
 *    aviso quando o item tem a mesma forma e o mesmo peso dos vizinhos.
 *  - O status vira etiqueta com ponto colorido, não texto corrido: é o dado
 *    que responde "posso mexer nesta empresa?" antes de qualquer clique.
 */

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ModalConfirmar } from './ModalConfirmar';

interface Props {
  empresaId: string;
  empresaNome: string;
  ativa: boolean;
  temAssinatura: boolean;
  alternarAtivaAction: (id: string) => Promise<void>;
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
  const [confirmando, setConfirmando] = useState(false);
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

  function confirmarAlternancia() {
    setConfirmando(false);
    setAberto(false);
    startTransition(async () => {
      await alternarAtivaAction(empresaId);
    });
  }

  const acoes = [
    {
      href: `/backoffice/empresas/${empresaId}`,
      titulo: 'Ver detalhes',
      desc: 'Cadastro, uso e faturas',
    },
    {
      href: `/backoffice/empresas/${empresaId}#cadastro`,
      titulo: 'Editar cadastro',
      desc: 'Nome, CNPJ, contato e endereço',
    },
    {
      href: `/backoffice/empresas/${empresaId}#assinatura`,
      titulo: temAssinatura ? 'Gerenciar assinatura' : 'Cadastrar assinatura',
      desc: temAssinatura ? 'Plano, valor e vencimento' : 'Definir plano e mensalidade',
      destaque: !temAssinatura,
    },
    {
      href: `/backoffice/empresas/${empresaId}/usuarios`,
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
                    className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl transition ${
                      // Sem ícone, o destaque de "falta cadastrar assinatura"
                      // passou para o fundo do item — discreto, mas suficiente
                      // para o olho parar nele antes dos outros três.
                      a.destaque
                        ? 'bg-gold-50/70 hover:bg-gold-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
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
                    onClick={() => setConfirmando(true)}
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

      <ModalConfirmar
        aberto={confirmando}
        titulo={ativa ? `Desativar ${empresaNome}?` : `Reativar ${empresaNome}?`}
        descricao={
          ativa
            ? 'A empresa deixa de operar no sistema até ser reativada.'
            : 'A empresa volta a operar normalmente.'
        }
        consequencia={
          ativa
            ? 'Nenhum usuário desta empresa conseguirá fazer login, e quem estiver logado é desconectado na próxima página que abrir.'
            : 'Os usuários voltam a conseguir entrar imediatamente.'
        }
        rotuloConfirmar={ativa ? 'Desativar empresa' : 'Reativar empresa'}
        tom={ativa ? 'destrutivo' : 'neutro'}
        processando={pending}
        onConfirmar={confirmarAlternancia}
        onCancelar={() => setConfirmando(false)}
      />
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
