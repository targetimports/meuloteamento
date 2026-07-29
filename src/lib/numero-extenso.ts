/**
 * Converte número em texto por extenso (português brasileiro).
 * Suporta inteiros até bilhões e valores em Real (centavos).
 */

const unidades = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete',
  'dezoito', 'dezenove',
];

const dezenas = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta',
  'oitenta', 'noventa',
];

const centenas = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos',
];

function ateMil(n: number): string {
  if (n === 0) return '';
  if (n < 20) return unidades[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? centenas[c] : `${centenas[c]} e ${ateMil(resto)}`;
}

function grupo(n: number, singular: string, plural: string): string {
  if (n === 0) return '';
  if (n === 1) return `um ${singular}`;
  return `${ateMil(n)} ${plural}`;
}

export function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const negativo = n < 0;
  n = Math.abs(Math.floor(n));

  const bilhao = Math.floor(n / 1_000_000_000);
  const milhao = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhar = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (bilhao > 0) partes.push(grupo(bilhao, 'bilhão', 'bilhões'));
  if (milhao > 0) partes.push(grupo(milhao, 'milhão', 'milhões'));
  if (milhar > 0) {
    partes.push(milhar === 1 ? 'mil' : `${ateMil(milhar)} mil`);
  }
  if (resto > 0) partes.push(ateMil(resto));

  const sep = (i: number) => {
    if (i === partes.length - 1) return '';
    return resto > 0 && resto < 100 && i === partes.length - 2 ? ' e ' : ', ';
  };

  let texto = partes.map((p, i) => p + sep(i)).join('');
  texto = texto.replace(/, $/, '').trim();
  return negativo ? `menos ${texto}` : texto;
}

export function realPorExtenso(valor: number): string {
  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);

  if (inteiro === 0 && centavos === 0) return 'zero reais';

  const partes: string[] = [];
  if (inteiro > 0) {
    partes.push(`${numeroPorExtenso(inteiro)} ${inteiro === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }
  return partes.join(' e ');
}

export function dataPorExtenso(d: Date): string {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${numeroPorExtenso(d.getDate())} de ${meses[d.getMonth()]} de ${numeroPorExtenso(d.getFullYear())}`;
}

export function metrosPorExtenso(m: number): string {
  const inteiro = Math.floor(m);
  const cent = Math.round((m - inteiro) * 100);
  if (cent === 0) {
    return `${numeroPorExtenso(inteiro)} metros`;
  }
  return `${numeroPorExtenso(inteiro)} metros e ${numeroPorExtenso(cent)} centímetros`;
}

export function metrosQuadradosPorExtenso(m: number): string {
  const inteiro = Math.floor(m);
  const cent = Math.round((m - inteiro) * 100);
  if (cent === 0) {
    return `${numeroPorExtenso(inteiro)} metros quadrados`;
  }
  return `${numeroPorExtenso(inteiro)} vírgula ${numeroPorExtenso(cent)} metros quadrados`;
}
