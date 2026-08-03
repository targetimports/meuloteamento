import { getEmpresaConfig } from '@/lib/empresa';
import { EmpresaForm } from '@/components/EmpresaForm';
import { salvarConfiguracoes } from './actions';
import { requireBackoffice } from '@/lib/backoffice';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  await requireBackoffice();
  const config = await getEmpresaConfig();

  return (
    <div>
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <h1 className="text-lg font-semibold text-slate-900">
          Configurações da plataforma
        </h1>
      </header>

      <div className="p-8">
      <p className="text-sm text-slate-500 mb-6">
        Dados cadastrais, contato, site público e gateway de pagamento do
        meuloteamento — não de nenhuma empresa-cliente.
      </p>

      <EmpresaForm
        initial={{
          razaoSocial: config.razaoSocial,
          nomeFantasia: config.nomeFantasia,
          cnpj: config.cnpj,
          inscricaoEstadual: config.inscricaoEstadual,
          endereco: config.endereco,
          cidade: config.cidade,
          estado: config.estado,
          cep: config.cep,
          telefone: config.telefone,
          email: config.email,
          whatsapp: config.whatsapp,
          logo: config.logo,
          asaasApiKey: config.asaasApiKey,
          asaasSandbox: config.asaasSandbox,
          bannerImagem: config.bannerImagem,
          bannerTitulo: config.bannerTitulo,
          bannerSubtitulo: config.bannerSubtitulo,
          sobreTexto: config.sobreTexto,
          contatoTexto: config.contatoTexto,
        }}
        action={salvarConfiguracoes}
      />
      </div>
    </div>
  );
}
