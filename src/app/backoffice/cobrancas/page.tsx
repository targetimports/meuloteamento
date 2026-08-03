/**
 * Cobranças das assinaturas — o que entrou, o que vai entrar, o que atrasou.
 *
 * As faturas nascem de duas formas: automaticamente ao ativar uma assinatura
 * (para o cadastro já produzir efeito visível) e pelo botão de gerar a
 * competência, que varre todas as assinaturas ativas de uma vez.
 *
 * A emissão no Asaas ainda não está ligada — por isso a baixa é manual.
 */

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl, competenciaAtual } from '@/lib/backoffice';
import { gerarFaturas, marcarFaturaPaga, cancelarFatura } from './actions';

export const dynamic = 'force-dynamic';

export default async function CobrancasPage() {
  await requireBackoffice();

  const hoje = new Date();
  const comp = competenciaAtual();

  const [faturas, assinaturasAtivas, jaGeradas] = await Promise.all([
    prisma.assinaturaFatura.findMany({
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
        assinatura: {
          select: { loteadoraId: true, loteadora: { select: { nome: true } } },
        },
      },
    }),
    prisma.assinatura.count({ where: { status: 'ATIVA' } }),
    prisma.assinaturaFatura.count({
      where: { competencia: comp, status: { not: 'CANCELADA' } },
    }),
  ]);

  const vencidas = faturas.filter((f) => f.status === 'PENDENTE' && f.vencimento < hoje);
  const totalVencido = vencidas.reduce((s, f) => s + Number(f.valor), 0);
  const totalPendente = faturas
    .filter((f) => f.status === 'PENDENTE')
    .reduce((s, f) => s + Number(f.valor), 0);
  const totalPago = faturas
    .filter((f) => f.status === 'PAGA')
    .reduce((s, f) => s + Number(f.valorPago ?? f.valor), 0);

  const dataBR = (d: Date) => d.toLocaleDateString('pt-BR');
  const diasAtraso = (d: Date) => Math.floor((hoje.getTime() - d.getTime()) / 86400000);

  const faltamGerar = assinaturasAtivas - jaGeradas;

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Cobranças</h1>
          <span className="text-sm text-slate-500">competência {comp}</span>
        </div>

        <form
          action={async () => {
            'use server';
            await gerarFaturas();
          }}
        >
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
          >
            Gerar cobranças de {comp}
          </button>
        </form>
      </header>

      <div className="p-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Cartao titulo="Em atraso" valor={brl(totalVencido)} sub={`${vencidas.length} fatura(s)`} tom="vermelho" />
          <Cartao titulo="A receber" valor={brl(totalPendente)} sub="todas as pendentes" />
          <Cartao titulo="Recebido" valor={brl(totalPago)} sub="nas faturas listadas" tom="verde" />
        </div>

        {/* Só aparece quando há o que fazer: aviso permanente vira paisagem. */}
        {faltamGerar > 0 && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            {faltamGerar} assinatura(s) ativa(s) ainda sem cobrança em {comp}. Use
            o botão acima para gerar — rodar de novo não duplica o que já existe.
          </p>
        )}

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {faturas.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">Nenhuma fatura gerada ainda.</p>
              <p className="text-xs text-slate-400 mt-1">
                {assinaturasAtivas === 0
                  ? 'Cadastre a assinatura de uma empresa para começar.'
                  : 'Use “Gerar cobranças” acima.'}
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
                    <th className="text-center font-medium px-5 py-3">Situação</th>
                    <th className="text-right font-medium px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {faturas.map((f) => {
                    const atrasada = f.status === 'PENDENTE' && f.vencimento < hoje;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/60 transition">
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
                        <td className="px-5 py-3 text-slate-700 tabular-nums">{f.competencia}</td>
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
                        <td className="px-5 py-3 text-center">
                          <SituacaoFatura status={f.status} atrasada={atrasada} pagoEm={f.pagoEm} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {f.status === 'PENDENTE' && (
                              <>
                                <form
                                  action={async () => {
                                    'use server';
                                    await marcarFaturaPaga(f.id);
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition"
                                  >
                                    Dar baixa
                                  </button>
                                </form>
                                <form
                                  action={async () => {
                                    'use server';
                                    await cancelarFatura(f.id);
                                  }}
                                >
                                  <button
                                    type="submit"
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition"
                                  >
                                    Cancelar
                                  </button>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          A emissão no Asaas ainda não está ligada — por enquanto a baixa é
          manual.
        </p>
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
  tom?: 'vermelho' | 'verde';
}) {
  const cor =
    tom === 'vermelho' ? 'text-red-600' : tom === 'verde' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 mb-2">{titulo}</p>
      <p className={`text-2xl font-bold tabular-nums ${cor}`}>{valor}</p>
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
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {pagoEm ? `Paga em ${pagoEm.toLocaleDateString('pt-BR')}` : 'Paga'}
      </span>
    );
  }
  if (status === 'CANCELADA') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/20">
        Cancelada
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${
        atrasada
          ? 'bg-red-50 text-red-700 ring-red-600/20'
          : 'bg-amber-50 text-amber-700 ring-amber-600/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${atrasada ? 'bg-red-500' : 'bg-amber-500'}`} />
      {atrasada ? 'Vencida' : 'Pendente'}
    </span>
  );
}
