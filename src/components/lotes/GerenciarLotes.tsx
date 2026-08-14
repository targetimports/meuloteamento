'use client';

/**
 * Tela de lotes: tabela + cadastro e edição em modal.
 *
 * Antes a página empilhava o formulário de edição inteiro de cada lote, um
 * embaixo do outro. Com 200 lotes isso eram 200 formulários montados de uma
 * vez — a página não terminava de rolar, e achar um lote específico exigia
 * procurar com o Ctrl+F do navegador.
 *
 * A tabela mostra o que se olha (código, área, preço, situação) e guarda o que
 * se edita atrás de um clique. O formulário só existe no DOM quando alguém
 * abre o modal.
 */

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL, formatArea } from '@/lib/format';
import {
  NovoLoteForm,
  NovosLotesEmMassaForm,
  EditarLoteForm,
  type TipoLoteUI,
} from '@/components/LoteForms';
import {
  atualizarLote,
  criarLote,
  criarLotesEmMassa,
  excluirLote,
} from '@/app/admin/(dashboard)/loteamentos/[id]/lotes/actions';

export interface LoteLinha {
  id: string;
  codigo: string;
  quadra: string;
  area: number;
  preco: number;
  status: string;
  tipo: string;
  descricao: string | null;
  motivoBloqueio: string | null;
  orientacaoSolar: string | null;
  esquina: boolean;
  fronteAreaVerde: boolean;
  fotos: string[];
}

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  DISPONIVEL: { texto: 'Disponível', classe: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  RESERVADO: { texto: 'Reservado', classe: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  EM_PAGAMENTO: { texto: 'Em pagamento', classe: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  VENDIDO: { texto: 'Vendido', classe: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  BLOQUEADO: { texto: 'Bloqueado', classe: 'bg-red-50 text-red-700 ring-red-600/20' },
};

export function GerenciarLotes({
  loteamentoId,
  lotes,
  tipos,
}: {
  loteamentoId: string;
  lotes: LoteLinha[];
  tipos: TipoLoteUI[];
}) {
  const router = useRouter();
  const [cadastrando, setCadastrando] = useState(false);
  const [aba, setAba] = useState<'individual' | 'massa'>('individual');
  const [editando, setEditando] = useState<LoteLinha | null>(null);
  const [busca, setBusca] = useState('');
  const [excluindo, iniciarExclusao] = useTransition();

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lotes;
    return lotes.filter((l) => l.codigo.toLowerCase().includes(q));
  }, [lotes, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código (ex.: A-01)"
          className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={() => {
            setAba('individual');
            setCadastrando(true);
          }}
          className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition"
        >
          + Cadastrar lotes
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {visiveis.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            {lotes.length === 0
              ? 'Nenhum lote cadastrado ainda.'
              : 'Nenhum lote com esse código.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Código</th>
                  <th className="text-right font-medium px-5 py-2.5">Área</th>
                  <th className="text-right font-medium px-5 py-2.5">Preço</th>
                  <th className="text-left font-medium px-5 py-2.5">Tipo</th>
                  <th className="text-center font-medium px-5 py-2.5">Situação</th>
                  <th className="text-right font-medium px-5 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiveis.map((l) => {
                  const s = ROTULO_STATUS[l.status] ?? {
                    texto: l.status,
                    classe: 'bg-slate-100 text-slate-600 ring-slate-500/20',
                  };
                  const vendavel = l.status === 'DISPONIVEL' || l.status === 'RESERVADO';
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-2.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {l.codigo}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-600 whitespace-nowrap">
                        {formatArea(l.area)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-slate-900 whitespace-nowrap">
                        {formatBRL(l.preco)}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-slate-500">
                        {l.tipo === 'COMERCIAL' ? 'Comercial' : 'Residencial'}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span
                          className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${s.classe}`}
                        >
                          {s.texto}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {vendavel && (
                            <Link
                              href={`/admin/vendas/novo?lote=${l.id}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 hover:bg-primary-50 transition"
                            >
                              Vender
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditando(l)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {visiveis.length > 0 && (
        <p className="text-xs text-slate-400">
          {visiveis.length === lotes.length
            ? `${lotes.length} lote(s)`
            : `${visiveis.length} de ${lotes.length} lote(s)`}
        </p>
      )}

      {/* -------------------- Cadastro -------------------- */}
      <Dialog open={cadastrando} onOpenChange={setCadastrando}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cadastrar lotes</DialogTitle>
          </DialogHeader>

          {/* Duas formas de cadastrar o mesmo objeto: uma quadra inteira de uma
              vez, ou um lote com todos os detalhes. Abas em vez de dois
              formulários lado a lado — quem cadastra faz um ou outro. */}
          <div className="flex gap-1 border-b border-slate-200">
            {(
              [
                ['individual', 'Lote individual'],
                ['massa', 'Em massa'],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setAba(valor)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                  aba === valor
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="max-h-[65vh] overflow-y-auto pt-1">
            {aba === 'individual' ? (
              <NovoLoteForm
                embutido
                tipos={tipos}
                action={criarLote.bind(null, loteamentoId)}
              />
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Cadastra uma quadra inteira de uma vez. Todos os lotes saem com a mesma
                  área e preço — ajuste depois os que fugirem do padrão.
                </p>
                <NovosLotesEmMassaForm
                  embutido
                  tipos={tipos}
                  action={criarLotesEmMassa.bind(null, loteamentoId)}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* -------------------- Edição -------------------- */}
      <Dialog open={editando !== null} onOpenChange={(a) => !a && setEditando(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lote {editando?.codigo}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="max-h-[65vh] overflow-y-auto">
              <EditarLoteForm
                embutido
                tipos={tipos}
                loteId={editando.id}
                initial={{
                  area: editando.area,
                  preco: editando.preco,
                  descricao: editando.descricao,
                  status: editando.status,
                  motivoBloqueio: editando.motivoBloqueio,
                  orientacaoSolar: editando.orientacaoSolar,
                  esquina: editando.esquina,
                  fronteAreaVerde: editando.fronteAreaVerde,
                  fotos: editando.fotos,
                }}
                action={atualizarLote.bind(null, editando.id)}
                onDelete={async () => {
                  const alvo = editando.id;
                  iniciarExclusao(async () => {
                    await excluirLote(alvo);
                    setEditando(null);
                    router.refresh();
                  });
                }}
              />
              {excluindo && <p className="mt-2 text-xs text-slate-500">Excluindo…</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
