'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFormState } from 'react-dom';
import { Field, Section, SubmitButton, ErrorBox, inputClass, selectClass } from './ui';
import { CampoMoeda } from '@/components/vendas/CampoMoeda';
import { SeletorParcelas } from '@/components/vendas/SeletorParcelas';
import { descobrirTaxaPrice, pmtPrice } from '@/lib/price';
import { ComboboxLote } from '@/components/vendas/ComboboxLote';
import { CampoCliente } from '@/components/vendas/CampoCliente';

interface LoteOption {
  id: string;
  codigo: string;
  preco: number;
  area: number;
  status: string;
  tipo: 'RESIDENCIAL' | 'COMERCIAL';
  loteamentoId: string;
  loteamentoNome: string;
}

/**
 * Condição de venda pronta — vem dos tipos de lote do simulador.
 *
 * Escolher uma preenche total, entrada e prazo com a mesma matemática que o
 * cliente viu na landing, em vez de deixar o admin digitar os três e torcer
 * para que batam.
 */
export interface CondicaoOption {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  entradaMinima: number;
  parcelas: number;
  valorParcela: number;
  loteamentoId: string;
}

interface ClienteOption {
  id: string;
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone: string;
}

interface CorretorOption {
  id: string;
  nome: string;
  comissaoPadrao: number;
}

export interface ContaOption {
  id: string;
  nome: string;
  tipo: 'ASAAS' | 'CAIXA' | 'BANCO' | 'OUTROS';
}

export interface PrefillCliente {
  nome?: string;
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  /** Se vier de um formulário, mostra banner indicando origem */
  origemLabel?: string;
}

interface VendaFormProps {
  lotes: LoteOption[];
  /**
   * Vazio para empresa que não cadastrou tipos no simulador — e aí o
   * formulário se comporta exatamente como antes, sem bloco nenhum a mais.
   */
  condicoes?: CondicaoOption[];
  clientes: ClienteOption[];
  corretores: CorretorOption[];
  contas: ContaOption[];
  loteIdInicial?: string;
  /** Pré-preenche os campos do cliente novo (vindo de um formulário, por exemplo) */
  prefillCliente?: PrefillCliente;
  /** Se já existe cliente cadastrado com mesmo CPF, ID dele (para abrir em modo existente) */
  clienteExistenteId?: string;
  action: (prev: { error?: string; ok?: boolean }, formData: FormData) => Promise<{ error?: string; ok?: boolean }>;
}

type FormState = { error?: string; ok?: boolean };

