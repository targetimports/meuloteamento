import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { LoteadoraForm } from '@/components/LoteadoraForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { atualizarLoteadora, excluirLoteadora, definirSenhaVendaSemEntrada } from '../actions';
import { canAccessLoteadora, isSuperAdmin } from '@/lib/tenant';
import { SenhaVendaSemEntradaForm } from '@/components/SenhaVendaSemEntradaForm';

export const dynamic = 'force-dynamic';

export default async function EditLoteadoraPage({ params }: { params: { id: string } }) {
  const loteadora = await prisma.loteadora.findUnique({
    where: { id: params.id },
    include: {
      loteamentos: {
        select: { id: true, nome: true, slug: true, publicado: true, ativo: true },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { loteamentos: true } },
    },
  });
  if (!loteadora) notFound();
  if (!(await canAccessLoteadora(loteadora.id))) notFound();
  const podeExcluir = await isSuperAdmin();

  const updateAction = atualizarLoteadora.bind(null, loteadora.id);
  const senhaAction = definirSenhaVendaSemEntrada.bind(null, loteadora.id);
  const deleteAction = async () => {
    'use server';
    await excluirLoteadora(loteadora.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/loteadoras" className="text-sm text-slate-500 hover:text-slate-700">
          ← Loteadoras
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{loteadora.nome}</h1>
        <p className="text-sm text-slate-500">
          slug: <code className="font-mono">{loteadora.slug}</code> · {loteadora._count.loteamentos} loteamento(s)
        </p>
        <div className="mt-3">
          <Link
            href={`/admin/loteadoras/${loteadora.id}/usuarios`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-900 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition"
          >
            🔑 Gerenciar usuários
          </Link>
        </div>
      </div>

      {/* Loteamentos da loteadora */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Loteamentos desta loteadora</h2>
          <Link
            href="/admin/loteamentos/novo"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            + Novo loteamento
          </Link>
        </div>
        {loteadora.loteamentos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum loteamento cadastrado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {loteadora.loteamentos.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between">
                <div>
                  <Link
                    href={`/admin/loteamentos/${l.id}`}
                    className="font-medium text-slate-900 hover:text-primary-700"
                  >
                    {l.nome}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500 font-mono">/{l.slug}</span>
                </div>
                <div className="flex gap-1">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      l.publicado ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {l.publicado ? 'publicado' : 'rascunho'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LoteadoraForm
        action={updateAction}
        submitLabel="Salvar alterações"
        initial={{
          nome: loteadora.nome,
          slug: loteadora.slug,
          razaoSocial: loteadora.razaoSocial,
          nomeFantasia: loteadora.nomeFantasia,
          cnpj: loteadora.cnpj,
          inscricaoEstadual: loteadora.inscricaoEstadual,
          endereco: loteadora.endereco,
          cidade: loteadora.cidade,
          estado: loteadora.estado,
          cep: loteadora.cep,
          telefone: loteadora.telefone,
          whatsapp: loteadora.whatsapp,
          email: loteadora.email,
          site: loteadora.site,
          logo: loteadora.logo,
          corPrimaria: loteadora.corPrimaria,
          corSecundaria: loteadora.corSecundaria,
          asaasApiKey: loteadora.asaasApiKey,
          asaasSandbox: loteadora.asaasSandbox,
          sobreTexto: loteadora.sobreTexto,
          ativo: loteadora.ativo,
          whatsappProvider: loteadora.whatsappProvider,
          whatsappToken: loteadora.whatsappToken,
          whatsappInstance: loteadora.whatsappInstance,
          whatsappBaseUrl: loteadora.whatsappBaseUrl,
          emailFromAddress: loteadora.emailFromAddress,
          emailReplyTo: loteadora.emailReplyTo,
          signProvider: loteadora.signProvider,
          signApiToken: loteadora.signApiToken,
          signSandbox: loteadora.signSandbox,
          representanteNome: loteadora.representanteNome,
          representanteCpf: loteadora.representanteCpf,
          representanteRg: loteadora.representanteRg,
          representanteCargo: loteadora.representanteCargo,
        }}
      />

      <SenhaVendaSemEntradaForm
        action={senhaAction}
        jaTemSenha={!!loteadora.vendaSemEntradaSenhaHash}
      />

      {loteadora._count.loteamentos === 0 && podeExcluir && (
        <section className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="font-semibold text-red-900 mb-1">Zona perigosa</h2>
          <p className="text-sm text-red-700 mb-3">
            Loteadora sem loteamentos pode ser excluída. Se já houver loteamentos, exclua-os ou transfira primeiro.
          </p>
          <form action={deleteAction}>
            <ConfirmButton
              message="Excluir esta loteadora?"
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Excluir loteadora
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}
