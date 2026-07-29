'use client';

import { useFormState } from 'react-dom';
import {
  Section,
  Field,
  SubmitButton,
  ErrorBox,
  SuccessBox,
  inputClass,
} from './ui';

interface LoteadoraInitial {
  nome?: string;
  slug?: string;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  site?: string | null;
  logo?: string | null;
  corPrimaria?: string | null;
  corSecundaria?: string | null;
  asaasApiKey?: string | null;
  asaasSandbox?: boolean;
  sobreTexto?: string | null;
  ativo?: boolean;
  // Comunicação
  whatsappProvider?: string | null;
  whatsappToken?: string | null;
  whatsappInstance?: string | null;
  whatsappBaseUrl?: string | null;
  emailFromAddress?: string | null;
  emailReplyTo?: string | null;
  // Assinatura digital
  signProvider?: string | null;
  signApiToken?: string | null;
  signSandbox?: boolean;
  // Representante legal (assina contratos)
  representanteNome?: string | null;
  representanteCpf?: string | null;
  representanteRg?: string | null;
  representanteCargo?: string | null;
}

type FormState = { error?: string; ok?: boolean };

export function LoteadoraForm({
  action,
  initial,
  submitLabel = 'Salvar',
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: LoteadoraInitial;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <ErrorBox message={state.error} />
      {state.ok && <SuccessBox message="Alterações salvas." />}

      <Section title="Identificação">
        <Field label="Nome / apelido público" required>
          <input name="nome" defaultValue={initial?.nome ?? ''} required className={inputClass} />
        </Field>
        <Field label="Slug" hint="Em branco gera do nome.">
          <input
            name="slug"
            defaultValue={initial?.slug ?? ''}
            className={inputClass + ' font-mono'}
          />
        </Field>
        <Field label="Razão social">
          <input
            name="razaoSocial"
            defaultValue={initial?.razaoSocial ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Nome fantasia">
          <input
            name="nomeFantasia"
            defaultValue={initial?.nomeFantasia ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="CNPJ">
          <input name="cnpj" defaultValue={initial?.cnpj ?? ''} className={inputClass} />
        </Field>
        <Field label="Inscrição estadual">
          <input
            name="inscricaoEstadual"
            defaultValue={initial?.inscricaoEstadual ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Loteadora ativa">
          <label className="inline-flex items-center gap-2">
            <input
              name="ativo"
              type="checkbox"
              defaultChecked={initial?.ativo ?? true}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Operacional</span>
          </label>
        </Field>
      </Section>

      <Section title="Endereço e contato">
        <Field label="Endereço" wide>
          <input name="endereco" defaultValue={initial?.endereco ?? ''} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input name="cidade" defaultValue={initial?.cidade ?? ''} className={inputClass} />
        </Field>
        <Field label="UF">
          <input
            name="estado"
            maxLength={2}
            defaultValue={initial?.estado ?? ''}
            className={inputClass + ' uppercase'}
          />
        </Field>
        <Field label="CEP">
          <input name="cep" defaultValue={initial?.cep ?? ''} className={inputClass} />
        </Field>
        <Field label="Telefone">
          <input name="telefone" defaultValue={initial?.telefone ?? ''} className={inputClass} />
        </Field>
        <Field label="WhatsApp">
          <input
            name="whatsapp"
            defaultValue={initial?.whatsapp ?? ''}
            className={inputClass}
            placeholder="55 11 99999-9999"
          />
        </Field>
        <Field label="E-mail">
          <input
            name="email"
            type="email"
            defaultValue={initial?.email ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Site">
          <input
            name="site"
            type="url"
            defaultValue={initial?.site ?? ''}
            className={inputClass}
            placeholder="https://"
          />
        </Field>
      </Section>

      <Section title="Branding da LP">
        <Field label="Logo (URL)" wide>
          <input
            name="logo"
            type="url"
            defaultValue={initial?.logo ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Cor primária (hex)" hint="Ex: #0284c7">
          <input
            name="corPrimaria"
            defaultValue={initial?.corPrimaria ?? ''}
            className={inputClass + ' font-mono'}
            placeholder="#0284c7"
          />
        </Field>
        <Field label="Cor secundária (hex)">
          <input
            name="corSecundaria"
            defaultValue={initial?.corSecundaria ?? ''}
            className={inputClass + ' font-mono'}
          />
        </Field>
        <Field label="Texto institucional (sobre a loteadora)" wide hint="Exibido nas LPs.">
          <textarea
            name="sobreTexto"
            rows={4}
            defaultValue={initial?.sobreTexto ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="💰 Asaas — cobrar parcelas dos clientes">
        <div className="md:col-span-2 -mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <p className="text-xs text-emerald-800 leading-relaxed">
            <strong>Esta é a conta Asaas DA LOTEADORA.</strong> Todos os boletos e PIX dos
            clientes desta loteadora caem na sua conta — não na da plataforma.
          </p>
        </div>
        <Field
          label="API Key Asaas"
          hint="Pegue no painel Asaas: Minha Conta → Integrações → API Key. Em branco = não emite cobranças automáticas."
          wide
        >
          <input
            name="asaasApiKey"
            type="password"
            defaultValue={initial?.asaasApiKey ?? ''}
            autoComplete="off"
            className={inputClass + ' font-mono'}
            placeholder="$aact_..."
          />
        </Field>
        <Field label="Ambiente Asaas">
          <label className="inline-flex items-center gap-2">
            <input
              name="asaasSandbox"
              type="checkbox"
              defaultChecked={initial?.asaasSandbox ?? true}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Sandbox (desmarcar para produção)</span>
          </label>
        </Field>
      </Section>

      <Section title="📱 WhatsApp — régua de cobrança e atendimento">
        <div className="md:col-span-2 -mt-2 p-3 rounded-lg bg-sky-50 border border-sky-200">
          <p className="text-xs text-sky-800 leading-relaxed">
            Em branco = ainda dá pra mandar via wa.me (link manual). Configurado = envio
            automático de cobrança e nurturing.
          </p>
        </div>
        <Field label="Provedor" hint="Evolution API (auto-hospedado), Z-API ou Meta Cloud API">
          <select
            name="whatsappProvider"
            defaultValue={initial?.whatsappProvider ?? ''}
            className={inputClass}
          >
            <option value="">— Não configurado —</option>
            <option value="evolution">Evolution API</option>
            <option value="zapi">Z-API</option>
            <option value="meta_cloud">Meta Cloud API</option>
          </select>
        </Field>
        <Field label="Instance" hint="Nome da instância (Evolution / Z-API) ou phone_number_id (Meta)">
          <input
            name="whatsappInstance"
            defaultValue={initial?.whatsappInstance ?? ''}
            className={inputClass + ' font-mono'}
            placeholder="ex: minha-instancia"
          />
        </Field>
        <Field
          label="Base URL (Evolution)"
          hint="URL do seu servidor Evolution. Ex: https://evo.meudominio.com (apenas Evolution)"
        >
          <input
            name="whatsappBaseUrl"
            type="url"
            defaultValue={initial?.whatsappBaseUrl ?? ''}
            className={inputClass + ' font-mono'}
            placeholder="https://evo.exemplo.com"
          />
        </Field>
        <Field label="Token / API Key" wide hint="apikey do Evolution, token Z-API ou access_token da Meta">
          <input
            name="whatsappToken"
            type="password"
            defaultValue={initial?.whatsappToken ?? ''}
            autoComplete="off"
            className={inputClass + ' font-mono'}
            placeholder="••••••"
          />
        </Field>
      </Section>

      <Section title="✉️ E-mail transacional">
        <Field label="Remetente (from address)" hint="O e-mail que aparece como remetente">
          <input
            name="emailFromAddress"
            type="email"
            defaultValue={initial?.emailFromAddress ?? ''}
            className={inputClass}
            placeholder="contato@suaempresa.com.br"
          />
        </Field>
        <Field label="Responder para (reply-to)">
          <input
            name="emailReplyTo"
            type="email"
            defaultValue={initial?.emailReplyTo ?? ''}
            className={inputClass}
            placeholder="vendas@suaempresa.com.br"
          />
        </Field>
        <div className="md:col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs text-slate-600 leading-relaxed">
            O provedor de envio (Resend, etc.) é configurado a nível global da plataforma. Aqui
            você só define quem aparece como remetente nos e-mails que vão pros SEUS clientes.
          </p>
        </div>
      </Section>

      <Section title="✍️ Assinatura eletrônica de contratos">
        <div className="md:col-span-2 -mt-2 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <p className="text-xs text-violet-800 leading-relaxed">
            Cliente recebe o contrato por e-mail e assina online. Em branco = usa a chave global
            da plataforma (se houver). Preenchido = usa a SUA conta Clicksign/ZapSign.
          </p>
        </div>
        <Field label="Provedor">
          <select
            name="signProvider"
            defaultValue={initial?.signProvider ?? ''}
            className={inputClass}
          >
            <option value="">— Usar configuração global —</option>
            <option value="clicksign">Clicksign</option>
            <option value="zapsign">ZapSign</option>
          </select>
        </Field>
        <Field label="Ambiente">
          <label className="inline-flex items-center gap-2">
            <input
              name="signSandbox"
              type="checkbox"
              defaultChecked={initial?.signSandbox ?? true}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Sandbox (desmarcar para produção)</span>
          </label>
        </Field>
        <Field
          label="API Token"
          wide
          hint="Clicksign: app.clicksign.com > Conta > Token de API · ZapSign: app.zapsign.com.br > Configurações > API"
        >
          <input
            name="signApiToken"
            type="password"
            defaultValue={initial?.signApiToken ?? ''}
            autoComplete="off"
            className={inputClass + ' font-mono'}
            placeholder="••••••"
          />
        </Field>
      </Section>

      <Section title="👤 Representante legal — assina contratos pela loteadora">
        <Field label="Nome completo" wide>
          <input
            name="representanteNome"
            defaultValue={initial?.representanteNome ?? ''}
            className={inputClass}
            placeholder="João da Silva"
          />
        </Field>
        <Field label="CPF">
          <input
            name="representanteCpf"
            defaultValue={initial?.representanteCpf ?? ''}
            className={inputClass}
            placeholder="000.000.000-00"
          />
        </Field>
        <Field label="RG">
          <input
            name="representanteRg"
            defaultValue={initial?.representanteRg ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Cargo" wide hint="Aparece na assinatura do contrato">
          <input
            name="representanteCargo"
            defaultValue={initial?.representanteCargo ?? 'Sócio Administrador'}
            className={inputClass}
            placeholder="Sócio Administrador"
          />
        </Field>
      </Section>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
