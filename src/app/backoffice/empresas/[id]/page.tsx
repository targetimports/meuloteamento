/**
 * Ficha da empresa-cliente: dados, uso e a assinatura dela.
 *
 * Só leitura dos dados cadastrais — quem edita cadastro de loteadora é
 * /admin/loteadoras, que já existe e funciona. Aqui se administra o
 * CONTRATO, que é o assunto do backoffice.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireBackoffice, brl } from '@/lib/backoffice';
import { EmpresaClienteForm } from '@/components/EmpresaClienteForm';
import { BotaoSituacaoEmpresa } from '@/components/BotaoSituacaoEmpresa';
import { salvarAssinatura } from './actions';
import { atualizarDadosEmpresa, alternarEmpresaAtiva } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS = ['TRIAL', 'ATIVA', 'INADIMPLENTE', 'BLOQUEADA', 'CANCELADA'] as const;

export default async function EmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireBackoffice();
  const { id } = await params;

  const empresa = await prisma.loteadora.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      slug: true,
      razaoSocial: true,
      cnpj: true,
      email: true,
      telefone: true,
      cidade: true,
      estado: true,
      ativo: true,
      createdAt: true,
      _count: { select: { loteamentos: true, adminUsers: true, corretores: true } },
      assinatura: {
        include: {
          plano: true,
          faturas: { orderBy: { vencimento: 'desc' }, take: 12 },
        },
      },
    },
  });

  if (!empresa) notFound();

  const planos = await prisma.plano.findMany({
    where: { ativo: true },
    orderBy: { valorMensal: 'asc' },
    select: { id: true, nome: true, valorMensal: true },
  });

  const a = empresa.assinatura;
  const campo =
    'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
  const dataBR = (d: Date) => d.toLocaleDateString('pt-BR');
  const paraInput = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : '';

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <Link href="/backoffice/empresas" className="text-xs text-slate-500 hover:underline">
          ← Empresas-cliente
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 mt-1">{empresa.nome}</h1>
      </header>

      <div className="p-8 grid gap-6 lg:grid-cols-3">
        {/* ---------------- Coluna esquerda: cadastro e uso ---------------- */}
        <div className="space-y-6">
          <section id="cadastro" className="bg-white border border-slate-200 rounded-xl p-5 scroll-mt-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Cadastro</h2>
            <EmpresaClienteForm
              action={atualizarDadosEmpresa}
              inicial={{
                id: empresa.id,
                nome: empresa.nome,
                slug: empresa.slug,
                razaoSocial: empresa.razaoSocial,
                cnpj: empresa.cnpj,
                email: empresa.email,
                telefone: empresa.telefone,
                cidade: empresa.cidade,
                estado: empresa.estado,
              }}
              rotuloBotao="Salvar dados"
            />
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Uso</h2>
            <dl className="space-y-2.5 text-sm">
              <Linha rotulo="Loteamentos" valor={String(empresa._count.loteamentos)} />
              <Linha rotulo="Corretores" valor={String(empresa._count.corretores)} />
              <Linha rotulo="Cliente desde" valor={dataBR(empresa.createdAt)} />
            </dl>
            <Link
              href={`/backoffice/empresas/${empresa.id}/usuarios`}
              className="mt-4 flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
            >
              <span className="text-sm text-slate-700">Usuários de acesso</span>
              <span className="text-sm font-semibold text-slate-900">
                {empresa._count.adminUsers} →
              </span>
            </Link>
          </section>

          {/* Corte de acesso de verdade: o login recusa usuário de empresa
              desativada, e o requireAdmin derruba quem já estiver dentro. */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              Situação da empresa
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {empresa.ativo
                ? 'Ativa — os usuários conseguem entrar normalmente.'
                : 'Inativa — nenhum usuário desta empresa consegue entrar, e as sessões abertas caem na próxima página.'}
            </p>
            <BotaoSituacaoEmpresa
              empresaId={empresa.id}
              empresaNome={empresa.nome}
              ativa={empresa.ativo}
              alternarAction={alternarEmpresaAtiva}
            />
          </section>
        </div>

        {/* ---------------- Coluna direita: assinatura ---------------- */}
        <div className="lg:col-span-2 space-y-6">
          <section id="assinatura" className="bg-white border border-slate-200 rounded-xl p-6 scroll-mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {a ? 'Assinatura' : 'Cadastrar assinatura'}
              </h2>
            </div>

            {!a && (
              <p className="mb-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                Esta empresa ainda não tem assinatura. Enquanto não tiver, ela
                opera normalmente e nada é cobrado nem bloqueado.
              </p>
            )}

            <form action={salvarAssinatura} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="loteadoraId" value={empresa.id} />

              <div>
                <label htmlFor="planoId" className="block text-xs font-medium text-slate-600 mb-1">
                  Plano
                </label>
                <select id="planoId" name="planoId" defaultValue={a?.planoId ?? ''} className={campo}>
                  <option value="">Sem plano</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — {brl(p.valorMensal)}/mês
                    </option>
                  ))}
                </select>
                {/* Select com uma opção só parece defeito. Se não há plano
                    cadastrado, a tela precisa dizer isso e mostrar a saída —
                    senão a pessoa fica procurando o bug. */}
                {planos.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1.5">
                    Nenhum plano cadastrado ainda.{' '}
                    <Link href="/backoffice/planos" className="underline font-medium">
                      Criar planos
                    </Link>{' '}
                    — ou deixe sem plano e informe a mensalidade à mão.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="valorMensal" className="block text-xs font-medium text-slate-600 mb-1">
                  Mensalidade (R$)
                </label>
                <input
                  id="valorMensal"
                  name="valorMensal"
                  inputMode="decimal"
                  defaultValue={a ? String(a.valorMensal) : ''}
                  placeholder="em branco = valor do plano"
                  className={campo}
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-xs font-medium text-slate-600 mb-1">
                  Situação
                </label>
                <select id="status" name="status" defaultValue={a?.status ?? 'TRIAL'} className={campo}>
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="trialAte" className="block text-xs font-medium text-slate-600 mb-1">
                  Teste até
                </label>
                <input
                  id="trialAte"
                  name="trialAte"
                  type="date"
                  defaultValue={paraInput(a?.trialAte)}
                  className={campo}
                />
              </div>

              <div>
                <label htmlFor="diaVencimento" className="block text-xs font-medium text-slate-600 mb-1">
                  Dia do vencimento (1–28)
                </label>
                <input
                  id="diaVencimento"
                  name="diaVencimento"
                  inputMode="numeric"
                  defaultValue={a?.diaVencimento ?? 10}
                  className={campo}
                />
              </div>

              <div>
                <label htmlFor="diasTolerancia" className="block text-xs font-medium text-slate-600 mb-1">
                  Dias de tolerância
                </label>
                <input
                  id="diasTolerancia"
                  name="diasTolerancia"
                  inputMode="numeric"
                  defaultValue={a?.diasTolerancia ?? 10}
                  className={campo}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Atraso tolerado antes de cortar o acesso.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="observacoes" className="block text-xs font-medium text-slate-600 mb-1">
                  Observações
                </label>
                <textarea
                  id="observacoes"
                  name="observacoes"
                  rows={2}
                  defaultValue={a?.observacoes ?? ''}
                  className={campo}
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition"
                >
                  {a ? 'Salvar assinatura' : 'Criar assinatura'}
                </button>
              </div>
            </form>

          </section>

          {/* ---------------- Faturas ---------------- */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Faturas</h2>
            {!a || a.faturas.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Nenhuma fatura gerada.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left font-medium py-2">Competência</th>
                    <th className="text-left font-medium py-2">Vencimento</th>
                    <th className="text-right font-medium py-2">Valor</th>
                    <th className="text-right font-medium py-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {a.faturas.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2 text-slate-900">{f.competencia}</td>
                      <td className="py-2 text-slate-600">{dataBR(f.vencimento)}</td>
                      <td className="py-2 text-right tabular-nums">{brl(f.valor)}</td>
                      <td className="py-2 text-right">
                        <span className="text-xs text-slate-600">{f.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-slate-900 text-right">{valor || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
