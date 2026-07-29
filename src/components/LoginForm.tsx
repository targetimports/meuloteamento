'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

interface Props {
  action: (formData: FormData) => Promise<void>;
}

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 overflow-hidden"
    >
      {/* shimmer no hover */}
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
      <span className="relative inline-flex items-center justify-center gap-2">
        {pending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Entrando…
          </>
        ) : (
          <>
            Entrar
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0-5 5m5-5H6" />
            </svg>
          </>
        )}
      </span>
    </button>
  );
}

export function LoginForm({ action }: Props) {
  const [showPwd, setShowPwd] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          E-mail
        </label>
        <div className={`relative group rounded-xl transition-all ${emailFocused ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-white' : ''}`}>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
            </svg>
          </span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder="voce@email.com"
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 pl-11 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary-500 transition"
          />
        </div>
      </div>

      {/* Senha */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Senha
          </label>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); alert('Funcionalidade em breve. Por enquanto, peça reset diretamente.'); }}
            className="text-xs text-slate-400 hover:text-primary-600 transition"
          >
            Esqueci a senha
          </button>
        </div>
        <div className={`relative rounded-xl transition-all ${pwdFocused ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-white' : ''}`}>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V8a4 4 0 1 0-8 0v4m-2 0h12v8H6v-8Z" />
            </svg>
          </span>
          <input
            id="password"
            name="password"
            type={showPwd ? 'text' : 'password'}
            required
            autoComplete="current-password"
            onFocus={() => setPwdFocused(true)}
            onBlur={() => setPwdFocused(false)}
            placeholder="••••••••"
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 pl-11 pr-12 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary-500 transition"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
            aria-label={showPwd ? 'Esconder senha' : 'Mostrar senha'}
          >
            {showPwd ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24 M1 1l22 22" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Manter conectado */}
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
        <input type="checkbox" name="lembrar" className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
        Manter conectado neste dispositivo
      </label>

      <SubmitBtn />
    </form>
  );
}
