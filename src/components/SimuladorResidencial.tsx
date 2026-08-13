'use client';

/**
 * Simulador específico do Parque Tucano (e qualquer loteamento com a mesma regra).
 *
 * Regra base:
 *   - Residencial à vista: R$ 55.000
 *   - Parcelado padrão: R$ 5.000 entrada + 60 parcelas de R$ 1.000
 *   - Taxa Price implícita: 0,6183% am (descoberta resolvendo PMT=1000, PV=50000, n=60)
 *   - Se o cliente der mais entrada, aplica a mesma taxa Price sobre o novo saldo
 *     → parcela proporcionalmente menor (abatimento de juros)
 *   - Comercial: R$ 300.000, só atendimento WhatsApp (sem simulador automático)
 */

import { useEffect, useMemo, useState } from 'react';
import { IconCalc, IconWhatsApp } from './icons';
import CustosCompra from './CustosCompra';

export interface SimuladorProps {
  /** Preço à vista do lote residencial padrão (default 55.000) */
  precoResidencial?: number;
  /** Entrada mínima padrão (default 5.000) */
  entradaMinima?: number;
  /** Número de parcelas (default 60) */
  parcelas?: number;
  /** Valor da parcela na condição padrão (default 1.000) — usado pra inferir a taxa Price */
  valorParcelaPadrao?: number;

  /** Tipos de lote configurados pela loteadora. Quando há algum, vira as abas. */
  tiposLote?: {
    id: string;
    nome: string;
    descricao?: string | null;
    preco: number;
    entradaMinima: number;
    parcelas: number;
    valorParcela: number;
    entradasSugeridas?: number[] | null;
    simulavel: boolean;
    ativo?: boolean;
  }[];

  /** Atalhos de entrada mostrados como botões. Vazio = degraus padrão. */
  entradasSugeridas?: number[];

  /** Preço do lote comercial (default 300.000) */
  precoComercial?: number;

  corPrimaria?: string;
  whatsapp?: string;
  loteamentoNome?: string;
  loteadoraNome?: string;
  /** Se true, mostra um header próprio (uso em página dedicada). Default false. */
  standalone?: boolean;
  /** URL/âncora para a lista de lotes (ex.: '#lotes' na LP ou '/parquetucano#lotes' na página dedicada).
   *  Quando fornecido, mostra o botão "Escolher meu lote" no card de resultado. */
  linkLotes?: string;
  /** Slug ou ID do loteamento — necessário para captura automática de lead */
  loteamentoSlug?: string;
  loteamentoId?: string;
}

function brl(n: number, decimals = 0): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

