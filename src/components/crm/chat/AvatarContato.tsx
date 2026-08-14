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
 * Antes o lugar da foto trazia as iniciais sobre uma cor derivada do nome. Só
 * que a maior parte da fila não tem nome — são conversas identificadas pelo
 * telefone, e a "inicial" virava um par de dígitos que não diz nada e ainda
 * pinta cada uma de uma cor diferente, como se fossem informação. A silhueta
 * neutra admite o que de fato se sabe do contato: nada além do número.
 */
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
        'flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
        dimensao,
        className
      )}
      aria-hidden
    >
      <Icone className="h-1/2 w-1/2" strokeWidth={1.75} />
    </span>
  );
}
