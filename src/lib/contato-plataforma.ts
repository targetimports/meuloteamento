/**
 * Canal de WhatsApp da PLATAFORMA (Meu Loteamento) — para quem quer assinar o
 * sistema falar com o comercial.
 *
 * Aqui o interessado e quem inicia a conversa, por link wa.me. Nao ha envio
 * automatico: nao depende de instancia Evolution, nao exige ler QR code e nao
 * corre risco de o WhatsApp derrubar a sessao (foi o que aconteceu com a
 * instancia da loteadora em 29/07).
 *
 * Nao confundir com o WhatsApp das loteadoras clientes, que fica nas colunas
 * whatsapp* da tabela loteadoras e serve para cobrar compradores de lote.
 */

/** Numero no formato internacional, sem '+', como o wa.me exige. */
export const WHATSAPP_PLATAFORMA = '5575991164106';

/** Como o numero aparece para o usuario. */
export const WHATSAPP_PLATAFORMA_EXIBICAO = '(75) 99116-4106';

/**
 * Monta o link do WhatsApp com a mensagem ja escrita, para o comercial saber
 * de cara qual plano despertou o interesse.
 */
export function linkWhatsAppPlataforma(plano?: string, nome?: string): string {
  const partes = [
    'Olá! Vim pelo site do Meu Loteamento',
    plano ? ` e tenho interesse no plano ${plano}` : '',
    '.',
    nome ? ` Meu nome é ${nome}.` : '',
  ];
  const texto = partes.join('');
  return `https://wa.me/${WHATSAPP_PLATAFORMA}?text=${encodeURIComponent(texto)}`;
}
