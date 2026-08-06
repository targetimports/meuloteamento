import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, tenantId, whereLoteadora } from '@/lib/tenant';
import { formatBRL, formatDate, formatDateTime } from '@/lib/format';
import { DistratoForm } from '@/components/DistratoForm';
import { distratarVenda, reajustarParcelas, mudarFormaPagamentoParcelas } from './actions';
import { ParcelaActionButton } from '@/components/ParcelaActionButton';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { msgCobrancaParcela, msgGenerico } from '@/lib/whatsappMessages';
import { marcarParcelaPaga, reabrirParcela } from '../../financeiro/actions';
import { VendaTimeline, type TimelineEvent } from '@/components/VendaTimeline';
import { ReajusteForm } from '@/components/ReajusteForm';
import ContratoActions from '@/components/ContratoActions';
import { PixCard } from '@/components/PixCard';
import { BoletoCartaoCard } from '@/components/BoletoCartaoCard';
import { RegerarPixButton } from '@/components/RegerarPixButton';
import { GerarBoletoButton } from '@/components/GerarBoletoButton';
import { TrocarFormaPagamento } from '@/components/TrocarFormaPagamento';
import { MudarCorretorButton } from '@/components/MudarCorretorButton';
import { VendaArquivosCard } from '@/components/VendaArquivosCard';

export const dynamic = 'force-dynamic';

const STATUS_VENDA: Record<string, string> = {
  ATIVA: 'bg-emerald-100 text-emerald-700',
  INADIMPLENTE: 'bg-red-100 text-red-700',
  QUITADA: 'bg-primary-100 text-primary-700',
  CANCELADA: 'bg-slate-100 text-slate-500',
  DISTRATADA: 'bg-slate-100 text-slate-500',
};
const STATUS_PARCELA: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600',
  PAGO: 'bg-emerald-100 text-emerald-700',
  ATRASADO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-slate-100 text-slate-400',
  ESTORNADO: 'bg-amber-100 text-amber-700',
};

