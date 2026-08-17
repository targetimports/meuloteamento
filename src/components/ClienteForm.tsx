'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { maskTelefone } from '@/lib/format';
import { inputClass, selectClass } from './ui';

export interface ClienteFormValues {
  nome?: string;
  email?: string;
  cpfCnpj?: string;
  telefone?: string;
  rg?: string | null;
  dataNascimento?: string | null; // YYYY-MM-DD
  nacionalidade?: string | null;
  estadoCivil?: string | null;
  profissao?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  aceitaWhatsApp?: boolean;
  aceitaEmail?: boolean;
}

type FormState = { error?: string; ok?: boolean; clienteId?: string };

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ClienteFormValues;
  submitLabel?: string;
}

function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskCep(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function ClienteForm({ action, initial, submitLabel = 'Salvar' }: Props) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [cpfCnpj, setCpfCnpj] = useState(initial?.cpfCnpj ? maskCpfCnpj(initial.cpfCnpj) : '');
  const [telefone, setTelefone] = useState(initial?.telefone ? maskTelefone(initial.telefone) : '');
  const [cep, setCep] = useState(initial?.cep ? maskCep(initial.cep) : '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enderecoAuto, setEnderecoAuto] = useState({
    logradouro: initial?.logradouro ?? '',
    bairro: initial?.bairro ?? '',
    cidade: initial?.cidade ?? '',
    estado: initial?.estado ?? '',
  });

  // Lookup ViaCEP quando CEP completo
  useEffect(() => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    let cancelled = false;
    setBuscandoCep(true);
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.erro) return;
        setEnderecoAuto({
          logradouro: data.logradouro || enderecoAuto.logradouro,
          bairro: data.bairro || enderecoAuto.bairro,
          cidade: data.localidade || enderecoAuto.cidade,
          estado: (data.uf || enderecoAuto.estado).toUpperCase(),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBuscandoCep(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep]);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg p-3">
          Alterações salvas com sucesso.
        </div>
      )}

      {/* IDENTIFICAÇÃO */}
      <Card title="Identificação">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo" required wide>
            <input
              name="nome"
              defaultValue={initial?.nome ?? ''}
              required
              minLength={2}
              placeholder="João da Silva"
              className={inputClass}
            />
          </Field>
          <Field label="CPF / CNPJ" required>
            <input
              name="cpfCnpj"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
              required
              minLength={11}
              placeholder="000.000.000-00"
              className={inputClass}
            />
          </Field>
          <Field label="RG">
            <input
              name="rg"
              defaultValue={initial?.rg ?? ''}
              placeholder="000.000.000"
              className={inputClass}
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              name="dataNascimento"
              type="date"
              defaultValue={initial?.dataNascimento ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Nacionalidade">
            <input
              name="nacionalidade"
              defaultValue={initial?.nacionalidade ?? 'Brasileiro(a)'}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      {/* CONTATO */}
      <Card title="Contato">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="E-mail" required wide>
            <input
              name="email"
              type="email"
              defaultValue={initial?.email ?? ''}
              required
              placeholder="cliente@email.com"
              className={inputClass}
            />
          </Field>
          <Field label="Telefone / WhatsApp" required>
            <input
              name="telefone"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              required
              minLength={14}
              placeholder="(75) 99999-9999"
              className={inputClass}
            />
          </Field>
          <Field label="Preferências de comunicação" wide>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  name="aceitaWhatsApp"
                  defaultChecked={initial?.aceitaWhatsApp ?? true}
                  className="rounded"
                />
                Aceita receber WhatsApp
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  name="aceitaEmail"
                  defaultChecked={initial?.aceitaEmail ?? true}
                  className="rounded"
                />
                Aceita receber E-mail
              </label>
            </div>
          </Field>
        </div>
      </Card>

      {/* DADOS PESSOAIS PARA CONTRATO */}
      <Card title="Dados para contrato" descricao="Aparecem nos contratos de compra e venda. Pode preencher depois.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Estado civil">
            <select
              name="estadoCivil"
              defaultValue={initial?.estadoCivil ?? ''}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              <option value="Solteiro(a)">Solteiro(a)</option>
              <option value="Casado(a)">Casado(a)</option>
              <option value="Divorciado(a)">Divorciado(a)</option>
              <option value="Viúvo(a)">Viúvo(a)</option>
              <option value="União Estável">União Estável</option>
            </select>
          </Field>
          <Field label="Profissão">
            <input
              name="profissao"
              defaultValue={initial?.profissao ?? ''}
              placeholder="Engenheiro civil"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      {/* ENDEREÇO */}
      <Card title="Endereço">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <Field label="CEP" hint={buscandoCep ? 'Buscando…' : 'Auto-completa logradouro/cidade/UF'}>
              <input
                name="cep"
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                placeholder="00000-000"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Logradouro">
              <input
                name="logradouro"
                value={enderecoAuto.logradouro}
                onChange={(e) => setEnderecoAuto({ ...enderecoAuto, logradouro: e.target.value })}
                placeholder="Rua / Av."
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Número">
              <input
                name="numero"
                defaultValue={initial?.numero ?? ''}
                placeholder="Nº"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Complemento">
              <input
                name="complemento"
                defaultValue={initial?.complemento ?? ''}
                placeholder="Apto 12, bloco B…"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Bairro">
              <input
                name="bairro"
                value={enderecoAuto.bairro}
                onChange={(e) => setEnderecoAuto({ ...enderecoAuto, bairro: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="Cidade">
              <input
                name="cidade"
                value={enderecoAuto.cidade}
                onChange={(e) => setEnderecoAuto({ ...enderecoAuto, cidade: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-1">
            <Field label="UF">
              <input
                name="estado"
                value={enderecoAuto.estado}
                onChange={(e) =>
                  setEnderecoAuto({ ...enderecoAuto, estado: e.target.value.toUpperCase() })
                }
                maxLength={2}
                className={`${inputClass} uppercase`}
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* AÇÕES */}
      <div className="flex items-center justify-end gap-2 pb-4">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

// ===== Helpers =====

function Card({
  title,
  descricao,
  children,
}: {
  title: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {descricao && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{descricao}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Salvando…
        </>
      ) : (
        label
      )}
    </button>
  );
}
