'use client';

import { useEffect, useRef, useState } from 'react';
import { IconArrowRight, IconCheck, IconX } from './icons';

export interface PlanoOpcao {
  name: string;
  price: number;
  tagline: string;
  /** Principais itens do plano — resumidos na coluna da esquerda. */
  destaques: string[];
}

interface Props {
  /** Nome do plano em que o usuario clicou — ja vem selecionado, mas e trocavel. */
  planoInicial: string;
  /** Opcoes do select, com preco e descricao para o resumo. */
  planos: PlanoOpcao[];
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
  const primeiroCampoRef = useRef<HTMLInputElement>(null);

  const planoAtual = planos.find((p) => p.name === plano) ?? planos[0];

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

  // bg-white e text-slate-900 explicitos: sem isso o Chrome em dark mode pinta
  // os campos de cinza escuro, destoando do modal branco.
  const campoBase =
    'w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500 transition';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-plano"
    >
      {/* Fundo escurecido — clicar fora fecha */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={painelRef}
        onKeyDown={onKeyDownPainel}
        className="relative w-full sm:w-[82vw] sm:min-w-[960px] sm:max-w-[1400px] max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
        >
          <IconX />
        </button>

        <div className="grid md:grid-cols-2 gap-10 md:gap-14 p-6 sm:p-10">
          {/* ---------------- Coluna da esquerda: contexto ---------------- */}
          <div className="flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary-600 mb-4">
              Contato
            </p>
            <h2
              id="titulo-modal-plano"
              className="text-4xl sm:text-5xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-5"
            >
              Vamos ver o sistema
              <br />
              com o seu loteamento?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              A gente mostra a plataforma funcionando, tira suas dúvidas e você
              decide sem compromisso.
            </p>

            {/* Resumo do plano escolhido — acompanha o select */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Plano selecionado
              </p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold text-slate-900">
                  {planoAtual.name}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-lg text-slate-700 font-semibold tabular-nums">
                  R$ {planoAtual.price.toLocaleString('pt-BR')}
                </span>
                <span className="text-sm text-slate-500">/mês</span>
              </div>
              <p className="text-sm text-slate-600 mb-5">{planoAtual.tagline}</p>

              <ul className="space-y-2.5 border-t border-slate-200 pt-5">
                {planoAtual.destaques.map((d) => (
                  <li key={d} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <IconCheck className="flex-shrink-0 mt-0.5 text-primary-600" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---------------- Coluna da direita: formulario ---------------- */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
            {status === 'ok' ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="mb-4 w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <IconCheck />
                </div>
                <p className="font-semibold text-slate-900 mb-1">
                  Recebemos seu contato!
                </p>
                <p className="text-sm text-slate-600 mb-6">
                  Seu interesse no plano <strong>{plano}</strong> foi registrado.
                  Um consultor vai falar com você pelos dados que deixou.
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
              <form onSubmit={onSubmit} className="space-y-5">
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
                  <label htmlFor="modal-nome" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nome *
                  </label>
                  <input
                    id="modal-nome"
                    ref={primeiroCampoRef}
                    name="nome"
                    required
                    minLength={2}
                    placeholder="Como podemos te chamar?"
                    className={campoBase}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="modal-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      E-mail *
                    </label>
                    <input
                      id="modal-email"
                      name="email"
                      type="email"
                      required
                      placeholder="voce@sualoteadora.com.br"
                      className={campoBase}
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-telefone" className="block text-sm font-medium text-slate-700 mb-1.5">
                      WhatsApp *
                    </label>
                    <input
                      id="modal-telefone"
                      name="telefone"
                      required
                      minLength={8}
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      className={campoBase}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="modal-plano" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Plano de interesse
                  </label>
                  <select
                    id="modal-plano"
                    name="plano"
                    value={plano}
                    onChange={(e) => setPlano(e.target.value)}
                    className={`${campoBase} bg-white`}
                  >
                    {planos.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} — R$ {p.price.toLocaleString('pt-BR')}/mês
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">
                    R$ {planoAtual.price.toLocaleString('pt-BR')}/mês — {planoAtual.tagline}.
                  </p>
                </div>

                <div>
                  <label htmlFor="modal-mensagem" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mensagem <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="modal-mensagem"
                    name="mensagem"
                    rows={3}
                    placeholder="Quantos loteamentos você tem hoje? Alguma dúvida específica?"
                    className={campoBase}
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
                  className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-semibold py-4 rounded-xl shadow-lg shadow-gold-600/25 transition"
                >
                  {status === 'enviando' ? 'Enviando...' : 'Quero uma demonstração'}
                  {status !== 'enviando' && <IconArrowRight />}
                </button>

                <p className="text-xs text-center text-slate-400">
                  Sem compromisso. Não enviamos spam.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
