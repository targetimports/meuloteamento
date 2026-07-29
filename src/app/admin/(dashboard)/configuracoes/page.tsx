import { getEmpresaConfig } from '@/lib/empresa';
import { EmpresaForm } from '@/components/EmpresaForm';
import { salvarConfiguracoes } from './actions';
import { requireSuperAdmin } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  await requireSuperAdmin();
  const config = await getEmpresaConfig();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Configurações da empresa</h1>
      <p className="text-sm text-slate-500 mb-6">
        Dados cadastrais, contato, site público e gateway de pagamento.
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
  );
}
