'use client';

/**
 * Confirmação de ação, no visual do sistema.
 *
 * Substitui o confirm() do navegador, que quebra a leitura da tela de três
 * formas: aparece com a cara do sistema operacional (e do domínio, no
 * Chrome), não distingue uma ação destrutiva de uma banal, e não deixa
 * mostrar estado de carregamento enquanto a ação roda.
 *
 * Renderiza por portal no <body>: dentro de uma tabela com overflow, um
 * elemento posicionado seria recortado pela borda do container.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  aberto: boolean;
  titulo: string;
  descricao: string;
  /** Frase curta com a consequência — o que muda no mundo ao confirmar. */
  consequencia?: string;
  rotuloConfirmar: string;
  tom?: 'destrutivo' | 'neutro';
  processando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirmar({
  aberto,
  titulo,
  descricao,
  consequencia,
  rotuloConfirmar,
  tom = 'destrutivo',
  processando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!aberto) return;
    function onTecla(e: KeyboardEvent) {
      // Enquanto processa, Esc não fecha: sumir com a janela no meio da ação
      // deixa a pessoa sem saber se aconteceu.
      if (e.key === 'Escape' && !processando) onCancelar();
    }
    document.addEventListener('keydown', onTecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onTecla);
      document.body.style.overflow = antes;
    };
  }, [aberto, processando, onCancelar]);

  if (!montado || !aberto) return null;

  const destrutivo = tom === 'destrutivo';

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="modal-fundo absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={processando ? undefined : onCancelar}
        aria-hidden
      />

      <div
        className="modal-painel relative w-full sm:max-w-[420px] bg-white rounded-t-3xl sm:rounded-2xl ring-1 ring-slate-900/5 overflow-hidden"
        style={{
          boxShadow: '0 1px 3px rgba(15,23,42,0.08), 0 24px 48px -12px rgba(15,23,42,0.25)',
        }}
      >
        <div className="p-6">
          <h2 className="text-[17px] font-semibold text-slate-900 leading-tight">
            {titulo}
          </h2>
          <p className="text-sm text-slate-600 mt-2">{descricao}</p>

          {consequencia && (
            <p
              className={`mt-4 text-xs rounded-lg px-3.5 py-3 ${
                destrutivo
                  ? 'text-red-800 bg-red-50 border border-red-100'
                  : 'text-slate-600 bg-slate-50 border border-slate-200'
              }`}
            >
              {consequencia}
            </p>
          )}
        </div>

        {/* Cancelar primeiro na ordem visual e o destrutivo à direita: o botão
            que desfaz fica onde o polegar alcança antes, no celular. */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={processando}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={processando}
            autoFocus
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition ${
              destrutivo
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {processando ? 'Aplicando…' : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
