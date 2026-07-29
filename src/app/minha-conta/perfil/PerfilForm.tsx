'use client';

import { useState } from 'react';

interface Initial {
  email: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  aceitaEmail: boolean;
  aceitaWhatsApp: boolean;
}

export default function PerfilForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState(initial);
  const [novaSenha, setNovaSenha] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  async function salvar() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cliente/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          telefone: form.telefone,
          aceitaEmail: form.aceitaEmail,
          aceitaWhatsApp: form.aceitaWhatsApp,
          novaSenha: novaSenha || undefined,
          senhaAtual: senhaAtual || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: data.error ?? 'Erro' });
      } else {
        setMsg({ tipo: 'ok', texto: 'Perfil atualizado' });
        setNovaSenha('');
        setSenhaAtual('');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 bg-white border border-slate-200 rounded-lg p-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
          <input
            value={form.email}
            disabled
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">CPF/CNPJ</label>
          <input
            value={form.cpfCnpj}
            disabled
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-slate-900 mb-2">Notificações</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.aceitaEmail}
            onChange={(e) => setForm({ ...form, aceitaEmail: e.target.checked })}
          />
          Receber e-mails (cobranças, recibos, contratos)
        </label>
        <label className="flex items-center gap-2 text-sm mt-1">
          <input
            type="checkbox"
            checked={form.aceitaWhatsApp}
            onChange={(e) => setForm({ ...form, aceitaWhatsApp: e.target.checked })}
          />
          Receber WhatsApp (lembretes de parcela)
        </label>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <h3 className="font-medium text-slate-900 mb-2">Trocar senha</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            type="password"
            placeholder="Senha atual"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Nova senha (mín. 8)"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {msg && (
        <div
          className={`text-sm rounded px-3 py-2 ${
            msg.tipo === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {msg.texto}
        </div>
      )}

      <button
        onClick={salvar}
        disabled={loading}
        className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-medium px-4 py-2 rounded text-sm"
      >
        {loading ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </div>
  );
}
