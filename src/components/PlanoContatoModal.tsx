'use client';

import { useEffect, useRef, useState } from 'react';
import { IconArrowRight, IconCheck, IconX } from './icons';

interface Props {
  /** Nome do plano em que o usuario clicou — ja vem selecionado, mas e trocavel. */
  planoInicial: string;
  /** Opcoes do select de plano. */
  planos: string[];
  onClose: () => void;
}

type Status = 'idle' | 'enviando' | 'ok' | 'erro';

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

export function PlanoContatoModal({ planoInicial, planos, onClose }: Props) {
  const [plano, setPlano] = useState(planoInicial);
  const [status, setStatus] = useState<Status>('idle');
  const [erro, setErro] = useState<string | null>(null);

  const painelRef = useRef<HTMLDivElement>(null);
  const primeiroCampoRef = useRef<HTMLSelectElement>(null);

  // Esc fecha, e a rolagem do fundo trava enquanto o modal esta aberto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primeiroCampoRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAntes;
    };
  }, [onClose]);

  // Mantem o foco preso dentro do modal (Tab nao escapa para a pagina atras).
  function onKeyDownPainel(e: React.KeyboardEvent) {
    if (e.key !== 'Tab' || !painelRef.current) return;
    const focaveis = painelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('enviando');
    setErro(null);

    const fd = new FormData(e.currentTarget);
    const dados = Object.fromEntries(fd.entries()) as Record<string, string>;
    const mensagemUsuario = (dados.mensagem ?? '').trim();

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: dados.nome,
          email: dados.email,
          telefone: dados.telefone,
          website: dados.website, // honeypot
          origem: `plano-${slug(plano)}`,
          mensagem: mensagemUsuario
            ? `Plano de interesse: ${plano}\n\n${mensagemUsuario}`
            : `Plano de interesse: ${plano}`,
        }),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
            : 'Não foi possível enviar agora. Tente novamente.'
        );
      }
      setStatus('ok');
    } catch (err) {
      setStatus('erro');
      setErro(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-plano"
    >
      {/* Fundo escurecido — clicar fora fecha */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={painelRef}
        onKeyDown={onKeyDownPainel}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        {/* Cabecalho dourado sobre escuro, no tom dos cards */}
        <div className="relative bg-slate-950 px-6 sm:px-8 py-6 rounded-t-3xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-3xl bg-gradient-to-b from-gold-500/15 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <IconX />
          </button>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-400 mb-1">
            Contratar plano
          </p>
          <h2 id="titulo-modal-plano" className="text-2xl font-bold text-white">
            {status === 'ok' ? 'Recebemos seu contato' : 'Fale com a gente'}
          </h2>
          {status !== 'ok' && (
            <p className="text-sm text-slate-400 mt-1">
              Retornamos em até 1 dia útil. Sem compromisso.
            </p>
          )}
        </div>

        {status === 'ok' ? (
          <div className="px-6 sm:px-8 py-10 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <IconCheck />
            </div>
            <p className="font-semibold text-slate-900 mb-1">
              Tudo certo! Seu interesse no plano {plano} foi registrado.
            </p>
            <p className="text-sm text-slate-600 mb-6">
              Um consultor vai entrar em contato pelos dados que você deixou.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="px-6 sm:px-8 py-6 space-y-4">
            {/* honeypot — invisivel para humanos */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', height: 0, width: 0 }}
              aria-hidden
            />

            <div>
              <label
                htmlFor="modal-plano"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Plano de interesse
              </label>
              <select
                id="modal-plano"
                ref={primeiroCampoRef}
                name="plano"
                value={plano}
                onChange={(e) => setPlano(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
              >
                {planos.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                Pode trocar — ajudamos você a escolher se estiver na dúvida.
              </p>
            </div>

            <div>
              <label htmlFor="modal-nome" className="block text-xs font-medium text-slate-700 mb-1.5">
                Nome *
              </label>
              <input
                id="modal-nome"
                name="nome"
                required
                minLength={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="modal-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  E-mail *
                </label>
                <input
                  id="modal-email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                />
              </div>
              <div>
                <label htmlFor="modal-telefone" className="block text-xs font-medium text-slate-700 mb-1.5">
                  WhatsApp *
                </label>
                <input
                  id="modal-telefone"
                  name="telefone"
                  required
                  minLength={8}
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="modal-mensagem" className="block text-xs font-medium text-slate-700 mb-1.5">
                Mensagem <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                id="modal-mensagem"
                name="mensagem"
                rows={3}
                placeholder="Quantos loteamentos você tem? Alguma dúvida específica?"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
              />
            </div>

            {status === 'erro' && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {erro ?? 'Falha ao enviar. Tente novamente.'}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'enviando'}
              className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-semibold py-3.5 rounded-xl shadow-lg shadow-gold-600/25 transition"
            >
              {status === 'enviando' ? 'Enviando...' : 'Enviar contato'}
              {status !== 'enviando' && <IconArrowRight />}
            </button>

            <p className="text-[11px] text-center text-slate-400">
              Seus dados são usados apenas para este atendimento.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
