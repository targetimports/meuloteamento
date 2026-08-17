'use client';

/**
 * Ajuste do valor da comissão numa venda já lançada.
 *
 * A tela mostra o que está comprometido antes de deixar digitar: comissão paga
 * saiu do caixa e liberada é compromisso com quem vendeu — nenhuma das duas
 * muda. O novo valor se distribui entre as que ainda estão bloqueadas, e é isso
 * que o resumo explica antes de confirmar.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatBRL } from '@/lib/format';
import { ajustarComissaoVenda } from '@/app/admin/(dashboard)/vendas/[id]/actions';

export function AjustarComissaoButton({
  vendaId,
  valorAtual,
  comprometido,
  bloqueadas,
}: {
  vendaId: string;
  valorAtual: number;
  /** Soma das comissões pagas e liberadas — o piso do novo total. */
  comprometido: number;
  bloqueadas: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(String(valorAtual));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const novo = Number(String(valor).replace(',', '.'));
  const valido = Number.isFinite(novo) && novo >= comprometido;
  const porParcela = bloqueadas > 0 ? (novo - comprometido) / bloqueadas : 0;

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await ajustarComissaoVenda(vendaId, novo, motivo.trim() || undefined);
      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível ajustar.');
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValor(String(valorAtual));
          setErro(null);
          setAberto(true);
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Ajustar comissão
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar comissão</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {bloqueadas === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Todas as comissões desta venda já foram liberadas ou pagas. Não há o que
                ajustar sem desfazer compromisso assumido com o corretor.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Valor total da comissão
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={comprometido}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <dt>Valor atual</dt>
                    <dd className="font-medium text-slate-900">{formatBRL(valorAtual)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Já pago ou liberado</dt>
                    <dd className="font-medium text-slate-900">{formatBRL(comprometido)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <dt>
                      A distribuir entre {bloqueadas}{' '}
                      {bloqueadas === 1 ? 'parcela bloqueada' : 'parcelas bloqueadas'}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {valido ? `${formatBRL(porParcela)} cada` : '—'}
                    </dd>
                  </div>
                </dl>

                <p className="text-[11px] text-slate-500">
                  Comissões já pagas ou liberadas não mudam: o cliente pagou a parcela que
                  as destravou, e o corretor tem direito a elas.
                </p>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Motivo (opcional)
                  </label>
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Renegociação com o corretor"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {!valido && Number.isFinite(novo) && (
                  <p className="text-xs text-red-600">
                    O total não pode ficar abaixo de {formatBRL(comprometido)}, que já está
                    comprometido.
                  </p>
                )}
                {erro && <p className="text-xs text-red-600">{erro}</p>}
              </>
            )}

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
              {bloqueadas > 0 && (
                <button
                  type="button"
                  onClick={salvar}
                  disabled={!valido || salvando}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
