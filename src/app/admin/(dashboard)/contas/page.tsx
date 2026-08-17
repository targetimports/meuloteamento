import { prisma } from '@/lib/prisma';
import { isSuperAdmin, tenantId } from '@/lib/tenant';
import { GerenciarContas, type ContaLinha } from '@/components/contas/GerenciarContas';

export const dynamic = 'force-dynamic';

export default async function ContasPage() {
  const tid = await tenantId();
  const where = tid ? { loteadoraId: tid } : {};

  const contas = await prisma.contaFinanceira.findMany({
    where,
    orderBy: [{ ativa: 'desc' }, { ordem: 'asc' }, { nome: 'asc' }],
    include: { _count: { select: { parcelas: true } } },
  });

  /**
   * Recebido por conta = soma das parcelas pagas nela.
   *
   * Só conta o que caiu de fato; o saldo inicial entra por fora, porque é o
   * que já existia antes de o sistema começar a registrar.
   */
  const saldosPorConta = await prisma.parcela.groupBy({
    by: ['contaId'],
    where: { status: 'PAGO', contaId: { in: contas.map((c) => c.id) } },
    _sum: { valorPago: true, valor: true },
  });
  const recebidoPorConta = new Map<string, number>();
  for (const s of saldosPorConta) {
    if (s.contaId) {
      recebidoPorConta.set(s.contaId, Number(s._sum.valorPago ?? s._sum.valor ?? 0));
    }
  }

  const linhas: ContaLinha[] = contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    banco: c.banco,
    agencia: c.agencia,
    numeroConta: c.numeroConta,
    chavePix: c.chavePix,
    titular: c.titular,
    descricao: c.descricao,
    cor: c.cor,
    ativa: c.ativa,
    saldoInicial: Number(c.saldoInicial),
    recebido: recebidoPorConta.get(c.id) ?? 0,
    parcelas: c._count.parcelas,
  }));

  // Superadmin não tem empresa na sessão e precisa dizer de quem é a conta.
  const loteadoras = tid
    ? []
    : (await isSuperAdmin())
      ? await prisma.loteadora.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
        })
      : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Contas financeiras</h1>
        <p className="text-sm text-slate-500">
          Onde caem os recebimentos. Asaas, caixa em espécie, contas bancárias externas.
        </p>
      </div>

      <GerenciarContas contas={linhas} loteadoras={loteadoras} />
    </div>
  );
}
