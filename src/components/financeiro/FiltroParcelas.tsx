'use client';

/**
 * Filtro das parcelas do financeiro, em modal.
 *
 * Diferente das outras tabelas do sistema, aqui o recorte não acontece no
 * navegador: são milhares de parcelas, e mandá-las todas para a tela só para
 * poder filtrar seria peso sem retorno. O modal devolve os campos escolhidos e
 * quem busca é o banco, pela rota da tabela.
 */

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FILTRO_PARCELA_VAZIO, type FiltrosParcela } from '@/lib/parcelas-consulta';

const STATUS = ['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO', 'ESTORNADO'];

const FORMAS = [
  { value: 'PARCELADO_PIX', label: 'Pix' },
  { value: 'PARCELADO_BOLETO', label: 'Boleto' },
  { value: 'PARCELADO_CHEQUE', label: 'Cheque (parcelado)' },
  { value: 'A_VISTA_CHEQUE', label: 'Cheque (à vista)' },
  { value: 'A_VISTA_PIX', label: 'Pix (à vista)' },
  { value: 'A_VISTA_ESPECIE', label: 'Espécie' },
];

const campoClass =
  'w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

export function FiltroParcelas({
  atuais,
  onAplicar,
}: {
  atuais: FiltrosParcela;
  onAplicar: (f: FiltrosParcela) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<FiltrosParcela>(atuais);

  const ativos = Object.values(atuais).filter((v) => v !== '').length;

  function aplicar(f: FiltrosParcela) {
    onAplicar(f);
    setAberto(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setRascunho(atuais);
          setAberto(true);
        }}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Filtrar
        {ativos > 0 && (
          <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-semibold text-white">
            {ativos}
          </span>
        )}
      </button>
      {ativos > 0 && (
        <button
          type="button"
          onClick={() => aplicar(FILTRO_PARCELA_VAZIO)}
          className="text-xs text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
        >
          Limpar
        </button>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filtrar parcelas</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              aplicar(rascunho);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Status">
                <select
                  value={rascunho.status}
                  onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todos</option>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Forma de pagamento">
                <select
                  value={rascunho.forma}
                  onChange={(e) => setRascunho({ ...rascunho, forma: e.target.value })}
                  className={campoClass}
                >
                  <option value="">Todas</option>
                  {FORMAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Cliente">
                <input
                  value={rascunho.cliente}
                  onChange={(e) => setRascunho({ ...rascunho, cliente: e.target.value })}
                  placeholder="Nome ou CPF"
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Lote">
                <input
                  value={rascunho.lote}
                  onChange={(e) => setRascunho({ ...rascunho, lote: e.target.value })}
                  placeholder="L077"
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Loteamento">
                <input
                  value={rascunho.loteamento}
                  onChange={(e) => setRascunho({ ...rascunho, loteamento: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Valor (R$)">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={rascunho.valorMin}
                    onChange={(e) => setRascunho({ ...rascunho, valorMin: e.target.value })}
                    placeholder="mínimo"
                    className={campoClass}
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <input
                    type="number"
                    value={rascunho.valorMax}
                    onChange={(e) => setRascunho({ ...rascunho, valorMax: e.target.value })}
                    placeholder="máximo"
                    className={campoClass}
                  />
                </div>
              </Campo>
              <Campo rotulo="Vence de">
                <input
                  type="date"
                  value={rascunho.de}
                  onChange={(e) => setRascunho({ ...rascunho, de: e.target.value })}
                  className={campoClass}
                />
              </Campo>
              <Campo rotulo="Vence até">
                <input
                  type="date"
                  value={rascunho.ate}
                  onChange={(e) => setRascunho({ ...rascunho, ate: e.target.value })}
                  className={campoClass}
                />
              </Campo>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => setRascunho(FILTRO_PARCELA_VAZIO)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Limpar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
