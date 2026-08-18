'use client';

/**
 * Edição de uma régua de cobrança.
 *
 * Os passos eram blocos empilhados com rótulo em cima de cada valor. Em
 * tabela, a coluna "Quando" fica em ordem e dá para ler a régua como o que
 * ela é: uma sequência de avisos ao redor do vencimento.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useFormState } from 'react-dom';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const CANAL_LABEL: Record<Passo['canal'], string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  SMS: 'SMS',
};

/** As que fazem sentido numa mensagem de cobrança — o resto é do contrato. */
const VARIAVEIS = [
  '{{cliente.nome}}',
  '{{parcela.numero}}',
  '{{parcela.valor}}',
  '{{parcela.vencimento}}',
  '{{parcela.diasAtraso}}',
  '{{parcela.pixCode}}',
  '{{parcela.boletoUrl}}',
];

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500';

function descrOffset(d: number) {
  if (d === 0) return 'No dia do vencimento';
  if (d < 0) return `${Math.abs(d)} dia${Math.abs(d) > 1 ? 's' : ''} antes`;
  return `${d} dia${d > 1 ? 's' : ''} após`;
}

export default function ReguaEditor({ regua, emUso }: Props) {
  const [meta, metaAction] = useFormState(atualizarRegua.bind(null, regua.id), {} as {
    error?: string;
    ok?: boolean;
  });
  const [novo, novoAction] = useFormState(adicionarPasso.bind(null, regua.id), {} as {
    error?: string;
    ok?: boolean;
  });
  const [adicionando, setAdicionando] = useState(false);

  async function alternarUso() {
    if (emUso) {
      if (!confirm('Desativar esta régua? Vai parar de enviar avisos automaticamente.')) return;
      await desativarRegua(regua.id);
    } else {
      await ativarRegua(regua.id);
    }
  }

  async function remover(passoId: string) {
    if (!confirm('Remover este passo?')) return;
    await removerPasso(passoId, regua.id);
  }

  // Antes do vencimento primeiro, depois o dia, depois os atrasos — a ordem
  // em que os avisos saem.
  const passos = [...regua.passos].sort((a, b) => a.diasOffset - b.diasOffset);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/regua-cobranca"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Réguas de cobrança
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{regua.nome}</h1>
              <span
                className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                  emUso
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                }`}
              >
                {emUso ? 'Em uso' : 'Não está em uso'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {emUso
                ? 'Os avisos desta régua estão saindo automaticamente.'
                : 'Nenhum aviso sai enquanto ela não for ativada.'}
            </p>
          </div>
          <button
            type="button"
            onClick={alternarUso}
            className={
              emUso
                ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50'
                : 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800'
            }
          >
            {emUso ? 'Parar envios' : 'Ativar esta régua'}
          </button>
        </div>
      </div>

      <form action={metaAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
            <input name="nome" defaultValue={regua.nome} required className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Descrição</label>
            <input name="descricao" defaultValue={regua.descricao} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="ativa"
            value="true"
            defaultChecked={regua.ativa}
            className="h-4 w-4 rounded border-slate-300"
          />
          Disponível para uso
        </label>

        {meta.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {meta.error}
          </p>
        )}
        {meta.ok && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Alterações salvas.
          </p>
        )}

        <div className="border-t border-slate-100 pt-4">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Salvar
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Passos</h2>
            <p className="text-sm text-slate-500">
              {passos.length === 0
                ? 'Cada passo é um aviso enviado em relação à data de vencimento.'
                : `${passos.length} aviso(s), do mais adiantado ao mais atrasado.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Adicionar passo
          </button>
        </div>

        {passos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Nenhum passo ainda. Sem passos, a régua não envia nada mesmo estando ativa.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Quando</th>
                    <th className="px-4 py-3 text-left font-semibold">Canal</th>
                    <th className="px-4 py-3 text-left font-semibold">Mensagem</th>
                    <th className="px-4 py-3 text-left font-semibold">Situação</th>
                    <th className="px-4 py-3 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {passos.map((p) => (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-slate-50 ${p.ativo ? '' : 'opacity-60'}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {descrOffset(p.diasOffset)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {CANAL_LABEL[p.canal]}
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-3 max-w-xl whitespace-pre-wrap break-words text-xs text-slate-600">
                          {p.template}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                            p.ativo
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                              : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                          }`}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remover(p.id)}
                          className="text-xs font-medium text-red-600 transition hover:underline"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <Dialog open={adicionando} onOpenChange={setAdicionando}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar passo</DialogTitle>
            <p className="text-sm text-slate-500">
              O aviso sai em relação ao vencimento da parcela: negativo antes, positivo depois.
            </p>
          </DialogHeader>

          <form action={novoAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Dias</label>
                <input
                  type="number"
                  name="diasOffset"
                  required
                  placeholder="-3"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-slate-400">−3 = três dias antes.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Canal</label>
                <select name="canal" className={inputCls} defaultValue="WHATSAPP">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="ativo"
                    value="true"
                    defaultChecked
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Ativo
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Mensagem</label>
              <textarea
                name="template"
                rows={5}
                required
                placeholder="Olá {{cliente.nome}}, sua parcela {{parcela.numero}} de {{parcela.valor}} vence em {{parcela.vencimento}}."
                className={inputCls}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Variáveis:</span>
                {VARIAVEIS.map((v) => (
                  <code
                    key={v}
                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>

            {novo.error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {novo.error}
              </p>
            )}
            {novo.ok && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Passo adicionado.
              </p>
            )}

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setAdicionando(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