export function VendaForm({
  lotes,
  condicoes,
  clientes,
  corretores,
  contas,
  loteIdInicial,
  prefillCliente,
  clienteExistenteId,
  action,
}: VendaFormProps) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  const [loteIds, setLoteIds] = useState<string[]>(
    loteIdInicial ? [loteIdInicial] : []
  );
  const [valorTotal, setValorTotal] = useState(0);
  const [valorTotalManual, setValorTotalManual] = useState(false);
  /**
   * Volta a ser número: o estado em texto existia porque apagar o campo virava
   * `Number('')` === 0 e o zero reaparecia sob o cursor. A máscara resolve isso
   * de outro jeito — não há o que apagar, só dígitos que entram e saem.
   */
  const [valorEntrada, setValorEntrada] = useState(0);
  const [numeroParcelas, setNumeroParcelas] = useState(60);
  /** Condição de venda escolhida; vazio = preenchimento manual. */
  const [condicaoId, setCondicaoId] = useState('');
  /**
   * Data específica da PRIMEIRA parcela mensal.
   * O dia do mês dela vira o dia-âncora de TODAS as demais (parcela N vence
   * em primeiraParcela + (N-1) meses, sempre no mesmo dia do mês).
   * Default: 30 dias após hoje.
   */
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    // clampa dia a 28 pra evitar fevereiro
    if (d.getDate() > 28) d.setDate(28);
    return d.toISOString().slice(0, 10);
  });
  const [formaPagamento, setFormaPagamento] = useState<
    | 'A_VISTA'
    | 'A_VISTA_ESPECIE'
    | 'A_VISTA_CHEQUE'
    | 'PARCELADO_BOLETO'
    | 'PARCELADO_PIX'
    | 'PARCELADO_CARTAO'
    | 'PARCELADO_CHEQUE'
    | 'PARCELADO_MISTO'
  >('PARCELADO_PIX');
  const [contaId, setContaId] = useState(
    contas.find((c) => c.tipo === 'CAIXA')?.id ?? ''
  );
  /**
   * Quando true (default), entrada usa a MESMA forma das mensais.
   * Quando false, admin pode escolher uma forma diferente apenas para a entrada.
   */
  const [entradaIgualMensais, setEntradaIgualMensais] = useState(true);
  /**
   * Forma específica da entrada (só ativa quando entradaIgualMensais=false).
   * Aceita 7 valores:
   *   PIX                  → cobrança PIX no Asaas (cliente pagará)
   *   BOLETO               → boleto no Asaas
   *   CARTAO               → cartão no Asaas
   *   JA_PAGA_PIX          → cliente já transferiu por PIX/transferência
   *   JA_PAGA_ESPECIE      → cliente entregou dinheiro em mãos
   *   CHEQUE_PROGRAMADO    → cheque com vencimento futuro (entra no fluxo
   *                          financeiro como parcela pendente até compensar)
   *   JA_PAGA_CHEQUE       → cheque já compensado (parcela nasce PAGA)
   */
  const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState<
    | 'PIX'
    | 'BOLETO'
    | 'CARTAO'
    | 'JA_PAGA_PIX'
    | 'JA_PAGA_ESPECIE'
    | 'CHEQUE_PROGRAMADO'
    | 'JA_PAGA_CHEQUE'
  >('JA_PAGA_PIX');
  const [contaIdEntrada, setContaIdEntrada] = useState<string>('');
  // Dados do cheque da entrada (preenchidos quando admin escolhe Cheque)
  const [chequeNumero, setChequeNumero] = useState('');
  const [chequeBanco, setChequeBanco] = useState('');
  const [chequeEmitente, setChequeEmitente] = useState('');
  const [chequePraca, setChequePraca] = useState('');
  // Data de vencimento do cheque (= data prevista de compensação).
  // Default: 30 dias após o contrato. Se vazio, herda da parcela ENTRADA.
  const [chequeVencimento, setChequeVencimento] = useState<string>('');
  const [gerarParcelas, setGerarParcelas] = useState(true);
  const [gerarPixEntrada, setGerarPixEntrada] = useState(false);
  /**
   * Número de parcelas do CARTÃO DE CRÉDITO da entrada.
   * 1 = à vista. 2..12 = parcelado pelo cliente no cartão (Asaas).
   * Só é usado quando a entrada vai cobrar via cartão (Parcelado-Cartão
   * herdado ou override "Cobrar via Cartão (Asaas)").
   */
  const [cartaoEntradaParcelas, setCartaoEntradaParcelas] = useState<number>(1);
  const [corretorId, setCorretorId] = useState('');
  const [comissaoPct, setComissaoPct] = useState<number | ''>('');

  const lotesSelecionados = useMemo(
    () =>
      loteIds
        .map((id) => lotes.find((l) => l.id === id))
        .filter((l): l is LoteOption => !!l),
    [lotes, loteIds]
  );
  const lote = lotesSelecionados[0];
  const somaPrecosLotes = useMemo(
    () => lotesSelecionados.reduce((s, l) => s + l.preco, 0),
    [lotesSelecionados]
  );
  const isMultiLote = lotesSelecionados.length > 1;


  function adicionarLote(id: string) {
    if (!id || loteIds.includes(id)) return;
    setLoteIds([...loteIds, id]);
  }
  function removerLote(id: string) {
    setLoteIds(loteIds.filter((x) => x !== id));
  }

  // Quando soma de preços muda, atualiza valor total (a menos que admin tenha editado manualmente)
  useEffect(() => {
    if (!valorTotalManual && somaPrecosLotes > 0) {
      setValorTotal(somaPrecosLotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [somaPrecosLotes]);

  // ===== Condições de venda vindas do simulador =====
  /**
   * Só para venda de UM lote. Com vários, cada um poderia ter tipo e preço
   * diferentes, e não há resposta única para "qual condição vale" — melhor
   * cair no preenchimento manual do que somar coisas que não se somam.
   */
  const condicoesDoLote = useMemo(() => {
    if (!lote || isMultiLote) return [];
    return (condicoes ?? []).filter((c) => c.loteamentoId === lote.loteamentoId);
  }, [condicoes, lote, isMultiLote]);

  const condicao = useMemo(
    () => condicoesDoLote.find((c) => c.id === condicaoId) ?? null,
    [condicoesDoLote, condicaoId]
  );

  /**
   * Teto de parcelas: o da condição do simulador quando há uma escolhida, o
   * limite do sistema quando não há. O mesmo número alimenta a barra e o
   * rótulo, para não existir a chance de dizerem coisas diferentes.
   */
  const maxParcelas = condicao ? condicao.parcelas : 72;

  /** Taxa que a condição embute — é ela que vale se a entrada mudar. */
  const taxaDaCondicao = useMemo(
    () =>
      condicao
        ? descobrirTaxaPrice(
            condicao.preco - condicao.entradaMinima,
            condicao.valorParcela,
            condicao.parcelas
          )
        : 0,
    [condicao]
  );

  // Trocar de lote reposiciona a condição. Quando existe exatamente uma com o
  // preço do lote, ela já vem escolhida — é o caso comum e evita o erro de
  // deixar o total no preço à vista.
  useEffect(() => {
    if (!condicoesDoLote.length) {
      setCondicaoId('');
      return;
    }
    const mesmoPreco = condicoesDoLote.filter((c) => c.preco === lote?.preco);
    setCondicaoId(mesmoPreco.length === 1 ? mesmoPreco[0].id : '');
  }, [condicoesDoLote, lote?.preco]);

  // Escolher uma condição traz entrada mínima e prazo dela.
  useEffect(() => {
    if (!condicao) return;
    setValorEntrada(condicao.entradaMinima);
    setNumeroParcelas(condicao.parcelas);
    setValorTotalManual(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condicao?.id]);

  /**
   * Com condição ativa, o total é DERIVADO: entrada mais a soma das parcelas.
   *
   * Entrada maior abate juros pelo Price, exatamente como no simulador — não
   * apenas divide o saldo por um número diferente.
   */
  useEffect(() => {
    if (!condicao) return;
    const saldo = Math.max(0, condicao.preco - valorEntrada);
    const parcela = Math.round(pmtPrice(saldo, taxaDaCondicao, numeroParcelas) * 100) / 100;
    setValorTotal(Math.round((valorEntrada + parcela * numeroParcelas) * 100) / 100);
  }, [condicao, taxaDaCondicao, valorEntrada, numeroParcelas]);

  // Atualiza comissão sugerida quando muda corretor
  const corretor = useMemo(() => corretores.find((c) => c.id === corretorId), [corretores, corretorId]);
  useEffect(() => {
    if (corretor && comissaoPct === '') {
      setComissaoPct(corretor.comissaoPadrao);
    } else if (!corretor) {
      setComissaoPct('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corretorId]);

  const isAvista =
    formaPagamento === 'A_VISTA' ||
    formaPagamento === 'A_VISTA_ESPECIE' ||
    formaPagamento === 'A_VISTA_CHEQUE';
  const isEspecie = formaPagamento === 'A_VISTA_ESPECIE';
  const restante = Math.max(0, valorTotal - valorEntrada);
  const valorParcela = isAvista
    ? valorTotal
    : numeroParcelas > 0
    ? Math.round((restante / numeroParcelas) * 100) / 100
    : 0;

  /**
   * Juro embutido na condição — a mesma leitura que o simulador público mostra.
   *
   * O sistema não calcula juros: "Valor total" é o total DO CONTRATO e a
   * parcela sai de uma divisão simples. Só que o campo vem preenchido com o
   * preço à vista do lote, então quem não o troca vende a 0% sem perceber —
   * já aconteceu em produção. A taxa aqui torna isso visível antes de salvar.
   */
  const principalFinanciado = Math.max(0, somaPrecosLotes - valorEntrada);
  const mostrarJuros =
    !isAvista && somaPrecosLotes > 0 && principalFinanciado > 0 && numeroParcelas > 0;
  const jurosEmbutidos = mostrarJuros
    ? Math.max(0, valorEntrada + valorParcela * numeroParcelas - somaPrecosLotes)
    : 0;
  const taxaMensal = mostrarJuros
    ? descobrirTaxaPrice(principalFinanciado, valorParcela, numeroParcelas)
    : 0;

  /**
   * Cálculo da comissão — reflete a regra do server (src/lib/comissao.ts):
   *
   *   - Lote RESIDENCIAL → fixa R$ 2.500 por lote (regra atual)
   *   - Lote COMERCIAL   → % do corretor sobre a fatia comercial do valor total
   *   - Misto → soma dos dois
   *
   * Aqui no client é só pra mostrar PREVIEW. O server recalcula e é a fonte da verdade.
   */
  const COMISSAO_FIXA_RESIDENCIAL = 2500;
  const lotesResidenciais = lotesSelecionados.filter((l) => l.tipo === 'RESIDENCIAL');
  const lotesComerciais = lotesSelecionados.filter((l) => l.tipo === 'COMERCIAL');
  const qtdResidenciais = lotesResidenciais.length;
  const qtdComerciais = lotesComerciais.length;
  // Fatia comercial do valor total (proporcional ao preço de tabela)
  const somaComerciais = lotesComerciais.reduce((s, l) => s + l.preco, 0);
  const fatiaComercial =
    somaPrecosLotes > 0 ? (valorTotal * somaComerciais) / somaPrecosLotes : 0;
  const comissaoFixaTotal = qtdResidenciais * COMISSAO_FIXA_RESIDENCIAL;
  const comissaoPctTotal =
    qtdComerciais > 0 && typeof comissaoPct === 'number'
      ? (fatiaComercial * comissaoPct) / 100
      : 0;
  const comissaoValor = corretorId ? comissaoFixaTotal + comissaoPctTotal : 0;

  function formatBRL(n: number) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <form action={formAction} className="space-y-6">
      <ErrorBox message={state.error} />

      {prefillCliente?.origemLabel && (
        <div className="p-3 rounded-lg bg-primary-50 border border-primary-200 text-sm text-primary-800 flex items-start gap-2">
          <span className="text-lg leading-none">📋</span>
          <div>
            <p className="font-semibold">
              Dados pré-preenchidos a partir do formulário
            </p>
            <p className="text-xs text-primary-700">
              {prefillCliente.origemLabel} — confira os campos abaixo antes de criar a venda.
            </p>
          </div>
        </div>
      )}

      {/* ====== LOTES ====== */}
      <Section title={isMultiLote ? `${lotesSelecionados.length} lotes vendidos (cobrança única)` : 'Lote vendido'}>
        {/* hidden input com array JSON */}
        <input type="hidden" name="loteIds" value={JSON.stringify(loteIds)} />

        <Field label={isMultiLote ? 'Lotes selecionados' : 'Lote'} required wide hint={
          isMultiLote
            ? `Soma dos preços de tabela: ${formatBRL(somaPrecosLotes)}`
            : 'Você pode adicionar mais de um lote — vira venda com cobrança única.'
        }>
          {/* CHIPS dos lotes selecionados */}
          {lotesSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200 min-h-[44px]">
              {lotesSelecionados.map((l, i) => (
                <span
                  key={l.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    i === 0
                      ? 'bg-primary-100 text-primary-800 border-primary-200'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {i === 0 && isMultiLote && <span className="text-[10px] font-bold opacity-60">PRINCIPAL ·</span>}
                  <span className="font-mono font-bold">{l.codigo}</span>
                  <span className="text-slate-500">·</span>
                  <span>{l.area.toFixed(0)} m²</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-semibold">{formatBRL(l.preco)}</span>
                  <button
                    type="button"
                    onClick={() => removerLote(l.id)}
                    className="ml-1 text-slate-400 hover:text-red-600 text-base leading-none"
                    title="Remover lote"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* DROPDOWN pra adicionar */}
          <ComboboxLote
            lotes={lotes.filter((l) => !loteIds.includes(l.id))}
            onEscolher={adicionarLote}
            className={inputClass}
            placeholder={
              lotesSelecionados.length === 0
                ? 'Buscar por código, quadra, área ou preço…'
                : 'Adicionar outro lote (cobrança única)…'
            }
          />
        </Field>

        {isMultiLote && (
          <div className="md:col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
            <p className="text-emerald-800 font-semibold mb-1">
              💰 Cobrança única — {lotesSelecionados.length} lotes
            </p>
            <p className="text-emerald-700">
              Será criada UMA venda com UM conjunto de parcelas. O cliente paga a soma
              dos {lotesSelecionados.length} lotes. Todos serão marcados como{' '}
              <strong>{lotesSelecionados.length > 1 ? 'EM_PAGAMENTO' : 'VENDIDO'}</strong>.
            </p>
          </div>
        )}
      </Section>

      {/* ====== CLIENTE ====== */}
      <Section title="Cliente comprador">
        <CampoCliente
          clientes={clientes}
          inicialId={clienteExistenteId}
          inputClass={inputClass}
          prefill={prefillCliente}
        />
      </Section>

      {/* ====== VALORES ====== */}
      <Section title="Valores e pagamento">
        <Field label="Forma de pagamento" required wide>
          <select
            name="formaPagamento"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value as 'A_VISTA')}
            required
            className={selectClass}
          >
            <option value="A_VISTA">À vista (PIX/transferência)</option>
            <option value="A_VISTA_ESPECIE">À vista — Dinheiro em espécie</option>
            <option value="A_VISTA_CHEQUE">À vista — Cheque</option>
            <option value="PARCELADO_PIX">Parcelado — PIX mensal</option>
            <option value="PARCELADO_BOLETO">Parcelado — Boleto</option>
            <option value="PARCELADO_CHEQUE">Parcelado — Cheque pré-datado</option>
            <option value="PARCELADO_CARTAO">Parcelado — Cartão</option>
            <option value="PARCELADO_MISTO">Parcelado — Misto</option>
          </select>
        </Field>

        {isAvista && (
          <Field
            label={isEspecie ? 'Caixa que recebeu o dinheiro' : 'Conta onde caiu o recebimento'}
            wide
            required={isEspecie}
            hint={isEspecie ? 'Após salvar, será gerado um recibo de pagamento.' : undefined}
          >
            <select
              name="contaId"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              required={isEspecie}
              className={selectClass}
            >
              <option value="">— Selecione —</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.tipo === 'CAIXA' ? '💵' : c.tipo === 'BANCO' ? '🏦' : c.tipo === 'ASAAS' ? '⚡' : '•'}{' '}
                  {c.nome} ({c.tipo})
                </option>
              ))}
            </select>
            {contas.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Nenhuma conta cadastrada.{' '}
                <a href="/admin/contas" className="underline">
                  Cadastrar contas →
                </a>
              </p>
            )}
          </Field>
        )}

        {condicoesDoLote.length > 0 && (
          <Field
            label="Condição de venda"
            wide
            hint="Condições cadastradas no simulador deste loteamento. Escolher uma preenche total, entrada e prazo com os mesmos números que o cliente vê no site."
          >
            <select
              value={condicaoId}
              onChange={(e) => setCondicaoId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Preencher manualmente —</option>
              {condicoesDoLote.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {formatBRL(c.preco)} · entrada {formatBRL(c.entradaMinima)} ·{' '}
                  {c.parcelas}x de {formatBRL(c.valorParcela)}
                </option>
              ))}
            </select>
            {condicao && condicao.preco !== lote?.preco && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1.5">
                A condição vale para lote de {formatBRL(condicao.preco)}, e este lote está
                cadastrado por {formatBRL(lote?.preco ?? 0)}. O cálculo usa o valor da
                condição — confira se é isso mesmo.
              </p>
            )}
          </Field>
        )}

        <Field
          label="Valor total"
          required
          hint={
            condicao
              ? `Calculado pela condição "${condicao.nome}": entrada mais a soma das parcelas. Para digitar à mão, volte para "Preencher manualmente".`
              : isMultiLote && !valorTotalManual
              ? `Auto-calculado: soma dos ${lotesSelecionados.length} lotes (R$ ${somaPrecosLotes.toFixed(2)})`
              : isMultiLote && valorTotalManual
                ? `⚠ valor editado manualmente — soma dos lotes é R$ ${somaPrecosLotes.toFixed(2)}`
                : undefined
          }
        >
          {/* Somente leitura sob uma condição: o valor é derivado dela, e um
              número digitado aqui seria sobrescrito no próximo cálculo. */}
          <CampoMoeda
            name="valorTotal"
            value={valorTotal}
            onChange={(v) => {
              setValorTotal(v);
              setValorTotalManual(true);
            }}
            readOnly={Boolean(condicao)}
            required
            className={`${inputClass} ${condicao ? 'bg-slate-50 text-slate-600' : ''}`}
          />
          {isMultiLote && valorTotalManual && (
            <button
              type="button"
              onClick={() => {
                setValorTotal(somaPrecosLotes);
                setValorTotalManual(false);
              }}
              className="text-[11px] text-primary-600 hover:underline mt-1"
            >
              ↺ Restaurar para soma dos lotes
            </button>
          )}
        </Field>

        {!isAvista && (
          <>
            <Field
              label="Entrada"
              hint={
                valorEntrada === 0
                  ? '⚠ Venda SEM entrada — todo o valor será diluído nas parcelas.'
                  : condicao && valorEntrada < condicao.entradaMinima
                  ? `⚠ Abaixo da entrada mínima da condição (${formatBRL(condicao.entradaMinima)}).`
                  : condicao
                  ? `Entrada maior abate juros e reduz a parcela, como no simulador. Mínima: ${formatBRL(condicao.entradaMinima)}.`
                  : undefined
              }
            >
              <CampoMoeda
                name="valorEntrada"
                value={valorEntrada}
                onChange={setValorEntrada}
                className={inputClass}
              />
              {/* Atalho — admin: zerar entrada */}
              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setValorEntrada(0)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    valorEntrada === 0
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Sem entrada
                </button>
                {[5000, 10000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setValorEntrada(v)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      valorEntrada === v
                        ? 'bg-primary-200 text-primary-900'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    R$ {(v / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </Field>
            <div>
              <SeletorParcelas
                name="numeroParcelas"
                value={numeroParcelas}
                onChange={setNumeroParcelas}
                max={maxParcelas}
                rotuloMaximo={
                  condicao ? `${maxParcelas}x (condição)` : `${maxParcelas}x (máximo)`
                }
              />
            </div>
            <Field
              label="Data da 1ª parcela"
              hint={
                dataPrimeiraParcela
                  ? `As demais parcelas vencerão sempre no dia ${Math.min(
                      new Date(dataPrimeiraParcela + 'T00:00:00').getDate(),
                      28
                    )} de cada mês.`
                  : 'Define o dia-âncora das parcelas seguintes.'
              }
            >
              <input
                name="dataPrimeiraParcela"
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                className={inputClass}
              />
              {/* Campo legado mantido pra compat. Derivado do dia da data acima. */}
              <input
                type="hidden"
                name="diaVencimento"
                value={
                  dataPrimeiraParcela
                    ? Math.min(
                        new Date(dataPrimeiraParcela + 'T00:00:00').getDate(),
                        28
                      )
                    : 10
                }
              />
            </Field>
            {/* SEM ENTRADA → exige senha de autorização da loteadora.
                Mostra alerta amarelo + campo password. O server-side valida
                contra o bcrypt hash da loteadora.
                NÃO se aplica a vendas À VISTA (o valor inteiro vira parcela
                única paga no ato — não há entrada). */}
            {valorEntrada === 0 && !isAvista && (
              <Field label="🔐 Autorização — venda SEM entrada" wide>
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50">
                  <p className="text-xs text-amber-900 mb-2 leading-snug">
                    <strong>Atenção:</strong> você está lançando uma venda sem entrada.
                    O lote será marcado como <strong>VENDIDO</strong> e as parcelas
                    usarão o <strong>valor total do lote</strong> ({formatBRL(valorTotal)})
                    como base. Esta operação exige a <strong>senha de autorização</strong>{' '}
                    cadastrada na loteadora.
                  </p>
                  <input
                    type="password"
                    name="senhaAutorizacaoSemEntrada"
                    autoComplete="off"
                    placeholder="Digite a senha de autorização da loteadora"
                    className={`${inputClass} max-w-md`}
                    minLength={4}
                  />
                  <p className="text-[11px] text-amber-700 mt-2">
                    Não tem a senha? Peça ao administrador. A senha é definida em{' '}
                    <em>Loteadoras → editar → Senha de autorização</em>.
                  </p>
                </div>
              </Field>
            )}
            {valorEntrada > 0 && (
              <>
                {/* Toggle: entrada igual ou diferente das mensais */}
                <Field
                  label={`Forma da entrada (${formatBRL(valorEntrada)})`}
                  wide
                  hint="A entrada pode ter forma diferente das parcelas mensais."
                >
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={entradaIgualMensais}
                      onChange={(e) => setEntradaIgualMensais(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700">
                      Mesma forma das parcelas mensais
                    </span>
                  </label>

                  {!entradaIgualMensais && (
                    <select
                      name="formaPagamentoEntrada"
                      value={formaPagamentoEntrada}
                      onChange={(e) =>
                        setFormaPagamentoEntrada(
                          e.target.value as typeof formaPagamentoEntrada
                        )
                      }
                      className={inputClass}
                    >
                      <option value="JA_PAGA_PIX">
                        ✓ Já paga — PIX/transferência
                      </option>
                      <option value="JA_PAGA_ESPECIE">
                        ✓ Já paga — Dinheiro em espécie 💵
                      </option>
                      <option value="JA_PAGA_CHEQUE">
                        ✓ Já paga — Cheque já compensado 🧾
                      </option>
                      <option value="PIX">⚡ Cobrar via PIX (Asaas)</option>
                      <option value="BOLETO">📄 Cobrar via Boleto (Asaas)</option>
                      <option value="CARTAO">💳 Cobrar via Cartão (Asaas)</option>
                      <option value="CHEQUE_PROGRAMADO">
                        🧾 Cheque pré-datado (compensa no vencimento)
                      </option>
                    </select>
                  )}

                  {!entradaIgualMensais &&
                    (formaPagamentoEntrada === 'JA_PAGA_ESPECIE' ||
                      formaPagamentoEntrada === 'JA_PAGA_PIX' ||
                      formaPagamentoEntrada === 'JA_PAGA_CHEQUE') && (
                      <select
                        name="contaIdEntrada"
                        value={contaIdEntrada}
                        onChange={(e) => setContaIdEntrada(e.target.value)}
                        required={
                          formaPagamentoEntrada === 'JA_PAGA_ESPECIE' ||
                          formaPagamentoEntrada === 'JA_PAGA_CHEQUE'
                        }
                        className={`${inputClass} mt-2`}
                      >
                        <option value="">— Conta destinatária da entrada —</option>
                        {contas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.tipo === 'CAIXA' ? '💵' : c.tipo === 'BANCO' ? '🏦' : c.tipo === 'ASAAS' ? '⚡' : '•'}{' '}
                            {c.nome} ({c.tipo})
                          </option>
                        ))}
                      </select>
                    )}

                  {/* Campos do cheque — aparecem quando entrada é cheque
                      (programado ou já compensado). Todos opcionais, mas
                      preenchidos facilitam controle posterior. */}
                  {!entradaIgualMensais &&
                    (formaPagamentoEntrada === 'CHEQUE_PROGRAMADO' ||
                      formaPagamentoEntrada === 'JA_PAGA_CHEQUE') && (
                      <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-500/5">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-2">
                          🧾 Dados do cheque
                        </p>
                        {formaPagamentoEntrada === 'CHEQUE_PROGRAMADO' && (
                          <div className="mb-2">
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                              Data de vencimento (compensação prevista)
                            </label>
                            <input
                              type="date"
                              name="chequeVencimento"
                              value={chequeVencimento}
                              onChange={(e) => setChequeVencimento(e.target.value)}
                              required
                              className={inputClass}
                            />
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                              Nesta data, a parcela aparece no Financeiro como pendente de compensação.
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                              Nº do cheque
                            </label>
                            <input
                              type="text"
                              name="chequeNumero"
                              value={chequeNumero}
                              onChange={(e) => setChequeNumero(e.target.value)}
                              placeholder="000123"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                              Banco
                            </label>
                            <input
                              type="text"
                              name="chequeBanco"
                              value={chequeBanco}
                              onChange={(e) => setChequeBanco(e.target.value)}
                              placeholder="Banco do Brasil"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                              Emitente (se diferente do cliente)
                            </label>
                            <input
                              type="text"
                              name="chequeEmitente"
                              value={chequeEmitente}
                              onChange={(e) => setChequeEmitente(e.target.value)}
                              placeholder="Cônjuge, terceiro..."
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                              Praça (cidade da agência)
                            </label>
                            <input
                              type="text"
                              name="chequePraca"
                              value={chequePraca}
                              onChange={(e) => setChequePraca(e.target.value)}
                              placeholder="Tucano-BA"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                </Field>

                {/* Gerar cobrança agora — aparece em PIX, BOLETO ou CARTÃO
                    (tudo que o Asaas cobra automaticamente). Mensagem se adapta
                    ao tipo de cobrança escolhido. */}
                {(() => {
                  // Detecta qual tipo de cobrança o admin escolheu pra entrada
                  const tipoCobranca: 'PIX' | 'BOLETO' | 'CARTAO' | null =
                    entradaIgualMensais
                      ? formaPagamento === 'PARCELADO_PIX'
                        ? 'PIX'
                        : formaPagamento === 'PARCELADO_BOLETO'
                          ? 'BOLETO'
                          : formaPagamento === 'PARCELADO_CARTAO'
                            ? 'CARTAO'
                            : null
                      : formaPagamentoEntrada === 'PIX'
                        ? 'PIX'
                        : formaPagamentoEntrada === 'BOLETO'
                          ? 'BOLETO'
                          : formaPagamentoEntrada === 'CARTAO'
                            ? 'CARTAO'
                            : null;

                  if (!tipoCobranca) return null;

                  const cfg = {
                    PIX:    { icon: '⚡', titulo: 'Gerar QR Code PIX agora', descricao: 'Cria a cobrança no Asaas e mostra o QR / copia-cola assim que a venda for salva.',     borda: 'border-emerald-200', bg: 'bg-emerald-50/50 hover:bg-emerald-50', texto: 'text-emerald-900', sub: 'text-emerald-700' },
                    BOLETO: { icon: '📄', titulo: 'Gerar boleto agora',       descricao: 'Cria o boleto no Asaas e mostra o PDF + linha digitável após salvar.',                  borda: 'border-sky-200',     bg: 'bg-sky-50/50 hover:bg-sky-50',         texto: 'text-sky-900',     sub: 'text-sky-700' },
                    CARTAO: { icon: '💳', titulo: 'Gerar link de cartão agora', descricao: 'Cria a fatura no Asaas. Cliente recebe o link e paga com cartão de crédito (até 12×).', borda: 'border-violet-200',  bg: 'bg-violet-50/50 hover:bg-violet-50',   texto: 'text-violet-900',  sub: 'text-violet-700' },
                  }[tipoCobranca];

                  return (
                    <>
                      <Field label={`Gerar cobrança ${tipoCobranca.toLowerCase()} agora?`} wide>
                        <label className={`flex items-start gap-2 cursor-pointer p-3 rounded-lg border ${cfg.borda} ${cfg.bg}`}>
                          <input
                            type="checkbox"
                            name="gerarPixEntrada"
                            checked={gerarPixEntrada}
                            onChange={(e) => setGerarPixEntrada(e.target.checked)}
                            className="mt-0.5 rounded"
                          />
                          <div>
                            <p className={`text-sm font-medium ${cfg.texto}`}>
                              {cfg.icon} {cfg.titulo} ({formatBRL(valorEntrada)})
                            </p>
                            <p className={`text-xs ${cfg.sub} mt-0.5`}>{cfg.descricao}</p>
                          </div>
                        </label>
                      </Field>

                      {/* Quando é CARTÃO, admin escolhe em quantas vezes o cliente
                          poderá parcelar no cartão de crédito (1x..12x).
                          O Asaas gera 1 fatura com o totalValue e installmentCount,
                          e o cliente paga em N vezes no cartão. */}
                      {tipoCobranca === 'CARTAO' && (
                        <Field label="Em quantas vezes o cliente poderá parcelar no cartão?" wide>
                          <div className="flex items-center gap-3 flex-wrap">
                            <select
                              name="cartaoEntradaParcelas"
                              value={cartaoEntradaParcelas}
                              onChange={(e) => setCartaoEntradaParcelas(Number(e.target.value))}
                              className={`${inputClass} max-w-[180px]`}
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                                const valorParc =
                                  valorEntrada > 0 ? valorEntrada / n : 0;
                                return (
                                  <option key={n} value={n}>
                                    {n}× {n === 1 ? '(à vista)' : `de ${formatBRL(valorParc)}`}
                                  </option>
                                );
                              })}
                            </select>
                            <p className="text-xs text-violet-700 dark:text-violet-300">
                              💳 O cliente vê esse limite na hora de pagar.
                              {cartaoEntradaParcelas > 1 && (
                                <>
                                  {' '}<strong>Total cobrado no cartão:</strong>{' '}
                                  {formatBRL(valorEntrada)} dividido em{' '}
                                  {cartaoEntradaParcelas}×.
                                </>
                              )}
                            </p>
                          </div>
                        </Field>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}
        <Field label="Data do contrato">
          <input
            name="dataContrato"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </Field>

        {/* Preview do cálculo */}
        <div className="md:col-span-2 p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-200 rounded-lg">
          <p className="text-xs uppercase tracking-wider text-primary-700 mb-2 font-semibold">
            Resumo
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Total</p>
              <p className="font-bold text-slate-900">{formatBRL(valorTotal)}</p>
            </div>
            {!isAvista && (
              <>
                <div>
                  <p className="text-slate-500 text-xs">
                    Entrada
                    {valorEntrada === 0 && (
                      <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-700 font-bold">
                        · sem entrada
                      </span>
                    )}
                  </p>
                  <p
                    className={`font-bold ${valorEntrada === 0 ? 'text-amber-700' : 'text-slate-900'}`}
                  >
                    {formatBRL(valorEntrada)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">
                    {valorEntrada === 0 ? 'A financiar' : 'Restante'}
                  </p>
                  <p className="font-bold text-slate-900">{formatBRL(restante)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Parcela</p>
                  <p className="font-bold text-primary-700">
                    {formatBRL(valorParcela)}
                    <span className="text-xs font-normal text-slate-500"> × {numeroParcelas}x</span>
                  </p>
                </div>

                {mostrarJuros && (
                  <div className="col-span-2 md:col-span-4 pt-2 mt-2 border-t border-primary-200">
                    {taxaMensal > 0 ? (
                      <p className="text-xs text-slate-700">
                        Preço à vista do lote:{' '}
                        <strong>{formatBRL(somaPrecosLotes)}</strong> · juros embutidos:{' '}
                        <strong>{formatBRL(jurosEmbutidos)}</strong> · taxa:{' '}
                        <strong>
                          {(taxaMensal * 100).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 3,
                          })}
                          % ao mês
                        </strong>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <strong>Venda sem juros.</strong> O valor total está igual ao
                        preço à vista do lote ({formatBRL(somaPrecosLotes)}), então as
                        parcelas só devolvem o principal. Se a intenção é vender
                        parcelado com juros, o valor total precisa ser o do contrato —
                        entrada mais a soma das parcelas.
                      </p>
                    )}
                  </div>
                )}
                {dataPrimeiraParcela && (
                  <div className="col-span-2 md:col-span-4 pt-2 mt-2 border-t border-primary-200">
                    <p className="text-slate-500 text-xs">Cronograma</p>
                    <p className="text-xs text-slate-700">
                      1ª parcela:{' '}
                      <strong>
                        {new Date(dataPrimeiraParcela + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </strong>
                      {numeroParcelas > 1 && (
                        <>
                          {' '}· última:{' '}
                          <strong>
                            {(() => {
                              const d = new Date(dataPrimeiraParcela + 'T00:00:00');
                              const dia = Math.min(d.getDate(), 28);
                              const ult = new Date(d);
                              ult.setMonth(d.getMonth() + (numeroParcelas - 1));
                              ult.setDate(dia);
                              return ult.toLocaleDateString('pt-BR');
                            })()}
                          </strong>
                        </>
                      )}
                      {' '}· dia-âncora:{' '}
                      <strong>
                        {Math.min(new Date(dataPrimeiraParcela + 'T00:00:00').getDate(), 28)}
                      </strong>{' '}
                      do mês
                    </p>
                  </div>
                )}
              </>
            )}
            {isAvista && (
              <div className="col-span-3">
                <p className="text-slate-500 text-xs">Pagamento</p>
                <p className="font-bold text-emerald-700">
                  ✓ {formatBRL(valorTotal)} à vista (venda já será marcada como QUITADA)
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ====== CORRETOR (OPCIONAL) ====== */}
      {corretores.length > 0 && (
        <Section title="Corretor (opcional)">
          <Field label="Corretor responsável" wide>
            <select
              name="corretorId"
              value={corretorId}
              onChange={(e) => setCorretorId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Sem corretor —</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.comissaoPadrao.toFixed(1)}% padrão p/ comerciais)
                </option>
              ))}
            </select>
          </Field>

          {corretorId && (
            <>
              {/* Comissão FIXA (residenciais) — sempre visível, não editável */}
              {qtdResidenciais > 0 && (
                <Field label="Comissão fixa (residencial)" wide>
                  <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">
                        🏠 {qtdResidenciais}{' '}
                        {qtdResidenciais === 1 ? 'lote residencial' : 'lotes residenciais'}
                        {' × '}
                        <strong>{formatBRL(COMISSAO_FIXA_RESIDENCIAL)}</strong>
                      </span>
                      <strong className="text-emerald-700 text-base">
                        {formatBRL(comissaoFixaTotal)}
                      </strong>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Valor fixo. Pago em <strong>4 parcelas de {formatBRL(COMISSAO_FIXA_RESIDENCIAL / 4)}</strong>,
                      uma por entrada + 3 primeiras mensais do cliente.
                    </p>
                  </div>
                </Field>
              )}

              {/* Comissão % (comerciais) — só aparece se tem lote comercial */}
              {qtdComerciais > 0 && (
                <Field
                  label={`Comissão % (sobre fatia comercial — ${formatBRL(fatiaComercial)})`}
                  wide
                >
                  <input
                    name="comissaoPct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={comissaoPct}
                    onChange={(e) =>
                      setComissaoPct(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className={inputClass}
                  />
                  {typeof comissaoPct === 'number' && (
                    <p className="text-xs text-slate-500 mt-1">
                      = <strong>{formatBRL(comissaoPctTotal)}</strong> sobre {qtdComerciais}{' '}
                      lote{qtdComerciais > 1 ? 's' : ''} comercial
                      {qtdComerciais > 1 ? 'is' : ''}
                    </p>
                  )}
                </Field>
              )}

              {/* Campo hidden pra mandar pct sempre (compat com schema) */}
              {qtdComerciais === 0 && (
                <input type="hidden" name="comissaoPct" value="" />
              )}

              {/* Total da comissão */}
              <div className="md:col-span-2 px-3 py-2.5 rounded-lg bg-primary-50 border border-primary-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">
                    💰 Total da comissão para o corretor
                  </span>
                  <strong className="text-primary-700 text-lg">
                    {formatBRL(comissaoValor)}
                  </strong>
                </div>
                {qtdResidenciais > 0 && (
                  <p className="text-[11px] text-slate-600 mt-1">
                    Liberada conforme cliente paga: 1ª parcela na entrada, depois 1 a cada
                    mensal pago (até a 4ª). Acompanhe em{' '}
                    <a href="/admin/comissoes" target="_blank" className="underline font-semibold">
                      Comissões
                    </a>
                    .
                  </p>
                )}
              </div>
            </>
          )}
        </Section>
      )}

      {/* ====== OPÇÕES AVANÇADAS ====== */}
      <Section title="Opções">
        <Field label="Gerar parcelas automaticamente?" wide>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="gerarParcelas"
              checked={gerarParcelas}
              onChange={(e) => setGerarParcelas(e.target.checked)}
              disabled={isAvista}
              className="mt-0.5 rounded"
            />
            <div>
              <p className="text-sm text-slate-700">
                {gerarParcelas ? 'Sim — sistema gera as parcelas conforme acima' : 'Não — vou cadastrar as parcelas depois'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAvista
                  ? 'Pagamento à vista sempre gera 1 parcela já paga'
                  : 'Desmarque se quiser cadastrar parcelas manualmente (ex: planilha externa, valores irregulares)'}
              </p>
            </div>
          </label>
        </Field>

        {!isAvista && (
          <Field label="Status do lote após a venda" wide>
            <select name="statusLoteFinal" defaultValue="EM_PAGAMENTO" className={selectClass}>
              <option value="EM_PAGAMENTO">Em pagamento (padrão) — fica amarelo no mapa</option>
              <option value="VENDIDO">Já marcar como Vendido — fica vermelho/cruz no mapa</option>
            </select>
          </Field>
        )}

        <Field label="Observações" wide>
          <textarea
            name="observacoes"
            rows={2}
            className={inputClass}
            placeholder="Notas internas sobre essa venda..."
          />
        </Field>
      </Section>

      <div className="flex gap-3 pt-2">
        <SubmitButton label="Criar venda" loadingLabel="Criando..." />
      </div>
    </form>
  );
}