/** Resolve a taxa mensal Price embutida via bisseção. */
function descobrirTaxaPrice(pv: number, pmt: number, n: number): number {
  function calc(i: number) {
    if (i === 0) return pv / n;
    return (pv * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  }
  let lo = 0,
    hi = 0.5,
    mid = 0;
  for (let k = 0; k < 200; k++) {
    mid = (lo + hi) / 2;
    if (calc(mid) > pmt) hi = mid;
    else lo = mid;
  }
  return mid;
}

/** Calcula PMT pelo sistema Price. */
function pmtPrice(pv: number, i: number, n: number): number {
  if (i === 0) return pv / n;
  return (pv * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

export function SimuladorResidencial({
  // Recebidos com sufixo Prop porque, logo abaixo, viram as variáveis de
  // mesmo nome derivadas do tipo de lote selecionado. Assim o corpo do
  // componente — que usa esses nomes em dezenas de pontos — não precisou ser
  // reescrito para suportar múltiplos tipos.
  precoResidencial: precoResidencialProp = 55000,
  entradaMinima: entradaMinimaProp = 5000,
  parcelas: parcelasProp = 60,
  valorParcelaPadrao: valorParcelaPadraoProp = 1000,
  entradasSugeridas: entradasSugeridasProp,
  tiposLote,
  precoComercial = 300000,
  corPrimaria = '#0ea5e9',
  whatsapp = '',
  loteamentoNome = 'o loteamento',
  loteadoraNome = '',
  standalone = false,
  linkLotes,
  loteamentoSlug,
  loteamentoId,
}: SimuladorProps) {
  /**
   * Tipos de lote configurados pela loteadora. Quando existe pelo menos um,
   * ele manda: as abas passam a ser os tipos e cada um traz a própria
   * condição. Sem nenhum, tudo segue como antes — Residencial/Comercial fixos.
   */
  const tipos = (tiposLote ?? []).filter((t) => t.ativo !== false);
  const temTipos = tipos.length > 0;

  const [idxTipo, setIdxTipo] = useState(0);
  const tipoAtivo = temTipos ? tipos[Math.min(idxTipo, tipos.length - 1)] : null;

  // Valores efetivos: do tipo selecionado, ou dos props quando não há tipos.
  const precoResidencial = tipoAtivo?.preco ?? precoResidencialProp;
  const entradaMinima = tipoAtivo?.entradaMinima ?? entradaMinimaProp;
  const parcelas = tipoAtivo?.parcelas || parcelasProp;
  const valorParcelaPadrao = tipoAtivo?.valorParcela ?? valorParcelaPadraoProp;
  const entradasSugeridas = tipoAtivo?.entradasSugeridas ?? entradasSugeridasProp;

  // Taxa Price embutida calculada uma vez
  const taxaMensal = useMemo(
    () =>
      descobrirTaxaPrice(
        precoResidencial - entradaMinima,
        valorParcelaPadrao,
        parcelas
      ),
    [precoResidencial, entradaMinima, valorParcelaPadrao, parcelas]
  );

  const [tipo, setTipo] = useState<'residencial' | 'comercial'>('residencial');
  /**
   * Quantidade de lotes residenciais sendo simulados juntos.
   * Cada lote = +precoResidencial no valor total e +entradaMinima na entrada mínima.
   * UX: cliente começa com 1 e pode somar/remover com botões.
   */
  const [qtdLotes, setQtdLotes] = useState(1);
  const [entrada, setEntrada] = useState(entradaMinima);
  const [qtdParcelas, setQtdParcelas] = useState(parcelas);

  // Trocar de aba muda preço e entrada mínima; sem reposicionar, a entrada da
  // aba anterior ficaria fora da faixa da nova e o slider apareceria travado.
  useEffect(() => {
    setEntrada(entradaMinima);
    setQtdParcelas(parcelas);
  }, [entradaMinima, parcelas]);

  // Totais derivados da qtd de lotes
  const precoTotalLotes = precoResidencial * qtdLotes;
  const entradaMinimaTotal = entradaMinima * qtdLotes;
  const entradaMaxima = precoTotalLotes - 1000;

  /**
   * Muda a quantidade de lotes garantindo que a entrada permaneça válida
   * (entre o novo mínimo e o novo máximo do slider).
   */
  function mudarQtdLotes(delta: number) {
    setQtdLotes((q) => {
      const nova = Math.max(1, Math.min(10, q + delta));
      const novoMin = entradaMinima * nova;
      const novoMax = precoResidencial * nova - 1000;
      setEntrada((e) => Math.min(Math.max(e, novoMin), novoMax));
      return nova;
    });
  }

  // Captura de lead: nome + WhatsApp opcionais; quando preenchidos, salvam ao clicar CTA
  const [leadNome, setLeadNome] = useState('');
  const [leadFone, setLeadFone] = useState('');
  const [leadCapturado, setLeadCapturado] = useState(false);

  async function capturarLead(tipoCta: 'residencial' | 'comercial') {
    if (leadCapturado) return;
    if (!leadNome.trim() || leadFone.replace(/\D/g, '').length < 10) return;
    if (!loteamentoSlug && !loteamentoId) return;
    try {
      await fetch('/api/leads/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: leadNome.trim(),
          telefone: leadFone,
          origem: 'simulacao',
          loteamentoSlug,
          loteamentoId,
          mensagem:
            tipoCta === 'comercial'
              ? 'Interesse em LOTE COMERCIAL'
              : `Simulou residencial: ${qtdLotes} lote(s), entrada ${entrada}, ${qtdParcelas}x ${Math.round(parcela)}`,
          simulacao:
            tipoCta === 'comercial'
              ? { valorTotal: precoComercial }
              : {
                  valorTotal: precoTotalLotes,
                  valorEntrada: entrada,
                  qtdParcelas,
                  valorParcela: Math.round(parcela),
                  qtdLotes,
                },
        }),
      });
      setLeadCapturado(true);
    } catch {
      /* fire-and-forget */
    }
  }

  const saldo = precoTotalLotes - entrada;
  const parcela = pmtPrice(saldo, taxaMensal, qtdParcelas);
  // Economia real comparada à condição padrão (escala com qtd de lotes)
  const condicaoPadraoTotal =
    qtdLotes * (entradaMinima + valorParcelaPadrao * parcelas);
  const novoTotal = entrada + parcela * qtdParcelas;
  const economiaJuros = condicaoPadraoTotal - novoTotal;

  const sliderStyle = (value: number, min: number, max: number): React.CSSProperties => {
    const pct = ((value - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, ${corPrimaria} 0%, ${corPrimaria} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
    };
  };

  // Mensagens WhatsApp
  const buildWhatsappResidencial = () => {
    if (!whatsapp) return '';
    const cabecalho =
      qtdLotes === 1
        ? `Olá! Simulei um lote residencial em ${loteamentoNome}:`
        : `Olá! Simulei ${qtdLotes} lotes residenciais em ${loteamentoNome}:`;
    const linhaLotes =
      qtdLotes === 1
        ? `💰 Valor à vista: ${brl(precoResidencial)}`
        : `💰 Valor à vista (${qtdLotes}x ${brl(precoResidencial)}): ${brl(precoTotalLotes)}`;
    const msg = [
      cabecalho,
      ``,
      linhaLotes,
      `💵 Entrada: ${brl(entrada)} (${((entrada / precoTotalLotes) * 100).toFixed(0)}%)`,
      `📅 Parcelado: ${qtdParcelas}x de ${brl(parcela)}`,
      `📊 Total: ${brl(novoTotal)}`,
      ``,
      `Gostaria de fechar essa proposta. Pode me chamar?`,
    ].join('\n');
    return `https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };
  const buildWhatsappComercial = () => {
    if (!whatsapp) return '';
    const msg = [
      `Olá! Tenho interesse em lote *comercial* em ${loteamentoNome}.`,
      ``,
      `Sei que o valor à vista é ${brl(precoComercial)} e que as condições parceladas são personalizadas.`,
      `Pode me passar as opções disponíveis? 🙏`,
    ].join('\n');
    return `https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <section
      className={
        standalone
          ? 'min-h-screen py-12 px-6 bg-gradient-to-br from-slate-50 via-white to-slate-50'
          : 'py-16 px-6 bg-gradient-to-br from-slate-50 to-white'
      }
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-3"
            style={{ background: `${corPrimaria}15`, color: corPrimaria }}
          >
            <IconCalc className="w-4 h-4" />
            Simulador de financiamento
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-2">
            Quanto vai caber no seu bolso?
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Aumente a entrada e veja o quanto você economiza em juros.
          </p>
        </div>

        {/* Abas: os tipos cadastrados pela loteadora ou, sem eles, o par fixo
            de sempre. Uma aba só não vira aba — seria um botão que não escolhe
            nada. */}
        {temTipos ? (
          tipos.length > 1 && (
            <div className="flex gap-2 justify-center mb-8 flex-wrap">
              {tipos.map((t, i) => {
                const ativo = i === Math.min(idxTipo, tipos.length - 1);
                return (
                  <button
                    key={t.id}
                    onClick={() => setIdxTipo(i)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition ${
                      ativo
                        ? 'text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    style={ativo ? { background: corPrimaria } : undefined}
                  >
                    {t.nome}
                    {t.descricao && (
                      <span className={`block text-[11px] font-normal ${ativo ? 'text-white/80' : 'text-slate-400'}`}>
                        {t.descricao}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex gap-2 justify-center mb-8">
            <button
              onClick={() => setTipo('residencial')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition ${
                tipo === 'residencial'
                  ? 'text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={tipo === 'residencial' ? { background: corPrimaria } : undefined}
            >
              🏡 Residencial
            </button>
            <button
              onClick={() => setTipo('comercial')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition ${
                tipo === 'comercial'
                  ? 'text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={tipo === 'comercial' ? { background: corPrimaria } : undefined}
            >
              🏢 Comercial
            </button>
          </div>
        )}

        {/* Com tipos cadastrados, quem decide entre simular e mandar ao
            contato é o próprio tipo (simulavel), não mais o par fixo. */}
        {(temTipos ? tipoAtivo?.simulavel !== false : tipo === 'residencial') ? (
          <>
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Controles */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                      {qtdLotes === 1
                        ? 'Lote residencial à vista'
                        : `${qtdLotes} lotes residenciais à vista`}
                    </p>
                    <p className="text-3xl font-black text-slate-900 mt-1">
                      {brl(precoTotalLotes)}
                    </p>
                    {qtdLotes > 1 && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {qtdLotes}× {brl(precoResidencial)}
                      </p>
                    )}
                  </div>
                  {/* Stepper: +/- lotes */}
                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => mudarQtdLotes(-1)}
                      disabled={qtdLotes <= 1}
                      aria-label="Remover lote"
                      className="w-7 h-7 rounded-full text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                    >
                      −
                    </button>
                    <span className="px-2 text-sm font-bold text-slate-900 min-w-[28px] text-center">
                      {qtdLotes}
                    </span>
                    <button
                      type="button"
                      onClick={() => mudarQtdLotes(+1)}
                      disabled={qtdLotes >= 10}
                      aria-label="Adicionar outro lote"
                      className="w-7 h-7 rounded-full text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                      style={{ background: corPrimaria }}
                    >
                      +
                    </button>
                  </div>
                </div>
                {qtdLotes === 1 && (
                  <button
                    type="button"
                    onClick={() => mudarQtdLotes(+1)}
                    className="mt-3 text-xs font-semibold inline-flex items-center gap-1 hover:underline"
                    style={{ color: corPrimaria }}
                  >
                    + Quero incluir outro lote
                  </button>
                )}
              </div>

              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-700">Sua entrada</span>
                <span className="text-lg font-bold" style={{ color: corPrimaria }}>
                  {brl(entrada)}{' '}
                  <span className="text-xs text-slate-400 font-medium">
                    ({((entrada / precoTotalLotes) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={entradaMinimaTotal}
                max={entradaMaxima}
                step={500}
                value={entrada}
                onChange={(e) => setEntrada(Number(e.target.value))}
                style={sliderStyle(entrada, entradaMinimaTotal, entradaMaxima)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Mínimo {brl(entradaMinimaTotal)}</span>
                <span>Quase à vista</span>
              </div>

              {/* Atalhos de entrada — escalam com a qtd de lotes */}
              <div className="grid grid-cols-4 gap-1.5 mt-4">
                {/* Atalhos configurados pela loteadora; sem eles, os degraus
                    fixos de antes. Num lote de 50 mil com entrada mínima de
                    1 mil, saltar direto para 10 mil pula a faixa que mais
                    interessa a quem está simulando. */}
                {(entradasSugeridas?.length
                  ? [entradaMinimaTotal, ...entradasSugeridas.map((v) => v * qtdLotes)]
                  : [
                      entradaMinimaTotal,
                      10000 * qtdLotes,
                      20000 * qtdLotes,
                      30000 * qtdLotes,
                    ]
                )
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .filter((v) => v >= entradaMinimaTotal && v <= entradaMaxima)
                  .slice(0, 4)
                  .map((v) => (
                    <button
                      key={v}
                      onClick={() => setEntrada(v)}
                      className={`text-xs font-semibold py-1.5 rounded-lg transition ${
                        entrada === v
                          ? 'text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      style={entrada === v ? { background: corPrimaria } : undefined}
                    >
                      {brl(v)}
                    </button>
                  ))}
              </div>

              {/* Slider de parcelas */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    Quantidade de parcelas
                  </span>
                  <span className="text-lg font-bold" style={{ color: corPrimaria }}>
                    {qtdParcelas}x
                  </span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={parcelas}
                  step={6}
                  value={qtdParcelas}
                  onChange={(e) => setQtdParcelas(Number(e.target.value))}
                  style={sliderStyle(qtdParcelas, 6, parcelas)}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>6x</span>
                  <span>{parcelas}x (máximo)</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mt-3">
                  {[12, 24, 36, 48, 60].filter((p) => p <= parcelas).map((p) => (
                    <button
                      key={p}
                      onClick={() => setQtdParcelas(p)}
                      className={`text-xs font-semibold py-1.5 rounded-lg transition ${
                        qtdParcelas === p
                          ? 'text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      style={qtdParcelas === p ? { background: corPrimaria } : undefined}
                    >
                      {p}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mt-5 text-xs">
                <p className="font-semibold text-slate-700 mb-2">
                  📋 Condições padrão{qtdLotes > 1 ? ` (×${qtdLotes} lotes)` : ''}
                </p>
                <ul className="space-y-1 text-slate-600">
                  <li className="flex justify-between">
                    <span>À vista</span>
                    <span className="font-bold text-slate-900">{brl(precoTotalLotes)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Parcelado</span>
                    <span className="font-semibold text-slate-700">
                      {brl(entradaMinimaTotal)} + {parcelas}x {brl(valorParcelaPadrao * qtdLotes)}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Resultado */}
            <div
              className="rounded-2xl p-6 text-white shadow-lg sticky top-4"
              style={{
                background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)`,
              }}
            >
              <p className="text-white/80 text-sm font-medium uppercase tracking-wider">
                Sua parcela mensal
              </p>
              <p className="text-5xl md:text-6xl font-black mt-2 mb-1">{brl(parcela)}</p>
              <p className="text-white/80 text-sm mb-5">
                Por {qtdParcelas} meses, após entrada de {brl(entrada)}
                {qtdLotes > 1 ? ` em ${qtdLotes} lotes.` : '.'}
              </p>

              {economiaJuros > 0 && (
                <div className="bg-white/15 backdrop-blur rounded-xl p-3 mb-4 border border-white/20">
                  <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">
                    💰 Você economiza em juros
                  </p>
                  <p className="text-2xl font-bold mt-0.5">{brl(economiaJuros)}</p>
                  <p className="text-[11px] text-white/70">
                    vs condição padrão ({brl(condicaoPadraoTotal)})
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-white/20 pt-4">
                <LinhaResumo
                  label={
                    qtdLotes === 1
                      ? 'Valor do lote'
                      : `Valor de ${qtdLotes} lotes`
                  }
                  valor={brl(precoTotalLotes)}
                />
                <LinhaResumo
                  label={`Entrada (${((entrada / precoTotalLotes) * 100).toFixed(0)}%)`}
                  valor={brl(entrada)}
                />
                <LinhaResumo label="Saldo financiado" valor={brl(saldo)} />
                <LinhaResumo label="Parcelas" valor={`${qtdParcelas}x`} />
                <LinhaResumo label="Total a pagar" valor={brl(novoTotal)} destacar />
              </div>

              {/* Captura de contato opcional — converte simulação em lead */}
              {(loteamentoSlug || loteamentoId) && (
                <div className="mt-5 pt-4 border-t border-white/20">
                  <p className="text-[11px] uppercase tracking-wider text-white/70 font-semibold mb-2">
                    💬 Quer que a gente te chame com essa proposta?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={leadNome}
                      onChange={(e) => setLeadNome(e.target.value)}
                      placeholder="Seu nome"
                      className="px-3 py-2 text-sm rounded-lg bg-white/25 backdrop-blur border border-white/50 text-white placeholder-white/80 focus:outline-none focus:bg-white/35 focus:border-white/80 focus:ring-2 focus:ring-white/40 transition"
                    />
                    <input
                      type="tel"
                      value={leadFone}
                      onChange={(e) => setLeadFone(e.target.value)}
                      placeholder="WhatsApp (DDD)"
                      className="px-3 py-2 text-sm rounded-lg bg-white/25 backdrop-blur border border-white/50 text-white placeholder-white/80 focus:outline-none focus:bg-white/35 focus:border-white/80 focus:ring-2 focus:ring-white/40 transition"
                    />
                  </div>
                  {leadCapturado && (
                    <p className="text-[11px] text-white/80 mt-1.5">
                      ✓ Recebemos seus dados. Vamos te chamar em breve.
                    </p>
                  )}
                </div>
              )}

              {/* CTAs — escolher lote (primário) + falar com consultor (secundário) */}
              <div className="mt-4 space-y-2">
                {linkLotes && (
                  <a
                    href={linkLotes}
                    onClick={() => capturarLead('residencial')}
                    className="flex items-center justify-center gap-2 w-full bg-white hover:bg-slate-100 transition font-bold py-3 rounded-xl shadow"
                    style={{ color: corPrimaria }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Escolher meu lote
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={buildWhatsappResidencial()}
                    onClick={() => capturarLead('residencial')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-white/15 hover:bg-white/25 backdrop-blur border border-white/30 text-white transition font-semibold py-2.5 rounded-xl"
                  >
                    <IconWhatsApp className="w-4 h-4" />
                    Falar com consultor
                  </a>
                )}
              </div>
              <p className="text-[10px] text-white/60 text-center mt-3">
                * Simulação ilustrativa. Valor final pode variar conforme análise de crédito e
                tabela vigente.
              </p>
            </div>
          </div>

          {/* Custos extras: ITBI + escritura + IPTU/ITR — escala com o total */}
          <div className="mt-6 max-w-3xl mx-auto">
            <CustosCompra valorLote={precoTotalLotes} defaultOpen={false} />
          </div>
          </>
        ) : (
          // ========== COMERCIAL ==========
          <div className="max-w-2xl mx-auto">
            <div
              className="rounded-3xl p-8 md:p-10 text-white shadow-2xl text-center"
              style={{
                background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)`,
              }}
            >
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold uppercase tracking-widest mb-4">
                Lote Comercial
              </span>
              <p className="text-white/80 text-sm uppercase tracking-wider">A partir de</p>
              <p className="text-5xl md:text-7xl font-black mt-2">{brl(precoComercial)}</p>
              <p className="text-white/80 text-lg mt-4 max-w-md mx-auto">
                Condições de parcelamento <strong>personalizadas</strong> conforme o perfil do
                investidor.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-8 text-left">
                {[
                  { t: 'Negociação direta', d: 'Sem tabela fixa' },
                  { t: 'Prazo flexível', d: 'Até 120 meses' },
                  { t: 'Atendimento VIP', d: 'Consultor dedicado' },
                ].map((b) => (
                  <div
                    key={b.t}
                    className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20"
                  >
                    <p className="text-xs font-bold">{b.t}</p>
                    <p className="text-[11px] text-white/70">{b.d}</p>
                  </div>
                ))}
              </div>
              {(loteamentoSlug || loteamentoId) && (
                <div className="mt-6 max-w-md mx-auto grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={leadNome}
                    onChange={(e) => setLeadNome(e.target.value)}
                    placeholder="Seu nome"
                    className="px-3 py-2 text-sm rounded-lg bg-white/25 backdrop-blur border border-white/50 text-white placeholder-white/80 focus:outline-none focus:bg-white/35 focus:border-white/80 focus:ring-2 focus:ring-white/40 transition"
                  />
                  <input
                    type="tel"
                    value={leadFone}
                    onChange={(e) => setLeadFone(e.target.value)}
                    placeholder="WhatsApp (DDD)"
                    className="px-3 py-2 text-sm rounded-lg bg-white/25 backdrop-blur border border-white/50 text-white placeholder-white/80 focus:outline-none focus:bg-white/35 focus:border-white/80 focus:ring-2 focus:ring-white/40 transition"
                  />
                </div>
              )}
              {whatsapp && (
                <a
                  href={buildWhatsappComercial()}
                  onClick={() => capturarLead('comercial')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 transition font-bold px-8 py-4 rounded-xl shadow-lg text-lg"
                  style={{ color: corPrimaria }}
                >
                  <IconWhatsApp className="w-6 h-6" />
                  Negociar pelo WhatsApp
                </a>
              )}
              {leadCapturado && (
                <p className="text-[12px] text-white/85 mt-3">
                  ✓ Recebemos seus dados. Vamos te chamar em breve.
                </p>
              )}
              <p className="text-[11px] text-white/60 mt-4">
                Nosso consultor vai elaborar uma proposta exclusiva pra você.
              </p>
            </div>
          </div>
        )}
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

function LinhaResumo({
  label,
  valor,
  destacar,
}: {
  label: string;
  valor: string;
  destacar?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${destacar ? 'pt-2 border-t border-white/20' : ''}`}
    >
      <span className={destacar ? 'text-white font-semibold' : 'text-white/80'}>{label}</span>
      <span className={`font-bold ${destacar ? 'text-lg' : ''}`}>{valor}</span>
    </div>
  );
}
