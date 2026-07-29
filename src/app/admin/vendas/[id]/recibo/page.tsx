// IMPORTANTE: este arquivo está FORA do route group (dashboard) de propósito —
// assim a página de recibo NÃO herda o sidebar/topbar do admin e fica limpa
// pra impressão. A URL final segue sendo /admin/vendas/[id]/recibo.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento } from '@/lib/tenant';
import { formatBRL, formatDate } from '@/lib/format';
import { ImprimirButton } from '@/components/ImprimirButton';

export const dynamic = 'force-dynamic';

/** Converte valor numérico para extenso em português (R$). */
function valorPorExtenso(n: number): string {
  if (n === 0) return 'zero reais';
  const inteiros = Math.floor(n);
  const centavos = Math.round((n - inteiros) * 100);
  const parteReais = inteiroPorExtenso(inteiros);
  const txt =
    parteReais +
    (inteiros === 1 ? ' real' : ' reais') +
    (centavos > 0
      ? ' e ' + inteiroPorExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
      : '');
  return txt;
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezAdezenove = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function ate999(x: number): string {
    if (x === 0) return '';
    if (x === 100) return 'cem';
    const c = Math.floor(x / 100);
    const dz = Math.floor((x % 100) / 10);
    const un = x % 10;
    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);
    if (dz === 1) partes.push(dezAdezenove[un]);
    else {
      if (dz > 0) partes.push(dezenas[dz]);
      if (un > 0) partes.push(unidades[un]);
    }
    return partes.join(' e ');
  }

  if (n < 1000) return ate999(n);
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const partMil = mil === 1 ? 'mil' : ate999(mil) + ' mil';
    if (resto === 0) return partMil;
    return partMil + (resto < 100 ? ' e ' : ' ') + ate999(resto);
  }
  // milhões (suficiente pro range típico)
  const milhoes = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const partM = (milhoes === 1 ? 'um milhão' : ate999(milhoes) + ' milhões');
  return partM + (resto > 0 ? ' ' + inteiroPorExtenso(resto) : '');
}

