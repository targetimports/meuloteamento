import { prisma } from '@/lib/prisma';
import { tenantId, whereClienteDaLoteadora } from '@/lib/tenant';
import { CobrancaPixRapida } from '@/components/CobrancaPixRapida';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cobrança avulsa — Admin' };

function brl(v: unknown) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function CobrancaAvulsaPage() {
  const tid = await tenantId();

  const [clientesAtivos, lotesDisponiveis, loteadoras, avulsas] = await Promise.all([
    prisma.cliente.findMany({
      where: whereClienteDaLoteadora(tid),
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cpfCnpj: true, telefone: true, email: true },
      take: 500,
    }),
    prisma.lote.findMany({
      where: tid
        ? {
            loteamento: { loteadoraId: tid },
            status: { in: ['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO'] },
          }
        : { status: { in: ['DISPONIVEL', 'RESERVADO', 'EM_PAGAMENTO'] } },
      orderBy: [{ loteamento: { nome: 'asc' } }, { codigo: 'asc' }],
      select: { id: true, codigo: true, preco: true, loteamento: { select: { nome: true } } },
      take: 500,
    }),
    tid
      ? Promise.resolve([] as { id: string; nome: string }[])
      : prisma.loteadora.findMany({
          where: { ativo: true },
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
        }),
    prisma.cobrancaAvulsa.findMany({
      where: tid ? { loteadoraId: tid } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { cliente: { select: { nome: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Cobrança avulsa
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Cobre qualquer pessoa por algo que <strong>não é venda de lote</strong> — taxa,
            serviço, acerto, mensalidade, etc. Gera <strong>link de pagamento + Pix</strong> na
            hora (não precisa de lote).
          </p>
        </div>
        <CobrancaPixRapida
          clientes={clientesAtivos}
          lotes={lotesDisponiveis.map((l) => ({
            id: l.id,
            codigo: l.codigo,
            preco: Number(l.preco),
            loteamentoNome: l.loteamento.nome,
          }))}
          loteadoras={loteadoras}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Cobranças avulsas recentes
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Descrição</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Valor</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {avulsas.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
                  {c.createdAt.toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-slate-800 dark:text-slate-200">
                  {c.descricao ?? '—'}
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                  {c.cliente?.nome ?? c.nomeAdHoc ?? '—'}
                </td>
                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                  {brl(c.valor)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      c.status === 'PAGO'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : c.status === 'CANCELADO'
                          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {c.asaasInvoiceUrl ? (
                    <a
                      href={c.asaasInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline text-xs"
                    >
                      abrir
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {avulsas.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm"
                >
                  Nenhuma cobrança avulsa ainda. Clique em <strong>Nova cobrança PIX</strong> para
                  criar a primeira.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
