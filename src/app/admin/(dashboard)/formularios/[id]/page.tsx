import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora } from '@/lib/tenant';
import { formatDateTime } from '@/lib/format';
import { parseCampos } from '@/lib/formulario-tipos';
import { LinkPublicoCopy } from '@/components/LinkPublicoCopy';

export const dynamic = 'force-dynamic';

const STATUS_BG: Record<string, string> = {
  NOVA: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  EM_ANALISE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  PROCESSADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ARQUIVADA: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default async function FormularioRespostasPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { status?: string };
}) {
  const f = await prisma.formulario.findUnique({ where: { id: params.id } });
  if (!f) notFound();
  if (f.loteadoraId && !(await canAccessLoteadora(f.loteadoraId))) notFound();

  const where = {
    formularioId: f.id,
    ...(searchParams.status ? { status: searchParams.status as 'NOVA' } : {}),
  };

  const [respostas, porStatus, arquivosCount] = await Promise.all([
    prisma.formularioResposta.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        _count: { select: { arquivos: true } },
      },
    }),
    prisma.formularioResposta.groupBy({
      by: ['status'],
      where: { formularioId: f.id },
      _count: { _all: true },
    }),
    prisma.formularioArquivo.count({
      where: { resposta: { formularioId: f.id } },
    }),
  ]);

  const totalNovas = porStatus.find((s) => s.status === 'NOVA')?._count._all ?? 0;
  const totalAnalise = porStatus.find((s) => s.status === 'EM_ANALISE')?._count._all ?? 0;
  const totalProc = porStatus.find((s) => s.status === 'PROCESSADA')?._count._all ?? 0;
  const totalArq = porStatus.find((s) => s.status === 'ARQUIVADA')?._count._all ?? 0;
  const totalGeral = porStatus.reduce((s, r) => s + r._count._all, 0);

  const filtros = [
    { value: '', label: `Todas (${totalGeral})` },
    { value: 'NOVA', label: `Novas (${totalNovas})` },
    { value: 'EM_ANALISE', label: `Em análise (${totalAnalise})` },
    { value: 'PROCESSADA', label: `Processadas (${totalProc})` },
    { value: 'ARQUIVADA', label: `Arquivadas (${totalArq})` },
  ];

  const campos = parseCampos(f.campos);
  const publicUrl = `/f/${f.slug}`;

  return (
    <div>
      {/* HEADER */}
      <div className="mb-6">
        <Link
          href="/admin/formularios"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Formulários
        </Link>
        <div className="flex items-start justify-between mt-1 flex-wrap gap-3">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {f.nome}
              </h1>
              <span
                className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider ${
                  f.ativo
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {f.ativo ? 'Ativo' : 'Pausado'}
              </span>
            </div>
            {f.descricao && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {f.descricao}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/formularios/${f.id}/editar`}
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
            >
              Editar
            </Link>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
            >
              Abrir link público ↗
            </a>
          </div>
        </div>
      </div>

      {/* LINK PÚBLICO */}
      <LinkPublicoCopy slug={f.slug} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Total respostas" valor={totalGeral.toString()} />
        <KPI label="Novas (não vistas)" valor={totalNovas.toString()} tint="text-amber-600" />
        <KPI label="Processadas" valor={totalProc.toString()} tint="text-emerald-600" />
        <KPI label="Arquivos enviados" valor={arquivosCount.toString()} />
      </div>

      {/* FILTROS */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filtros.map((filtro) => {
          const active = (searchParams.status ?? '') === filtro.value;
          const href = filtro.value
            ? `/admin/formularios/${f.id}?status=${filtro.value}`
            : `/admin/formularios/${f.id}`;
          return (
            <Link
              key={filtro.value}
              href={href}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {filtro.label}
            </Link>
          );
        })}
      </div>

      {/* TABELA */}
      {respostas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma resposta ainda.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Compartilhe o link público acima para receber respostas.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Recebido em</th>
                <th className="text-left px-4 py-3 font-semibold">Nome</th>
                <th className="text-left px-4 py-3 font-semibold">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 font-semibold">Contato</th>
                <th className="text-left px-4 py-3 font-semibold">Lote</th>
                <th className="text-left px-4 py-3 font-semibold">Anexos</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {respostas.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    !r.vistaEm ? 'font-medium' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                    {formatDateTime(r.createdAt)}
                    {!r.vistaEm && (
                      <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {r.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">
                    {r.cpfCnpj ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.email && <p className="text-slate-700 dark:text-slate-300">{r.email}</p>}
                    {r.telefone && (
                      <p className="text-slate-500 dark:text-slate-400">{r.telefone}</p>
                    )}
                    {!r.email && !r.telefone && '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 font-mono">
                    {r.loteCodigo ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r._count.arquivos > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 rounded">
                        📎 {r._count.arquivos}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${STATUS_BG[r.status]}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/admin/vendas/novo?fromForm=${r.id}`}
                        title="Criar venda com estes dados"
                        className="px-2 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                      >
                        💰 Criar venda
                      </Link>
                      <Link
                        href={`/admin/formularios/respostas/${r.id}`}
                        className="text-primary-600 dark:text-primary-400 hover:underline text-xs font-medium"
                      >
                        Detalhes →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CAMPOS RESUMO */}
      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Campos deste formulário ({campos.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {campos.map((c) => (
            <span
              key={c.id}
              className="text-[11px] px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
            >
              {c.label}
              {c.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, valor, tint }: { label: string; valor: string; tint?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`text-2xl font-black mt-1 ${tint ?? 'text-slate-900 dark:text-slate-100'}`}>
        {valor}
      </p>
    </div>
  );
}
