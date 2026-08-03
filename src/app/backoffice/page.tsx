/**
 * Visão geral do backoffice: a saúde do negócio da plataforma numa tela.
 *
 * Os números seguem os do painel do Construlog, que já provou ser a leitura
 * certa no dia a dia: receita recorrente, quantos clientes, quanto entrou no
 * mês, quanto está vencido, e o que vence a seguir.
 *
 * Só leitura — nenhuma ação daqui muda nada.
 */

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl, competenciaAtual } from '@/lib/backoffice';

export const dynamic = 'force-dynamic';

export default async function BackofficeHome() {
  await requireBackoffice();

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const em7Dias = new Date(hoje.getTime() + 7 * 86400000);

  const [assinaturas, vencidas, recebidasNoMes, proximas, empresasRecentes] =
    await Promise.all([
      prisma.assinatura.findMany({
        select: { status: true, valorMensal: true },
      }),
      prisma.assinaturaFatura.findMany({
        where: { status: 'PENDENTE', vencimento: { lt: hoje } },
        select: {
          id: true,
          valor: true,
          vencimento: true,
          assinatura: { select: { loteadora: { select: { nome: true } } } },
        },
        orderBy: { vencimento: 'asc' },
        take: 8,
      }),
      prisma.assinaturaFatura.findMany({
        where: { status: 'PAGA', pagoEm: { gte: inicioMes } },
        select: { valorPago: true, valor: true },
      }),
      prisma.assinaturaFatura.findMany({
        where: {
          status: 'PENDENTE',
          vencimento: { gte: hoje, lte: em7Dias },
        },
        select: {
          id: true,
          valor: true,
          vencimento: true,
          assinatura: { select: { loteadora: { select: { nome: true } } } },
        },
        orderBy: { vencimento: 'asc' },
        take: 8,
      }),
      prisma.loteadora.findMany({
        select: {
          id: true,
          nome: true,
          ativo: true,
          assinatura: {
            select: { status: true, valorMensal: true, plano: { select: { nome: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  // Receita recorrente = só quem está pagando de fato. Trial e bloqueado não
  // entram: contar promessa como receita é o jeito mais rápido de olhar um
  // número bonito que não existe no extrato.
  const mrr = assinaturas
    .filter((a) => a.status === 'ATIVA' || a.status === 'INADIMPLENTE')
    .reduce((s, a) => s + Number(a.valorMensal), 0);

  const ativos = assinaturas.filter((a) => a.status === 'ATIVA').length;
  const emTeste = assinaturas.filter((a) => a.status === 'TRIAL').length;
  const recebido = recebidasNoMes.reduce(
    (s, f) => s + Number(f.valorPago ?? f.valor),
    0
  );
  const totalVencido = vencidas.reduce((s, f) => s + Number(f.valor), 0);

  const dataBR = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Visão geral</h1>
      </header>

      <div className="p-8 space-y-6">
        <p className="text-sm text-slate-500">
          Assinaturas do meuloteamento — competência {competenciaAtual()}
        </p>

        {/* ---------------- Indicadores ---------------- */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador
            titulo="Receita recorrente"
            valor={brl(mrr)}
            sub={`${ativos} cliente(s) pagante(s)`}
            tom="verde"
          />
          <Indicador
            titulo="Clientes ativos"
            valor={String(ativos)}
            sub={`${emTeste} em teste`}
          />
          <Indicador
            titulo="Recebido no mês"
            valor={brl(recebido)}
            sub={`desde ${dataBR(inicioMes)}`}
          />
          <Indicador
            titulo="Em atraso"
            valor={brl(totalVencido)}
            sub={`${vencidas.length} cobrança(s)`}
            tom={vencidas.length ? 'vermelho' : undefined}
          />
        </div>

        {/* ---------------- Listas ---------------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Painel titulo="Em atraso" link="/backoffice/cobrancas" linkLabel="Ver cobranças">
            {vencidas.length === 0 ? (
              <Vazio texto="Ninguém em atraso." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {vencidas.map((f) => (
                  <li key={f.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {f.assinatura.loteadora.nome}
                      </p>
                      <p className="text-xs text-red-600">
                        venceu em {dataBR(f.vencimento)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {brl(f.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          <Painel titulo="Vence nos próximos 7 dias">
            {proximas.length === 0 ? (
              <Vazio texto="Nada vencendo nos próximos 7 dias." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {proximas.map((f) => (
                  <li key={f.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {f.assinatura.loteadora.nome}
                      </p>
                      <p className="text-xs text-slate-500">
                        vence em {dataBR(f.vencimento)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {brl(f.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>

        <Painel titulo="Empresas-cliente" link="/backoffice/empresas" linkLabel="Ver todas">
          {empresasRecentes.length === 0 ? (
            <Vazio texto="Nenhuma empresa cadastrada." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {empresasRecentes.map((e) => (
                <li key={e.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{e.nome}</p>
                    <p className="text-xs text-slate-500">
                      {e.assinatura
                        ? `${e.assinatura.plano?.nome ?? 'Sem plano'} · ${brl(e.assinatura.valorMensal)}/mês`
                        : 'Sem assinatura cadastrada'}
                    </p>
                  </div>
                  <StatusBadge assinatura={e.assinatura} ativo={e.ativo} />
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  );
}

// =====================================================================
// Peças da tela
// =====================================================================

function Indicador({
  titulo,
  valor,
  sub,
  tom,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  tom?: 'verde' | 'vermelho';
}) {
  const cor =
    tom === 'verde'
      ? 'text-emerald-600'
      : tom === 'vermelho'
        ? 'text-red-600'
        : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 mb-2">{titulo}</p>
      <p className={`text-2xl font-bold tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Painel({
  titulo,
  link,
  linkLabel,
  children,
}: {
  titulo: string;
  link?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        {link && (
          <Link href={link} className="text-xs text-primary-600 hover:underline">
            {linkLabel ?? 'Ver tudo'}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-sm text-slate-400">{texto}</p>;
}

function StatusBadge({
  assinatura,
  ativo,
}: {
  assinatura: { status: string } | null;
  ativo: boolean;
}) {
  if (!assinatura) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
        Sem assinatura
      </span>
    );
  }
  const mapa: Record<string, { txt: string; cls: string }> = {
    TRIAL: { txt: 'Em teste', cls: 'bg-sky-50 text-sky-700' },
    ATIVA: { txt: 'Ativo', cls: 'bg-emerald-50 text-emerald-700' },
    INADIMPLENTE: { txt: 'Em atraso', cls: 'bg-amber-50 text-amber-700' },
    BLOQUEADA: { txt: 'Bloqueado', cls: 'bg-red-50 text-red-700' },
    CANCELADA: { txt: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  };
  const s = mapa[assinatura.status] ?? { txt: assinatura.status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${s.cls} ${!ativo ? 'opacity-60' : ''}`}>
      {s.txt}
    </span>
  );
}