export default async function VendaDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { msg?: string; n?: string; pix?: string; cobranca?: string; mantidas?: string };
}) {
  const venda = await prisma.venda.findUnique({
    where: { id: params.id },
    include: {
      cliente: true,
      lote: {
        include: {
          loteamento: {
            select: {
              nome: true,
              slug: true,
              loteadoraId: true,
              loteadora: { select: { nome: true } },
            },
          },
        },
      },
      vendaLotes: {
        orderBy: { ordem: 'asc' },
        include: {
          lote: {
            include: {
              loteamento: { select: { nome: true, slug: true } },
            },
          },
        },
      },
      corretor: { select: { id: true, nome: true, comissaoPadrao: true } },
      parcelas: { orderBy: { numero: 'asc' } },
      comissaoParcelas: { select: { status: true } },
      arquivos: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nomeOriginal: true,
          mimeType: true,
          tamanho: true,
          categoria: true,
          descricao: true,
          createdAt: true,
        },
      },
    },
  });
  if (!venda) notFound();
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) notFound();

  // Lista de corretores ativos pra trocar/adicionar
  const corretoresAtivos = await prisma.corretor.findMany({
    where: { ...(await whereLoteadora()), ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });

  // Contagem de comissões por status (pra warning no modal)
  const comissoesPagas = venda.comissaoParcelas.filter((c) => c.status === 'PAGA').length;
  const comissoesLiberadas = venda.comissaoParcelas.filter((c) => c.status === 'LIBERADA').length;
  const comissoesBloqueadas = venda.comissaoParcelas.filter((c) => c.status === 'BLOQUEADA').length;

  // Resolve lista efetiva de lotes (multi-lote tem vendaLotes; legado tem só venda.lote)
  const lotesDaVenda = venda.vendaLotes.length > 0
    ? venda.vendaLotes
    : [{
        id: 'legacy',
        loteId: venda.lote.id,
        valor: venda.valorTotal,
        ordem: 0,
        createdAt: venda.createdAt,
        vendaId: venda.id,
        lote: venda.lote,
      }];
  const isMultiLote = lotesDaVenda.length > 1;

  const loteadoraNome = venda.lote.loteamento.loteadora.nome;

  // Templates de contrato disponíveis para esta loteadora
  const tid = await tenantId();
  const contratoTemplates = await prisma.contratoTemplate.findMany({
    where: tid
      ? { loteadoraId: tid, ativo: true }
      : { loteadoraId: venda.lote.loteamento.loteadoraId, ativo: true },
    select: { id: true, nome: true, default: true },
    orderBy: [{ default: 'desc' }, { updatedAt: 'desc' }],
  });

  // Histórico do lote (eventos extras pra timeline)
  const loteHist = await prisma.loteHistorico.findMany({
    where: { loteId: venda.loteId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  // Monta eventos da timeline
  const timeline: TimelineEvent[] = [];
  timeline.push({
    data: venda.dataContrato,
    tipo: 'criada',
    titulo: `Contrato #${venda.numero} criado`,
    descricao: `Lote ${venda.lote.codigo} vendido por ${formatBRL(Number(venda.valorTotal))}`,
  });
  for (const p of venda.parcelas) {
    if (p.pagoEm) {
      timeline.push({
        data: p.pagoEm,
        tipo: 'pago',
        titulo: `Parcela ${p.numero} paga`,
        descricao: `${formatBRL(Number(p.valorPago ?? p.valor))} · ${p.tipo}`,
      });
    }
  }
  if (venda.dataQuitacao) {
    timeline.push({
      data: venda.dataQuitacao,
      tipo: 'quitada',
      titulo: 'Venda QUITADA',
      descricao: 'Todas as parcelas foram pagas.',
    });
  }
  if (venda.status === 'DISTRATADA') {
    timeline.push({
      data: venda.updatedAt,
      tipo: 'distratada',
      titulo: 'Venda DISTRATADA',
      descricao: venda.observacoes ?? undefined,
    });
  }
  for (const h of loteHist) {
    if (h.statusAntes !== h.statusDepois) {
      timeline.push({
        data: h.createdAt,
        tipo: 'lote_status',
        titulo: `Lote: ${h.statusAntes} → ${h.statusDepois}`,
        descricao: h.motivo ?? undefined,
      });
    }
  }

  // As únicas que a troca de forma de pagamento alcança. Pagas e canceladas
  // ficam como estão — mudar a forma do que já aconteceu reescreveria o
  // histórico.
  const parcelasEmAberto = venda.parcelas.filter(
    (p) => p.status === 'PENDENTE' || p.status === 'ATRASADO'
  );

  const pagas = venda.parcelas.filter((p) => p.status === 'PAGO');
  const totalPago = pagas.reduce((s, p) => s + Number(p.valorPago || p.valor), 0);
  const totalDevido = venda.parcelas.reduce(
    (s, p) => (p.status === 'PENDENTE' || p.status === 'ATRASADO' ? s + Number(p.valor) : s),
    0
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {searchParams.msg === 'criada' && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
          <span>✓</span>
          <span>
            Venda criada com sucesso.
            {searchParams.cobranca === 'pix' && ' PIX da entrada gerado — veja o QR Code abaixo.'}
            {searchParams.cobranca === 'boleto' && ' Boleto da entrada gerado — link disponível abaixo.'}
            {searchParams.cobranca === 'credit_card' &&
              ' Link de pagamento por cartão gerado — disponível abaixo.'}
            {!searchParams.cobranca && ' Você pode marcar parcelas como pagas abaixo.'}
          </span>
        </div>
      )}
      {searchParams.pix === 'asaas-sem-chave' && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <span>⚠</span>
          <span>
            Cobrança da entrada não foi gerada: a loteadora não tem chave Asaas configurada.{' '}
            <Link href="/admin/configuracoes" className="underline">
              Configurar Asaas
            </Link>
          </span>
        </div>
      )}
      {searchParams.pix === 'asaas-erro' && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <span>⚠</span>
          <span>
            Houve uma falha ao gerar a cobrança da entrada no Asaas. A venda foi criada, mas você
            precisará gerar a cobrança manualmente.
          </span>
        </div>
      )}

      {/* Cobrança da entrada (PIX / Boleto / Cartão — qualquer um que esteja
          ativo na parcela ENTRADA e não tenha sido pago ainda). */}
      {(() => {
        const entrada = venda.parcelas.find(
          (p) => p.tipo === 'ENTRADA' && p.asaasPaymentId && p.status !== 'PAGO',
        );
        if (!entrada) return null;
        const descricao = `Entrada do contrato #${venda.numero} — Lote ${venda.lote.codigo}`;

        // PIX: tem QR Code base64
        if (entrada.asaasPixQrCode) {
          return (
            <PixCard
              valor={Number(entrada.valor)}
              descricao={descricao}
              qrCodeBase64={entrada.asaasPixQrCode}
              payload={entrada.asaasPixCode ?? ''}
              invoiceUrl={entrada.asaasInvoiceUrl ?? null}
              telefoneCliente={venda.cliente.telefone}
            />
          );
        }
        // Boleto: tem bankSlipUrl OU formaPagamento é BOLETO
        if (entrada.asaasBoletoUrl || entrada.formaPagamento === 'PARCELADO_BOLETO') {
          return (
            <BoletoCartaoCard
              tipo="BOLETO"
              valor={Number(entrada.valor)}
              descricao={descricao}
              invoiceUrl={entrada.asaasInvoiceUrl ?? null}
              boletoUrl={entrada.asaasBoletoUrl ?? null}
              telefoneCliente={venda.cliente.telefone}
            />
          );
        }
        // Cartão: formaPagamento é CARTAO e tem invoiceUrl
        if (
          entrada.formaPagamento === 'PARCELADO_CARTAO' &&
          entrada.asaasInvoiceUrl
        ) {
          return (
            <BoletoCartaoCard
              tipo="CARTAO"
              valor={Number(entrada.valor)}
              descricao={descricao}
              invoiceUrl={entrada.asaasInvoiceUrl}
              telefoneCliente={venda.cliente.telefone}
            />
          );
        }
        return null;
      })()}
      {searchParams.msg === 'reajustada' && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <span>%</span>
          <span>
            Reajuste aplicado em {searchParams.n ?? '?'} parcela(s). Confira os valores atualizados
            abaixo.
          </span>
        </div>
      )}
      <div>
        <Link href="/admin/vendas" className="text-sm text-slate-500 hover:text-slate-700">
          ← Vendas
        </Link>
        <div className="flex items-baseline gap-3 mt-1 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">
            Contrato #{venda.numero}
          </h1>
          <span className={`px-2 py-0.5 text-xs rounded ${STATUS_VENDA[venda.status]}`}>
            {venda.status}
          </span>
          {(venda.status === 'QUITADA' || pagas.length > 0) && (
            <Link
              href={`/admin/vendas/${venda.id}/recibo`}
              target="_blank"
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded"
            >
              📄 Gerar recibo
            </Link>
          )}
        </div>
        <p className="text-sm text-slate-500">
          Assinado em {formatDate(venda.dataContrato)}
          {venda.dataQuitacao && ` · Quitado em ${formatDate(venda.dataQuitacao)}`}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Valor total" valor={formatBRL(Number(venda.valorTotal))} highlight />
        <KPI label="Já recebido" valor={formatBRL(totalPago)} tint="text-emerald-600" />
        <KPI label="A receber" valor={formatBRL(totalDevido)} tint="text-amber-600" />
        <KPI
          label="Parcelas pagas"
          valor={`${pagas.length}/${venda.parcelas.length}`}
        />
      </div>

      {/* Cliente */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-slate-900">Cliente</h2>
          <div className="flex items-center gap-2">
            {venda.cliente.telefone && (
              <WhatsAppButton
                telefone={venda.cliente.telefone}
                label="Falar com cliente"
                variant="full"
                message={msgGenerico({ nome: loteadoraNome })}
              />
            )}
            <Link
              href={`/admin/clientes/${venda.cliente.id}`}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver perfil →
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Item label="Nome" value={venda.cliente.nome} />
          <Item label="CPF/CNPJ" value={venda.cliente.cpfCnpj} mono />
          <Item label="Telefone" value={venda.cliente.telefone} />
          <Item label="E-mail" value={venda.cliente.email} />
        </dl>
      </section>

      {/* Lote(s) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold text-slate-900">
            {isMultiLote ? `Lotes vendidos (${lotesDaVenda.length})` : 'Lote vendido'}
          </h2>
          {isMultiLote && (
            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">
              📦 COBRANÇA ÚNICA
            </span>
          )}
        </div>
        {isMultiLote ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left py-2 pr-3">Código</th>
                  <th className="text-left py-2 pr-3">Loteamento</th>
                  <th className="text-left py-2 pr-3">Quadra</th>
                  <th className="text-left py-2 pr-3">Área</th>
                  <th className="text-right py-2">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lotesDaVenda.map((vl, i) => (
                  <tr key={vl.id}>
                    <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                      {vl.lote.codigo}
                      {i === 0 && (
                        <span className="ml-1.5 text-[9px] px-1 py-0.5 bg-primary-100 text-primary-700 rounded font-semibold align-middle">
                          PRINCIPAL
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{vl.lote.loteamento.nome}</td>
                    <td className="py-2 pr-3 text-slate-700">{vl.lote.quadra}</td>
                    <td className="py-2 pr-3 text-slate-700">{Number(vl.lote.area).toFixed(2)} m²</td>
                    <td className="py-2 text-right font-semibold text-slate-900">
                      {formatBRL(Number(vl.valor))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={4} className="py-2 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Total da venda
                  </td>
                  <td className="py-2 text-right text-base font-black text-slate-900">
                    {formatBRL(Number(venda.valorTotal))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <Item label="Código" value={venda.lote.codigo} mono />
            <Item label="Loteamento" value={venda.lote.loteamento.nome} />
            <Item label="Área" value={`${Number(venda.lote.area).toFixed(2)} m²`} />
            <Item label="Quadra" value={venda.lote.quadra} />
          </dl>
        )}
      </section>

      {/* Contrato digital */}
      <ContratoActions
        vendaId={venda.id}
        contratoStatus={venda.contratoStatus}
        contratoHtml={venda.contratoHtml}
        contratoSignerUrl={venda.contratoSignerUrl}
        templates={contratoTemplates}
      />

      {/* Corretor — sempre aparece (mesmo sem corretor permite ADICIONAR) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Corretor</h2>
          {/* Só permite trocar/adicionar se a venda ainda está ATIVA ou INADIMPLENTE.
              Vendas QUITADAS/CANCELADAS/DISTRATADAS não devem ter o corretor mexido
              (já fecharam). */}
          {(venda.status === 'ATIVA' || venda.status === 'INADIMPLENTE') && (
            <MudarCorretorButton
              vendaId={venda.id}
              corretorAtualId={venda.corretor?.id ?? null}
              corretorAtualNome={venda.corretor?.nome ?? null}
              corretores={corretoresAtivos}
              comissoesPagas={comissoesPagas}
              comissoesLiberadas={comissoesLiberadas}
              comissoesBloqueadas={comissoesBloqueadas}
            />
          )}
        </div>
        {venda.corretor ? (
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <Item label="Corretor" value={venda.corretor.nome} />
            {venda.comissaoPct && (
              <Item label="Comissão %" value={`${Number(venda.comissaoPct).toFixed(2)}%`} />
            )}
            {venda.comissaoValor && (
              <Item label="Comissão valor" value={formatBRL(Number(venda.comissaoValor))} />
            )}
          </dl>
        ) : (
          <p className="text-sm text-slate-500 italic">
            Sem corretor atribuído nesta venda.
            {(venda.status === 'ATIVA' || venda.status === 'INADIMPLENTE') && (
              <> Clique em <strong>+ Adicionar corretor</strong> acima.</>
            )}
          </p>
        )}
      </section>

      {/* Parcelas */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-slate-900">
            Parcelas ({venda.parcelas.length})
          </h2>
          {/* A troca fica aqui, junto das parcelas que ela afeta — e não no
              cabeçalho da venda, onde pareceria alterar a venda inteira. */}
          <TrocarFormaPagamento
            vendaId={venda.id}
            formaAtual={venda.formaPagamento}
            emAberto={parcelasEmAberto.length}
            comCobranca={parcelasEmAberto.filter((p) => p.asaasPaymentId).length}
            action={mudarFormaPagamentoParcelas}
          />
        </div>
        {venda.parcelas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma parcela gerada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Vencimento</th>
                <th className="text-left px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Pago em</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Asaas</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {venda.parcelas.map((p) => (
                <tr key={p.id} className="text-sm">
                  <td className="px-3 py-2 font-mono">{p.numero}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs">
                    <div>{p.tipo}</div>
                    {p.formaPagamento && p.formaPagamento !== venda.formaPagamento && (
                      <div
                        className="text-[10px] text-amber-700 font-semibold"
                        title="Forma de pagamento diferente da venda"
                      >
                        {p.formaPagamento.replace('PARCELADO_', '').replace('A_VISTA_', '').replace('_', ' ')}
                      </div>
                    )}
                    {/* Badge cheque com dados do cheque (nº, banco, emitente) */}
                    {(p.formaPagamento === 'A_VISTA_CHEQUE' ||
                      p.formaPagamento === 'PARCELADO_CHEQUE') && (
                      <div
                        className="mt-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded inline-flex items-center gap-1 font-semibold"
                        title={`Cheque${p.chequeNumero ? ' nº ' + p.chequeNumero : ''}${p.chequeBanco ? ' · ' + p.chequeBanco : ''}${p.chequeEmitente ? ' · emitente ' + p.chequeEmitente : ''}${p.chequePraca ? ' · ' + p.chequePraca : ''}`}
                      >
                        🧾 Cheque
                        {p.chequeNumero && (
                          <span className="font-mono">nº {p.chequeNumero}</span>
                        )}
                        {p.chequeBanco && <span>· {p.chequeBanco}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDate(p.vencimento)}</td>
                  <td className="px-3 py-2 font-medium">{formatBRL(Number(p.valor))}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.pagoEm ? formatDateTime(p.pagoEm) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded ${STATUS_PARCELA[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {/* Rótulo honesto: "Boleto" só quando existe o PDF do
                        boleto. Antes, dizia Boleto e abria a página de
                        pagamento do Asaas — quem clicava esperando o documento
                        recebia uma tela de opções e achava que estava
                        quebrado. */}
                    {p.asaasBoletoUrl ? (
                      <a
                        href={p.asaasBoletoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                        title="PDF do boleto"
                      >
                        Boleto
                      </a>
                    ) : p.asaasInvoiceUrl ? (
                      <a
                        href={p.asaasInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                        title="Página de pagamento do Asaas (Pix, cartão e boleto)"
                      >
                        Pagamento
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1.5 items-center justify-end flex-wrap">
                      {(p.status === 'PENDENTE' || p.status === 'ATRASADO') &&
                        venda.cliente.telefone && (
                          <WhatsAppButton
                            telefone={venda.cliente.telefone}
                            label="Cobrar"
                            message={msgCobrancaParcela({
                              cliente: { nome: venda.cliente.nome },
                              venda: {
                                numero: venda.numero,
                                loteCodigo: venda.lote.codigo,
                                loteamentoNome: venda.lote.loteamento.nome,
                              },
                              parcela: {
                                numero: p.numero,
                                vencimento: p.vencimento,
                                valor: Number(p.valor),
                                invoiceUrl: p.asaasInvoiceUrl ?? p.asaasBoletoUrl ?? null,
                              },
                              loteadora: { nome: loteadoraNome },
                            })}
                          />
                        )}
                      {/* O botão segue a forma efetiva da parcela (a dela, ou
                          a da venda quando não tem própria). Mostrar "Gerar
                          PIX" numa parcela de boleto recriaria a cobrança como
                          Pix e desfaria a escolha. */}
                      {(p.status === 'PENDENTE' || p.status === 'ATRASADO') &&
                        ((p.formaPagamento ?? venda.formaPagamento) === 'PARCELADO_BOLETO' ? (
                          <GerarBoletoButton
                            parcelaId={p.id}
                            boletoUrl={p.asaasBoletoUrl}
                            invoiceUrl={p.asaasInvoiceUrl}
                          />
                        ) : (
                          <RegerarPixButton
                            parcelaId={p.id}
                            jaTinha={!!p.asaasPaymentId}
                            clienteTelefone={venda.cliente.telefone}
                            loteCodigo={venda.lote.codigo}
                          />
                        ))}
                      {(p.status === 'PENDENTE' || p.status === 'ATRASADO') && (
                        <ParcelaActionButton
                          parcelaId={p.id}
                          action={marcarParcelaPaga}
                          label="✓ Pago"
                          confirmMsg={`Marcar parcela ${p.numero} (${formatBRL(Number(p.valor))}) como paga?`}
                        />
                      )}
                      {p.status === 'PAGO' && (
                        <ParcelaActionButton
                          parcelaId={p.id}
                          action={reabrirParcela}
                          label="↺ Reabrir"
                          confirmMsg="Reabrir esta parcela?"
                          variant="subtle"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {venda.observacoes && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 mb-2">Observações</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{venda.observacoes}</p>
        </section>
      )}

      {/* Documentos anexados (RG, CPF, comprovantes, contratos, etc.) */}
      <VendaArquivosCard vendaId={venda.id} arquivos={venda.arquivos} />

      {/* Timeline da venda */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Histórico do contrato</h2>
        <VendaTimeline eventos={timeline} />
      </section>

      {/* Reajuste de parcelas (somente vendas ativas com parcelas em aberto) */}
      {(venda.status === 'ATIVA' || venda.status === 'INADIMPLENTE') &&
        venda.parcelas.some((p) => p.status === 'PENDENTE' || p.status === 'ATRASADO') && (
          <ReajusteForm
            vendaId={venda.id}
            action={reajustarParcelas}
            qtdParcelasAbertas={
              venda.parcelas.filter(
                (p) => p.status === 'PENDENTE' || p.status === 'ATRASADO'
              ).length
            }
          />
        )}

      {/* Distrato / Cancelamento — só pra vendas ainda ativas */}
      {(venda.status === 'ATIVA' || venda.status === 'INADIMPLENTE') && (
        <DistratoForm
          vendaId={venda.id}
          vendaNumero={venda.numero}
          loteCodigo={venda.lote.codigo}
          parcelasPendentes={
            venda.parcelas.filter((p) => p.status === 'PENDENTE' || p.status === 'ATRASADO').length
          }
          action={distratarVenda}
        />
      )}
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function KPI({
  label,
  valor,
  highlight,
  tint,
}: {
  label: string;
  valor: string;
  highlight?: boolean;
  tint?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white' : 'bg-white border border-slate-200'
      }`}
    >
      <p className={`text-xs uppercase tracking-wider ${highlight ? 'text-white/80' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-white' : tint ?? 'text-slate-900'}`}>
        {valor}
      </p>
    </div>
  );
}
