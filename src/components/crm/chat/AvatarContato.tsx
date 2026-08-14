'use client';

import { useState } from 'react';
import { User, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Avatar do contato — foto real quando existe, silhueta genérica quando não.
 *
 * 🔴 A foto vem do CDN do WhatsApp e EXPIRA. A ingestão revalida a cada 24h,
 * mas entre a expiração e a próxima mensagem a URL quebra. Por isso o erro de
 * carregamento cai de volta na silhueta em vez de deixar o ícone partido do
 * navegador: um contato sem foto é normal; um retângulo quebrado parece defeito
 * do sistema.
 *
 * A cor do círculo é derivada do contato, não sorteada: o mesmo contato tem
 * sempre a mesma cor, e é isso que faz reconhecer a conversa na fila sem ler o
 * nome. O que saiu foram as iniciais — a maior parte da fila é identificada
 * pelo telefone, e a "inicial" virava um par de dígitos que não diz nada.
 *
 * A paleta é escolhida entre tons fechados o bastante para a silhueta branca
 * sobre eles passar no contraste; por isso não há amarelo nem lima aqui.
 */

const CORES = [
  'bg-sky-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-indigo-600',
  'bg-orange-600',
  'bg-fuchsia-600',
];

function corDe(semente: string): string {
  let h = 0;
  for (let i = 0; i < semente.length; i++) h = (h * 31 + semente.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
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
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
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

  const Icone = ehGrupo ? Users : User;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-white',
        dimensao,
        // Grupo fora da paleta: ele não é uma pessoa, e a cor neutra é o que
        // separa os dois tipos de conversa de relance.
        ehGrupo ? 'bg-slate-500' : corDe(nome),
        className
      )}
      aria-hidden
    >
      <Icone className="h-1/2 w-1/2" strokeWidth={1.75} />
    </span>
  );
}
