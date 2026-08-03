'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';
import {
  mudarStatusInteressado,
  responderInteressado,
  salvarObservacoes,
} from '@/app/backoffice/interessados/actions';

export interface InteressadoUI {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  plano: string;
  mensagem: string | null;
  status: 'NOVO' | 'NEGOCIANDO' | 'CLIENTE' | 'PERDIDO';
  observacoes: string | null;
  respondidoEm: string | null;
  createdAt: string;
}

const ROTULO_STATUS: Record<InteressadoUI['status'], string> = {
  NOVO: 'Novo',
  NEGOCIANDO: 'Negociando',
  CLIENTE: 'Cliente',
  PERDIDO: 'Perdido',
};

const COR_STATUS: Record<InteressadoUI['status'], string> = {
  NOVO: 'bg-sky-100 text-sky-700',
  NEGOCIANDO: 'bg-amber-100 text-amber-700',
  CLIENTE: 'bg-emerald-100 text-emerald-700',
  PERDIDO: 'bg-slate-200 text-slate-600',
};

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'há 1 dia';
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
}

export function InteressadosTabela({ itens }: { itens: InteressadoUI[] }) {
  const [aberto, setAberto] = useState<InteressadoUI | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function trocarStatus(id: string, status: InteressadoUI['status']) {
    setSalvando(true);
    const fd = new FormData();
    fd.set('id', id);
    fd.set('status', status);
    await mudarStatusInteressado({}, fd);
    setSalvando(false);
    setAberto(null);
  }

  async function gravarObservacoes(id: string, texto: string) {
    setSalvando(true);
    const fd = new FormData();
    fd.set('id', id);
    fd.set('observacoes', texto);
    await salvarObservacoes({}, fd);
    setSalvando(false);
  }

  if (!itens.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="text-slate-900 font-medium mb-1">Nenhum interessado por aqui</p>
        <p className="text-sm text-slate-500">
          Quem pedir contato pelos planos do site aparece nesta lista.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-600">
                <th className="px-4 py-3 font-medium">Interessado</th>
                <th className="px-4 py-3 font-medium">Mensagem</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Recebido</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-900">{i.nome}</p>
                    <p className="text-xs text-slate-500">{i.email}</p>
                  </td>
                  <td className="px-4 py-3 align-top max-w-sm">
                    <p className="text-slate-600 truncate">
                      {i.mensagem || <span className="text-slate-400">— sem mensagem —</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700">
                    {i.plano}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${COR_STATUS[i.status]}`}
                    >
                      {ROTULO_STATUS[i.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-500">
                    {tempoRelativo(i.createdAt)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setAberto(i)}
                        className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition whitespace-nowrap"
                      >
                        Responder
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {aberto && (
        <DetalheInteressado
          item={aberto}
          salvando={salvando}
          onFechar={() => setAberto(null)}
          onTrocarStatus={(s) => trocarStatus(aberto.id, s)}
          onSalvarObservacoes={(t) => gravarObservacoes(aberto.id, t)}
        />
      )}
    </>
  );
}

function DetalheInteressado({
  item,
  salvando,
  onFechar,
  onTrocarStatus,
  onSalvarObservacoes,
}: {
  item: InteressadoUI;
  salvando: boolean;
  onFechar: () => void;
  onTrocarStatus: (s: InteressadoUI['status']) => void;
  onSalvarObservacoes: (texto: string) => void;
}) {
  const [obs, setObs] = useState(item.observacoes ?? '');
  const [montado, setMontado] = useState(false);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [envioOk, setEnvioOk] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  async function enviarResposta() {
    setEnviando(true);
    setErroEnvio(null);
    const fd = new FormData();
    fd.set('id', item.id);
    fd.set('mensagem', resposta);
    const r = await responderInteressado({}, fd);
    setEnviando(false);
    if (r.error) {
      setErroEnvio(r.error);
      return;
    }
    setEnvioOk(true);
    setResposta('');
  }

  // Esc fecha e a rolagem do fundo trava, como no modal da landing.
  useEffect(() => {
    setMontado(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKey);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAntes;
    };
  }, [onFechar]);

  if (!montado) return null;

  /*
    Renderizado por portal no <body>: dentro do layout do admin o modal ficava
    preso abaixo da topbar (sticky z-30) e da sidebar, e o fundo escuro nao
    cobria o topo da tela. No body ele escapa de qualquer contexto de
    empilhamento — inclusive de ancestral com transform, que faz `fixed` se
    comportar como `absolute`.
  */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onFechar} aria-hidden />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-2 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
        >
          <IconX />
        </button>

        <div className="p-6 sm:p-8 pt-14">
          <div className="flex items-start gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{item.nome}</h2>
            <span
              className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${COR_STATUS[item.status]}`}
            >
              {ROTULO_STATUS[item.status]}
            </span>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Interesse no plano <strong className="text-slate-700">{item.plano}</strong> ·{' '}
            {tempoRelativo(item.createdAt)}
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-0.5">E-mail</p>
              <a href={`mailto:${item.email}`} className="text-sm text-slate-900 hover:underline break-all">
                {item.email}
              </a>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-0.5">WhatsApp</p>
              <a
                href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-900 hover:underline"
              >
                {item.telefone}
              </a>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Mensagem
          </p>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {item.mensagem || 'Não deixou mensagem.'}
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Anotações internas
          </p>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => obs !== (item.observacoes ?? '') && onSalvarObservacoes(obs)}
            rows={3}
            placeholder="O que foi conversado, próximos passos..."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 mb-6"
          />

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Situação
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {(['NOVO', 'NEGOCIANDO', 'CLIENTE', 'PERDIDO'] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={salvando || s === item.status}
                onClick={() => onTrocarStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-100 ${
                  s === item.status
                    ? `${COR_STATUS[s]} border-transparent cursor-default`
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {ROTULO_STATUS[s]}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Responder por e-mail
              </p>
              <p className="text-xs text-slate-400">
                {item.respondidoEm
                  ? `Respondido ${tempoRelativo(item.respondidoEm)}`
                  : 'Ainda não respondido'}
              </p>
            </div>

            {envioOk ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
                <p className="text-sm font-medium text-emerald-900">
                  Resposta enviada para {item.email}
                </p>
                <button
                  type="button"
                  onClick={() => setEnvioOk(false)}
                  className="mt-2 text-xs text-emerald-700 hover:underline"
                >
                  Escrever outra
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  rows={5}
                  placeholder={`Olá, ${item.nome.split(' ')[0]}! Obrigado pelo contato...`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Vai como e-mail de <strong>Meu Loteamento</strong> para {item.email}. A
                  saudação e a assinatura são adicionadas automaticamente.
                </p>

                {erroEnvio && (
                  <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    {erroEnvio}
                  </p>
                )}

                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    disabled={enviando || resposta.trim().length < 5}
                    onClick={enviarResposta}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition"
                  >
                    {enviando ? 'Enviando...' : 'Enviar resposta'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
