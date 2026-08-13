import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, requireAdmin } from '@/lib/tenant';
import { LoteamentoForm } from '@/components/LoteamentoForm';
import { atualizarLoteamento, excluirLoteamento } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditLoteamentoPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();

  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { lotes: true } },
      loteadora: { select: { id: true, nome: true, slug: true } },
    },
  });
  if (!loteamento) notFound();
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) notFound();

  // Mesmo motivo da tela de novo loteamento: o select mostrava todas as
  // loteadoras do sistema. Aqui o risco era maior — dava para reatribuir o
  // loteamento a outra empresa pelo próprio formulário.
  const loteadoras = await prisma.loteadora.findMany({
    where: {
      ativo: true,
      ...(session.loteadoraId ? { id: session.loteadoraId } : {}),
    },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });

  const stats = await prisma.lote.groupBy({
    by: ['status'],
    where: { loteamentoId: loteamento.id },
    _count: { _all: true },
  });
  const statusMap = Object.fromEntries(stats.map((s) => [s.status, s._count._all]));

  const updateAction = atualizarLoteamento.bind(null, loteamento.id);
  const deleteAction = async () => {
    'use server';
    await excluirLoteamento(loteamento.id);
  };

  return (
    <div className="space-y-6">
      {/* BREADCRUMB + TÍTULO */}
      <div>
        <Link
          href="/admin/loteamentos"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← Loteamentos
        </Link>
        <div className="flex items-start justify-between mt-1 flex-wrap gap-3">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loteamento.nome}
              </h1>
              <span
                className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider ${
                  loteamento.publicado
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {loteamento.publicado ? 'Publicado' : 'Rascunho'}
              </span>
              {!loteamento.ativo && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                  Inativo
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {loteamento.cidade} / {loteamento.estado} ·{' '}
              <code className="font-mono">/{loteamento.slug}</code>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Loteadora:{' '}
              <Link
                href={`/admin/loteadoras/${loteamento.loteadora.id}`}
                className="text-primary-700 dark:text-primary-400 hover:underline font-medium"
              >
                {loteamento.loteadora.nome}
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {loteamento.publicado && (
              <a
                href={`/${loteamento.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg"
              >
                Ver página pública ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* KPIs / STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total de lotes" value={loteamento._count.lotes} />
        <KpiCard
          label="Disponíveis"
          value={statusMap.DISPONIVEL ?? 0}
          tint="text-emerald-600 dark:text-emerald-400"
          dot="bg-emerald-500"
        />
        <KpiCard
          label="Reservados"
          value={statusMap.RESERVADO ?? 0}
          tint="text-amber-600 dark:text-amber-400"
          dot="bg-amber-500"
        />
        <KpiCard
          label="Vendidos"
          value={statusMap.VENDIDO ?? 0}
          tint="text-blue-600 dark:text-blue-400"
          dot="bg-blue-500"
        />
        <KpiCard
          label="Bloqueados"
          value={statusMap.BLOQUEADO ?? 0}
          tint="text-slate-500"
          dot="bg-slate-400"
        />
      </div>

      {/* QUICK ACTIONS */}
      <div className="flex gap-2 flex-wrap">
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/lotes`}
          icon="📋"
          label="Gerenciar lotes"
          desc={`${loteamento._count.lotes} cadastrados`}
        />
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/mapa`}
          icon="🗺️"
          label="Editor visual do mapa"
          desc="redimensionar · calibrar · zoom"
        />
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/tabelas-preco`}
          icon="💰"
          label="Tabelas de preço"
          desc="planos e condições"
        />
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/simulador`}
          icon="🧮"
          label="Simulador"
          desc="valores do site público"
        />
        <QuickActionLink
          href={`/touch/${loteamento.slug}`}
          icon="🖥"
          label="Stand 3D touch"
          desc="abrir em nova aba"
        />
      </div>

      {/* EDITOR TABBED */}
      <LoteamentoForm
        action={updateAction}
        submitLabel="Salvar alterações"
        loteadoras={loteadoras}
        initial={{
          loteadoraId: loteamento.loteadoraId,
          nome: loteamento.nome,
          slug: loteamento.slug,
          tagline: loteamento.tagline,
          subtagline: loteamento.subtagline,
          descricao: loteamento.descricao,
          parcelaAPartirDe: loteamento.parcelaAPartirDe != null ? Number(loteamento.parcelaAPartirDe) : null,
          endereco: loteamento.endereco,
          cidade: loteamento.cidade,
          estado: loteamento.estado,
          cep: loteamento.cep,
          lat: loteamento.lat,
          lng: loteamento.lng,
          cartorio: loteamento.cartorio,
          comarca: loteamento.comarca,
          imagemCapa: loteamento.imagemCapa,
          imagemMapa: loteamento.imagemMapa,
          imagensGaleria: loteamento.imagensGaleria,
          diferenciais: loteamento.diferenciais,
          documentos: (loteamento.documentos as { nome: string; url: string }[] | null) ?? [],
          videoApresentacao: loteamento.videoApresentacao,
          videoApresentacaoPoster: loteamento.videoApresentacaoPoster,
          videoHero: loteamento.videoHero,
          videoHeroPoster: loteamento.videoHeroPoster,
          contatoNome: loteamento.contatoNome,
          contatoTelefone: loteamento.contatoTelefone,
          contatoEmail: loteamento.contatoEmail,
          reservaMinutos: loteamento.reservaMinutos,
          maxParcelas: loteamento.maxParcelas,
          permiteFinanciamento: loteamento.permiteFinanciamento,
          ativo: loteamento.ativo,
          publicado: loteamento.publicado,
        }}
      />

      {/* ZONA PERIGOSA */}
      <details className="bg-red-50/50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/30 rounded-2xl">
        <summary className="px-5 py-4 cursor-pointer font-semibold text-red-900 dark:text-red-300 list-none flex items-center justify-between">
          <span className="flex items-center gap-2">⚠️ Zona perigosa</span>
          <span className="text-xs text-red-700 dark:text-red-400">expandir ▼</span>
        </summary>
        <div className="px-5 pb-5">
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            Excluir o loteamento remove todos os lotes vinculados (não permitido se houver
            vendas vinculadas).
          </p>
          <form action={deleteAction}>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              🗑 Excluir loteamento permanentemente
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tint,
  dot,
}: {
  label: string;
  value: number;
  tint?: string;
  dot?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative">
      {dot && (
        <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${dot}`} />
      )}
      <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-black mt-1 ${tint ?? 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

function QuickActionLink({
  href,
  icon,
  label,
  desc,
}: {
  href: string;
  icon: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50/30 dark:hover:bg-primary-500/5 rounded-xl transition-colors group flex-1 min-w-[180px]"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-700 dark:group-hover:text-primary-400">
          {label}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
    </Link>
  );
}
