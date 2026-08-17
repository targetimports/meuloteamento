'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, requireAdmin } from '@/lib/tenant';
import { resolverClientePorCpf } from '@/lib/cliente-upsert';
import { mudarStatusLote } from '@/lib/lote-status';
import { getLoteadoraAsaasContext } from '@/lib/asaas-context';
import { ensureAsaasCustomerForCliente } from '@/lib/asaas-cliente';
import { createPaymentForParcela, getPixQrCode } from '@/lib/asaas';
import {
  calcularComissaoVenda,
  dividirEmParcelasIguais,
  escolherParcelasAncora,
  COMISSAO_NUMERO_PARCELAS,
} from '@/lib/comissao';

const checkbox = z.preprocess((v) => v === 'on' || v === true, z.boolean());

/**
 * Aceita `loteIds` como JSON string (array de IDs) — campo hidden no form.
 * Fallback: aceita `loteId` único (compat com formulários antigos).
 */
const loteIdsTransform = z.preprocess(
  (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return [];
      if (s.startsWith('[')) {
        try {
          const arr = JSON.parse(s);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }
      return [s];
    }
    return [];
  },
  z.array(z.string().min(1))
);

const schema = z.object({
  // Aceita loteIds (multi) OU loteId (legado/single)
  loteIds: loteIdsTransform.optional(),
  loteId: z.string().optional(),

  // Cliente: ou existente (clienteId) ou novo (cliente* fields)
  clienteId: z.string().optional(),
  clienteNome: z.string().trim().optional(),
  clienteCpfCnpj: z.string().trim().optional(),
  clienteEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  clienteTelefone: z.string().trim().optional(),

  // Valores
  valorTotal: z.coerce.number().positive('Valor total deve ser positivo'),
  valorEntrada: z.coerce.number().min(0).default(0),
  /**
   * Limite máximo: 72 parcelas.
   * Valor padrão: 60 (regra de tabela do Parque Tucano).
   *
   * Era 65 desde que só existia a tabela do Parque Tucano. O Alto do Sertão
   * vende em 72x, e o corte antigo recusava a venda no envio mesmo com o
   * simulador público já oferecendo o prazo.
   */
  numeroParcelas: z.coerce.number().int().min(1).max(72).default(60),
  diaVencimento: z.coerce.number().int().min(1).max(28).default(10),
  /**
   * Data específica da PRIMEIRA parcela mensal (não a entrada).
   * Se preenchida, sobrescreve diaVencimento — o dia do mês dela vira o dia
   * de todas as parcelas seguintes (parcela N vence em primeiraParcela + (N-1) meses).
   * Se vazia, fallback ao comportamento legado (dataContrato + 1 mês, dia=diaVencimento).
   */
  dataPrimeiraParcela: z.string().optional(),
  dataContrato: z.string().optional(),
  formaPagamento: z.enum([
    'A_VISTA',
    'A_VISTA_ESPECIE',
    'A_VISTA_CHEQUE',
    'PARCELADO_BOLETO',
    'PARCELADO_PIX',
    'PARCELADO_CARTAO',
    'PARCELADO_CHEQUE',
    'PARCELADO_MISTO',
  ]),
  /**
   * Forma de pagamento específica da ENTRADA. Permite que a entrada use
   * uma forma diferente das mensais. Quando vazia, segue a forma principal.
   * Valores aceitos para entrada:
   *   - PIX                → cobrança PIX no Asaas (cliente pagará)
   *   - BOLETO             → boleto no Asaas
   *   - CARTAO             → cartão no Asaas
   *   - JA_PAGA_PIX        → cliente já transferiu via PIX/transferência
   *   - JA_PAGA_ESPECIE    → cliente entregou em mãos
   *   - JA_PAGA_CHEQUE     → cheque já compensado (parcela nasce PAGA)
   *   - CHEQUE_PROGRAMADO  → cheque pré-datado (parcela PENDENTE até vencer)
   */
  formaPagamentoEntrada: z
    .enum([
      'PIX',
      'BOLETO',
      'CARTAO',
      'JA_PAGA_PIX',
      'JA_PAGA_ESPECIE',
      'JA_PAGA_CHEQUE',
      'CHEQUE_PROGRAMADO',
    ])
    .optional(),
  /** Conta destinatária especificamente da entrada (override). */
  contaIdEntrada: z.string().optional(),
  /** Dados do cheque da entrada (opcional, só quando forma for cheque) */
  chequeNumero: z.string().optional(),
  chequeBanco: z.string().optional(),
  chequeEmitente: z.string().optional(),
  chequePraca: z.string().optional(),
  /** Data de vencimento do cheque pré-datado (YYYY-MM-DD) */
  chequeVencimento: z.string().optional(),

  /**
   * Quando a entrada é cobrada via CARTÃO DE CRÉDITO (Asaas), define em
   * quantas vezes o cliente pode parcelar no cartão (1..12). 1 = à vista.
   * Ignorado para PIX / BOLETO / espécie / cheque.
   */
  cartaoEntradaParcelas: z.coerce.number().int().min(1).max(12).default(1),

  contaId: z.string().optional(),
  corretorId: z.string().optional(),
  /**
   * Comissão definida na própria venda. Ausentes, valem as regras de sempre:
   * R$ 2.500 por lote residencial (ou % do corretor nos comerciais), em 4
   * parcelas. É o que mantém as vendas antigas e o fluxo atual intactos.
   */
  comissaoValorManual: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0).optional()
  ),
  comissaoParcelas: z.coerce.number().int().min(1).max(24).optional(),
  comissaoPct: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0).max(100).optional()
  ),

  observacoes: z.string().trim().optional(),

  /**
   * Senha de autorização para liberar venda SEM entrada (valorEntrada=0).
   * Exigida apenas quando valorEntrada=0 e a loteadora tem
   * `vendaSemEntradaSenhaHash` configurado. O sistema valida bcrypt e,
   * se OK, marca o lote como VENDIDO (não EM_PAGAMENTO) e calcula as
   * parcelas usando o valorTotal inteiro.
   */
  senhaAutorizacaoSemEntrada: z.string().optional(),

  gerarParcelas: checkbox.default(true),
  gerarPixEntrada: checkbox.default(false),
  statusLoteFinal: z.enum(['VENDIDO', 'EM_PAGAMENTO']).default('EM_PAGAMENTO'),
});

