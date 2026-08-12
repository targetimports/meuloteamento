import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Cartão do CRM.
 *
 * SEM sombra por padrão: quando a elevação vira estrutura, o resultado é
 * cartão dentro de cartão dentro de cartão — cada camada com sombra, cada
 * sombra roubando densidade. Aqui a estrutura vem da BORDA; a sombra fica
 * reservada para o que realmente flutua (dropdown, modal, drawer).
 *
 *   default     — borda + superfície do cartão
 *   subtle      — sem borda, fundo levemente distinto: agrupa sem cercar
 *   raised      — para o cartão que precisa se destacar de outro cartão
 *   interactive — clicável: ganha realce de borda no hover, não sombra
 */
const variantesCard = {
  default: 'border border-border bg-card',
  subtle: 'bg-surface-soft',
  raised: 'border border-border bg-surface-raised shadow-xs',
  interactive:
    'border border-border bg-card transition-colors hover:border-primary/40 hover:bg-accent/40 cursor-pointer',
} as const;

export type CardVariant = keyof typeof variantesCard;

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-lg text-card-foreground', variantesCard[variant] ?? variantesCard.default, className)}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 px-4 py-3.5', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-body-lg leading-6 font-semibold tracking-[-0.005em]', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-body-sm text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pb-4 text-body', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center px-4 pb-4', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
