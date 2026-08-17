import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatDate } from '@/lib/format';
import { TabelaComissoes, type ComissaoLinha } from '@/components/comissoes/TabelaComissoes';

export const dynamic = 'force-dynamic';

const RESUMO = [
  { status: 'BLOQUEADA', rotulo: 'Bloqueada', nota: 'Espera o cliente pagar a parcela' },
  { status: 'LIBERADA', rotulo: 'Liberada', nota: 'Pronta para repassar ao corretor' },
  { status: 'PAGA', rotulo: 'Paga', nota: 'Já saiu do caixa' },
  { status: 'CANCELADA', rotulo: 'Cancelada', nota: 'Venda desfeita ou corretor removido' },
] as const;

export default async function ComissoesPage() {
  const tid = await tenantId();

  const tenantWhere = tid ? { venda: { lote: { loteamento: { loteadoraId: tid } } } } : {};

  const totaisRaw = await prisma.comissaoParcela.groupBy({
    by: ['status'],
    where: tenantWhere,
    _sum: { valor: true },
    _count: true,
  });
  const totais: Record<string, { count: number; valor: number }> = {
    BLOQUEADA: { count: 0, valor: 0 },
    LIBERADA: { count: 0, valor: 0 },
    PAGA: { count: 0, valor: 0 },
    CANCELADA: { count: 0, valor: 0 },
  };
  for (const t of totaisRaw) {
    totais[t.status] = { count: t._count, valor: Number(t._sum.valor ?? 0) };
  }

  /**
   * A lista vai inteira para a tela, e é lá que se filtra e ordena.
   *
   * São algumas centenas de comissões por empresa — quatro por venda. O teto
   * é rede de segurança; se uma empresa passar dele, o recorte precisa voltar
   * para o banco, como já é no financeiro.
   */
  const comissoes = await prisma.comissaoParcela.findMany({
    where: tenantWhere,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 2000,
    include: {
      corretor: { select: { id: true, nome: true } },
      conta: { select: { nome: true } },
      parcelaCliente: { select: { numero: true, tipo: true, status: true, pagoEm: true } },
      venda: {
        select: {
          id: true,
          numero: true,
          cliente: { select: { nome: true } },
          lote: { select: { codigo: true, tipo: true } },
        },
      },
    },
  });

  const linhas: ComissaoLinha[] = comissoes.map((c) => ({
    id: c.id,
    corretorId: c.corretor.id,
    corretorNome: c.corretor.nome,
    vendaId: c.venda.id,
    vendaNumero: c.venda.numero,
    loteCodigo: c.venda.lote.codigo,
    loteTipo: c.venda.lote.tipo,
    clienteNome: c.venda.cliente.nome,
    numero: c.numero,
    valor: Number(c.valor),
    valorPago: c.valorPago === null ? null : Number(c.valorPago),
    status: c.status,
    pagaEmLabel: c.pagaEm ? formatDate(c.pagaEm) : null,
    contaNome: c.conta?.nome ?? null,
    vinculo: c.parcelaCliente
      ? c.parcelaCliente.tipo === 'MENSAL'
        ? `${c.parcelaCliente.tipo} ${c.parcelaCliente.numero}`
        : c.parcelaCliente.tipo
      : null,
    vinculoStatus: c.parcelaCliente
      ? c.parcelaCliente.pagoEm
        ? `${c.parcelaCliente.status} em ${formatDate(c.parcelaCliente.pagoEm)}`
        : c.parcelaCliente.status
      : null,
    vinculoPago: c.parcelaCliente?.status === 'PAGO',
  }));

  // Corretores que de fato têm comissão: oferecer no filtro quem não tem
  // nenhuma só faria perder o clique.
  const corretores = [...new Map(linhas.map((l) => [l.corretorId, l])).values()]
    .map((l) => ({ id: l.corretorId, nome: l.corretorNome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const contas = await prisma.contaFinanceira.findMany({
    where: tid ? { loteadoraId: tid } : {},
    select: { id: true, nome: true, tipo: true },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Comissões</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Repasses aos corretores, parcelados junto com o pagamento do cliente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {RESUMO.map((r) => (
          <div
            key={r.status}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {r.rotulo}
              </span>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                {totais[r.status].count}
              </span>
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatBRL(totais[r.status].valor)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{r.nota}</p>
          </div>
        ))}
      </div>

      <TabelaComissoes comissoes={linhas} corretores={corretores} contas={contas} />
    </div>
  );
}
