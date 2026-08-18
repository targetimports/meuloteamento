/**
 * Dados fictícios para pré-visualizar um modelo de contrato.
 *
 * A pré-visualização precisa disto porque o renderizador troca variável não
 * encontrada por vazio: sem contexto, o contrato apareceria com buracos no
 * lugar de nome, valor e datas — que é justamente o que se quer conferir.
 *
 * O que não tiver exemplo aqui aparece como «nome.da.variavel», e não some.
 * Assim, uma variável nova continua visível na pré-visualização até alguém
 * lhe dar um exemplo.
 */

import { availableVariables } from './template';

const EXEMPLOS: Record<string, string> = {
  'cliente.nome': 'Maria Aparecida de Souza',
  'cliente.cpfCnpj': '123.456.789-00',
  'cliente.email': 'maria.souza@email.com',
  'cliente.telefone': '(75) 99999-0000',
  'cliente.endereco': 'Rua das Palmeiras, 128, Centro, Feira de Santana/BA',
  'cliente.cep': '44001-000',
  'cliente.nacionalidade': 'Brasileira',
  'cliente.estadoCivil': 'Casada',
  'cliente.profissao': 'Professora',
  'cliente.rg': '12.345.678-9',

  'lote.codigo': 'L077',
  'lote.quadra': 'C',
  'lote.numero': '07',
  'lote.area': '250,00 m²',
  'lote.areaExtenso': 'duzentos e cinquenta metros quadrados',
  'lote.testada': '10,00',
  'lote.testadaExtenso': 'dez metros',
  'lote.fundo': '25,00',
  'lote.fundoExtenso': 'vinte e cinco metros',
  'lote.viaFrente': 'Rua das Acácias',
  'lote.ladoVia': 'ímpar',
  'lote.confrontacaoEsquerdo': 'o lote 06 da mesma quadra',
  'lote.confrontacaoDireito': 'o lote 08 da mesma quadra',
  'lote.confrontacaoFrente': 'a Rua das Acácias',
  'lote.confrontacaoFundo': 'o lote 22 da quadra D',
  'lote.matricula': '38.412',

  'loteamento.nome': 'Residencial Parque Tucano',
  'loteamento.endereco': 'Rodovia BA-052, km 12, s/n',
  'loteamento.cidade': 'Feira de Santana',
  'loteamento.estado': 'BA',
  'loteamento.cartorio': '1º Ofício de Registro de Imóveis',
  'loteamento.comarca': 'Feira de Santana',

  'venda.numero': '122',
  'venda.valorTotal': '65.000,00',
  'venda.valorTotalExtenso': 'sessenta e cinco mil reais',
  'venda.valorEntrada': '5.000,00',
  'venda.valorEntradaExtenso': 'cinco mil reais',
  'venda.valorParcela': '1.000,00',
  'venda.valorParcelaExtenso': 'mil reais',
  'venda.numeroParcelas': '60',
  'venda.numeroParcelasExtenso': 'sessenta',
  'venda.diaVencimento': '05',
  'venda.diaVencimentoExtenso': 'cinco',
  'venda.primeiroVencimento': '05/09/2026',
  'venda.primeiroVencimentoExtenso': 'cinco de setembro de dois mil e vinte e seis',
  'venda.dataContrato': '04/08/2026',
  'venda.dataContratoExtenso': 'quatro de agosto de dois mil e vinte e seis',
  'venda.taxaCorretagem': '2.500,00',
  'venda.taxaCorretagemExtenso': 'dois mil e quinhentos reais',
  'venda.descontoPontualidadePct': '5',

  'loteadora.razaoSocial': 'Loteadora Exemplo Empreendimentos Ltda.',
  'loteadora.cnpj': '12.345.678/0001-90',
  'loteadora.endereco': 'Av. Getúlio Vargas, 1000, sala 12, Centro, Feira de Santana/BA',
  'loteadora.email': 'contato@loteadora.com.br',
  'loteadora.telefone': '(75) 3333-0000',
  'loteadora.representanteNome': 'João Carlos Pereira',
  'loteadora.representanteCpf': '987.654.321-00',
  'loteadora.representanteCargo': 'Sócio Administrador',
};

/**
 * Contexto aninhado ({cliente: {nome: …}}) — a forma que `renderTemplate`
 * espera, e não o mapa achatado de cima.
 */
export function contextoDeExemplo(): Record<string, unknown> {
  const ctx: Record<string, Record<string, string>> = {};
  for (const { name } of availableVariables()) {
    const [grupo, campo] = name.split('.');
    if (!grupo || !campo) continue;
    ctx[grupo] ??= {};
    ctx[grupo][campo] = EXEMPLOS[name] ?? `«${name}»`;
  }
  return ctx;
}
