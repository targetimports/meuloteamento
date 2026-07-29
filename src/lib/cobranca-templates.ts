/**
 * Templates das mensagens de cobrança (WhatsApp), com link + Pix copia-e-cola.
 * Usados pela UI de agenda e pelo script de setup.
 * {{var}} = escapado; {{{var}}} = sem escape (usado em URL e no código Pix).
 */

const RODAPE = ['', '_{{loteadora.nome}}_'];

function pagamentoBloco(): string[] {
  return [
    '',
    '💳 Link de pagamento (Pix, boleto ou cartão):',
    '{{{parcela.invoiceUrl}}}',
    '',
    '📲 Pix copia e cola (toque e segure pra copiar):',
    '{{{parcela.pixCode}}}',
  ];
}

export function tplAntes(dias: number): string {
  const plural = dias > 1 ? 's' : '';
  return [
    'Olá *{{cliente.nome}}*! 👋',
    '',
    `Lembrete: sua parcela *#{{parcela.numero}}* da venda *#{{venda.numero}}* ({{loteamento.nome}}) vence em *${dias} dia${plural}* ({{parcela.vencimento}}).`,
    '',
    '💰 Valor: *{{parcela.valor}}*',
    ...pagamentoBloco(),
    ...RODAPE,
  ].join('\n');
}

export function tplVencimento(): string {
  return [
    'Olá *{{cliente.nome}}*! 👋',
    '',
    'Sua parcela *#{{parcela.numero}}* ({{loteamento.nome}}) *vence hoje* ({{parcela.vencimento}}).',
    '',
    '💰 Valor: *{{parcela.valor}}*',
    ...pagamentoBloco(),
    ...RODAPE,
  ].join('\n');
}

export function tplAtraso(): string {
  return [
    'Olá *{{cliente.nome}}*! 👋',
    '',
    'Sua parcela *#{{parcela.numero}}* ({{loteamento.nome}}) está *vencida* desde {{parcela.vencimento}} (há {{parcela.diasAtraso}} dia(s) em atraso).',
    '',
    '💰 Valor: *{{parcela.valor}}*',
    ...pagamentoBloco(),
    ...RODAPE,
  ].join('\n');
}
