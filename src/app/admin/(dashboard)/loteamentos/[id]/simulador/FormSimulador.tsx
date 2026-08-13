'use client';

/**
 * Configuração do simulador, com prévia do resultado ao lado.
 *
 * A prévia existe porque a relação entre os campos não é óbvia: preço, entrada
 * e valor da parcela juntos definem a taxa de juros embutida, e ninguém
 * consegue prever de cabeça que juro sai de "50.000, entrada 1.000, 60x de
 * 1.000". Mostrar a taxa e o total enquanto se digita transforma tentativa e
 * erro em decisão.
 */

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

interface Props {
  loteamentoId: string;
  inicial: {
    simPrecoResidencial: string;
    simPrecoComercial: string;
    simEntradaMinima: string;
    simParcelas: string;
    simValorParcela: string;
    simEntradasSugeridas: string;
  };
  /** Padrões usados quando o campo fica vazio — os mesmos do componente. */
  padroes: {
    preco: number;
    entrada: number;
    parcelas: number;
    valorParcela: number;
  };
  action: (
    loteamentoId: string,
    prev: { ok?: boolean; error?: string },
    formData: FormData
  ) => Promise<{ ok?: boolean; error?: string }>;
}

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition';

function num(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Mesma matemática do simulador público: taxa Price a partir da condição. */
function taxaPrice(pv: number, pmt: number, n: number): number | null {
  if (pv <= 0 || pmt <= 0 || n <= 0) return null;
  if (pmt * n <= pv) return null; // sem juros embutido — condição inválida
  let lo = 0.000001;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const calc = (pv * mid * Math.pow(1 + mid, n)) / (Math.pow(1 + mid, n) - 1);
    if (calc > pmt) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando…' : 'Salvar parâmetros'}
    </button>
  );
}

export function FormSimulador({ loteamentoId, inicial, padroes, action }: Props) {
  const [estado, formAction] = useFormState(action.bind(null, loteamentoId), {});

  const [preco, setPreco] = useState(inicial.simPrecoResidencial);
  const [entrada, setEntrada] = useState(inicial.simEntradaMinima);
  const [parcelas, setParcelas] = useState(inicial.simParcelas);
  const [valorParcela, setValorParcela] = useState(inicial.simValorParcela);

  // Prévia calculada com os mesmos fallbacks do simulador público, para o que
  // se vê aqui ser o que o visitante verá.
  const previa = useMemo(() => {
    const p = num(preco) ?? padroes.preco;
    const e = num(entrada) ?? padroes.entrada;
    const n = Number(parcelas.trim()) || padroes.parcelas;
    const pmt = num(valorParcela) ?? padroes.valorParcela;

    const saldo = p - e;
    const total = e + pmt * n;
    const taxa = taxaPrice(saldo, pmt, n);

    return {
      preco: p,
      entrada: e,
      saldo,
      parcelas: n,
      valorParcela: pmt,
      total,
      juros: total - p,
      taxaMensal: taxa,
      invalido: saldo <= 0 || pmt * n < saldo,
    };
  }, [preco, entrada, parcelas, valorParcela, padroes]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-5">
      {/* ---------------- Campos ---------------- */}
      <div className="lg:col-span-3 space-y-5">
        {estado.error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            Parâmetros salvos. O simulador público já está usando os novos valores.
          </p>
        )}

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900">Condição de referência</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            É desta combinação que o simulador deduz a taxa de juros. Deve
            refletir a condição padrão que a loteadora pratica hoje.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="simPrecoResidencial" className="block text-xs font-medium text-slate-600 mb-1">
                Preço do lote à vista (R$)
              </label>
              <input
                id="simPrecoResidencial"
                name="simPrecoResidencial"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder={String(padroes.preco)}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="simEntradaMinima" className="block text-xs font-medium text-slate-600 mb-1">
                Entrada mínima (R$)
              </label>
              <input
                id="simEntradaMinima"
                name="simEntradaMinima"
                inputMode="decimal"
                value={entrada}
                onChange={(e) => setEntrada(e.target.value)}
                placeholder={String(padroes.entrada)}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="simParcelas" className="block text-xs font-medium text-slate-600 mb-1">
                Prazo máximo (parcelas)
              </label>
              <input
                id="simParcelas"
                name="simParcelas"
                inputMode="numeric"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                placeholder={String(padroes.parcelas)}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="simValorParcela" className="block text-xs font-medium text-slate-600 mb-1">
                Parcela nessa condição (R$)
              </label>
              <input
                id="simValorParcela"
                name="simValorParcela"
                inputMode="decimal"
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                placeholder={String(padroes.valorParcela)}
                className={campo}
              />
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900">Ajustes do simulador</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Opcionais. Em branco, o simulador decide sozinho.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="simEntradasSugeridas" className="block text-xs font-medium text-slate-600 mb-1">
                Atalhos de entrada
              </label>
              <input
                id="simEntradasSugeridas"
                name="simEntradasSugeridas"
                defaultValue={inicial.simEntradasSugeridas}
                placeholder="1000, 5000, 10000, 20000"
                className={campo}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Botões de valor rápido, separados por vírgula.
              </p>
            </div>
            <div>
              <label htmlFor="simPrecoComercial" className="block text-xs font-medium text-slate-600 mb-1">
                Preço do lote comercial (R$)
              </label>
              <input
                id="simPrecoComercial"
                name="simPrecoComercial"
                inputMode="decimal"
                defaultValue={inicial.simPrecoComercial}
                placeholder="só se houver lote comercial"
                className={campo}
              />
            </div>
          </div>
        </section>

        <Botao />
      </div>

      {/* ---------------- Prévia ---------------- */}
      <aside className="lg:col-span-2">
        <div className="bg-slate-900 text-white rounded-xl p-5 sticky top-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Prévia — o que o visitante vê
          </p>

          {previa.invalido ? (
            <p className="mt-4 text-sm text-amber-300">
              Condição inválida: a parcela não cobre o saldo financiado. Aumente
              o valor da parcela ou o prazo.
            </p>
          ) : (
            <>
              <p className="text-3xl font-bold mt-2 tabular-nums">
                {brl(previa.valorParcela)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Por {previa.parcelas} meses, após entrada de {brl(previa.entrada)}.
              </p>

              <dl className="mt-5 space-y-2 text-sm border-t border-slate-700 pt-4">
                <Linha rotulo="Valor do lote" valor={brl(previa.preco)} />
                <Linha rotulo="Entrada mínima" valor={brl(previa.entrada)} />
                <Linha rotulo="Saldo financiado" valor={brl(previa.saldo)} />
                <Linha rotulo="Total a pagar" valor={brl(previa.total)} destaque />
                <Linha rotulo="Juros embutidos" valor={brl(previa.juros)} />
                {previa.taxaMensal !== null && (
                  <Linha
                    rotulo="Taxa implícita"
                    valor={`${(previa.taxaMensal * 100).toFixed(2)}% a.m.`}
                  />
                )}
              </dl>

              {/* Sem esta linha, uma taxa alta passaria despercebida — quem
                  configura olha o valor da parcela, não o juro que ela gera. */}
              {previa.taxaMensal !== null && previa.taxaMensal > 0.02 && (
                <p className="mt-4 text-xs text-amber-300 bg-amber-500/10 rounded-lg p-3">
                  A taxa implícita está acima de 2% ao mês. Confira se é mesmo a
                  condição praticada.
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </form>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-400 text-xs">{rotulo}</dt>
      <dd className={`tabular-nums ${destaque ? 'font-semibold text-white' : 'text-slate-200'}`}>
        {valor}
      </dd>
    </div>
  );
}
