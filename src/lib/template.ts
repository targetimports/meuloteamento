/**
 * Mustache-like renderer (sem dependência externa).
 * Suporta {{a.b.c}} com escape HTML e {{{a.b.c}}} sem escape.
 */

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(template: string, ctx: Record<string, unknown>): string {
  // {{{ unescaped }}}
  let out = template.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_m, path: string) => {
    const v = get(ctx, path);
    return v == null ? '' : String(v);
  });
  // {{ escaped }}
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const v = get(ctx, path);
    return v == null ? '' : escapeHtml(String(v));
  });
  return out;
}

export function availableVariables(): { name: string; descricao: string }[] {
  return [
    { name: 'cliente.nome', descricao: 'Nome completo do cliente' },
    { name: 'cliente.cpfCnpj', descricao: 'CPF ou CNPJ formatado' },
    { name: 'cliente.email', descricao: 'E-mail do cliente' },
    { name: 'cliente.telefone', descricao: 'Telefone formatado' },
    { name: 'cliente.endereco', descricao: 'Endereço completo (logradouro, número, bairro, cidade, UF)' },
    { name: 'cliente.cep', descricao: 'CEP do cliente' },
    { name: 'cliente.nacionalidade', descricao: 'Nacionalidade (default: Brasileiro(a))' },
    { name: 'cliente.estadoCivil', descricao: 'Estado civil (Solteiro/Casado/etc.)' },
    { name: 'cliente.profissao', descricao: 'Profissão' },
    { name: 'cliente.rg', descricao: 'RG do cliente' },

    { name: 'lote.codigo', descricao: 'Código do lote (ex: A-12)' },
    { name: 'lote.quadra', descricao: 'Quadra' },
    { name: 'lote.numero', descricao: 'Número do lote' },
    { name: 'lote.area', descricao: 'Área em m² (ex: 250,00 m²)' },
    { name: 'lote.areaExtenso', descricao: 'Área por extenso (ex: duzentos e cinquenta metros quadrados)' },
    { name: 'lote.testada', descricao: 'Frente em metros (testada)' },
    { name: 'lote.testadaExtenso', descricao: 'Frente por extenso' },
    { name: 'lote.fundo', descricao: 'Profundidade da frente aos fundos' },
    { name: 'lote.fundoExtenso', descricao: 'Profundidade por extenso' },
    { name: 'lote.viaFrente', descricao: 'Nome da via onde o lote tem frente' },
    { name: 'lote.ladoVia', descricao: 'Lado da via (par/ímpar)' },
    { name: 'lote.confrontacaoEsquerdo', descricao: 'Confrontação à esquerda' },
    { name: 'lote.confrontacaoDireito', descricao: 'Confrontação à direita' },
    { name: 'lote.confrontacaoFrente', descricao: 'Confrontação à frente' },
    { name: 'lote.confrontacaoFundo', descricao: 'Confrontação aos fundos' },
    { name: 'lote.matricula', descricao: 'Número da matrícula no cartório' },

    { name: 'loteamento.nome', descricao: 'Nome do loteamento' },
    { name: 'loteamento.endereco', descricao: 'Endereço do loteamento' },
    { name: 'loteamento.cidade', descricao: 'Cidade' },
    { name: 'loteamento.estado', descricao: 'UF' },
    { name: 'loteamento.cartorio', descricao: 'Nome do Cartório de Registro de Imóveis' },
    { name: 'loteamento.comarca', descricao: 'Comarca (default = cidade)' },

    { name: 'venda.numero', descricao: 'Número da venda' },
    { name: 'venda.valorTotal', descricao: 'Valor total formatado em real (sem R$)' },
    { name: 'venda.valorTotalExtenso', descricao: 'Valor total por extenso' },
    { name: 'venda.valorEntrada', descricao: 'Entrada formatada (sem R$)' },
    { name: 'venda.valorEntradaExtenso', descricao: 'Entrada por extenso' },
    { name: 'venda.valorParcela', descricao: 'Parcela formatada (sem R$)' },
    { name: 'venda.valorParcelaExtenso', descricao: 'Valor da parcela por extenso' },
    { name: 'venda.numeroParcelas', descricao: 'Quantidade de parcelas' },
    { name: 'venda.numeroParcelasExtenso', descricao: 'Quantidade de parcelas por extenso' },
    { name: 'venda.diaVencimento', descricao: 'Dia do mês do vencimento' },
    { name: 'venda.diaVencimentoExtenso', descricao: 'Dia do vencimento por extenso' },
    { name: 'venda.primeiroVencimento', descricao: 'Data do primeiro vencimento DD/MM/YYYY' },
    { name: 'venda.primeiroVencimentoExtenso', descricao: 'Primeiro vencimento por extenso' },
    { name: 'venda.dataContrato', descricao: 'Data do contrato DD/MM/YYYY' },
    { name: 'venda.dataContratoExtenso', descricao: 'Data do contrato por extenso' },
    { name: 'venda.taxaCorretagem', descricao: 'Taxa de corretagem (sem R$)' },
    { name: 'venda.taxaCorretagemExtenso', descricao: 'Taxa de corretagem por extenso' },
    { name: 'venda.descontoPontualidadePct', descricao: 'Desconto pontualidade em %' },

    { name: 'loteadora.razaoSocial', descricao: 'Razão social da loteadora' },
    { name: 'loteadora.cnpj', descricao: 'CNPJ da loteadora' },
    { name: 'loteadora.endereco', descricao: 'Endereço da loteadora' },
    { name: 'loteadora.email', descricao: 'E-mail comercial da loteadora' },
    { name: 'loteadora.telefone', descricao: 'Telefone da loteadora' },
    { name: 'loteadora.representanteNome', descricao: 'Nome do representante legal (assinante)' },
    { name: 'loteadora.representanteCpf', descricao: 'CPF do representante legal' },
    { name: 'loteadora.representanteCargo', descricao: 'Cargo do representante (Sócio Administrador, etc.)' },

    { name: 'parcela.numero', descricao: '(Régua) Número da parcela' },
    { name: 'parcela.valor', descricao: '(Régua) Valor da parcela em R$' },
    { name: 'parcela.vencimento', descricao: '(Régua) Data de vencimento DD/MM/YYYY' },
    { name: 'parcela.pixCode', descricao: '(Régua) PIX copia-e-cola' },
    { name: 'parcela.boletoUrl', descricao: '(Régua) URL do boleto' },
    { name: 'parcela.diasAtraso', descricao: '(Régua) Dias em atraso (negativo = antes do vencimento)' },
  ];
}
