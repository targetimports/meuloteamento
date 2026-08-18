'use client';

/**
 * Edição de um modelo de contrato.
 *
 * A lista de variáveis e a pré-visualização ficavam numa coluna estreita ao
 * lado do formulário: a lista tinha 50 itens e empurrava a pré-visualização
 * para fora da tela, e a pré-visualização mostrava o HTML numa largura de
 * 320px, onde nada se parece com o contrato impresso.
 *
 * Agora as variáveis abrem em modal (consulta pontual, não companhia
 * permanente) e a pré-visualização fica abaixo do formulário, com a largura
 * inteira, dentro de um iframe — que é o que faz o modelo aparecer como o
 * cliente vai receber, e não como marcação.
 */

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { availableVariables, renderTemplate } from '@/lib/template';
import { contextoDeExemplo } from '@/lib/template-exemplo';
import { salvarTemplate, excluirTemplate } from './actions';

interface Initial {
  id?: string;
  nome: string;
  descricao?: string;
  conteudoHtml: string;
  ativo: boolean;
  default: boolean;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

const GRUPOS: Record<string, string> = {
  cliente: 'Cliente',
  lote: 'Lote',
  loteamento: 'Loteamento',
  venda: 'Venda',
  loteadora: 'Loteadora',
};

/**
 * Folha de estilo da pré-visualização.
 *
 * O modelo é um fragmento de HTML, sem `<head>` — sem isto ele herdaria a
 * fonte padrão do navegador em largura total, que não se parece com a página
 * que sai na impressão.
 */
const ESTILO_PREVIA = `
  body {
    margin: 0;
    padding: 32px 40px;
    background: #fff;
    color: #0f172a;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12px;
    line-height: 1.6;
    text-align: justify;
  }
  h1, h2, h3 { font-family: Georgia, serif; line-height: 1.3; text-align: left; }
  h1 { font-size: 17px; } h2 { font-size: 15px; } h3 { font-size: 13px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 4px 6px; }
  img { max-width: 100%; }
`;

export default function TemplateForm({ initial }: { initial: Initial }) {
  const [state, formAction] = useFormState(salvarTemplate, {} as {
    error?: string;
    ok?: boolean;
  });
  const [html, setHtml] = useState(initial.conteudoHtml);
  const [comExemplo, setComExemplo] = useState(true);
  const [verVariaveis, setVerVariaveis] = useState(false);
  const [copiada, setCopiada] = useState<string | null>(null);

  // A digitação não repinta o iframe a cada tecla: recarregar o documento
  // inteiro a 60 vezes por segundo trava o campo de texto.
  const [htmlAtrasado, setHtmlAtrasado] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setHtmlAtrasado(html), 400);
    return () => clearTimeout(t);
  }, [html]);

  const variaveis = useMemo(
    () => availableVariables().filter((v) => !v.name.startsWith('parcela.')),
    []
  );

  const porGrupo = useMemo(() => {
    const mapa = new Map<string, typeof variaveis>();
    for (const v of variaveis) {
      const grupo = v.name.split('.')[0];
      if (!mapa.has(grupo)) mapa.set(grupo, []);
      mapa.get(grupo)!.push(v);
    }
    return [...mapa.entries()];
  }, [variaveis]);

  const documento = useMemo(() => {
    const corpo = comExemplo
      ? renderTemplate(htmlAtrasado, contextoDeExemplo())
      : htmlAtrasado;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${ESTILO_PREVIA}</style></head><body>${corpo}</body></html>`;
  }, [htmlAtrasado, comExemplo]);

  async function copiar(nome: string) {
    try {
      await navigator.clipboard.writeText(`{{${nome}}}`);
      setCopiada(nome);
      setTimeout(() => setCopiada(null), 1500);
    } catch {
      /* navegador sem permissão de área de transferência: o texto está à vista */
    }
  }

  async function excluir() {
    if (!initial.id) return;
    if (!confirm('Excluir este modelo? Vendas que usam ele preservam o HTML já gerado.')) return;
    await excluirTemplate(initial.id);
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
            <input name="nome" defaultValue={initial.nome} required className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
            <input name="descricao" defaultValue={initial.descricao} className={inputCls} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-medium text-slate-600">Conteúdo do modelo (HTML)</label>
            <button
              type="button"
              onClick={() => setVerVariaveis(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Variáveis disponíveis
            </button>
          </div>
          <textarea
            name="conteudoHtml"
            rows={18}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={initial.ativo}
              value="true"
              className="h-4 w-4 rounded border-slate-300"
            />
            Ativo
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              name="default"
              defaultChecked={initial.default}
              value="true"
              className="h-4 w-4 rounded border-slate-300"
            />
            Modelo padrão para esta loteadora
          </label>
        </div>

        {state.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Modelo salvo.
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Salvar
          </button>
          {initial.id && (
            <button
              type="button"
              onClick={excluir}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Excluir
            </button>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Pré-visualização</h2>
            <p className="text-xs text-slate-500">
              {comExemplo
                ? 'Com dados fictícios, como o cliente vai receber.'
                : 'Com as variáveis à mostra, como estão no modelo.'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={comExemplo}
              onChange={(e) => setComExemplo(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Preencher com dados de exemplo
          </label>
        </div>
        {/* `sandbox` vazio: o modelo é HTML que alguém digitou, e um script
            dentro dele não tem por que rodar com a sessão do admin. */}
        <iframe
          title="Pré-visualização do contrato"
          srcDoc={documento}
          sandbox=""
          className="h-[70vh] w-full border-0 bg-white"
        />
      </section>

      <Dialog open={verVariaveis} onOpenChange={setVerVariaveis}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Variáveis disponíveis</DialogTitle>
            <p className="text-sm text-slate-500">
              Clique para copiar e cole no modelo. Cada uma é trocada pelo dado da venda na hora
              de gerar o contrato.
            </p>
          </DialogHeader>

          <div className="space-y-5">
            {porGrupo.map(([grupo, itens]) => (
              <div key={grupo}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {GRUPOS[grupo] ?? grupo}
                </h3>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {itens.map((v) => (
                    <li key={v.name}>
                      <button
                        type="button"
                        onClick={() => copiar(v.name)}
                        className="flex w-full items-baseline gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
                        title="Copiar"
                      >
                        <code className="shrink-0 font-mono text-xs text-primary-700">
                          {`{{${v.name}}}`}
                        </code>
                        <span className="min-w-0 flex-1 text-xs text-slate-500">{v.descricao}</span>
                        <span
                          className={`shrink-0 text-[11px] font-medium text-emerald-600 ${
                            copiada === v.name ? '' : 'invisible'
                          }`}
                        >
                          copiada
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
