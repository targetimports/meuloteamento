/**
 * Cobranças das assinaturas — a visão de quem precisa saber o que entrou,
 * o que vai entrar e o que está atrasado.
 *
 * Nesta etapa é só leitura. A geração das faturas e a emissão no Asaas
 * entram na etapa seguinte, junto com getPlatformAsaasContext().
 */

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl } from '@/lib/backoffice';

export const dynamic = 'force-dynamic';

export default async function CobrancasPage() {
  await requireBackoffice();

  const hoje = new Date();

  const faturas = await prisma.assinaturaFatura.findMany({
    orderBy: [{ vencimento: 'desc' }],
    take: 200,
    select: {
      id: true,
      competencia: true,
      valor: true,
      valorPago: true,
      vencimento: true,
      status: true,
      pagoEm: true,
      origem: true,
      linkPagamento: true,
      assinatura: {
        select: { loteadoraId: true, loteadora: { select: { nome: true } } },
      },
    },
  });

  const vencidas = faturas.filter(
    (f) => f.status === 'PENDENTE' && f.vencimento < hoje
  );
  const totalVencido = vencidas.reduce((s, f) => s + Number(f.valor), 0);
  const totalPendente = faturas
    .filter((f) => f.status === 'PENDENTE')
    .reduce((s, f) => s + Number(f.valor), 0);

  const dataBR = (d: Date) => d.toLocaleDateString('pt-BR');
  const diasAtraso = (d: Date) =>
    Math.floor((hoje.getTime() - d.getTime()) / 86400000);

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Cobranças</h1>
      </header>

      <div className="p-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Em atraso" valor={brl(totalVencido)} sub={`${vencidas.length} fatura(s)`} tom="vermelho" />
          <Cartao titulo="A receber" valor={brl(totalPendente)} sub="todas as pendentes" />
          <Cartao titulo="Faturas listadas" valor={String(faturas.length)} sub="últimas 200" />
        </div>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {faturas.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400">Nenhuma fatura gerada ainda.</p>
              <p className="text-xs text-slate-400 mt-1">
                Cadastre a assinatura de uma empresa para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-5 py-3">Empresa</th>
                    <th className="text-left font-medium px-5 py-3">Competência</th>
                    <th className="text-left font-medium px-5 py-3">Vencimento</th>
                    <th className="text-right font-medium px-5 py-3">Valor</th>
                    <th className="text-right font-medium px-5 py-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {faturas.map((f) => {
                    const atrasada = f.status === 'PENDENTE' && f.vencimento < hoje;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3">
                          <Link
                            href={`/backoffice/empresas/${f.assinatura.loteadoraId}`}
                            className="font-medium text-slate-900 hover:text-primary-600"
                          >
                            {f.assinatura.loteadora.nome}
                          </Link>
                          {f.origem === 'MANUAL' && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              manual
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-700">{f.competencia}</td>
                        <td className="px-5 py-3">
                          <span className={atrasada ? 'text-red-600' : 'text-slate-600'}>
                            {dataBR(f.vencimento)}
                          </span>
                          {atrasada && (
                            <span className="block text-xs text-red-500">
                              {diasAtraso(f.vencimento)} dia(s) de atraso
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                          {brl(f.valorPago ?? f.valor)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <SituacaoFatura status={f.status} atrasada={atrasada} pagoEm={f.pagoEm} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Cartao({
  titulo,
  valor,
  sub,
  tom,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  tom?: 'vermelho';
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 mb-2">{titulo}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          tom === 'vermelho' ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {valor}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SituacaoFatura({
  status,
  atrasada,
  pagoEm,
}: {
  status: string;
  atrasada: boolean;
  pagoEm: Date | null;
}) {
  if (status === 'PAGA') {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
        Paga{pagoEm ? ` em ${pagoEm.toLocaleDateString('pt-BR')}` : ''}
      </span>
    );
  }
  if (status === 'CANCELADA') {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
        Cancelada
      </span>
    );
  }
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full ${
        atrasada ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {atrasada ? 'Vencida' : 'Pendente'}
    </span>
  );
}
