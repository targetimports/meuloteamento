'use client';

/**
 * Campo de dinheiro com máscara.
 *
 * O que se digita são só dígitos, lidos como centavos: teclar 6 4 7 0 4 vira
 * "647,04" e depois "6.470,4..." conforme entram mais números. Não existe
 * vírgula para errar, nem ponto para o servidor interpretar como decimal
 * quando era milhar — que é o engano clássico de "64.704" virar sessenta e
 * quatro reais e setenta centavos.
 *
 * O valor que vai no envio continua sendo número cru, num input escondido: o
 * schema do servidor espera `64704`, não `R$ 64.704,00`. A máscara é só o que
 * a pessoa vê.
 */

import { useEffect, useState } from 'react';

/** 6470400 centavos → "64.704,00" */
function formatar(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CampoMoeda({
  name,
  value,
  onChange,
  readOnly,
  className,
  id,
  required,
}: {
  name: string;
  /** Valor em reais, como o resto do formulário usa. */
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  className?: string;
  id?: string;
  required?: boolean;
}) {
  const [texto, setTexto] = useState(() => formatar(Math.round(value * 100)));

  // Acompanha mudanças vindas de fora (condição do simulador, atalhos de
  // entrada, cálculo derivado) sem atropelar o que está sendo digitado.
  const [emFoco, setEmFoco] = useState(false);
  useEffect(() => {
    if (emFoco) return;
    setTexto(formatar(Math.round(value * 100)));
  }, [value, emFoco]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        readOnly={readOnly}
        value={texto}
        onFocus={() => setEmFoco(true)}
        onBlur={() => {
          setEmFoco(false);
          setTexto(formatar(Math.round(value * 100)));
        }}
        onChange={(e) => {
          const digitos = e.target.value.replace(/\D/g, '').slice(0, 12);
          const centavos = digitos ? parseInt(digitos, 10) : 0;
          setTexto(formatar(centavos));
          onChange(centavos / 100);
        }}
        className={`${className ?? ''} pl-9`}
      />
      {/* O que a action lê. O campo visível não tem `name` de propósito: se
          tivesse, o texto com pontos e vírgula chegaria ao servidor. */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
