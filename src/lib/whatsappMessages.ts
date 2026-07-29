/**
 * Mensagens pré-prontas para envio via WhatsApp (cobrança, boas-vindas, etc).
 * Todas em PT-BR, tom cordial e direto.
 */

import { formatBRL, formatDate } from './format';

interface ParcelaMsg {
  numero: number;
  vencimento: Date | string;
  valor: number | string;
  invoiceUrl?: string | null;
  identifier?: string | null; // linha digitável
}

interface VendaMsg {
  numero: string | number;
  loteCodigo: string;
  loteamentoNome: string;
}

interface ClienteMsg {
  nome: string;
}

interface LoteadoraMsg {
  nome: string;
}

/**
 * Cobrança padrão (parcela pendente ou atrasada).
 */
export function msgCobrancaParcela({
  cliente,
  venda,
  parcela,
  loteadora,
}: {
  cliente: ClienteMsg;
  venda: VendaMsg;
  parcela: ParcelaMsg;
  loteadora: LoteadoraMsg;
}): string {
  const primeiroNome = cliente.nome.split(' ')[0];
  const valor = formatBRL(Number(parcela.valor));
  const venc = formatDate(parcela.vencimento);

  const linhas = [
    `Olá, ${primeiroNome}! 👋`,
    ``,
    `Aqui é da ${loteadora.nome}. Estou passando para te lembrar da parcela ${parcela.numero} do contrato #${venda.numero} (lote ${venda.loteCodigo} – ${venda.loteamentoNome}):`,
    ``,
    `💰 Valor: *${valor}*`,
    `📅 Vencimento: *${venc}*`,
  ];

  if (parcela.invoiceUrl) {
    linhas.push(``, `🔗 Boleto/PIX: ${parcela.invoiceUrl}`);
  }
  if (parcela.identifier) {
    linhas.push(``, `Linha digitável:`, `\`${parcela.identifier}\``);
  }

  linhas.push(``, `Qualquer dúvida, é só me chamar por aqui. Obrigado! 🙏`);
  return linhas.join('\n');
}

/**
 * Mensagem de boas-vindas após criação da venda.
 */
export function msgBoasVindas({
  cliente,
  venda,
  loteadora,
  totalParcelas,
}: {
  cliente: ClienteMsg;
  venda: VendaMsg;
  loteadora: LoteadoraMsg;
  totalParcelas: number;
}): string {
  const primeiroNome = cliente.nome.split(' ')[0];
  return [
    `Olá, ${primeiroNome}! 🎉`,
    ``,
    `Bem-vindo(a) à família ${loteadora.nome}!`,
    ``,
    `Seu contrato #${venda.numero} para o lote *${venda.loteCodigo}* (${venda.loteamentoNome}) está confirmado.`,
    `Foram geradas ${totalParcelas} parcela(s) — você vai receber os boletos por aqui mesmo.`,
    ``,
    `Qualquer coisa estou à disposição. Parabéns pela conquista! 🏡`,
  ].join('\n');
}

/**
 * Pré-aviso de vencimento próximo (D-3 ou D-7).
 */
export function msgPreAviso({
  cliente,
  venda,
  parcela,
  loteadora,
  diasAteVencimento,
}: {
  cliente: ClienteMsg;
  venda: VendaMsg;
  parcela: ParcelaMsg;
  loteadora: LoteadoraMsg;
  diasAteVencimento: number;
}): string {
  const primeiroNome = cliente.nome.split(' ')[0];
  const valor = formatBRL(Number(parcela.valor));
  const venc = formatDate(parcela.vencimento);
  const diasTxt =
    diasAteVencimento === 0
      ? 'vence hoje'
      : diasAteVencimento === 1
        ? 'vence amanhã'
        : `vence em ${diasAteVencimento} dias`;

  const linhas = [
    `Oi, ${primeiroNome}! 👋`,
    ``,
    `Passando para avisar que a parcela ${parcela.numero} do contrato #${venda.numero} *${diasTxt}* (${venc}).`,
    ``,
    `💰 Valor: *${valor}*`,
  ];

  if (parcela.invoiceUrl) {
    linhas.push(``, `🔗 Pagar agora: ${parcela.invoiceUrl}`);
  }

  linhas.push(``, `Atenciosamente, ${loteadora.nome}`);
  return linhas.join('\n');
}

/**
 * Mensagem genérica para abrir conversa com cliente.
 */
export function msgGenerico(loteadora: LoteadoraMsg): string {
  return `Olá! Aqui é da ${loteadora.nome}. Como posso ajudar?`;
}
