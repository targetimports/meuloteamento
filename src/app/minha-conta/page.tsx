import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';
import { formatBRL, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha conta — meuloteamento' };

export default async function MinhaContaHomePage() {
  const session = await getClienteSession();
  if (!session) redirect('/minha-conta/login');

  const vendas = await prisma.venda.findMany({
    where: { clienteId: session.sub },
    include: {
      lote: { include: { loteamento: true } },
      parcelas: { orderBy: { numero: 'asc' } },
    },
    orderBy: { dataContrato: 'desc' },
  });

  const totalParcelas = vendas.flatMap((v) => v.parcelas);
  const proximas = totalParcelas
    .filter((p) => p.status === 'PENDENTE' || p.status === 'ATRASADO')
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
    .slice(0, 3);

  const atrasadas = totalParcelas.filter((p) => p.status === 'ATRASADO');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Olá, {session.nome.split(' ')[0]}</h1>
        <p className="text-slate-600 text-sm">Bem-vindo de volta.</p>
      </div>

      {atrasadas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="font-semibold text-amber-900 mb-1">
            {atrasadas.length} parcela{atrasadas.length > 1 ? 's' : ''} em atraso
          </h2>
          <p className="text-sm text-amber-800">
            <Link href="/minha-conta/parcelas?status=ATRASADO" className="underline">
              Veja como regularizar
            </Link>
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Próximas parcelas</h2>
        {proximas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma parcela pendente.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {proximas.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    Parcela {p.numero} — {formatBRL(Number(p.valor))}
                  </div>
                  <div className="text-xs text-slate-500">Vence em {formatDate(p.vencimento)}</div>
                </div>
                <Link
                  href={`/minha-conta/parcelas#parcela-${p.id}`}
                  className="text-sm text-sky-600 hover:underline"
                >
                  Pagar
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Meus lotes</h2>
        {vendas.length === 0 ? (
          <p className="text-sm text-slate-500">Você ainda não tem compras.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {vendas.map((v) => (
              <div key={v.id} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-xs text-slate-500">Venda #{v.numero}</div>
                <div className="font-medium text-slate-900">
                  Lote {v.lote.codigo} — {v.lote.loteamento.nome}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {formatBRL(Number(v.valorTotal))} • {v.numeroParcelas}x{' '}
                  {formatBRL(Number(v.valorParcela))}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Status: <span className="font-medium">{v.status}</span>
                </div>
                <div className="mt-3 flex gap-3 text-sm">
                  <Link
                    href={`/minha-conta/contratos/${v.id}`}
                    className="text-sky-600 hover:underline"
                  >
                    Contrato
                  </Link>
                  <Link
                    href={`/minha-conta/parcelas?venda=${v.id}`}
                    className="text-sky-600 hover:underline"
                  >
                    Parcelas
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