type FormState = { error?: string; ok?: boolean };

export async function criarVenda(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const data = parsed.data;

  // ===== Resolve a lista de lotes =====
  const loteIds = data.loteIds && data.loteIds.length > 0
    ? Array.from(new Set(data.loteIds))
    : data.loteId
      ? [data.loteId]
      : [];
  if (loteIds.length === 0) {
    return { error: 'Selecione pelo menos 1 lote' };
  }

  // Carrega todos os lotes e valida
  const lotes = await prisma.lote.findMany({
    where: { id: { in: loteIds } },
    include: { loteamento: { select: { id: true, loteadoraId: true, slug: true } } },
  });
  if (lotes.length !== loteIds.length) {
    return { error: 'Um ou mais lotes não foram encontrados' };
  }

  // Tenant: todos os lotes devem ser da mesma loteadora
  const loteadoraId = lotes[0].loteamento.loteadoraId;
  if (!lotes.every((l) => l.loteamento.loteadoraId === loteadoraId)) {
    return { error: 'Todos os lotes devem pertencer à mesma loteadora' };
  }
  if (!(await canAccessLoteamento(loteadoraId))) {
    return { error: 'Sem permissão para estes lotes' };
  }

  // ===== Senha de autorização — venda SEM entrada =====
  // Regra: SOMENTE em venda PARCELADA, se valorEntrada=0, exige senha.
  // Vendas À VISTA (A_VISTA / A_VISTA_ESPECIE / A_VISTA_CHEQUE) pagam o
  // valor INTEIRO na hora — não existe o conceito de "entrada" pra elas,
  // então o check NÃO se aplica.
  const formaIsAvistaCheck =
    data.formaPagamento === 'A_VISTA' ||
    data.formaPagamento === 'A_VISTA_ESPECIE' ||
    data.formaPagamento === 'A_VISTA_CHEQUE';
  let vendaSemEntradaAutorizada = false;
  if (!formaIsAvistaCheck && data.valorEntrada === 0) {
    const loteadora = await prisma.loteadora.findUnique({
      where: { id: loteadoraId },
      select: { vendaSemEntradaSenhaHash: true, nome: true },
    });
    if (!loteadora?.vendaSemEntradaSenhaHash) {
      return {
        error:
          `Venda SEM ENTRADA bloqueada — a loteadora "${loteadora?.nome ?? ''}" não ` +
          `tem senha de autorização cadastrada. Peça ao administrador para ` +
          `cadastrá-la em Loteadoras → editar.`,
      };
    }
    const senhaDigitada = (data.senhaAutorizacaoSemEntrada ?? '').trim();
    if (!senhaDigitada) {
      return {
        error:
          'Venda SEM ENTRADA: digite a senha de autorização no campo destacado.',
      };
    }
    const ok = await bcrypt.compare(senhaDigitada, loteadora.vendaSemEntradaSenhaHash);
    if (!ok) {
      return { error: 'Senha de autorização incorreta.' };
    }
    vendaSemEntradaAutorizada = true;
  }

  // Disponibilidade
  for (const l of lotes) {
    if (l.status === 'VENDIDO') {
      return { error: `Lote ${l.codigo} já está vendido. Distrate a venda anterior antes.` };
    }
    if (l.status === 'BLOQUEADO') {
      return { error: `Lote ${l.codigo} está bloqueado.` };
    }
  }

  // Reordena na ordem dos IDs informados (mantém a escolha do admin como ordem)
  const lotesOrdenados = loteIds
    .map((id) => lotes.find((l) => l.id === id)!)
    .filter(Boolean);
  const lotePrincipal = lotesOrdenados[0];

  const slugsAfetados = Array.from(new Set(lotesOrdenados.map((l) => l.loteamento.slug)));
  const codigosLotes = lotesOrdenados.map((l) => l.codigo).join(', ');
  const isMulti = lotesOrdenados.length > 1;

  // ===== Cliente: existente ou novo =====
  let clienteIdFinal = data.clienteId?.trim();

  if (!clienteIdFinal) {
    if (!data.clienteNome || !data.clienteCpfCnpj || !data.clienteTelefone) {
      return {
        error: 'Selecione um cliente existente ou preencha nome, CPF e telefone do novo cliente',
      };
    }
    // A regra de identidade (CPF manda) e a de e-mail unico vivem em
    // lib/cliente-upsert: o cadastro rapido do combobox usa exatamente as
    // mesmas, e duas copias divergiriam justamente nos casos de borda.
    const r = await resolverClientePorCpf({
      nome: data.clienteNome,
      cpfCnpj: data.clienteCpfCnpj,
      telefone: data.clienteTelefone,
      email: data.clienteEmail,
    });
    if (!r.ok) return { error: r.erro };
    clienteIdFinal = r.id;
  } else {
    const c = await prisma.cliente.findUnique({ where: { id: clienteIdFinal } });
    if (!c) return { error: 'Cliente não encontrado' };
  }

  // ===== Corretor + comissão =====
  // Lotes RESIDENCIAIS: comissão FIXA R$2500/lote (não usa %)
  // Lotes COMERCIAIS:   mantém regra antiga (% do corretor sobre o valor)
  // Misto: soma fixo dos residenciais + % do trecho comercial.
  let corretorIdFinal: string | undefined = data.corretorId?.trim() || undefined;
  let comissaoPct: number | null = data.comissaoPct ?? null;
  let comissaoValor: number | undefined;
  let comissaoUsaRegraFixa = false;
  if (corretorIdFinal) {
    const c = await prisma.corretor.findUnique({ where: { id: corretorIdFinal } });
    if (!c) return { error: 'Corretor não encontrado' };
    if (comissaoPct === null) {
      comissaoPct = Number(c.comissaoPadrao);
    }
    // calcularComissaoVenda precisa dos lotes + valoresPorLote — calcularemos
    // depois quando esses dados estiverem prontos (logo abaixo).
  }

  // ===== Valor parcela + datas =====
  const restante = Math.max(0, data.valorTotal - data.valorEntrada);
  const isAvista = data.formaPagamento === 'A_VISTA' || data.formaPagamento === 'A_VISTA_ESPECIE';
  const valorParcela = isAvista
    ? data.valorTotal
    : data.numeroParcelas > 0
    ? Math.round((restante / data.numeroParcelas) * 100) / 100
    : 0;

  const dataContratoFinal = data.dataContrato ? new Date(data.dataContrato) : new Date();
  const statusVendaInicial = isAvista ? 'QUITADA' : 'ATIVA';
  // Venda autorizada SEM entrada → lote vai direto pra VENDIDO (fica fora
  // de circulação totalmente). A venda continua ATIVA porque há parcelas a
  // receber, mas o lote não pode aparecer pra ninguém comprar.
  const statusLoteFinal = isAvista
    ? 'VENDIDO'
    : vendaSemEntradaAutorizada
      ? 'VENDIDO'
      : data.statusLoteFinal;

  /**
   * Resolve a data da primeira parcela mensal e o dia-âncora do mês.
   *
   * - Se o usuário forneceu dataPrimeiraParcela, usamos esta como vencimento da
   *   parcela #1, e o dia dela passa a ser o dia-âncora das demais (parcela N
   *   vence em primeiraParcela + (N-1) meses, sempre no mesmo dia).
   * - Senão, fallback ao legado: primeira parcela = dataContrato + 1 mês,
   *   dia = diaVencimento.
   *
   * O dia é clampado a 28 para evitar problemas com fevereiro / meses curtos.
   */
  let primeiroVencimento: Date;
  let diaAncora: number;
  if (data.dataPrimeiraParcela && data.dataPrimeiraParcela.trim()) {
    const d = new Date(data.dataPrimeiraParcela + 'T00:00:00');
    if (isNaN(d.getTime())) {
      return { error: 'Data da primeira parcela inválida' };
    }
    primeiroVencimento = d;
    diaAncora = Math.min(d.getDate(), 28);
    // Se o dia original era > 28, normaliza a primeira parcela também
    if (d.getDate() > 28) {
      primeiroVencimento = new Date(d);
      primeiroVencimento.setDate(28);
    }
  } else {
    const d = new Date(dataContratoFinal);
    d.setMonth(d.getMonth() + 1);
    d.setDate(data.diaVencimento);
    primeiroVencimento = d;
    diaAncora = data.diaVencimento;
  }

  if (data.formaPagamento === 'A_VISTA_ESPECIE' && !data.contaId) {
    return { error: 'Para pagamento em espécie, selecione qual caixa/conta recebeu o dinheiro.' };
  }
  if (data.contaId) {
    const conta = await prisma.contaFinanceira.findUnique({
      where: { id: data.contaId },
      select: { loteadoraId: true },
    });
    if (!conta || conta.loteadoraId !== loteadoraId) {
      return { error: 'Conta financeira inválida' };
    }
  }
  // Valida contaIdEntrada se foi passado
  if (data.contaIdEntrada) {
    const conta = await prisma.contaFinanceira.findUnique({
      where: { id: data.contaIdEntrada },
      select: { loteadoraId: true },
    });
    if (!conta || conta.loteadoraId !== loteadoraId) {
      return { error: 'Conta financeira da entrada inválida' };
    }
  }

  /**
   * Resolve metadados da parcela ENTRADA com base em `formaPagamentoEntrada`.
   *
   * Retorna:
   *  - forma: FormaPagamento concreta a gravar na parcela
   *  - status inicial: PAGO (se já paga) ou PENDENTE (se será cobrada)
   *  - contaIdFinal: contaIdEntrada do form, ou contaId geral como fallback
   *  - gerarCobrancaAgora: se deve criar cobrança no Asaas
   *  - billingType: tipo de cobrança Asaas — 'PIX' | 'BOLETO' | 'CREDIT_CARD'
   *  - jaPaga: se a parcela deve nascer PAGO
   */
  type EntradaConfig = {
    forma:
      | 'A_VISTA'
      | 'A_VISTA_ESPECIE'
      | 'A_VISTA_CHEQUE'
      | 'PARCELADO_BOLETO'
      | 'PARCELADO_PIX'
      | 'PARCELADO_CARTAO'
      | 'PARCELADO_CHEQUE'
      | 'PARCELADO_MISTO';
    jaPaga: boolean;
    contaIdFinal: string | null;
    gerarCobrancaAgora: boolean;
    billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | null;
    /** Se a entrada é cheque (programado ou já compensado), guarda os dados.
     *  Cheque "compensa" no vencimento → se programado, parcela usa essa data;
     *  se já compensado, parcela nasce PAGA com pagoEm=hoje. */
    chequeProgramado: boolean;
    /** Override do vencimento da parcela ENTRADA (só para cheque pré-datado) */
    vencimentoOverride: Date | null;
  };

  function resolverEntrada(): EntradaConfig {
    const override = data.formaPagamentoEntrada;
    const baseCheque = {
      chequeProgramado: false,
      vencimentoOverride: null as Date | null,
    };
    if (!override) {
      // Sem override: entrada herda a forma das mensais
      const isMensaisPix = data.formaPagamento === 'PARCELADO_PIX';
      const isMensaisBoleto = data.formaPagamento === 'PARCELADO_BOLETO';
      const isMensaisCartao = data.formaPagamento === 'PARCELADO_CARTAO';
      // Só "Cobrar agora" se for um dos 3 tipos cobráveis E o admin marcou
      const podeBilling = isMensaisPix || isMensaisBoleto || isMensaisCartao;
      return {
        forma: data.formaPagamento,
        jaPaga: false,
        contaIdFinal: data.contaId ?? null,
        gerarCobrancaAgora: podeBilling && data.gerarPixEntrada,
        billingType: isMensaisPix
          ? 'PIX'
          : isMensaisBoleto
            ? 'BOLETO'
            : isMensaisCartao
              ? 'CREDIT_CARD'
              : null,
        ...baseCheque,
      };
    }
    if (override === 'JA_PAGA_ESPECIE') {
      return {
        forma: 'A_VISTA_ESPECIE',
        jaPaga: true,
        contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
        gerarCobrancaAgora: false,
        billingType: null,
        ...baseCheque,
      };
    }
    if (override === 'JA_PAGA_PIX') {
      return {
        forma: 'A_VISTA',
        jaPaga: true,
        contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
        gerarCobrancaAgora: false,
        billingType: null,
        ...baseCheque,
      };
    }
    if (override === 'JA_PAGA_CHEQUE') {
      // Cheque que JÁ compensou → parcela nasce PAGA com data de hoje
      return {
        forma: 'A_VISTA_CHEQUE',
        jaPaga: true,
        contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
        gerarCobrancaAgora: false,
        billingType: null,
        chequeProgramado: false,
        vencimentoOverride: null,
      };
    }
    if (override === 'CHEQUE_PROGRAMADO') {
      // Cheque pré-datado → parcela PENDENTE até chegar a data do cheque.
      // No financeiro vai aparecer na lista de "a receber" como qualquer outra.
      const vencimentoStr = data.chequeVencimento ?? null;
      const vencimentoData = vencimentoStr
        ? new Date(vencimentoStr + 'T00:00:00')
        : null;
      return {
        forma: 'A_VISTA_CHEQUE',
        jaPaga: false,
        contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
        gerarCobrancaAgora: false,
        billingType: null,
        chequeProgramado: true,
        vencimentoOverride:
          vencimentoData && !isNaN(vencimentoData.getTime())
            ? vencimentoData
            : null,
      };
    }
    if (override === 'PIX') {
      return {
        forma: 'PARCELADO_PIX',
        jaPaga: false,
        contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
        gerarCobrancaAgora: data.gerarPixEntrada,
        billingType: 'PIX',
        ...baseCheque,
      };
    }
    if (override === 'BOLETO') {
      return {
        forma: 'PARCELADO_BOLETO',
        jaPaga: false,
        contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
        gerarCobrancaAgora: data.gerarPixEntrada,
        billingType: 'BOLETO',
        ...baseCheque,
      };
    }
    // CARTAO
    return {
      forma: 'PARCELADO_CARTAO',
      jaPaga: false,
      contaIdFinal: data.contaIdEntrada ?? data.contaId ?? null,
      gerarCobrancaAgora: data.gerarPixEntrada,
      billingType: 'CREDIT_CARD',
      ...baseCheque,
    };
  }

  const entradaCfg = resolverEntrada();

  // Se entrada é "já paga em espécie" → exige conta destinatária
  if (entradaCfg.jaPaga && entradaCfg.forma === 'A_VISTA_ESPECIE' && !entradaCfg.contaIdFinal) {
    return {
      error:
        'Para entrada já paga em espécie, selecione qual caixa/conta recebeu o dinheiro.',
    };
  }

  // ===== Distribuição do valorTotal pelos lotes =====
  // Estratégia: proporcional ao preço de tabela de cada lote.
  // Se a soma dos preços de tabela é zero, divide igualmente.
  const somaPrecos = lotesOrdenados.reduce((s, l) => s + Number(l.preco), 0);
  const valoresPorLote = lotesOrdenados.map((l) => {
    if (somaPrecos > 0) {
      return Math.round((data.valorTotal * Number(l.preco)) / somaPrecos * 100) / 100;
    }
    return Math.round((data.valorTotal / lotesOrdenados.length) * 100) / 100;
  });
  // Ajuste de centavos: a diferença vai para o primeiro lote
  const somaDistribuida = valoresPorLote.reduce((s, v) => s + v, 0);
  const ajuste = Math.round((data.valorTotal - somaDistribuida) * 100) / 100;
  if (ajuste !== 0 && valoresPorLote.length > 0) {
    valoresPorLote[0] = Math.round((valoresPorLote[0] + ajuste) * 100) / 100;
  }

  // ===== Cálculo final da comissão (agora que temos lotes + valoresPorLote) =====
  if (corretorIdFinal) {
    const calc = calcularComissaoVenda({
      lotes: lotesOrdenados.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        preco: Number(l.preco),
      })),
      valorTotalVenda: data.valorTotal,
      valoresPorLote,
      pctCorretor: comissaoPct ?? 0,
    });
    comissaoValor = calc.valor;
    comissaoUsaRegraFixa = calc.usaRegraFixa;
    // Valor digitado na venda vence o calculado: a regra automática vira uma
    // sugestão, e quem negociou diferente registra o que de fato combinou.
    if (data.comissaoValorManual !== undefined) {
      comissaoValor = data.comissaoValorManual;
    }
    // Quando usa regra fixa (residencial), o pct equivalente é só informativo
    if (calc.usaRegraFixa && calc.qtdLotesComerciais === 0) {
      // 100% residencial: zerar pct para não confundir
      comissaoPct = null;
    } else {
      comissaoPct = calc.pctEquivalente;
    }
  }

  // ===== Transação =====
  let vendaIdCriada = '';

  try {
    await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.create({
        data: {
          loteId: lotePrincipal.id,
          clienteId: clienteIdFinal!,
          corretorId: corretorIdFinal || null,
          comissaoPct: comissaoPct ?? null,
          comissaoValor: comissaoValor ?? null,
          valorTotal: data.valorTotal,
          valorEntrada: data.valorEntrada,
          numeroParcelas: isAvista ? 1 : data.numeroParcelas,
          valorParcela,
          diaVencimento: diaAncora,
          formaPagamento: data.formaPagamento,
          status: statusVendaInicial,
          dataContrato: dataContratoFinal,
          dataQuitacao: isAvista ? dataContratoFinal : null,
          origem: 'ADMIN',
          observacoes: data.observacoes || null,
        },
      });
      vendaIdCriada = venda.id;

      // Cria join VendaLote para TODOS os lotes (inclui o principal)
      await tx.vendaLote.createMany({
        data: lotesOrdenados.map((l, i) => ({
          vendaId: venda.id,
          loteId: l.id,
          valor: valoresPorLote[i],
          ordem: i,
        })),
      });

      // Gera parcelas se solicitado
      if (data.gerarParcelas || isAvista) {
        if (isAvista) {
          // À vista: 1 parcela com tudo. Se for cheque, anota dados do cheque
          // pra rastreabilidade (mesmo já estando PAGA — útil pra histórico).
          const ehChequeAVista = data.formaPagamento === 'A_VISTA_CHEQUE';
          await tx.parcela.create({
            data: {
              vendaId: venda.id,
              numero: 1,
              tipo: 'ENTRADA',
              valor: data.valorTotal,
              valorPago: data.valorTotal,
              vencimento: dataContratoFinal,
              pagoEm: dataContratoFinal,
              status: 'PAGO',
              contaId: data.contaId || null,
              formaPagamento: data.formaPagamento,
              ...(ehChequeAVista
                ? {
                    chequeNumero: data.chequeNumero?.trim() || null,
                    chequeBanco: data.chequeBanco?.trim() || null,
                    chequeEmitente: data.chequeEmitente?.trim() || null,
                    chequePraca: data.chequePraca?.trim() || null,
                  }
                : {}),
            },
          });
        } else {
          const parcelas: Array<{
            vendaId: string;
            numero: number;
            tipo: 'ENTRADA' | 'MENSAL';
            valor: number;
            valorPago?: number;
            vencimento: Date;
            pagoEm?: Date;
            status: 'PENDENTE' | 'PAGO';
            contaId?: string | null;
            formaPagamento?:
              | 'A_VISTA'
              | 'A_VISTA_ESPECIE'
              | 'A_VISTA_CHEQUE'
              | 'PARCELADO_BOLETO'
              | 'PARCELADO_PIX'
              | 'PARCELADO_CARTAO'
              | 'PARCELADO_CHEQUE'
              | 'PARCELADO_MISTO';
            chequeNumero?: string | null;
            chequeBanco?: string | null;
            chequeEmitente?: string | null;
            chequePraca?: string | null;
          }> = [];

          if (data.valorEntrada > 0) {
            // Cheque pré-datado: vencimento = data do cheque (override)
            // Demais: vencimento = data do contrato (mesma data da assinatura)
            const vencimentoEntrada =
              entradaCfg.vencimentoOverride ?? dataContratoFinal;
            // Campos do cheque (só quando forma é cheque)
            const ehCheque =
              entradaCfg.forma === 'A_VISTA_CHEQUE' ||
              entradaCfg.forma === 'PARCELADO_CHEQUE';
            parcelas.push({
              vendaId: venda.id,
              numero: 0,
              tipo: 'ENTRADA',
              valor: data.valorEntrada,
              vencimento: vencimentoEntrada,
              status: entradaCfg.jaPaga ? 'PAGO' : 'PENDENTE',
              ...(entradaCfg.jaPaga
                ? {
                    valorPago: data.valorEntrada,
                    pagoEm: dataContratoFinal,
                  }
                : {}),
              contaId: entradaCfg.contaIdFinal,
              formaPagamento: entradaCfg.forma,
              ...(ehCheque
                ? {
                    chequeNumero: data.chequeNumero?.trim() || null,
                    chequeBanco: data.chequeBanco?.trim() || null,
                    chequeEmitente: data.chequeEmitente?.trim() || null,
                    chequePraca: data.chequePraca?.trim() || null,
                  }
                : {}),
            });
          }
          for (let i = 1; i <= data.numeroParcelas; i++) {
            // Parcela #1 vence em `primeiroVencimento`.
            // Parcela #N vence em `primeiroVencimento + (N-1) meses`, dia=diaAncora.
            const venc = new Date(primeiroVencimento);
            venc.setMonth(primeiroVencimento.getMonth() + (i - 1));
            venc.setDate(diaAncora);
            parcelas.push({
              vendaId: venda.id,
              numero: i,
              tipo: 'MENSAL',
              valor: valorParcela,
              vencimento: venc,
              status: 'PENDENTE',
              contaId: data.contaId || null,
              formaPagamento: data.formaPagamento,
            });
          }
          await tx.parcela.createMany({ data: parcelas });
        }
      }

      // ===== Cria as 4 parcelas da comissão do corretor =====
      // Só cria se há corretor + valor > 0. As parcelas começam BLOQUEADAS
      // e ficam LIBERADAS quando o cliente paga a parcela vinculada.
      if (corretorIdFinal && comissaoValor && comissaoValor > 0) {
        // Carrega as parcelas do cliente recém-criadas para descobrir os IDs
        const parcelasCliente = await tx.parcela.findMany({
          where: { vendaId: venda.id },
          select: { id: true, tipo: true, numero: true, status: true },
          orderBy: { numero: 'asc' },
        });
        const qtdComissao = data.comissaoParcelas ?? COMISSAO_NUMERO_PARCELAS;
        const ancoras = escolherParcelasAncora(parcelasCliente, qtdComissao);
        const valores = dividirEmParcelasIguais(comissaoValor, qtdComissao);

        // Se a parcela-âncora já está PAGA na criação (caso à vista quitada),
        // a comissão já nasce LIBERADA.
        const parcelaPorId = new Map(parcelasCliente.map((p) => [p.id, p]));

        await tx.comissaoParcela.createMany({
          data: Array.from({ length: qtdComissao }, (_, i) => {
            const ancoraId = ancoras[i];
            const ancora = ancoraId ? parcelaPorId.get(ancoraId) : null;
            const jaPaga = ancora?.status === 'PAGO';
            return {
              vendaId: venda.id,
              corretorId: corretorIdFinal!,
              numero: i + 1,
              valor: valores[i],
              parcelaClienteId: ancoraId,
              status: jaPaga
                ? ('LIBERADA' as const)
                : ('BLOQUEADA' as const),
              liberadaEm: jaPaga ? new Date() : null,
            };
          }),
        });
      }

      // Atualiza status de TODOS os lotes
      for (const l of lotesOrdenados) {
        await mudarStatusLote({
          loteId: l.id,
          novoStatus: statusLoteFinal as 'VENDIDO' | 'EM_PAGAMENTO',
          motivo: isMulti
            ? `Venda ${venda.numero} (multi-lote: ${codigosLotes}) criada manualmente por ${session.email}`
            : `Venda ${venda.numero} criada manualmente por ${session.email}`,
          userId: session.sub,
          userType: 'ADMIN',
          tx,
        });
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar venda';
    return { error: msg };
  }

  // ===== Cobrança da entrada (PIX / Boleto / Cartão) — opcional =====
  // Só gera se admin escolheu uma das 3 formas cobráveis E marcou "gerar agora".
  // Para PIX: ainda pega o QR code (encodedImage + payload).
  // Para Boleto: salva bankSlipUrl e invoiceUrl.
  // Para Cartão: salva invoiceUrl (cliente abre a página de checkout do Asaas
  //              e paga com cartão de crédito).
  let pixWarn: string | null = null;
  if (
    entradaCfg.gerarCobrancaAgora &&
    entradaCfg.billingType &&
    !isAvista &&
    data.valorEntrada > 0
  ) {
    try {
      const ctx = await getLoteadoraAsaasContext(loteadoraId);
      if (!ctx) {
        pixWarn = 'asaas-sem-chave';
      } else {
        const parcelaEntrada = await prisma.parcela.findFirst({
          where: { vendaId: vendaIdCriada, tipo: 'ENTRADA', numero: 0 },
        });
        const cliente = await prisma.cliente.findUnique({
          where: { id: clienteIdFinal! },
          select: {
            id: true,
            nome: true,
            cpfCnpj: true,
            email: true,
            telefone: true,
            asaasCustomerId: true,
            cep: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
          },
        });
        if (parcelaEntrada && cliente) {
          const customerId = await ensureAsaasCustomerForCliente(ctx, cliente);
          const tipoLabel =
            entradaCfg.billingType === 'PIX'
              ? 'PIX'
              : entradaCfg.billingType === 'BOLETO'
                ? 'Boleto'
                : 'Cartão';
          const desc = isMulti
            ? `Entrada (${tipoLabel}) — Lotes ${codigosLotes}`
            : `Entrada (${tipoLabel}) — Lote ${lotePrincipal.codigo}`;
          const payment = await createPaymentForParcela(ctx, {
            customer: customerId,
            billingType: entradaCfg.billingType,
            value: data.valorEntrada,
            dueDate: parcelaEntrada.vencimento.toISOString().slice(0, 10),
            parcelaId: parcelaEntrada.id,
            description: desc,
            // Só vale pra CREDIT_CARD; o helper ignora em outros tipos.
            // Se admin escolheu parcelar a entrada no cartão, manda installmentCount.
            installmentCount:
              entradaCfg.billingType === 'CREDIT_CARD'
                ? data.cartaoEntradaParcelas
                : undefined,
          });

          // Campos a gravar variam por método
          const updateData: {
            asaasPaymentId: string;
            asaasInvoiceUrl: string | null;
            asaasBoletoUrl?: string | null;
            asaasPixCode?: string | null;
            asaasPixQrCode?: string | null;
          } = {
            asaasPaymentId: payment.id,
            asaasInvoiceUrl: payment.invoiceUrl ?? null,
          };

          if (entradaCfg.billingType === 'PIX') {
            // PIX: pega o QR code separado
            const qr = await getPixQrCode(ctx, payment.id);
            updateData.asaasPixCode = qr.payload;
            updateData.asaasPixQrCode = qr.encodedImage;
          } else if (entradaCfg.billingType === 'BOLETO') {
            // Boleto: bankSlipUrl traz o PDF
            updateData.asaasBoletoUrl = payment.bankSlipUrl ?? null;
          }
          // Cartão: invoiceUrl é o link de pagamento (já gravado acima)

          await prisma.parcela.update({
            where: { id: parcelaEntrada.id },
            data: updateData,
          });
        }
      }
    } catch (err) {
      console.error('[criarVenda] falha ao gerar cobrança da entrada', err);
      pixWarn = 'asaas-erro';
    }
  }

  revalidatePath('/admin/vendas');
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin/clientes');
  for (const slug of slugsAfetados) revalidatePath(`/${slug}`);

  const qs = new URLSearchParams({ msg: 'criada' });
  if (pixWarn) qs.set('pix', pixWarn);
  if (entradaCfg.billingType && entradaCfg.gerarCobrancaAgora) {
    qs.set('cobranca', entradaCfg.billingType.toLowerCase());
  }
  redirect(`/admin/vendas/${vendaIdCriada}?${qs.toString()}`);
}

