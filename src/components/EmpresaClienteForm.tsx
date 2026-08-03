'use client';

/**
 * Formulário de empresa-cliente do backoffice.
 *
 * Separado do LoteadoraForm de propósito: aquele tem 35 campos, incluindo
 * chaves de Asaas, WhatsApp e assinatura digital — configuração técnica que
 * o próprio cliente ajusta na tela dele. Aqui é só o que o provedor precisa
 * para abrir e manter a conta.
 */

import { useFormState, useFormStatus } from 'react-dom';

export interface DadosEmpresa {
  id?: string;
  nome?: string | null;
  slug?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

type EstadoForm = { error?: string; ok?: boolean };

interface Props {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial?: DadosEmpresa;
  rotuloBotao: string;
}

const campo =
  'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

function Botao({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition"
    >
      {pending ? 'Salvando...' : rotulo}
    </button>
  );
}

export function EmpresaClienteForm({ action, inicial, rotuloBotao }: Props) {
  const [estado, formAction] = useFormState(action, {} as EstadoForm);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {inicial?.id && <input type="hidden" name="id" value={inicial.id} />}

      <div className="sm:col-span-2">
        <label htmlFor="nome" className="block text-xs font-medium text-slate-600 mb-1">
          Nome da empresa *
        </label>
        <input
          id="nome"
          name="nome"
          required
          minLength={2}
          defaultValue={inicial?.nome ?? ''}
          placeholder="Grupo Germanos"
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-xs font-medium text-slate-600 mb-1">
          Endereço (slug)
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={inicial?.slug ?? ''}
          placeholder="gerado a partir do nome"
          className={campo}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Vira o subdomínio da empresa. Mudar depois quebra links já divulgados.
        </p>
      </div>

      <div>
        <label htmlFor="cnpj" className="block text-xs font-medium text-slate-600 mb-1">
          CNPJ
        </label>
        <input
          id="cnpj"
          name="cnpj"
          defaultValue={inicial?.cnpj ?? ''}
          placeholder="00.000.000/0000-00"
          className={campo}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="razaoSocial" className="block text-xs font-medium text-slate-600 mb-1">
          Razão social
        </label>
        <input
          id="razaoSocial"
          name="razaoSocial"
          defaultValue={inicial?.razaoSocial ?? ''}
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-xs font-medium text-slate-600 mb-1">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={inicial?.email ?? ''}
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="telefone" className="block text-xs font-medium text-slate-600 mb-1">
          Telefone
        </label>
        <input
          id="telefone"
          name="telefone"
          defaultValue={inicial?.telefone ?? ''}
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="cidade" className="block text-xs font-medium text-slate-600 mb-1">
          Cidade
        </label>
        <input
          id="cidade"
          name="cidade"
          defaultValue={inicial?.cidade ?? ''}
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="estado" className="block text-xs font-medium text-slate-600 mb-1">
          UF
        </label>
        <input
          id="estado"
          name="estado"
          maxLength={2}
          defaultValue={inicial?.estado ?? ''}
          placeholder="BA"
          className={campo}
        />
      </div>

      {estado.error && (
        <p className="sm:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="sm:col-span-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          Dados salvos.
        </p>
      )}

      <div className="sm:col-span-2">
        <Botao rotulo={rotuloBotao} />
      </div>
    </form>
  );
}
