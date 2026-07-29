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

interface EmpresaInitial {
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  inscricaoEstadual: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  whatsapp: string | null;
  logo: string | null;
  asaasApiKey: string | null;
  asaasSandbox: boolean;
  bannerImagem: string | null;
  bannerTitulo: string | null;
  bannerSubtitulo: string | null;
  sobreTexto: string | null;
  contatoTexto: string | null;
}

type FormState = { error?: string; ok?: boolean };

export function EmpresaForm({
  initial,
  action,
}: {
  initial: EmpresaInitial;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <ErrorBox message={state.error} />
      {state.ok && <SuccessBox message="Configurações salvas." />}

      <Section title="Dados cadastrais">
        <Field label="Razão social" wide>
          <input name="razaoSocial" defaultValue={initial.razaoSocial ?? ''} className={inputClass} />
        </Field>
        <Field label="Nome fantasia">
          <input name="nomeFantasia" defaultValue={initial.nomeFantasia ?? ''} className={inputClass} />
        </Field>
        <Field label="CNPJ">
          <input name="cnpj" defaultValue={initial.cnpj ?? ''} className={inputClass} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Inscrição estadual">
          <input
            name="inscricaoEstadual"
            defaultValue={initial.inscricaoEstadual ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Endereço e contato">
        <Field label="Endereço" wide>
          <input name="endereco" defaultValue={initial.endereco ?? ''} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input name="cidade" defaultValue={initial.cidade ?? ''} className={inputClass} />
        </Field>
        <Field label="UF">
          <input name="estado" defaultValue={initial.estado ?? ''} maxLength={2} className={inputClass + ' uppercase'} />
        </Field>
        <Field label="CEP">
          <input name="cep" defaultValue={initial.cep ?? ''} className={inputClass} />
        </Field>
        <Field label="Telefone">
          <input name="telefone" defaultValue={initial.telefone ?? ''} className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={initial.email ?? ''} className={inputClass} />
        </Field>
        <Field label="WhatsApp">
          <input name="whatsapp" defaultValue={initial.whatsapp ?? ''} className={inputClass} placeholder="55 11 99999-9999" />
        </Field>
        <Field label="Logo (URL)">
          <input name="logo" type="url" defaultValue={initial.logo ?? ''} className={inputClass} />
        </Field>
      </Section>

      <Section title="Site público">
        <Field label="Banner — imagem (URL)" wide>
          <input name="bannerImagem" type="url" defaultValue={initial.bannerImagem ?? ''} className={inputClass} />
        </Field>
        <Field label="Banner — título" wide>
          <input name="bannerTitulo" defaultValue={initial.bannerTitulo ?? ''} className={inputClass} />
        </Field>
        <Field label="Banner — subtítulo" wide>
          <input name="bannerSubtitulo" defaultValue={initial.bannerSubtitulo ?? ''} className={inputClass} />
        </Field>
        <Field label="Texto da página &ldquo;Sobre&rdquo;" wide hint="Pode usar quebras de linha. Renderizado em parágrafos.">
          <textarea
            name="sobreTexto"
            rows={6}
            defaultValue={initial.sobreTexto ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Texto da página &ldquo;Contato&rdquo;" wide>
          <textarea
            name="contatoTexto"
            rows={4}
            defaultValue={initial.contatoTexto ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Asaas da PLATAFORMA — cobrar assinatura das loteadoras">
        <div className="md:col-span-2 -mt-2 p-3 rounded-lg bg-violet-50 border border-violet-200">
          <p className="text-xs text-violet-800 leading-relaxed">
            <strong>⚠️ Esta é a conta Asaas DA NOSSA EMPRESA (meuloteamento).</strong> Use essa
            chave para emitir as cobranças mensais que cada loteadora paga pra nós (assinatura
            SaaS). <br />
            <strong>NÃO use esta chave</strong> para cobrar os clientes finais — para isso, cada
            loteadora cadastra a chave dela em <code className="bg-violet-100 px-1 rounded">Loteadoras → editar</code>.
          </p>
        </div>
        <Field
          label="API Key da plataforma"
          hint="Conta Asaas da meuloteamento. Quando preenchido, sobrescreve o valor do .env."
          wide
        >
          <input
            name="asaasApiKey"
            type="password"
            defaultValue={initial.asaasApiKey ?? ''}
            autoComplete="off"
            className={inputClass + ' font-mono'}
            placeholder="$aact_..."
          />
        </Field>
        <Field label="Ambiente">
          <label className="inline-flex items-center gap-2">
            <input
              name="asaasSandbox"
              type="checkbox"
              defaultChecked={initial.asaasSandbox}
              className="rounded"
            />
            <span className="text-sm text-slate-700">Usar sandbox (desmarcado = produção)</span>
          </label>
        </Field>
      </Section>

      <SubmitButton label="Salvar configurações" />
    </form>
  );
}
