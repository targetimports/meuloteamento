'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/cliente/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setEnviado(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Recuperar senha</h1>
        <p className="text-sm text-slate-500 mb-6">
          Você receberá um e-mail com o link para redefinir sua senha.
        </p>
        {enviado ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded px-3 py-3">
            Se este e-mail estiver cadastrado, você receberá em instantes as instruções.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-medium px-4 py-2 rounded text-sm"
            >
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}
        <div className="mt-6 text-sm">
          <Link href="/minha-conta/login" className="text-sky-600 hover:underline">
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
