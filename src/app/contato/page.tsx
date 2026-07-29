import type { Metadata } from 'next';
import { getEmpresaConfig } from '@/lib/empresa';
import { PublicHeader, PublicFooter } from '@/components/PublicHeader';
import { LeadFormPublic } from '@/components/LeadFormPublic';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getEmpresaConfig();
  const nomeEmpresa = config.nomeFantasia ?? config.razaoSocial ?? 'meuloteamento';
  return {
    title: `Contato — ${nomeEmpresa}`,
    description: `Fale com a ${nomeEmpresa}. Atendimento por WhatsApp, e-mail ou telefone. Tire dúvidas sobre nossos loteamentos.`,
    alternates: { canonical: '/contato' },
    openGraph: {
      title: `Contato — ${nomeEmpresa}`,
      description: `Atendimento por WhatsApp, e-mail ou telefone.`,
      type: 'website',
    },
  };
}

export default async function ContatoPage() {
  const config = await getEmpresaConfig();
  const nomeEmpresa = config.nomeFantasia ?? config.razaoSocial ?? 'meuloteamento';
  const texto = config.contatoTexto ?? 'Fale conosco pelos canais abaixo ou deixe seus dados que retornaremos.';
  const paragrafos = texto.split('\n').filter((p) => p.trim().length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader nomeEmpresa={nomeEmpresa} />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Contato</h1>
          {paragrafos.map((p, i) => (
            <p key={i} className="text-slate-700 mb-3">
              {p}
            </p>
          ))}

          <div className="mt-6 space-y-2 text-sm">
            {config.telefone && (
              <p>
                <span className="font-medium text-slate-700">Telefone:</span>{' '}
                <span className="text-slate-600">{config.telefone}</span>
              </p>
            )}
            {config.whatsapp && (
              <p>
                <span className="font-medium text-slate-700">WhatsApp:</span>{' '}
                <a
                  href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`}
                  className="text-primary-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {config.whatsapp}
                </a>
              </p>
            )}
            {config.email && (
              <p>
                <span className="font-medium text-slate-700">E-mail:</span>{' '}
                <a href={`mailto:${config.email}`} className="text-primary-600 hover:underline">
                  {config.email}
                </a>
              </p>
            )}
            {(config.endereco || config.cidade) && (
              <p>
                <span className="font-medium text-slate-700">Endereço:</span>{' '}
                <span className="text-slate-600">
                  {[config.endereco, config.cidade, config.estado].filter(Boolean).join(', ')}
                </span>
              </p>
            )}
          </div>
        </div>

        <div>
          <LeadFormPublic origem="contato" />
        </div>
      </main>

      <PublicFooter
        nomeEmpresa={nomeEmpresa}
        telefone={config.telefone}
        email={config.email}
        cnpj={config.cnpj}
      />
    </div>
  );
}
