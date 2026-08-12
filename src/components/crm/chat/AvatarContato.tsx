'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Avatar do contato — foto real quando existe, iniciais quando não.
 *
 * 🔴 A foto vem do CDN do WhatsApp e EXPIRA. A ingestão revalida a cada 24h,
 * mas entre a expiração e a próxima mensagem a URL quebra. Por isso o erro de
 * carregamento cai de volta nas iniciais em vez de deixar o ícone partido do
 * navegador: um contato sem foto é normal; um retângulo quebrado parece defeito
 * do sistema.
 *
 * A cor das iniciais é derivada do nome, não aleatória: o mesmo contato tem
 * sempre a mesma cor, e é isso que faz reconhecer a conversa na fila sem ler.
 */

const CORES = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-orange-500',
];

function corDe(semente: string): string {
  let h = 0;
  for (let i = 0; i < semente.length; i++) h = (h * 31 + semente.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function AvatarContato({
  nome,
  fotoUrl,
  ehGrupo,
  tamanho = 'md',
  className,
}: {
  nome: string;
  fotoUrl?: string | null;
  ehGrupo?: boolean;
  tamanho?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);

  const dimensao = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-caption',
    lg: 'h-12 w-12 text-body',
  }[tamanho];

  if (fotoUrl && !falhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nome}
        onError={() => setFalhou(true)}
        className={cn('shrink-0 rounded-full object-cover', dimensao, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        dimensao,
        ehGrupo ? 'bg-slate-500' : corDe(nome),
        className
      )}
      aria-hidden
    >
      {ehGrupo ? <Users className="h-1/2 w-1/2" /> : iniciais(nome)}
    </span>
  );
}
