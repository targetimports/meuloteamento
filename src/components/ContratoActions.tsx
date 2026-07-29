'use client';

import { useTransition, useState } from 'react';
import {
  gerarContratoAction,
  enviarParaAssinaturaAction,
  salvarContratoEditadoAction,
} from '@/app/admin/(dashboard)/contratos/actions';

interface Props {
  vendaId: string;
  contratoStatus: string;
  contratoHtml: string | null;
  contratoSignerUrl: string | null;
  templates: { id: string; nome: string; default: boolean }[];
}

export default function ContratoActions({
  vendaId,
  contratoStatus,
  contratoHtml,
  contratoSignerUrl,
  templates,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState<string>(
    templates.find((t) => t.default)?.id ?? templates[0]?.id ?? ''
  );
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const [editando, setEditando] = useState(false);
  const [htmlEdit, setHtmlEdit] = useState<string>(contratoHtml ?? '');

  function abrirEditor() {
    setHtmlEdit(contratoHtml ?? '');
    setEditando(true);
    setMsg(null);
  }

  function salvarEdicao() {
    startTransition(async () => {
      setMsg(null);
      const r = await salvarContratoEditadoAction(vendaId, htmlEdit);
      if (r.ok) {
        setEditando(false);
        setMsg({ tipo: 'ok', texto: 'Contrato salvo' });
      } else {
        setMsg({ tipo: 'erro', texto: r.error ?? 'Erro ao salvar' });
      }
    });
  }

  function gerar() {
    startTransition(async () => {
      setMsg(null);
      const r = await gerarContratoAction(vendaId, templateId || null);
      setMsg({ tipo: r.ok ? 'ok' : 'erro', texto: r.ok ? 'Contrato gerado' : r.error ?? 'Erro' });
    });
  }

  function enviar() {
    startTransition(async () => {
      setMsg(null);
      const r = await enviarParaAssinaturaAction(vendaId);
      setMsg({ tipo: r.ok ? 'ok' : 'erro', texto: r.ok ? 'Enviado para assinatura' : r.erro ?? 'Erro' });
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Contrato digital</h3>
        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{contratoStatus}</span>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum modelo cadastrado.{' '}
          <a href="/admin/contratos/novo" className="text-sky-600 hover:underline">
            Criar modelo
          </a>
        </p>
      ) : (
        <>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Modelo</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} {t.default ? '(padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={gerar}
              disabled={isPending}
              className="text-sm bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white px-3 py-1.5 rounded"
            >
              {contratoHtml ? 'Regenerar contrato' : 'Gerar contrato'}
            </button>
            {contratoHtml && (
              <a
                href={`/api/admin/vendas/${vendaId}/contrato`}
                target="_blank"
                rel="noreferrer"
                className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded"
              >
                Ver / imprimir
              </a>
            )}
            {contratoHtml && contratoStatus !== 'ASSINADO' && (
              <button
                onClick={abrirEditor}
                disabled={isPending}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-3 py-1.5 rounded"
              >
                Editar contrato
              </button>
            )}
            {contratoHtml && contratoStatus !== 'ASSINADO' && (
              <button
                onClick={enviar}
                disabled={isPending}
                className="text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-3 py-1.5 rounded"
              >
                Enviar para assinatura
              </button>
            )}
            {contratoSignerUrl && (
              <a
                href={contratoSignerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded"
              >
                Link de assinatura
              </a>
            )}
          </div>

          {editando && (
            <div className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-indigo-50/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">
                  Editar HTML do contrato desta venda
                </label>
                <span className="text-[11px] text-slate-500">
                  Ajuste pontual — não sobrescreve o modelo
                </span>
              </div>
              <textarea
                value={htmlEdit}
                onChange={(e) => setHtmlEdit(e.target.value)}
                rows={18}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono"
              />
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-500 mb-1">Preview</div>
                  <div
                    className="prose prose-sm max-w-none border border-dashed border-slate-300 rounded p-3 text-xs bg-white max-h-64 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: htmlEdit }}
                  />
                </div>
                <div className="flex flex-col gap-2 justify-end">
                  <button
                    onClick={salvarEdicao}
                    disabled={isPending}
                    className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-3 py-1.5 rounded"
                  >
                    Salvar contrato
                  </button>
                  <button
                    onClick={() => setEditando(false)}
                    disabled={isPending}
                    className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {msg && (
        <div
          className={`text-sm rounded px-3 py-2 ${
            msg.tipo === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {msg.texto}
        </div>
      )}
    </div>
  );
}
