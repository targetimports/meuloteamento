import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireBackoffice } from '@/lib/backoffice';
import { FormsPerfil } from './FormsPerfil';
import { atualizarMeuPerfil, trocarMinhaSenha } from './actions';

export const dynamic = 'force-dynamic';

export default async function MeuPerfilPage() {
  const sessao = await requireBackoffice();

  // Lê do banco em vez de usar a sessão: o cookie guarda o que era verdade no
  // login, e a tela deve mostrar o que é verdade agora.
  const eu = await prisma.adminUser.findUnique({
    where: { id: sessao.sub },
    select: { nome: true, email: true, ativo: true, ultimoLogin: true, createdAt: true },
  });
  if (!eu) notFound();

  // Quantas empresas este acesso alcança — o que dá dimensão ao "vê tudo".
  const empresas = await prisma.loteadora.count();

  const iniciais = eu.nome
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const data = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '—';

  const dataHora = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Nunca';

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Meu perfil</h1>
      </header>

      <div className="p-8 flex flex-col gap-6 w-full">
        {/* ---------------- Identidade ---------------- */}
        <section className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-6 flex flex-wrap items-center gap-5">
            <div className="w-14 h-14 flex-shrink-0 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-semibold">
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900 truncate">{eu.nome}</h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  Super admin
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{eu.email}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 border-t border-slate-100 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <Dado rotulo="Acesso desde" valor={data(eu.createdAt)} />
            <Dado rotulo="Último login" valor={dataHora(eu.ultimoLogin)} />
            <Dado
              rotulo="Alcance"
              valor={`${empresas} empresa${empresas === 1 ? '' : 's'}-cliente`}
              nota="Este acesso enxerga todas"
            />
          </dl>
        </section>

        <FormsPerfil
          atualizarAction={atualizarMeuPerfil}
          trocarSenhaAction={trocarMinhaSenha}
          inicial={{ nome: eu.nome, email: eu.email }}
        />
      </div>
    </div>
  );
}

function Dado({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="px-6 py-4">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {rotulo}
      </dt>
      <dd className="text-sm text-slate-900 mt-1">{valor}</dd>
      {nota && <p className="text-[11px] text-slate-400 mt-0.5">{nota}</p>}
    </div>
  );
}
