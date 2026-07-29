'use client';

import { useEffect, useState } from 'react';

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
    <div className="bg-primary-50/50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 rounded-2xl p-4 mb-6">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
          🔗 Link público
        </p>
        <p className="text-[10px] text-primary-700 dark:text-primary-300">
          Compartilhe com o cliente para coletar os dados
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          readOnly
          value={fullUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[200px] px-3 py-2 bg-white dark:bg-slate-900 border border-primary-200 dark:border-primary-500/30 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300"
        />
        <button
          onClick={copy}
          className="px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg whitespace-nowrap"
        >
          {copied ? '✓ Copiado' : '📋 Copiar link'}
        </button>
        <button
          onClick={copyMessageWpp}
          className="px-3 py-2 text-xs font-semibold bg-[#25D366] hover:bg-[#1cb858] text-white rounded-lg whitespace-nowrap"
        >
          {copiedWpp ? '✓ Copiada' : '📱 Copiar msg WhatsApp'}
        </button>
      </div>
    </div>
  );
}
