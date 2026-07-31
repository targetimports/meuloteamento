import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/tenant';
import { InteressadosTabela, type InteressadoUI } from '@/components/InteressadosTabela';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 10;

type Filtro = 'em-aberto' | 'novos' | 'negociando' | 'clientes' | 'perdidos' | 'todos';

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'em-aberto', rotulo: 'Em aberto' },
  { chave: 'novos', rotulo: 'Novos' },
  { chave: 'negociando', rotulo: 'Negociando' },
  { chave: 'clientes', rotulo: 'Viraram cliente' },
  { chave: 'perdidos', rotulo: 'Perdidos' },
  { chave: 'todos', rotulo: 'Todos' },
];

const WHERE_POR_FILTRO: Record<Filtro, Prisma.InteressadoWhereInput> = {
  'em-aberto': { status: { in: ['NOVO', 'NEGOCIANDO'] } },
  novos: { status: 'NOVO' },
  negociando: { status: 'NEGOCIANDO' },
  clientes: { status: 'CLIENTE' },
  perdidos: { status: 'PERDIDO' },
  todos: {},
};

export default async function InteressadosPage({
  searchParams,
}: {
  searchParams: { situacao?: string; pagina?: string };
}) {
  // So o dono da plataforma ve quem quer assinar a plataforma. Um admin de
  // loteadora nao tem nada a ver com a carteira comercial do meuloteamento.
  await requireSuperAdmin();

  const filtro: Filtro =
    (FILTROS.find((f) => f.chave === searchParams.situacao)?.chave as Filtro) ?? 'em-aberto';
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const where = WHERE_POR_FILTRO[filtro];

  const [itens, total, porStatus] = await Promise.all([
    prisma.interessado.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.interessado.count({ where }),
    prisma.interessado.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const contar = (s: string) => porStatus.find((p) => p.status === s)?._count._all ?? 0;
  const novos = contar('NOVO');
  const negociando = contar('NEGOCIANDO');
  const clientes = contar('CLIENTE');
  const perdidos = contar('PERDIDO');
  const encerradas = clientes + perdidos;
  const conversao = encerradas > 0 ? Math.round((clientes / encerradas) * 100) : null;

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const itensUI: InteressadoUI[] = itens.map((i) => ({
    id: i.id,
    nome: i.nome,
    email: i.email,
    telefone: i.telefone,
    plano: i.plano,
    mensagem: i.mensagem,
    status: i.status,
    observacoes: i.observacoes,
    respondidoEm: i.respondidoEm?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  }));

  const linkPagina = (p: number) => `/admin/interessados?situacao=${filtro}&pagina=${p}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Interessados</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quem pediu contato pelos planos do site e ainda não assinou. É diferente
          de <Link href="/admin/leads" className="text-primary-600 hover:underline">Leads / CRM</Link>,
          que é quem quer comprar um lote.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi titulo="Novos" valor={novos} nota="ainda sem resposta" />
        <Kpi titulo="Em aberto" valor={novos + negociando} nota="em conversa" />
        <Kpi titulo="Viraram cliente" valor={clientes} nota="assinaram a plataforma" destaque />
        <Kpi
          titulo="Conversão"
          valor={conversao === null ? '—' : `${conversao}%`}
          nota={
            encerradas > 0
              ? `de ${encerradas} negociação${encerradas > 1 ? 'ões' : ''} encerrada${encerradas > 1 ? 's' : ''}`
              : 'nenhuma negociação encerrada'
          }
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.chave}
            href={`/admin/interessados?situacao=${f.chave}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              f.chave === filtro
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>

      <InteressadosTabela itens={itensUI} />

      {/* Paginacao */}
      {total > POR_PAGINA && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {(paginaAtual - 1) * POR_PAGINA + 1}–{Math.min(paginaAtual * POR_PAGINA, total)} de{' '}
            {total}
          </p>
          <div className="flex items-center gap-2">
            {paginaAtual > 1 ? (
              <Link
                href={linkPagina(paginaAtual - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-100 transition"
              >
                Anterior
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-300">
                Anterior
              </span>
            )}
            <span className="text-sm text-slate-500 px-2">
              {paginaAtual} de {totalPaginas}
            </span>
            {paginaAtual < totalPaginas ? (
              <Link
                href={linkPagina(paginaAtual + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-100 transition"
              >
                Próxima
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-300">
                Próxima
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  nota,
  destaque,
}: {
  titulo: string;
  valor: number | string;
  nota: string;
  destaque?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-sm text-slate-500 mb-2">{titulo}</p>
      <p
        className={`text-3xl font-bold tabular-nums ${
          destaque ? 'text-emerald-600' : 'text-slate-900'
        }`}
      >
        {valor}
      </p>
      <p className="text-xs text-slate-400 mt-1">{nota}</p>
    </div>
  );
}
