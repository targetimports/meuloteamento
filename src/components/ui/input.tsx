import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Campo de texto: 40px de altura, sem sombra — o foco é marcado pela borda
 * ganhando a cor primária, não por um anel cinza.
 *
 * `text-foreground` é obrigatório aqui, não enfeite: o `globals.css` tem uma
 * regra base que pinta `input`/`textarea`/`select` de slate-900 como rede de
 * proteção para navegador que ignore `color-scheme`. Sem esta classe o texto
 * ficaria escuro sobre fundo escuro no tema noturno.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-transparent px-3.5 py-2 text-body-lg text-foreground transition-colors file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3.5 py-2 text-body-lg text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45',
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, Textarea };
