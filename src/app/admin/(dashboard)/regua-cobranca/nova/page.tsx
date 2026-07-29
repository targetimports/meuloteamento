'use client';

import { useFormState } from 'react-dom';
import { criarRegua } from '../actions';

const TEMPLATE_PADRAO_WHATSAPP_D3 = `Olá {{cliente.nome}}, sua parcela {{parcela.numero}} de {{parcela.valor}} vence em {{parcela.vencimento}}. PIX copia-e-cola: {{parcela.pixCode}}`;

export default function NovaReguaPage() {
  const [state, action] = useFormState(criarRegua, { error: undefined } as { error?: string });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Nova régua de cobrança</h1>

      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900">
        Sugestão de passos para você adicionar depois:
        <ul className="list-disc ml-5 mt-2 space-y-0.5 text-amber-800 text-xs">
          <li><strong>−3 dias</strong> · WhatsApp lembrete</li>
          <li><strong>0</strong> · WhatsApp aviso vencimento</li>
          <li><strong>+3 dias</strong> · WhatsApp cobrança suave</li>
          <li><strong>+7 dias</strong> · E-mail formal</li>
          <li><strong>+15 dias</strong> · WhatsApp + e-mail última chance</li>
        </ul>
      </div>

      <form action={action} className="space-y-4 bg-white border border-slate-200 rounded-lg p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome da régua</label>
          <input
            name="nome"
            required
            placeholder="Ex: Régua padrão 2026"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <input
            name="descricao"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativa" value="true" defaultChecked />
          Ativa
        </label>
        {state.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
            {state.error}
          </div>
        )}
        <button
          type="submit"
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-4 py-2 rounded text-sm"
        >
          Criar
        </button>
      </form>
    </div>
  );
}
