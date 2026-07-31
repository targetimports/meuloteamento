'use client';

import { useState } from 'react';
import { IconX } from './icons';
import {
  mudarStatusInteressado,
  marcarComoRespondido,
  salvarObservacoes,
} from '@/app/admin/(dashboard)/interessados/actions';

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

  async function responder(i: InteressadoUI) {
    const assunto = `Sobre seu interesse no plano ${i.plano} — meuloteamento`;
    const corpo =
      `Olá, ${i.nome.split(' ')[0]}!\n\n` +
      `Recebemos seu contato sobre o plano ${i.plano}.\n\n`;
    window.location.href =
      `mailto:${i.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

    const fd = new FormData();
    fd.set('id', i.id);
    await marcarComoRespondido({}, fd);
  }

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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAberto(i)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium transition whitespace-nowrap"
                      >
                        Ver mensagem
                      </button>
                      <button
                        type="button"
                        onClick={() => responder(i)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition whitespace-nowrap"
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
          onResponder={() => responder(aberto)}
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
  onResponder,
  onTrocarStatus,
  onSalvarObservacoes,
}: {
  item: InteressadoUI;
  salvando: boolean;
  onFechar: () => void;
  onResponder: () => void;
  onTrocarStatus: (s: InteressadoUI['status']) => void;
  onSalvarObservacoes: (texto: string) => void;
}) {
  const [obs, setObs] = useState(item.observacoes ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onFechar} aria-hidden />

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

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p className="text-xs text-slate-400">
              {item.respondidoEm
                ? `Respondido ${tempoRelativo(item.respondidoEm)}`
                : 'Ainda não respondido'}
            </p>
            <button
              type="button"
              onClick={onResponder}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
            >
              Responder por e-mail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
