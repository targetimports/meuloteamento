/**
 * Resolve um cliente a partir de CPF/CNPJ: acha o existente ou cria.
 *
 * Vive aqui porque o mesmo caminho passou a existir em dois lugares — o
 * lançamento da venda e o cadastro rápido pelo combobox de comprador. Duas
 * cópias divergiriam justamente nas partes que não são óbvias: o CPF é a chave
 * de identidade, o e-mail é único no banco e nem sempre é informado, e o
 * placeholder gerado para quem não tem e-mail precisa ser único também.
 */

import { prisma } from './prisma';

export type ResultadoCliente = { ok: true; id: string } | { ok: false; erro: string };

export async function resolverClientePorCpf(input: {
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email?: string | null;
}): Promise<ResultadoCliente> {
  const nome = input.nome?.trim();
  const telefone = input.telefone?.trim();
  const cpfClean = (input.cpfCnpj ?? '').replace(/\D/g, '');

  if (!nome || !cpfClean || !telefone) {
    return { ok: false, erro: 'Informe nome, CPF e telefone.' };
  }
  if (cpfClean.length !== 11 && cpfClean.length !== 14) {
    return { ok: false, erro: 'CPF/CNPJ inválido' };
  }

  const existente = await prisma.cliente.findUnique({ where: { cpfCnpj: cpfClean } });

  if (existente) {
    // Evita conflito de email: só troca pelo novo se ele NÃO estiver em uso
    // por outro cliente. Senão mantém o que estava, em silêncio — o cadastro
    // do cliente não é o assunto de quem está lançando uma venda.
    let emailParaUsar: string | null = existente.email;
    const novoEmail = (input.email || '').trim().toLowerCase();
    if (novoEmail && novoEmail !== existente.email) {
      const conflito = await prisma.cliente.findUnique({
        where: { email: novoEmail },
        select: { id: true },
      });
      if (!conflito || conflito.id === existente.id) emailParaUsar = novoEmail;
    }

    await prisma.cliente.update({
      where: { id: existente.id },
      data: { nome, telefone, email: emailParaUsar ?? existente.email },
    });
    return { ok: true, id: existente.id };
  }

  // Resolve um email único — senão o Prisma estoura P2002 e o admin recebe um
  // erro genérico que não diz o que fazer.
  let emailEscolhido = (input.email || '').trim().toLowerCase();
  if (emailEscolhido) {
    const conflito = await prisma.cliente.findUnique({
      where: { email: emailEscolhido },
      select: { id: true, cpfCnpj: true },
    });
    if (conflito) {
      return {
        ok: false,
        erro:
          `O e-mail "${emailEscolhido}" já está cadastrado para outro cliente ` +
          `(CPF ${conflito.cpfCnpj}). Use um e-mail diferente ou deixe em branco.`,
      };
    }
  } else {
    // Sem email informado, gera um placeholder a partir do CPF. Se já existir
    // (recadastro), acrescenta o horário para garantir a unicidade.
    emailEscolhido = `${cpfClean}@semcontato.local`;
    const jaExiste = await prisma.cliente.findUnique({
      where: { email: emailEscolhido },
      select: { id: true },
    });
    if (jaExiste) emailEscolhido = `${cpfClean}.${Date.now()}@semcontato.local`;
  }

  try {
    const novo = await prisma.cliente.create({
      data: { nome, cpfCnpj: cpfClean, telefone, email: emailEscolhido },
    });
    return { ok: true, id: novo.id };
  } catch (e) {
    // Corrida: alguém criou este cliente em paralelo entre a checagem e o
    // insert. Mensagem clara em vez do digest genérico do Next.
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      erro:
        'Não foi possível criar o cliente (provável duplicidade de e-mail ou CPF). ' +
        `Detalhe: ${msg.split('\n')[0]}`,
    };
  }
}
