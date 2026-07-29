import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FormulariosPage() {
  const tid = await tenantId();

  const formularios = await prisma.formulario.findMany({
    where: tid ? { loteadoraId: tid } : {},
    orderBy: [{ ativo: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      nome: true,
      descricao: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
      loteamento: { select: { nome: true } },
      _count: { select: { respostas: true } },
    },
  });

  // Conta respostas novas (não vistas) por formulário
  const novasPorForm = await prisma.formularioResposta.groupBy({
    by: ['formularioId'],
    where: {
      status: 'NOVA',
      formulario: tid ? { loteadoraId: tid } : {},
    },
    _count: { _all: true },
  });
  const novasMap = new Map(novasPorForm.map((r) => [r.formularioId, r._count._all]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Formulários
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Crie formulários públicos para captar dados e documentos dos clientes.
          </p>
        </div>
        <Link
          href="/admin/formularios/novo"
          className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span>+</span> Novo formulário
        </Link>
      </div>

      {formularios.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-5xl mb-3">📋</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Nenhum formulário criado ainda
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Use formulários para coletar dados, fotos de documentos e definir o lote
            de interesse antes mesmo do cliente fechar a venda.
          </p>
          <Link
            href="/admin/formularios/novo"
            className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Criar primeiro formulário
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {formularios.map((f) => {
            const novas = novasMap.get(f.id) ?? 0;
            const publicUrl = `/f/${f.slug}`;
            return (
              <div
                key={f.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <Link
                      href={`/admin/formularios/${f.id}`}
                      className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 line-clamp-2"
                    >
                      {f.nome}
                    </Link>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider whitespace-nowrap ${
                        f.ativo
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {f.ativo ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  {f.descricao && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                      {f.descricao}
                    </p>
                  )}
                  {f.loteamento && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      🏠 {f.loteamento.nome}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
                        Respostas
                      </p>
                      <p className="text-xl font-black text-slate-900 dark:text-slate-100">
                        {f._count.respostas}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg p-2 text-center ${
                        novas > 0
                          ? 'bg-amber-100 dark:bg-amber-500/15'
                          : 'bg-slate-50 dark:bg-slate-800/60'
                      }`}
                    >
                      <p
                        className={`text-[10px] uppercase tracking-widest font-semibold ${
                          novas > 0
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Novas
                      </p>
                      <p
                        className={`text-xl font-black ${
                          novas > 0
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {novas}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Atualizado em {formatDate(f.updatedAt)}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 px-5 py-3 flex items-center gap-2 text-xs border-t border-slate-200 dark:border-slate-800">
                  <Link
                    href={`/admin/formularios/${f.id}`}
                    className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Ver respostas →
                  </Link>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <Link
                    href={`/admin/formularios/${f.id}/editar`}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Editar
                  </Link>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Link público ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
