'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { salvarTemplate, excluirTemplate } from './actions';
import { availableVariables } from '@/lib/template';

interface Initial {
  id?: string;
  nome: string;
  descricao?: string;
  conteudoHtml: string;
  ativo: boolean;
  default: boolean;
}

export default function TemplateForm({ initial }: { initial: Initial }) {
  const [state, formAction] = useFormState(salvarTemplate, { error: undefined } as { error?: string; ok?: boolean });
  const [preview, setPreview] = useState(initial.conteudoHtml);
  const variaveis = availableVariables().filter(
    (v) => !v.name.startsWith('parcela.')
  );

  async function deleteFn() {
    if (!initial.id) return;
    if (!confirm('Excluir este modelo? Vendas que usam ele preservam o HTML já gerado.')) return;
    await excluirTemplate(initial.id);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <form action={formAction} className="space-y-4 bg-white border border-slate-200 rounded-lg p-5">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input
            name="nome"
            defaultValue={initial.nome}
            required
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
          <input
            name="descricao"
            defaultValue={initial.descricao}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Conteúdo (HTML com variáveis {`{{cliente.nome}}`} etc.)
          </label>
          <textarea
            name="conteudoHtml"
            rows={20}
            defaultValue={initial.conteudoHtml}
            onChange={(e) => setPreview(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono"
            required
          />
        </div>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ativo" defaultChecked={initial.ativo} value="true" />
            Ativo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="default" defaultChecked={initial.default} value="true" />
            Modelo padrão para esta loteadora
          </label>
        </div>

        {state.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded px-3 py-2">
            Modelo salvo.
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-4 py-2 rounded text-sm"
          >
            Salvar
          </button>
          {initial.id && (
            <button
              type="button"
              onClick={deleteFn}
              className="bg-red-50 hover:bg-red-100 text-red-700 font-medium px-4 py-2 rounded text-sm"
            >
              Excluir
            </button>
          )}
        </div>
      </form>

      <aside className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-2 text-sm">Variáveis disponíveis</h3>
          <p className="text-xs text-slate-500 mb-3">
            Clique para copiar. Use {`{{nome}}`} no texto.
          </p>
          <ul className="space-y-1 text-xs">
            {variaveis.map((v) => (
              <li key={v.name}>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`{{${v.name}}}`)}
                  className="font-mono text-sky-600 hover:underline"
                  title={v.descricao}
                >
                  {`{{${v.name}}}`}
                </button>{' '}
                <span className="text-slate-500">— {v.descricao}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 mb-2 text-sm">Preview (HTML bruto)</h3>
          <div
            className="prose prose-sm max-w-none border border-dashed border-slate-300 rounded p-3 text-xs"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </aside>
    </div>
  );
}
