'use client';

/**
 * Ativar/desativar empresa na ficha, com confirmação no padrão do sistema.
 *
 * Era um <form> com submit direto: um clique e a empresa inteira saía do ar,
 * sem pergunta. Agora passa pelo mesmo modal usado na listagem.
 */

import { useState, useTransition } from 'react';
import { ModalConfirmar } from './ModalConfirmar';

interface Props {
  empresaId: string;
  empresaNome: string;
  ativa: boolean;
  alternarAction: (id: string) => Promise<void>;
}

export function BotaoSituacaoEmpresa({
  empresaId,
  empresaNome,
  ativa,
  alternarAction,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmar() {
    setConfirmando(false);
    startTransition(async () => {
      await alternarAction(empresaId);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={pending}
        className={`w-full text-sm px-4 py-2.5 rounded-lg disabled:opacity-60 transition ${
          ativa
            ? 'bg-white border border-red-300 text-red-700 hover:bg-red-50'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {pending ? 'Aplicando…' : ativa ? 'Desativar empresa' : 'Reativar empresa'}
      </button>

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
        onConfirmar={confirmar}
        onCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
