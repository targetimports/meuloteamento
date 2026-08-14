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

      {/* Grade em vez de flex-wrap: com larguras livres a última linha ficava
          com cards esticados, de tamanhos diferentes dos de cima. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/lotes`}
          label="Gerenciar lotes"
          desc={`${loteamento._count.lotes} cadastrados`}
        />
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/mapa`}
          label="Editor visual do mapa"
          desc="Redimensionar, calibrar e posicionar"
        />
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/tabelas-preco`}
          label="Tabelas de preço"
          desc="Planos e condições"
        />
        <QuickActionLink
          href={`/admin/loteamentos/${loteamento.id}/simulador`}
          label="Simulador"
          desc="Valores do site público"
        />
        <QuickActionLink
          href={`/touch/${loteamento.slug}`}
          label="Stand 3D touch"
          desc="Vitrine para tela sensível ao toque"
          externo
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

/**
 * Atalho para as telas do loteamento.
 *
 * Sem ícone: os emojis anteriores (prancheta, mapa, saco de dinheiro, ábaco)
 * eram decoração — nenhum deles dizia algo que o rótulo ao lado já não
 * dissesse, e cinco desenhos coloridos em fila competiam com o conteúdo da
 * página. O que sobrou é o que se lê.
 */
function QuickActionLink({
  href,
  label,
  desc,
  externo,
}: {
  href: string;
  label: string;
  desc: string;
  externo?: boolean;
}) {
  return (
    <Link
      href={href}
      target={externo ? '_blank' : undefined}
      rel={externo ? 'noopener noreferrer' : undefined}
      className="group rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
    >
      <p className="flex items-center gap-1 text-sm font-medium text-slate-900 dark:text-slate-100">
        {label}
        {externo && <span className="text-slate-400">↗</span>}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    </Link>
  );
}