/**
 * Cadastro rápido do comprador, a partir do combobox da tela de venda.
 *
 * Usa a mesma resolução por CPF do lançamento da venda: se o CPF já existe, o
 * cliente é reaproveitado e atualizado em vez de recusado — quem está lançando
 * uma venda não quer descobrir ali que o comprador já estava cadastrado.
 *
 * Devolve o cliente pronto para o campo, para a tela não precisar recarregar
 * a lista inteira só por causa de um cadastro.
 */
export async function criarClienteRapido(formData: FormData): Promise<{
  ok: boolean;
  cliente?: { id: string; nome: string; email: string; cpfCnpj: string; telefone: string };
  erro?: string;
}> {
  await requireAdmin();

  const r = await resolverClientePorCpf({
    nome: String(formData.get('nome') ?? ''),
    cpfCnpj: String(formData.get('cpfCnpj') ?? ''),
    telefone: String(formData.get('telefone') ?? ''),
    email: String(formData.get('email') ?? ''),
  });
  if (!r.ok) return { ok: false, erro: r.erro };

  const c = await prisma.cliente.findUnique({
    where: { id: r.id },
    select: { id: true, nome: true, email: true, cpfCnpj: true, telefone: true },
  });
  if (!c) return { ok: false, erro: 'Cliente não encontrado após o cadastro.' };

  revalidatePath('/admin/vendas/novo');
  return { ok: true, cliente: c };
}

