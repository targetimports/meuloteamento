/**
 * Consulta das parcelas do financeiro.
 *
 * Mora aqui, e não dentro da página, porque duas entradas precisam concordar:
 * a primeira carga vem renderizada do servidor e as trocas de ordem, filtro e
 * página vêm da rota que a tabela chama. Se cada uma montasse o próprio
 * `where`, um dia elas discordariam — e a divergência apareceria como uma
 * linha que some ao trocar a ordenação.
 */

import { prisma } from './prisma';
import { formatDate } from './format';
import { msgCobrancaParcela } from './whatsappMessages';

export interface FiltrosParcela {
  status: string;
  cliente: string;
  lote: string;
  loteamento: string;
  forma: string;
  de: string;
  ate: string;
  valorMin: string;
  valorMax: string;
}

export const FILTRO_PARCELA_VAZIO: FiltrosParcela = {
  status: '',
  cliente: '',
  lote: '',
  loteamento: '',
  forma: '',
  de: '',
  ate: '',
  valorMin: '',
  valorMax: '',
};

export type CampoOrdemParcela = 'vencimento' | 'contrato' | 'cliente' | 'valor' | 'status';

export const CAMPOS_ORDEM: CampoOrdemParcela[] = [
  'vencimento',
  'contrato',
  'cliente',
  'valor',
  'status',
];

export const PARCELAS_POR_PAGINA = 20;

export interface LinhaParcela {
  id: string;
  numero: number;
  tipo: string;
  vencimentoLabel: string;
  pagoEmLabel: string | null;
  valor: number;
  valorPago: number | null;
  status: string;
  /** ATRASADO calculado: PENDENTE cujo vencimento já passou. */
  statusVisual: string;
  contratoNumero: number;
  loteCodigo: string;
  loteamentoNome: string;
  clienteNome: string;
  clienteTelefone: string | null;
  formaPagamento: string | null;
  chequeNumero: string | null;
  chequeBanco: string | null;
  chequeEmitente: string | null;
  chequePraca: string | null;
  asaasInvoiceUrl: string | null;
  temCobranca: boolean;
  /** Texto de cobrança pronto — depende do nome da loteadora, que só o servidor tem. */
  mensagem: string;
}

/**
 * Tradução do campo para o `orderBy` do Prisma.
 *
 * Contrato e cliente moram em tabelas vizinhas — ordenar por eles é ordenar
 * pela relação, não por uma coluna da parcela.
 */
export function ordenarParcelasPor(campo: CampoOrdemParcela, dir: 'asc' | 'desc') {
  switch (campo) {
    case 'contrato':
      return { venda: { numero: dir } };
    case 'cliente':
      return { venda: { cliente: { nome: dir } } };
    case 'valor':
      return { valor: dir };
    case 'status':
      return { status: dir };
    default:
      return { vencimento: dir };
  }
}

