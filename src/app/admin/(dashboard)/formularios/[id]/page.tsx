import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { canAccessLoteadora } from '@/lib/tenant';
import { formatDateTime } from '@/lib/format';
import { parseCampos } from '@/lib/formulario-tipos';
import { LinkPublicoCopy } from '@/components/LinkPublicoCopy';
import { TabelaRespostas, type RespostaLinha } from '@/components/formularios/TabelaRespostas';

export const dynamic = 'force-dynamic';

export default async function FormularioRespostasPage({ params }: { params: { id: string } }) {
  const f = await prisma.formulario.findUnique({ where: { id: params.id } });
  if (!f) notFound();
  if (f.loteadoraId && !(await canAccessLoteadora(f.loteadoraId))) notFound();

  const [respostas, porStatus, arquivosCount] = await Promise.all([
    prisma.formularioResposta.findMany({
      where: { formularioId: f.id },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: { _count: { select: { arquivos: true } } },
    }),
    prisma.formularioResposta.groupBy({
      by: ['status'],
      where: { formularioId: f.id },
      _count: { _all: true },
    }),
    prisma.formularioArquivo.count({ where: { resposta: { formularioId: f.id } } }),
  ]);

  const contar = (s: string) => porStatus.find((r) => r.status === s)?._count._all ?? 0;
  const totalGeral = porStatus.reduce((s, r) => s + r._count._all, 0);

  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  const linhas: RespostaLinha[] = respostas.map((r) => ({
    id: r.id,
    // A data vira texto aqui; o campo AAAA-MM-DD ao lado é só para filtrar e
    // ordenar. Formatada no navegador, a resposta da meia-noite apareceria no
    // dia anterior para quem está a oeste de Greenwich.
    data: `${r.createdAt.getFullYear()}-${doisDigitos(r.createdAt.getMonth() + 1)}-${doisDigitos(r.createdAt.getDate())}`,
    dataLabel: formatDateTime(r.createdAt),
    vista: !!r.vistaEm,
    nome: r.nome,
    cpfCnpj: r.cpfCnpj,
    email: r.email,
    telefone: r.telefone,
    loteCodigo: r.loteCodigo,
    arquivos: r._count.arquivos,
    status: r.status,
  }));

  const campos = parseCampos(f.campos);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/formularios"
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Formulários
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{f.nome}</h1>
              <span
                className={`rounded px-2 py-0.5 text-xs ring-1 ring-inset ${
                  f.ativo
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : 'bg-slate-100 text-slate-500 ring-slate-500/20'
                }`}
              >
                {f.ativo ? 'Ativo' : 'Pausado'}
              </span>
            </div>
            {f.descricao && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.descricao}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/formularios/${f.id}/editar`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Editar
            </Link>
            <a
              href={`/f/${f.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Abrir link público
            </a>
          </div>
        </div>
      </div>

      <LinkPublicoCopy slug={f.slug} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Total de respostas" valor={totalGeral} />
        <Numero rotulo="Novas (não vistas)" valor={contar('NOVA')} tint="text-amber-600" />
        <Numero rotulo="Processadas" valor={contar('PROCESSADA')} tint="text-emerald-600" />
        <Numero rotulo="Arquivos enviados" valor={arquivosCount} />
      </div>

      <TabelaRespostas respostas={linhas} />

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          Campos deste formulário
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {campos.length} campo(s). O asterisco marca os obrigatórios.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {campos.map((c) => (
            <span
              key={c.id}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {c.label}
              {c.obrigatorio && <span className="ml-0.5 text-red-500">*</span>}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Numero({ rotulo, valor, tint }: { rotulo: string; valor: number; tint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {rotulo}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tint ?? 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