/**
 * Cadastro rápido de corretor, a partir do combobox da tela de venda.
 *
 * A loteadora vem do loteamento do lote selecionado, não da sessão: assim
 * funciona igual para o admin da empresa e para o super admin, que não tem
 * loteadora própria. O acesso é conferido pelo mesmo caminho das demais ações.
 */
export async function criarCorretorRapido(formData: FormData): Promise<{
  ok: boolean;
  corretor?: { id: string; nome: string; comissaoPadrao: number };
  erro?: string;
}> {
  await requireAdmin();

  const loteamentoId = String(formData.get('loteamentoId') ?? '').trim();
  if (!loteamentoId) {
    return { ok: false, erro: 'Selecione o lote antes de cadastrar o corretor.' };
  }

  const loteamento = await prisma.loteamento.findUnique({
    where: { id: loteamentoId },
    select: { loteadoraId: true },
  });
  if (!loteamento) return { ok: false, erro: 'Loteamento não encontrado.' };
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) {
    return { ok: false, erro: 'Sem permissão para esta loteadora.' };
  }

  const nome = String(formData.get('nome') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!nome || !email) return { ok: false, erro: 'Informe nome e e-mail.' };

  const comissao = Number(String(formData.get('comissaoPadrao') ?? '0').replace(',', '.'));

  try {
    const c = await prisma.corretor.create({
      data: {
        loteadoraId: loteamento.loteadoraId,
        nome,
        email,
        telefone: String(formData.get('telefone') ?? '').trim() || null,
        comissaoPadrao: Number.isFinite(comissao) ? comissao : 0,
      },
      select: { id: true, nome: true, comissaoPadrao: true },
    });
    revalidatePath('/admin/vendas/novo');
    return {
      ok: true,
      corretor: { id: c.id, nome: c.nome, comissaoPadrao: Number(c.comissaoPadrao) },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      erro: `Não foi possível cadastrar o corretor. Detalhe: ${msg.split('\n')[0]}`,
    };
  }
}
