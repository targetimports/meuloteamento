import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Etiqueta em formato de pílula.
 *
 * As variantes "Soft" (tint — fundo com ~12% da cor e texto na cor forte) são
 * o padrão para status em tabela e lista: legíveis nos dois temas e discretas
 * o bastante para repetir dezenas de vezes na mesma tela sem virar ruído.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-0.5 text-body-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-border text-foreground',
        primarySoft: 'bg-primary/[0.12] text-primary-strong',
        successSoft: 'bg-success/[0.12] text-success-strong',
        warningSoft: 'bg-warning/[0.16] text-warning-strong',
        infoSoft: 'bg-info/[0.12] text-info-strong',
        errorSoft: 'bg-destructive/[0.12] text-destructive',
        neutralSoft: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
