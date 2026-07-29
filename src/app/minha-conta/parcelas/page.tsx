import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';
import { formatBRL, formatDate } from '@/lib/format';
import ParcelaCard from './ParcelaCard';
import RenegociarBox from './RenegociarBox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parcelas — meuloteamento' };

export default async function ParcelasPage({
  searchParams,
}: {
  searchParams: { venda?: string; status?: string };
}) {
  const session = await getClienteSession();
  if (!session) redirect('/minha-conta/login');

  const where = {
    venda: { clienteId: session.sub, ...(searchParams.venda ? { id: searchParams.venda } : {}) },
    ...(searchParams.status ? { status: searchParams.status as any } : {}),
  };

  const parcelas = await prisma.parcela.findMany({
    where,
    include: { venda: { include: { lote: true } } },
    orderBy: [{ vencimento: 'asc' }, { numero: 'asc' }],
  });

  const atrasadas = parcelas.filter((p) => p.status === 'ATRASADO');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Parcelas</h1>

      {atrasadas.length >= 2 && searchParams.venda && (
        <RenegociarBox
          vendaId={searchParams.venda}
          parcelas={atrasadas.map((p) => ({
            id: p.id,
            numero: p.numero,
            valor: formatBRL(Number(p.valor)),
            vencimento: p.vencimento.toISOString(),
          }))}
        />
      )}

      <div className="space-y-3" id="lista">
        {parcelas.map((p) => (
          <div key={p.id} id={`parcela-${p.id}`}>
            <ParcelaCard
              parcela={{
                id: p.id,
                numero: p.numero,
                valor: formatBRL(Number(p.valor)),
                vencimento: formatDate(p.vencimento),
                status: p.status,
                pixCode: p.asaasPixCode,
                boletoUrl: p.asaasBoletoUrl,
                invoiceUrl: p.asaasInvoiceUrl,
              }}
              lote={p.venda.lote.codigo}
              vendaNumero={p.venda.numero}
            />
          </div>
        ))}
        {parcelas.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma parcela encontrada.</p>
        )}
      </div>
    </div>
  );
}
