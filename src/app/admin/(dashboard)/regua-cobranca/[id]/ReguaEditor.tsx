'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import {
  atualizarRegua,
  adicionarPasso,
  removerPasso,
  ativarRegua,
  desativarRegua,
} from '../actions';

interface Passo {
  id: string;
  diasOffset: number;
  canal: 'WHATSAPP' | 'EMAIL' | 'SMS';
  template: string;
  ativo: boolean;
}

interface Props {
  regua: {
    id: string;
    nome: string;
    descricao: string;
    ativa: boolean;
    passos: Passo[];
  };
  emUso: boolean;
}

function descrOffset(d: number) {
  if (d === 0) return 'No dia do vencimento';
  if (d < 0) return `${Math.abs(d)} dia${Math.abs(d) > 1 ? 's' : ''} antes`;
  return `${d} dia${d > 1 ? 's' : ''} após`;
}

export default function ReguaEditor({ regua, emUso }: Props) {
  const [meta, metaAction] = useFormState(
    atualizarRegua.bind(null, regua.id),
    { error: undefined } as { error?: string; ok?: boolean }
  );
  const [novo, novoAction] = useFormState(
    adicionarPasso.bind(null, regua.id),
    { error: undefined } as { error?: string; ok?: boolean }
  );
  const [confirmaAtivacao, setConfirmaAtivacao] = useState(false);

  async function toggleAtivacao() {
    if (emUso) {
      if (!confirm('Desativar esta régua? Vai parar de enviar avisos automaticamente.')) return;
      await desativarRegua(regua.id);
    } else {
      await ativarRegua(regua.id);
    }
    setConfirmaAtivacao(false);
  }

  async function remover(passoId: string) {
    if (!confirm('Remover este passo?')) return;
    await removerPasso(passoId, regua.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{regua.nome}</h1>
        <button
          onClick={toggleAtivacao}
          className={`text-sm font-medium px-3 py-2 rounded ${
            emUso
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {emUso ? 'Desativar (parar envios)' : 'Ativar esta régua'}
        </button>
      </div>

      <form action={metaAction} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input
              name="nome"
              defaultValue={regua.nome}
              required
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              name="descricao"
              defaultValue={regua.descricao}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativa" value="true" defaultChecked={regua.ativa} />
          Ativa (permite ser usada)
        </label>
        {meta.error && (
          <div className="text-sm text-red-700">{meta.error}</div>
        )}
        {meta.ok && <div className="text-sm text-emerald-700">Salvo</div>}
        <button className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded">
          Salvar
        </button>
      </form>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Passos ({regua.passos.length})
        </h2>

        <div className="space-y-2 mb-4">
          {regua.passos.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded p-3 flex items-start gap-3">
              <div className="text-center flex-shrink-0 w-24">
                <div className="text-xs text-slate-500">Quando</div>
                <div className="font-medium text-slate-900 text-sm">{descrOffset(p.diasOffset)}</div>
              </div>
              <div className="flex-shrink-0 w-24">
                <div className="text-xs text-slate-500">Canal</div>
                <div className="font-medium text-slate-900 text-sm">{p.canal}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500">Mensagem</div>
                <div className="text-sm text-slate-800 line-clamp-3 whitespace-pre-wrap break-words">
                  {p.template}
                </div>
              </div>
              <button
                onClick={() => remover(p.id)}
                className="text-xs text-red-600 hover:underline flex-shrink-0"
              >
                Remover
              </button>
            </div>
          ))}
          {regua.passos.length === 0 && (
            <div className="text-sm text-slate-500">Nenhum passo. Adicione abaixo.</div>
          )}
        </div>

        <form action={novoAction} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="text-sm font-semibold text-slate-900">Adicionar passo</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Dias (negativo = antes; positivo = após)
              </label>
              <input
                type="number"
                name="diasOffset"
                required
                placeholder="-3"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Canal</label>
              <select
                name="canal"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">E-mail</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ativo" value="true" defaultChecked />
                Ativo
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Mensagem (use {`{{cliente.nome}}`}, {`{{parcela.numero}}`}, {`{{parcela.valor}}`}, etc.)
            </label>
            <textarea
              name="template"
              rows={4}
              required
              placeholder="Olá {{cliente.nome}}, sua parcela {{parcela.numero}} de {{parcela.valor}} vence em {{parcela.vencimento}}."
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </div>
          {novo.error && <div className="text-sm text-red-700">{novo.error}</div>}
          {novo.ok && <div className="text-sm text-emerald-700">Passo adicionado</div>}
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded">
            Adicionar passo
          </button>
        </form>
      </section>
    </div>
  );
}
