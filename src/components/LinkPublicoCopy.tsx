'use client';

import { useEffect, useState } from 'react';

import { IconWhatsApp } from '@/components/icons';

export function LinkPublicoCopy({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedWpp, setCopiedWpp] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = origin ? `${origin}/f/${slug}` : `/f/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyMessageWpp() {
    const msg = `Olá! Por favor preencha este formulário com seus dados para que possamos continuar o atendimento:\n\n${fullUrl}`;
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedWpp(true);
    setTimeout(() => setCopiedWpp(false), 2000);
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Link público
        </p>
        <p className="text-[11px] text-slate-400">
          Compartilhe com o cliente para coletar os dados
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          readOnly
          value={fullUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        />
        <button
          onClick={copy}
          className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
        >
          {copied ? 'Copiado' : 'Copiar link'}
        </button>
        <button
          onClick={copyMessageWpp}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <IconWhatsApp className="h-3.5 w-3.5 text-[#25D366]" />
          {copiedWpp ? 'Mensagem copiada' : 'Copiar mensagem'}
        </button>
      </div>
    </div>
  );
}