const numero = (v: string): number | undefined => {
  const n = Number(String(v).replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

export function whereDeParcelas(tid: string | null, f: FiltrosParcela) {
  // Datas do formulário vêm como AAAA-MM-DD. O `ate` cobre o dia inteiro: quem
  // filtra "até 31/08" espera ver o que vence em 31/08.
  const dataDe = f.de ? new Date(`${f.de}T00:00:00`) : undefined;
  const dataAte = f.ate ? new Date(`${f.ate}T23:59:59`) : undefined;
  const vMin = numero(f.valorMin);
  const vMax = numero(f.valorMax);
  const soDigitos = f.cliente.replace(/\D/g, '');

  return {
    ...(tid ? { venda: { lote: { loteamento: { loteadoraId: tid } } } } : {}),
    ...(f.status ? { status: f.status as 'PENDENTE' } : {}),
    ...(f.forma ? { formaPagamento: f.forma as 'PARCELADO_PIX' } : {}),
    ...(dataDe || dataAte
      ? { vencimento: { ...(dataDe ? { gte: dataDe } : {}), ...(dataAte ? { lte: dataAte } : {}) } }
      : {}),
    ...(vMin !== undefined || vMax !== undefined
      ? {
          valor: {
            ...(vMin !== undefined ? { gte: vMin } : {}),
            ...(vMax !== undefined ? { lte: vMax } : {}),
          },
        }
      : {}),
    // Este bloco substitui o `venda` do escopo de empresa — por isso ele
    // repete o vínculo com a loteadora em cada nível que reescreve.
    ...(f.cliente || f.lote || f.loteamento
      ? {
          venda: {
            ...(tid ? { lote: { loteamento: { loteadoraId: tid } } } : {}),
            ...(f.cliente
              ? {
                  cliente: {
                    OR: [
                      { nome: { contains: f.cliente, mode: 'insensitive' as const } },
                      // Só consulta o CPF quando o texto tem dígito: com
                      // `contains: ''` o OR devolveria a lista inteira.
                      ...(soDigitos ? [{ cpfCnpj: { contains: soDigitos } }] : []),
                    ],
                  },
                }
              : {}),
            ...(f.lote || f.loteamento
              ? {
                  lote: {
                    ...(tid ? { loteamento: { loteadoraId: tid } } : {}),
                    ...(f.lote
                      ? { codigo: { contains: f.lote, mode: 'insensitive' as const } }
                      : {}),
                    ...(f.loteamento
                      ? {
                          loteamento: {
                            ...(tid ? { loteadoraId: tid } : {}),
                            nome: { contains: f.loteamento, mode: 'insensitive' as const },
                          },
                        }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

export async function consultarParcelas({
  tid,
  filtros,
  campo,
  dir,
  pagina,
}: {
  tid: string | null;
  filtros: FiltrosParcela;
  campo: CampoOrdemParcela;
  dir: 'asc' | 'desc';
  pagina: number;
}): Promise<{ linhas: LinhaParcela[]; total: number }> {
  const where = whereDeParcelas(tid, filtros);

  const [parcelas, total] = await Promise.all([
    prisma.parcela.findMany({
      where,
      orderBy: [ordenarParcelasPor(campo, dir)],
      skip: (pagina - 1) * PARCELAS_POR_PAGINA,
      take: PARCELAS_POR_PAGINA,
      include: {
        venda: {
          select: {
            numero: true,
            cliente: { select: { nome: true, telefone: true } },
            lote: {
              select: {
                codigo: true,
                loteamento: {
                  select: { nome: true, loteadora: { select: { nome: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.parcela.count({ where }),
  ]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const linhas: LinhaParcela[] = parcelas.map((p) => {
    const atrasada = p.status === 'PENDENTE' && p.vencimento.getTime() < hoje.getTime();
    return {
      id: p.id,
      numero: p.numero,
      tipo: p.tipo,
      // Datas viram texto aqui: formatar no navegador mostraria o dia anterior
      // para quem está a oeste de Greenwich.
      vencimentoLabel: formatDate(p.vencimento),
      pagoEmLabel: p.pagoEm ? formatDate(p.pagoEm) : null,
      valor: Number(p.valor),
      valorPago: p.valorPago === null ? null : Number(p.valorPago),
      status: p.status,
      statusVisual: atrasada ? 'ATRASADO' : p.status,
      contratoNumero: p.venda.numero,
      loteCodigo: p.venda.lote.codigo,
      loteamentoNome: p.venda.lote.loteamento.nome,
      clienteNome: p.venda.cliente.nome,
      clienteTelefone: p.venda.cliente.telefone,
      formaPagamento: p.formaPagamento,
      chequeNumero: p.chequeNumero,
      chequeBanco: p.chequeBanco,
      chequeEmitente: p.chequeEmitente,
      chequePraca: p.chequePraca,
      asaasInvoiceUrl: p.asaasInvoiceUrl,
      temCobranca: !!p.asaasPaymentId,
      mensagem: msgCobrancaParcela({
        cliente: { nome: p.venda.cliente.nome },
        venda: {
          numero: p.venda.numero,
          loteCodigo: p.venda.lote.codigo,
          loteamentoNome: p.venda.lote.loteamento.nome,
        },
        parcela: {
          numero: p.numero,
          vencimento: p.vencimento,
          valor: Number(p.valor),
          invoiceUrl: p.asaasInvoiceUrl ?? p.asaasBoletoUrl ?? null,
        },
        loteadora: { nome: p.venda.lote.loteamento.loteadora.nome },
      }),
    };
  });

  return { linhas, total };
}

/** Lê filtros/ordem/página de uma query string, com os mesmos padrões dos dois lados. */
export function lerParametros(get: (k: string) => string | null) {
  const filtros: FiltrosParcela = {
    status: get('status') ?? '',
    cliente: get('cliente') ?? '',
    lote: get('lote') ?? '',
    loteamento: get('loteamento') ?? '',
    forma: get('forma') ?? '',
    de: get('de') ?? '',
    ate: get('ate') ?? '',
    valorMin: get('valorMin') ?? '',
    valorMax: get('valorMax') ?? '',
  };
  const pedido = get('ordem') ?? '';
  const campo: CampoOrdemParcela = (CAMPOS_ORDEM as string[]).includes(pedido)
    ? (pedido as CampoOrdemParcela)
    : 'vencimento';
  const dir: 'asc' | 'desc' = get('dir') === 'desc' ? 'desc' : 'asc';
  const pagina = Math.max(1, Number(get('pagina')) || 1);
  return { filtros, campo, dir, pagina };
}
