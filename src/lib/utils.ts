import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes e resolve conflitos do Tailwind.
 *
 * `clsx` monta a lista (aceitando condicionais e objetos); `twMerge` remove o
 * que ficou duplicado na mesma propriedade — sem ele, `cn('p-2', 'p-4')` manda
 * as duas para o HTML e quem vence é a ordem no CSS gerado, não a intenção de
 * quem chamou.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
