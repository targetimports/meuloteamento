import type { Metadata } from 'next';
import { getEmpresaConfig } from '@/lib/empresa';
import { PublicHeader, PublicFooter } from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getEmpresaConfig();
  const nomeEmpresa = config.nomeFantasia ?? config.razaoSocial ?? 'meuloteamento';
  return {
    title: `Sobre nós — ${nomeEmpresa}`,
    description:
      config.sobreTexto?.slice(0, 160) ??
      `Conheça a ${nomeEmpresa}: nossa missão, valores e os loteamentos que oferecemos.`,
    alternates: { canonical: '/sobre' },
    openGraph: {
      title: `Sobre — ${nomeEmpresa}`,
      description: config.sobreTexto?.slice(0, 200),
      type: 'website',
    },
  };
}

export default async function SobrePage() {
  const config = await getEmpresaConfig();
  const nomeEmpresa = config.nomeFantasia ?? config.razaoSocial ?? 'meuloteamento';
  const texto = config.sobreTexto ?? `Estamos construindo um espaço para apresentar nosso trabalho.\n\nEm breve mais informações.`;
  const paragrafos = texto.split('\n').filter((p) => p.trim().length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader nomeEmpresa={nomeEmpresa} />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Sobre nós</h1>
        <div className="prose prose-slate max-w-none">
          {paragrafos.map((p, i) => (
            <p key={i} className="text-slate-700 leading-relaxed mb-4">
              {p}
            </p>
          ))}
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
