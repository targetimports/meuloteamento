import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL, formatCpfCnpj, formatPhone, formatDateTime, formatDate } from '@/lib/format';
import { IconWhatsApp } from '@/components/icons';

export const dynamic = 'force-dynamic';

const STATUS_VENDA: Record<string, string> = {
  ATIVA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  INADIMPLENTE: 'bg-red-50 text-red-700 ring-red-600/20',
  QUITADA: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  CANCELADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  DISTRATADA: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const STATUS_RESERVA: Record<string, string> = {
  ATIVA: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  CONVERTIDA: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

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
  const telefoneDigitos = cliente.telefone?.replace(/\D/g, '') ?? '';

  return (
    <div className="space-y-6">
      {searchParams.msg === 'criado' && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Cliente cadastrado com sucesso.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/clientes" className="text-sm text-slate-500 hover:text-slate-700">
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{cliente.nome}</h1>
          <p className="text-sm text-slate-500">
            Cliente desde {formatDateTime(cliente.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {telefoneDigitos && (
            /* Abre a conversa no chat do sistema, não no WhatsApp Web: é lá
               que o histórico com este cliente fica registrado. */
            <Link
              href={`/admin/whatsapp/chat?tel=${telefoneDigitos}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <IconWhatsApp className="h-4 w-4 text-[#25D366]" />
              Falar com cliente
            </Link>
          )}
          <Link
            href={`/admin/vendas/novo?cliente=${cliente.id}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Nova venda
          </Link>
          <Link
            href={`/admin/clientes/${cliente.id}/editar`}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Editar
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Numero rotulo="Vendas" valor={String(cliente.vendas.length)} />
        <Numero rotulo="Reservas" valor={String(cliente.reservas.length)} />
        <Numero
          rotulo="Total comprado"
          valor={totalComprado > 0 ? formatBRL(totalComprado) : '—'}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Dados do cliente</h2>
        {/* Quatro colunas em tela larga: são campos curtos, e em duas colunas
            sobrava metade da linha vazia depois de cada valor. */}
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Item label="E-mail" value={cliente.email} />
          <Item label="CPF / CNPJ" value={formatCpfCnpj(cliente.cpfCnpj)} mono />
          <Item label="Telefone" value={formatPhone(cliente.telefone)} />
          {cliente.rg && <Item label="RG" value={cliente.rg} />}
          {cliente.dataNascimento && (
            <Item label="Data de nascimento" value={formatDate(cliente.dataNascimento)} />
          )}
          {cliente.nacionalidade && (
            <Item label="Nacionalidade" value={cliente.nacionalidade} />
          )}
          {cliente.estadoCivil && <Item label="Estado civil" value={cliente.estadoCivil} />}
          {cliente.profissao && <Item label="Profissão" value={cliente.profissao} />}
          {cliente.cep && <Item label="CEP" value={cliente.cep} />}
          {cliente.cidade && cliente.estado && (
            <Item label="Cidade / UF" value={`${cliente.cidade} / ${cliente.estado}`} />
          )}
          {(cliente.logradouro || cliente.numero) && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Endereço</dt>
              <dd className="mt-0.5 text-slate-900">
                {[cliente.logradouro, cliente.numero, cliente.bairro].filter(Boolean).join(', ')}
                {cliente.complemento ? ` — ${cliente.complemento}` : ''}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {cliente.vendas.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">
            Vendas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Contrato</th>
                  <th className="px-6 py-3 text-left font-semibold">Lote</th>
                  <th className="px-6 py-3 text-left font-semibold">Parcelas</th>
                  <th className="px-6 py-3 text-right font-semibold">Valor</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cliente.vendas.map((v) => {
                  const pagas = v.parcelas.filter((p) => p.status === 'PAGO').length;
                  return (
                    <tr key={v.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <span className="font-mono text-slate-900">#{v.numero}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDate(v.dataContrato)}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-mono text-slate-900">{v.lote.codigo}</span>
                        <span className="block text-xs text-slate-500">
                          {v.lote.loteamento.nome}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-600">
                        {pagas}/{v.parcelas.length} pagas
                      </td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums text-slate-900">
                        {formatBRL(Number(v.valorTotal))}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                            STATUS_VENDA[v.status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        <Link
                          href={`/admin/vendas/${v.id}`}
                          className="text-sm font-medium text-primary-600 hover:opacity-80"
                        >
                          Detalhes →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cliente.reservas.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">
            Reservas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Lote</th>
                  <th className="px-6 py-3 text-left font-semibold">Criada em</th>
                  <th className="px-6 py-3 text-left font-semibold">Expira</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cliente.reservas.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <span className="font-mono text-slate-900">{r.lote.codigo}</span>
                      <span className="block text-xs text-slate-500">{r.lote.loteamento.nome}</span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600">
                      {formatDateTime(r.expiraEm)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                          STATUS_RESERVA[r.status] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
