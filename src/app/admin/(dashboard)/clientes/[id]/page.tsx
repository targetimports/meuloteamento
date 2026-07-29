import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatCpfCnpj, formatPhone, formatDateTime, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClienteDetalhePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { msg?: string };
}) {
  const tid = await tenantId();

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      vendas: {
        where: tid ? { lote: { loteamento: { loteadoraId: tid } } } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          lote: { select: { codigo: true, loteamento: { select: { nome: true, slug: true } } } },
          parcelas: { select: { status: true, valor: true } },
        },
      },
      reservas: {
        where: tid ? { lote: { loteamento: { loteadoraId: tid } } } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          lote: { select: { codigo: true, loteamento: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!cliente) notFound();

  // Pra tenants, se cliente não tem nada na loteadora dele, 404
  if (tid && cliente.vendas.length === 0 && cliente.reservas.length === 0) {
    notFound();
  }

  const totalComprado = cliente.vendas.reduce((s, v) => s + Number(v.valorTotal), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {searchParams.msg === 'criado' && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
          ✓ Cliente cadastrado com sucesso.
        </div>
      )}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/clientes" className="text-sm text-slate-500 hover:text-slate-700">
            ← Clientes
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{cliente.nome}</h1>
          <p className="text-sm text-slate-500">
            Cliente desde {formatDateTime(cliente.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {cliente.telefone && (
            <a
              href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm bg-[#25D366] hover:bg-[#1cb858] text-white rounded-lg inline-flex items-center gap-1.5"
            >
              📱 WhatsApp
            </a>
          )}
          <Link
            href={`/admin/vendas/novo?cliente=${cliente.id}`}
            className="px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            + Nova venda
          </Link>
          <Link
            href={`/admin/clientes/${cliente.id}/editar`}
            className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            ✎ Editar
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Vendas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{cliente.vendas.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Reservas</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{cliente.reservas.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total comprado</p>
          <p className="text-2xl font-bold text-primary-700 mt-1">
            {totalComprado > 0 ? formatBRL(totalComprado) : '—'}
          </p>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Dados do cliente</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Item label="Nome" value={cliente.nome} />
          <Item label="E-mail" value={cliente.email} />
          <Item label="CPF / CNPJ" value={formatCpfCnpj(cliente.cpfCnpj)} mono />
          <Item label="Telefone" value={formatPhone(cliente.telefone)} />
          {cliente.rg && <Item label="RG" value={cliente.rg} />}
          {cliente.dataNascimento && (
            <Item label="Data de nascimento" value={formatDate(cliente.dataNascimento)} />
          )}
          {cliente.cep && <Item label="CEP" value={cliente.cep} />}
          {cliente.cidade && cliente.estado && (
            <Item label="Cidade / UF" value={`${cliente.cidade} / ${cliente.estado}`} />
          )}
          {(cliente.logradouro || cliente.numero) && (
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Endereço</p>
              <p className="text-slate-900">
                {[cliente.logradouro, cliente.numero, cliente.bairro].filter(Boolean).join(', ')}
                {cliente.complemento ? ` — ${cliente.complemento}` : ''}
              </p>
            </div>
          )}
        </dl>
      </section>

      {cliente.vendas.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Vendas</h2>
          <ul className="divide-y divide-slate-100">
            {cliente.vendas.map((v) => {
              const pagas = v.parcelas.filter((p) => p.status === 'PAGO').length;
              return (
                <li key={v.id} className="py-3 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      Lote {v.lote.codigo}{' '}
                      <span className="text-slate-500 font-normal">
                        · {v.lote.loteamento.nome}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contrato #{v.numero} · {formatDate(v.dataContrato)} ·{' '}
                      {pagas}/{v.parcelas.length} parcelas pagas
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {formatBRL(Number(v.valorTotal))}
                    </p>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded ${
                        v.status === 'ATIVA'
                          ? 'bg-emerald-100 text-emerald-700'
                          : v.status === 'INADIMPLENTE'
                          ? 'bg-red-100 text-red-700'
                          : v.status === 'QUITADA'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {cliente.reservas.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Reservas</h2>
          <ul className="divide-y divide-slate-100">
            {cliente.reservas.map((r) => (
              <li key={r.id} className="py-3 flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    Lote {r.lote.codigo}{' '}
                    <span className="text-slate-500 font-normal">
                      · {r.lote.loteamento.nome}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Criada em {formatDateTime(r.createdAt)} · Expira{' '}
                    {formatDateTime(r.expiraEm)}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    r.status === 'ATIVA'
                      ? 'bg-amber-100 text-amber-700'
                      : r.status === 'CONVERTIDA'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
