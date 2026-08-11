/**
 * Janela de horário permitida para o DISPARO AUTOMÁTICO de cobrança.
 *
 * A régua só gera/envia cobrança entre 08:00 e 12:00 (horário de Brasília).
 * Fora dessa janela, nada de cobrança é enviado — mas mensagens que NÃO são
 * cobrança (recuperação de senha, leads) continuam saindo normalmente.
 */

export const COBRANCA_HORA_INICIO = 8; // 08:00
export const COBRANCA_HORA_FIM = 12; // para às 12:00 (envia 08:00–11:59)

/** Hora (0-23) no fuso de São Paulo, independente do fuso do servidor. */
export function horaBRT(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return h % 24;
}

/** true se agora está dentro da janela permitida de cobrança (08:00–11:59 BRT). */
export function dentroDaJanelaCobranca(now: Date = new Date()): boolean {
  const h = horaBRT(now);
  return h >= COBRANCA_HORA_INICIO && h < COBRANCA_HORA_FIM;
}
