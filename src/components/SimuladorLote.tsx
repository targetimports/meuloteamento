'use client';

/**
 * Simulador de financiamento de lote — embedado na landing page pública.
 * O cliente brinca com entrada/parcelas/valor e vê a parcela mensal calculada.
 * Inspirado nos sites Lotear/Terravista.
 */

import { useMemo, useState } from 'react';
import { IconCalc, IconWhatsApp } from './icons';

interface Props {
  /** Valor padrão do lote (mediano do empreendimento) */
  precoMedio: number;
  /** Range — valor mínimo e máximo de lote do loteamento */
  precoMin: number;
  precoMax: number;
  /** Cor primária do loteamento */
  corPrimaria?: string;
  /** Telefone WhatsApp da loteadora (para CTA de contato) */
  whatsapp?: string;
  /** Slug do loteamento (para mensagem) */
  loteamentoNome?: string;
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function SimuladorLote({
  precoMedio,
  precoMin,
  precoMax,
  corPrimaria = '#0ea5e9',
  whatsapp,
  loteamentoNome,
}: Props) {
  const [valor, setValor] = useState(Math.round(precoMedio));
  const [entradaPct, setEntradaPct] = useState(30);
  const [parcelas, setParcelas] = useState(60);

  const calc = useMemo(() => {
    const entrada = (valor * entradaPct) / 100;
    const saldo = valor - entrada;
    const parcelaMensal = parcelas > 0 ? saldo / parcelas : saldo;
    return { entrada, saldo, parcelaMensal };
  }, [valor, entradaPct, parcelas]);

  const sliderStyle = (value: number, min: number, max: number): React.CSSProperties => {
    const pct = ((value - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, ${corPrimaria} 0%, ${corPrimaria} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
    };
  };

  const whatsappMsg = whatsapp
    ? `https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Olá! Simulei um lote ${loteamentoNome ? `em ${loteamentoNome} ` : ''}por ${brl(valor)}: ${brl(calc.entrada)} de entrada + ${parcelas}x de ${brl(calc.parcelaMensal)}. Gostaria de mais informações.`,
      )}`
    : null;

  return (
    <section className="py-16 px-6 bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-3"
            style={{ background: `${corPrimaria}15`, color: corPrimaria }}
          >
            <IconCalc className="w-4 h-4" />
            Simulador de financiamento
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Quanto vai caber no seu bolso?
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Arraste os controles abaixo e veja como fica a parcela mensal do seu lote.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Controles */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <Controle
              label="Valor do lote"
              valor={brl(valor)}
              corPrimaria={corPrimaria}
            >
              <input
                type="range"
                min={Math.floor(precoMin)}
                max={Math.ceil(precoMax)}
                step={1000}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
                style={sliderStyle(valor, precoMin, precoMax)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>{brl(precoMin)}</span>
                <span>{brl(precoMax)}</span>
              </div>
            </Controle>

            <Controle
              label="Entrada"
              valor={`${entradaPct}% • ${brl(calc.entrada)}`}
              corPrimaria={corPrimaria}
            >
              <input
                type="range"
                min={10}
                max={70}
                step={1}
                value={entradaPct}
                onChange={(e) => setEntradaPct(Number(e.target.value))}
                style={sliderStyle(entradaPct, 10, 70)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>10%</span>
                <span>70%</span>
              </div>
            </Controle>

            <Controle
              label="Número de parcelas"
              valor={`${parcelas}x`}
              corPrimaria={corPrimaria}
            >
              <input
                type="range"
                min={12}
                max={120}
                step={6}
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                style={sliderStyle(parcelas, 12, 120)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>12x</span>
                <span>120x (10 anos)</span>
              </div>
            </Controle>

            <p className="text-[11px] text-slate-400 mt-4 italic">
              * Simulação ilustrativa, sem juros aplicados. Os valores finais dependem da tabela
              vigente e da análise de crédito.
            </p>
          </div>

          {/* Resultado */}
          <div
            className="rounded-2xl p-6 text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)`,
            }}
          >
            <p className="text-white/80 text-sm font-medium uppercase tracking-wider">
              Sua parcela mensal
            </p>
            <p className="text-5xl md:text-6xl font-black mt-2 mb-1">
              {brl(calc.parcelaMensal)}
            </p>
            <p className="text-white/80 text-sm mb-6">
              Por {parcelas} meses, após entrada de {brl(calc.entrada)}.
            </p>

            <div className="space-y-2 border-t border-white/20 pt-4">
              <LinhaResumo label="Lote escolhido" valor={brl(valor)} />
              <LinhaResumo label={`Entrada (${entradaPct}%)`} valor={brl(calc.entrada)} />
              <LinhaResumo label="Saldo financiado" valor={brl(calc.saldo)} />
              <LinhaResumo label="Parcelas" valor={`${parcelas}x`} />
            </div>

            {whatsappMsg && (
              <a
                href={whatsappMsg}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center justify-center gap-2 w-full bg-white hover:bg-slate-100 transition font-bold py-3 rounded-xl shadow"
                style={{ color: corPrimaria }}
              >
                <IconWhatsApp className="w-5 h-5" />
                Falar com consultor
              </a>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 22px;
          height: 22px;
          background: ${corPrimaria};
          border: 3px solid white;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        .slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          background: ${corPrimaria};
          border: 3px solid white;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        .slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.1);
        }
      `}</style>
    </section>
  );
}

function Controle({
  label,
  valor,
  corPrimaria,
  children,
}: {
  label: string;
  valor: string;
  corPrimaria: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-base font-bold" style={{ color: corPrimaria }}>
          {valor}
        </span>
      </div>
      {children}
    </div>
  );
}

function LinhaResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/80">{label}</span>
      <span className="font-bold">{valor}</span>
    </div>
  );
}
