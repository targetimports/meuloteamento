'use client';

import { useFormStatus } from 'react-dom';

// Cores explícitas de fundo + texto pra que os inputs/selects não herdem o
// "forced dark mode" do sistema operacional / navegador quando o site está
// em modo claro. Sempre claros no light mode, escuros no dark mode controlado.
export const inputClass =
  'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 ' +
  'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ' +
  'placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
  'rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm';

/**
 * Select com a seta do sistema trocada por uma desenhada.
 *
 * O select nativo herda o desenho do sistema operacional: a seta muda de forma
 * entre Windows, macOS e Linux, e nenhuma delas combina com o resto dos campos.
 * `appearance-none` remove a original e o SVG de fundo entra no lugar, com
 * padding à direita para o texto não passar por baixo dela.
 */
export const selectClass =
  inputClass +
  ' appearance-none bg-no-repeat pr-9 cursor-pointer' +
  " bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")]" +
  ' bg-[length:1.1rem] bg-[position:right_0.65rem_center]';

export const labelClass =
  'block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      <legend className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

export function Field({
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
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg"
    >
      {pending ? loadingLabel ?? 'Salvando...' : label}
    </button>
  );
}

export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
      {message}
    </div>
  );
}

export function SuccessBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
      {message}
    </div>
  );
}

/**
 * Editor de lista de strings (uma por linha) → array.
 * No formData vem como string com \n, e a action faz split.
 */
export function MultilineField({
  name,
  label,
  hint,
  initial,
  rows = 4,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  initial?: string[];
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint} wide>
      <textarea
        name={name}
        rows={rows}
        defaultValue={initial?.join('\n') ?? ''}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );
}
