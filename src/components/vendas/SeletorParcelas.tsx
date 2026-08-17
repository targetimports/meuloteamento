'use client';

/**
 * Prazo da venda num controle deslizante, como no simulador público.
 *
 * O campo numérico deixava digitar qualquer coisa e só corrigia depois — quem
 * escrevia 100 via o número saltar para o teto sem entender por quê. Aqui o
 * limite é a própria extensão da barra: não há como pedir mais do que existe,
 * e o máximo fica escrito embaixo.
 *
 * O teto vem de fora: é o prazo da condição do simulador quando há uma
 * escolhida, e o limite geral do sistema quando não há.
 */

const COR = '#ca8a04';

export function SeletorParcelas({
  name,
  value,
  onChange,
  min = 1,
  max,
  rotuloMaximo,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max: number;
  /** Texto sob a ponta direita — ex.: "72x (máximo)" ou "36x (condição)". */
  rotuloMaximo?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 100;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">Quantidade de parcelas</span>
        <span className="text-xl font-bold" style={{ color: COR }}>
          {value}x
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Quantidade de parcelas"
        className="slider h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, ${COR} 0%, ${COR} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
        }}
      />

      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{min}x</span>
        <span>{rotuloMaximo ?? `${max}x (máximo)`}</span>
      </div>

      {/* O range não é submetido: o valor viaja neste campo, com o nome que a
          action espera. */}
      <input type="hidden" name={name} value={value} />

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: ${COR};
          border: 3px solid white;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: ${COR};
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
    </div>
  );
}