export default async function ReciboPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { lote?: string };
}) {
  const venda = await prisma.venda.findUnique({
    where: { id: params.id },
    include: {
      cliente: true,
      corretor: { select: { nome: true } },
      lote: {
        include: {
          loteamento: {
            select: {
              nome: true,
              slug: true,
              loteadoraId: true,
              cidade: true,
              estado: true,
              loteadora: {
                select: {
                  nome: true,
                  cnpj: true,
                  endereco: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                  telefone: true,
                  email: true,
                  logo: true,
                },
              },
            },
          },
        },
      },
      vendaLotes: {
        orderBy: { ordem: 'asc' },
        include: {
          lote: {
            select: {
              id: true,
              codigo: true,
              quadra: true,
              area: true,
              loteamento: { select: { nome: true, cidade: true, estado: true } },
            },
          },
        },
      },
      parcelas: { where: { status: 'PAGO' }, include: { conta: true }, orderBy: { numero: 'asc' } },
    },
  });

  if (!venda) notFound();
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) notFound();

  const totalPagoVenda = venda.parcelas.reduce(
    (s, p) => s + Number(p.valorPago ?? p.valor),
    0
  );
  const valorTotalVenda = Number(venda.valorTotal);

  /**
   * Lista de lotes desta venda. Usa vendaLotes (multi-lote) se houver, senão cai
   * no lote principal (compat com vendas antigas que não populavam vendaLotes).
   *
   * Para cada lote, calcula o valor proporcional dos campos da venda:
   *   - fração      = valorLote / valorTotalVenda
   *   - entradaLote = venda.valorEntrada × fração
   *   - totalPagoLote = totalPagoVenda × fração
   */
  type LoteRecibo = {
    id: string;
    codigo: string;
    quadra: string | null;
    area: number;
    valorLote: number;
    fracao: number;
    entradaLote: number;
    totalPagoLote: number;
    loteamentoNome: string;
    loteamentoCidade: string | null;
    loteamentoEstado: string | null;
  };

  const lotes: LoteRecibo[] =
    venda.vendaLotes.length > 0
      ? venda.vendaLotes.map((vl) => {
          const valor = Number(vl.valor);
          const fracao = valorTotalVenda > 0 ? valor / valorTotalVenda : 0;
          return {
            id: vl.lote.id,
            codigo: vl.lote.codigo,
            quadra: vl.lote.quadra,
            area: Number(vl.lote.area),
            valorLote: valor,
            fracao,
            entradaLote: Math.round(Number(venda.valorEntrada) * fracao * 100) / 100,
            totalPagoLote: Math.round(totalPagoVenda * fracao * 100) / 100,
            loteamentoNome: vl.lote.loteamento.nome,
            loteamentoCidade: vl.lote.loteamento.cidade,
            loteamentoEstado: vl.lote.loteamento.estado,
          };
        })
      : [
          {
            id: venda.lote.id,
            codigo: venda.lote.codigo,
            quadra: venda.lote.quadra,
            area: Number(venda.lote.area),
            valorLote: valorTotalVenda,
            fracao: 1,
            entradaLote: Number(venda.valorEntrada),
            totalPagoLote: totalPagoVenda,
            loteamentoNome: venda.lote.loteamento.nome,
            loteamentoCidade: venda.lote.loteamento.cidade,
            loteamentoEstado: venda.lote.loteamento.estado,
          },
        ];

  // Filtro opcional: ?lote=L013 → mostra só esse recibo
  const filtroLote = searchParams?.lote?.trim();
  const lotesFiltrados = filtroLote
    ? lotes.filter((l) => l.codigo === filtroLote || l.id === filtroLote)
    : lotes;

  // Se filtro não casou, cai pro 1º lote (em vez de tela vazia)
  const lotesAImprimir = lotesFiltrados.length > 0 ? lotesFiltrados : lotes.slice(0, 1);
  const isMulti = lotes.length > 1;

  const formas: Record<string, string> = {
    A_VISTA: 'À vista (PIX/transferência)',
    A_VISTA_ESPECIE: 'À vista — Dinheiro em espécie',
    PARCELADO_PIX: 'Parcelado PIX',
    PARCELADO_BOLETO: 'Parcelado em boletos',
    PARCELADO_CARTAO: 'Parcelado no cartão',
    PARCELADO_MISTO: 'Parcelado (forma mista)',
  };
  const formaPagto = formas[venda.formaPagamento] ?? venda.formaPagamento;

  const lr = venda.lote.loteamento.loteadora;
  const hoje = new Date();

  return (
    <div className="bg-white min-h-screen print:bg-white">
      {/* Toolbar — só aparece na tela, some na impressão */}
      <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between print:hidden sticky top-0 z-10 flex-wrap gap-3">
        <Link href={`/admin/vendas/${venda.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Voltar para a venda #{venda.numero}
        </Link>
        {/* Seletor de lote quando venda é multi-lote */}
        {isMulti && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold mr-1">
              Recibo:
            </span>
            <Link
              href={`/admin/vendas/${venda.id}/recibo`}
              className={`text-xs font-semibold px-2.5 py-1 rounded ${
                !filtroLote
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Todos ({lotes.length})
            </Link>
            {lotes.map((l) => (
              <Link
                key={l.id}
                href={`/admin/vendas/${venda.id}/recibo?lote=${encodeURIComponent(l.codigo)}`}
                className={`text-xs font-semibold px-2.5 py-1 rounded ${
                  filtroLote === l.codigo
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {l.codigo}
              </Link>
            ))}
          </div>
        )}
        <ImprimirButton />
      </div>

      {/* Um recibo por lote — page-break entre eles na impressão */}
      {lotesAImprimir.map((lote, idx) => (
        <article
          key={lote.id}
          className={`max-w-3xl mx-auto p-8 print:p-0 print:max-w-none ${
            idx > 0 ? 'print:break-before-page mt-12 print:mt-0' : ''
          }`}
        >
          {/* Cabeçalho */}
          <header className="flex items-start justify-between mb-8 border-b-4 border-slate-900 pb-4">
            <div className="flex items-center gap-4">
              {lr.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lr.logo} alt={lr.nome} className="h-16 w-auto object-contain" />
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-900">{lr.nome}</h2>
                {lr.cnpj && <p className="text-xs text-slate-600">CNPJ: {lr.cnpj}</p>}
                {lr.endereco && (
                  <p className="text-xs text-slate-600">
                    {lr.endereco}
                    {lr.cidade ? `, ${lr.cidade}/${lr.estado}` : ''}
                  </p>
                )}
                {(lr.telefone || lr.email) && (
                  <p className="text-xs text-slate-600">
                    {lr.telefone}
                    {lr.telefone && lr.email ? ' · ' : ''}
                    {lr.email}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Recibo</p>
              <p className="text-2xl font-black text-slate-900">
                Nº {venda.numero}
                {isMulti && (
                  <span className="text-base font-bold text-slate-500">/{lote.codigo}</span>
                )}
              </p>
              <p className="text-xs text-slate-600">{formatDate(hoje)}</p>
            </div>
          </header>

          {/* Título */}
          <div className="text-center my-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-wide">
              RECIBO DE PAGAMENTO
            </h1>
            {isMulti && (
              <p className="text-xs uppercase tracking-widest text-slate-500 mt-2">
                Lote {lote.codigo} · {idx + 1} de {lotes.length}
              </p>
            )}
            <p className="text-3xl font-black text-slate-900 mt-3 border-y-2 border-slate-900 inline-block px-6 py-1">
              {formatBRL(lote.totalPagoLote)}
            </p>
          </div>

          {/* Corpo */}
          <div className="text-justify leading-relaxed text-slate-900 text-[15px] space-y-4">
            <p>
              Recebi(emos) de <strong className="uppercase">{venda.cliente.nome}</strong>
              {venda.cliente.cpfCnpj && (
                <>
                  , portador(a) do CPF/CNPJ nº <strong>{venda.cliente.cpfCnpj}</strong>
                </>
              )}
              , a quantia de <strong>{formatBRL(lote.totalPagoLote)}</strong> (
              <em>{valorPorExtenso(lote.totalPagoLote)}</em>), referente ao pagamento{' '}
              <strong>{formaPagto.toLowerCase()}</strong> da aquisição do{' '}
              <strong>Lote {lote.codigo}</strong>
              {lote.quadra && <> (Quadra {lote.quadra}, </>}
              {!lote.quadra && <> (</>}
              área <strong>{lote.area.toFixed(2)} m²</strong>), localizado no empreendimento{' '}
              <strong>{lote.loteamentoNome}</strong>
              {lote.loteamentoCidade && (
                <>
                  , na cidade de {lote.loteamentoCidade}/{lote.loteamentoEstado}
                </>
              )}
              , conforme contrato de compra e venda Nº <strong>{venda.numero}</strong>
              {isMulti && (
                <>
                  {' '}
                  (parte de uma venda com {lotes.length} lotes — este recibo refere-se
                  exclusivamente ao Lote {lote.codigo})
                </>
              )}
              .
            </p>

            {venda.formaPagamento === 'A_VISTA_ESPECIE' && venda.parcelas[0]?.conta && (
              <p>
                Pagamento realizado em <strong>dinheiro em espécie</strong>, recebido por{' '}
                <strong>{venda.parcelas[0].conta.nome}</strong>.
              </p>
            )}

            <p>
              Para a maior clareza, firmo o presente recibo dando plena, total e irrevogável
              quitação do referido valor, nada mais tendo a reclamar a qualquer título.
            </p>
          </div>

          {/* Dados financeiros */}
          <table className="w-full mt-8 text-sm border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-2 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                  Valor do lote
                </td>
                <td className="py-2 text-right font-bold">{formatBRL(lote.valorLote)}</td>
              </tr>
              {lote.entradaLote > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                    Entrada (proporcional)
                  </td>
                  <td className="py-2 text-right">{formatBRL(lote.entradaLote)}</td>
                </tr>
              )}
              <tr className="border-b border-slate-200">
                <td className="py-2 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                  Forma de pagamento
                </td>
                <td className="py-2 text-right">{formaPagto}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-2 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                  Data do contrato
                </td>
                <td className="py-2 text-right">{formatDate(venda.dataContrato)}</td>
              </tr>
              {venda.dataQuitacao && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                    Data da quitação
                  </td>
                  <td className="py-2 text-right">{formatDate(venda.dataQuitacao)}</td>
                </tr>
              )}
              {isMulti && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 text-slate-500 uppercase text-xs tracking-wider font-semibold">
                    Total da venda (todos os lotes)
                  </td>
                  <td className="py-2 text-right text-slate-700">
                    {formatBRL(valorTotalVenda)}{' '}
                    <span className="text-xs text-slate-400">· total pago {formatBRL(totalPagoVenda)}</span>
                  </td>
                </tr>
              )}
              <tr className="bg-slate-50">
                <td className="py-3 px-2 text-slate-900 uppercase text-xs tracking-wider font-bold">
                  {isMulti ? `Total pago (lote ${lote.codigo})` : 'Total pago'}
                </td>
                <td className="py-3 px-2 text-right text-lg font-black">
                  {formatBRL(lote.totalPagoLote)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Local + assinatura */}
          <div className="mt-16">
            <p className="text-center text-sm text-slate-700">
              {lr.cidade}/{lr.estado}, {formatDate(hoje)}.
            </p>
            <div className="mt-16 max-w-md mx-auto text-center">
              <div className="border-t border-slate-900 pt-2">
                <p className="font-bold text-slate-900">{lr.nome}</p>
                {lr.cnpj && <p className="text-xs text-slate-600">CNPJ: {lr.cnpj}</p>}
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-12 print:mt-8">
            Documento gerado eletronicamente · meuloteamento.com · Recibo Nº {venda.numero}
            {isMulti && ` · Lote ${lote.codigo}`}
          </p>
        </article>
      ))}

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          html, body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
