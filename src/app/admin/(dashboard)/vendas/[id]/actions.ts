'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, requireAdmin } from '@/lib/tenant';
import { mudarStatusLote } from '@/lib/lote-status';
import { deletePayment, updatePayment, AsaasError } from '@/lib/asaas';
import { getLoteadoraAsaasContext } from '@/lib/asaas-context';
import { cancelarComissoesDaVenda } from '@/lib/comissao';

type StatusVendaFinal = 'CANCELADA' | 'DISTRATADA';

/**
 * Distrato/cancelamento de venda:
 *  1. Marca a venda com o status final (CANCELADA ou DISTRATADA)
 *  2. Cancela todas as parcelas que ainda estão PENDENTES ou ATRASADAS
 *  3. Devolve o lote para o status escolhido (default: DISPONIVEL)
 *  4. Registra histórico na auditoria do lote
 *
 *  Idempotente: se a venda já estiver finalizada, falha graciosamente.
 */
export async function distratarVenda(
  vendaId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin();

  const motivo = String(formData.get('motivo') || '').trim();
  const tipoStatus = (String(formData.get('tipoStatus') || 'DISTRATADA') as StatusVendaFinal);
  const novoStatusLote = String(formData.get('novoStatusLote') || 'DISPONIVEL') as
    | 'DISPONIVEL'
    | 'RESERVADO'
    | 'BLOQUEADO';

  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: { lote: { include: { loteamento: { select: { slug: true, loteadoraId: true } } } } },
  });
  if (!venda) throw new Error('Venda não encontrada');
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para esta venda');
  }
  if (venda.status === 'CANCELADA' || venda.status === 'DISTRATADA') {
    throw new Error('Esta venda já foi finalizada (' + venda.status + ').');
  }

  // 1) ANTES de cancelar localmente: deletar TODAS as cobranças em aberto no Asaas
  //    para que o cliente não consiga mais pagar PIX/boleto de uma venda cancelada.
  const parcelasAbertas = await prisma.parcela.findMany({
    where: {
      vendaId,
      status: { in: ['PENDENTE', 'ATRASADO'] },
      asaasPaymentId: { not: null },
    },
    select: { id: true, asaasPaymentId: true, numero: true },
  });

  if (parcelasAbertas.length > 0) {
    const ctx = await getLoteadoraAsaasContext(venda.lote.loteamento.loteadoraId);
    if (ctx) {
      for (const p of parcelasAbertas) {
        if (!p.asaasPaymentId) continue;
        try {
          await deletePayment(ctx, p.asaasPaymentId);
        } catch (err) {
          // 404/400 = já deletado/inexistente — segue o jogo.
          // Outros erros: loga mas NÃO aborta o distrato (a cobrança ainda pode ser
          // cancelada manualmente no painel Asaas).
          if (
            !(err instanceof AsaasError) ||
            (err.status !== 404 && err.status !== 400)
          ) {
            console.warn(
              `[distratarVenda] falha ao deletar PIX ${p.asaasPaymentId} (parcela ${p.numero}):`,
              err
            );
          }
        }
      }
    } else {
      console.warn(
        `[distratarVenda] loteadora ${venda.lote.loteamento.loteadoraId} sem ctx Asaas — não foi possível deletar ${parcelasAbertas.length} cobrança(s) em aberto`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // Atualiza venda
    await tx.venda.update({
      where: { id: vendaId },
      data: {
        status: tipoStatus,
        observacoes:
          (venda.observacoes ? venda.observacoes + '\n\n' : '') +
          `[${new Date().toLocaleDateString('pt-BR')}] ${tipoStatus} por ${session.email}` +
          (motivo ? ` — ${motivo}` : ''),
      },
    });

    // Cancela parcelas em aberto
    await tx.parcela.updateMany({
      where: {
        vendaId,
        status: { in: ['PENDENTE', 'ATRASADO'] },
      },
      data: { status: 'CANCELADO' },
    });

    // Libera o lote
    await mudarStatusLote({
      loteId: venda.loteId,
      novoStatus: novoStatusLote,
      motivo:
        novoStatusLote === 'BLOQUEADO'
          ? motivo || `Bloqueado após ${tipoStatus.toLowerCase()} do contrato #${venda.numero}`
          : `Liberado após ${tipoStatus.toLowerCase()} do contrato #${venda.numero}`,
      userId: session.sub,
      userType: 'ADMIN',
      tx,
    });
  });

  // Cancela comissões pendentes do corretor (BLOQUEADA/LIBERADA → CANCELADA).
  // Comissões já pagas (status PAGA) são preservadas.
  await cancelarComissoesDaVenda(vendaId);

  revalidatePath(`/admin/vendas/${vendaId}`);
  revalidatePath('/admin/vendas');
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin/comissoes');
  revalidatePath(`/${venda.lote.loteamento.slug}`);

  redirect(`/admin/vendas?msg=distratada`);
}

/**
 * Reajusta as parcelas PENDENTES/ATRASADAS de uma venda por um índice (%).
 * Útil para aplicar IPCA/IGP-M anualmente.
 *
 * O percentual é cumulativo sobre o valor atual: novo = atual * (1 + pct/100).
 * Idempotente apenas no sentido de não tocar em parcelas pagas/canceladas.
 */
export async function reajustarParcelas(
  vendaId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin();

  const pctStr = String(formData.get('percentual') || '0').replace(',', '.');
  const indice = String(formData.get('indice') || 'IPCA').trim().toUpperCase();
  const pct = parseFloat(pctStr);

  if (!isFinite(pct) || pct === 0) {
    throw new Error('Percentual inválido. Informe um número diferente de zero.');
  }
  if (Math.abs(pct) > 50) {
    throw new Error('Reajuste acima de 50% bloqueado por segurança. Confirme o índice.');
  }

  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: {
      lote: { include: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) throw new Error('Venda não encontrada');
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão.');
  }
  if (venda.status === 'CANCELADA' || venda.status === 'DISTRATADA' || venda.status === 'QUITADA') {
    throw new Error('Venda finalizada não pode ser reajustada.');
  }

  const fator = 1 + pct / 100;

  const result = await prisma.$transaction(async (tx) => {
    const parcelas = await tx.parcela.findMany({
      where: { vendaId, status: { in: ['PENDENTE', 'ATRASADO'] } },
      select: { id: true, valor: true },
    });

    for (const p of parcelas) {
      const novo = Number(p.valor) * fator;
      await tx.parcela.update({
        where: { id: p.id },
        data: { valor: novo.toFixed(2) },
      });
    }

    // Anota no histórico via observação da venda
    await tx.venda.update({
      where: { id: vendaId },
      data: {
        observacoes:
          (venda.observacoes ? venda.observacoes + '\n\n' : '') +
          `[${new Date().toLocaleDateString('pt-BR')}] Reajuste de ${pct.toFixed(2)}% (${indice}) aplicado em ${parcelas.length} parcela(s) por ${session.email}.`,
      },
    });

    return parcelas.length;
  });

  revalidatePath(`/admin/vendas/${vendaId}`);
  revalidatePath('/admin/financeiro');

  // Não dá pra mandar query string num redirect via server action chamado por <form action>?
  // Vamos só revalidar e deixar a UI mostrar o resultado novo.
  redirect(`/admin/vendas/${vendaId}?msg=reajustada&n=${result}`);
}

/**
 * Troca/adiciona/remove o corretor de uma venda já criada.
 *
 * Comportamento com COMISSÕES existentes:
 *   - Comissões PAGAS  → preservadas (já saiu dinheiro)
 *   - Comissões LIBERADAS → preservadas (compromisso pendente — admin decide
 *                          se quer estornar antes)
 *   - Comissões BLOQUEADAS → reatribuídas ao novo corretor (ou canceladas
 *                          se o novo for null/removeu)
 *
 * Idempotente: se o corretor for o mesmo, retorna sem alterações.
 */
export async function mudarCorretorVenda(
  vendaId: string,
  novoCorretorId: string | null,
  motivo?: string,
): Promise<void> {
  const session = await requireAdmin();

  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: {
      corretor: { select: { id: true, nome: true } },
      lote: {
        include: {
          loteamento: { select: { loteadoraId: true, slug: true } },
        },
      },
      comissaoParcelas: { select: { id: true, status: true, valor: true } },
    },
  });
  if (!venda) throw new Error('Venda não encontrada');
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) {
    throw new Error('Sem permissão para esta venda');
  }

  // Mesmo corretor? Não faz nada.
  const atualId = venda.corretorId ?? null;
  if (atualId === novoCorretorId) return;

  // Valida que o novo corretor existe e pertence à mesma loteadora
  // (corretores são compartilhados nesse modelo, mas validamos pra evitar erro)
  let novoNome: string | null = null;
  if (novoCorretorId) {
    const novo = await prisma.corretor.findUnique({
      where: { id: novoCorretorId },
      select: { id: true, nome: true, ativo: true },
    });
    if (!novo) throw new Error('Novo corretor não encontrado');
    if (!novo.ativo) throw new Error('Esse corretor está inativo');
    novoNome = novo.nome;
  }

  const nomeAntigo = venda.corretor?.nome ?? '(sem corretor)';
  const nomeNovo = novoNome ?? '(sem corretor)';

  // Identifica comissões a reatribuir / cancelar
  const bloqueadas = venda.comissaoParcelas.filter((c) => c.status === 'BLOQUEADA');
  const liberadas = venda.comissaoParcelas.filter((c) => c.status === 'LIBERADA');

  await prisma.$transaction(async (tx) => {
    // 1) Atualiza o corretor da venda + anota no histórico
    const obsNova =
      (venda.observacoes ? venda.observacoes + '\n\n' : '') +
      `[${new Date().toLocaleDateString('pt-BR')}] Corretor: ${nomeAntigo} → ${nomeNovo} (por ${session.email})` +
      (motivo ? ` — ${motivo}` : '');

    await tx.venda.update({
      where: { id: vendaId },
      data: {
        corretorId: novoCorretorId,
        observacoes: obsNova,
      },
    });

    // 2) Comissões BLOQUEADAS → reatribuir pro novo corretor (ou cancelar se removeu)
    if (bloqueadas.length > 0) {
      if (novoCorretorId) {
        await tx.comissaoParcela.updateMany({
          where: {
            id: { in: bloqueadas.map((c) => c.id) },
          },
          data: { corretorId: novoCorretorId },
        });
      } else {
        // Sem novo corretor → cancela as bloqueadas
        await tx.comissaoParcela.updateMany({
          where: {
            id: { in: bloqueadas.map((c) => c.id) },
          },
          data: { status: 'CANCELADA' },
        });
      }
    }

    // 3) Comissões LIBERADAS — preservam corretor antigo (compromisso pendente)
    //    mas anota observação se houver
    if (liberadas.length > 0 && atualId) {
      const valorLiberado = liberadas.reduce((s, c) => s + Number(c.valor), 0);
      await tx.comissaoParcela.updateMany({
        where: { id: { in: liberadas.map((c) => c.id) } },
        data: {
          observacoes:
            `Corretor original mantido nesta comissão (já liberada). ` +
            `Corretor da venda agora é ${nomeNovo}. ` +
            `Valor pendente: ${valorLiberado.toFixed(2)}`,
        },
      });
    }
  });

  revalidatePath(`/admin/vendas/${vendaId}`);
  revalidatePath('/admin/vendas');
  revalidatePath('/admin/comissoes');
}

/**
 * Troca a forma de pagamento das parcelas ainda em aberto entre Pix e boleto.
 *
 * POR QUE ISTO EXISTE: a forma escolhida no fechamento da venda define o que o
 * Asaas emite. Venda em PARCELADO_PIX nunca gera PDF de boleto — quem pedia o
 * boleto depois recebia a página de pagamento do Asaas, que não é a mesma
 * coisa. Antes disso, a única saída era refazer a venda.
 *
 * O QUE É PRESERVADO, e por quê:
 *
 *  - Parcelas PAGAS e CANCELADAS não são tocadas. Mudar a forma do que já foi
 *    pago reescreveria o histórico do que de fato aconteceu.
 *  - A forma da VENDA também muda, para que parcelas geradas depois sigam a
 *    nova escolha. Sem isso, a venda diria uma coisa e as parcelas outra.
 *
 * O EFEITO EXTERNO, que é o cuidado central: parcela que já tem cobrança no
 * Asaas precisa ter a cobrança REFEITA — o tipo não é editável lá. A cobrança
 * antiga é excluída e os campos do Asaas são limpos; a régua emite a nova no
 * formato certo. Consequência inevitável: qualquer link ou Pix copia-e-cola já
 * enviado ao cliente daquela parcela deixa de funcionar. Por isso a tela avisa
 * quantas cobranças serão refeitas antes de confirmar.
 *
 * Se a exclusão no Asaas falhar (cobrança já paga ou em processamento), a
 * parcela é deixada como está e segue para a próxima: derrubar a operação
 * inteira por causa de uma parcela seria pior que trocar as demais.
 */
export interface TrocaFormaResult {
  ok?: boolean;
  error?: string;
  alteradas?: number;
  mantidas?: number;
}

export async function mudarFormaPagamentoParcelas(
  vendaId: string,
  nova: string
): Promise<TrocaFormaResult> {
  const session = await requireAdmin();

  if (nova !== 'PARCELADO_PIX' && nova !== 'PARCELADO_BOLETO') {
    return { error: 'Forma de pagamento inválida. Use Pix ou boleto.' };
  }

  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: {
      lote: { include: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) return { error: 'Venda não encontrada.' };
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) {
    return { error: 'Sem permissão.' };
  }
  if (venda.status === 'CANCELADA' || venda.status === 'DISTRATADA') {
    return { error: 'Venda finalizada não pode ter a forma de pagamento alterada.' };
  }

  const emAberto = await prisma.parcela.findMany({
    where: { vendaId, status: { in: ['PENDENTE', 'ATRASADO'] } },
    select: { id: true, numero: true, asaasPaymentId: true, asaasInvoiceUrl: true },
  });

  if (emAberto.length === 0) {
    return { error: 'Não há parcelas em aberto para alterar.' };
  }

  // Primeiro o Asaas, depois o banco: se a exclusão lá falhar, o banco ainda
  // não foi alterado e o estado dos dois lados continua coerente.
  const ctx = await getLoteadoraAsaasContext(venda.lote.loteamento.loteadoraId);
  const refeitas: string[] = [];
  const naoRefeitas: number[] = [];

  for (const p of emAberto) {
    if (!p.asaasPaymentId) continue;

    if (ctx) {
      try {
        await deletePayment(ctx, p.asaasPaymentId);
        refeitas.push(p.id);
      } catch (e) {
        // Cobrança paga ou em processamento não pode ser excluída no Asaas.
        // Deixa a parcela intacta em vez de criar divergência entre os dois.
        if (e instanceof AsaasError || e instanceof Error) {
          naoRefeitas.push(p.numero);
          continue;
        }
        throw e;
      }
    } else {
      // Sem chave configurada não há o que excluir; limpa os campos locais
      // para a régua reemitir quando a integração voltar.
      refeitas.push(p.id);
    }
  }

  const idsParaTrocar = emAberto
    .filter((p) => !naoRefeitas.includes(p.numero))
    .map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    await tx.parcela.updateMany({
      where: { id: { in: idsParaTrocar } },
      data: {
        formaPagamento: nova,
        // Zera o vínculo com a cobrança antiga: a régua reemite no formato
        // novo porque garantirCobranca só reaproveita quando há invoiceUrl.
        asaasPaymentId: null,
        asaasInvoiceUrl: null,
        asaasBoletoUrl: null,
        asaasPixCode: null,
        asaasPixQrCode: null,
      },
    });

    await tx.venda.update({
      where: { id: vendaId },
      data: {
        formaPagamento: nova,
        observacoes:
          (venda.observacoes ? venda.observacoes + '\n\n' : '') +
          `[${new Date().toLocaleDateString('pt-BR')}] Forma de pagamento alterada para ` +
          `${nova === 'PARCELADO_PIX' ? 'Pix' : 'Boleto'} em ${idsParaTrocar.length} parcela(s) ` +
          `em aberto por ${session.email}.` +
          (naoRefeitas.length
            ? ` Parcela(s) ${naoRefeitas.join(', ')} mantida(s): a cobrança no Asaas não pôde ser refeita.`
            : ''),
      },
    });
  });

  revalidatePath(`/admin/vendas/${vendaId}`);
  revalidatePath('/admin/financeiro');

  return { ok: true, alteradas: idsParaTrocar.length, mantidas: naoRefeitas.length };
}

export interface MudarVencimentoResult {
  ok?: boolean;
  error?: string;
  alteradas?: number;
  falharam?: number;
}

/**
 * Move o dia de vencimento das parcelas em aberto (ex.: do 21 para o 20).
 *
 * Mantém mês e ano de cada parcela e troca apenas o dia — o cronograma
 * continua o mesmo, só desloca dentro do mês. Renumerar ou empurrar meses
 * mudaria o contrato, não a conveniência de data que se pediu.
 *
 * O LIMITE DE 28 é deliberado: dia 29, 30 e 31 não existem em todo mês, e uma
 * parcela de fevereiro cairia em março sozinha. Quem precisa de "último dia do
 * mês" precisa de outra regra, não deste campo.
 *
 * NO ASAAS, atualiza em vez de recriar. A cobrança mantém o mesmo id, então o
 * boleto e o Pix que o cliente já recebeu continuam valendo — só passam a
 * vencer na data nova. Recriar seria mais simples de escrever e invalidaria o
 * que está na mão dele.
 *
 * Parcela cuja atualização no Asaas falhar (paga, em processamento, excluída)
 * fica com a data antiga: melhor uma parcela fora do padrão do que a data no
 * sistema divergindo da cobrança que o cliente tem.
 */
export async function mudarDiaVencimento(
  vendaId: string,
  dia: number
): Promise<MudarVencimentoResult> {
  const session = await requireAdmin();

  if (!Number.isInteger(dia) || dia < 1 || dia > 28) {
    return { error: 'Escolha um dia entre 1 e 28. Dias 29 a 31 não existem em todos os meses.' };
  }

  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: { lote: { include: { loteamento: { select: { loteadoraId: true } } } } },
  });
  if (!venda) return { error: 'Venda não encontrada.' };
  if (!(await canAccessLoteamento(venda.lote.loteamento.loteadoraId))) {
    return { error: 'Sem permissão.' };
  }
  if (venda.status === 'CANCELADA' || venda.status === 'DISTRATADA') {
    return { error: 'Venda finalizada não pode ter vencimentos alterados.' };
  }

  const emAberto = await prisma.parcela.findMany({
    where: { vendaId, status: { in: ['PENDENTE', 'ATRASADO'] } },
    select: { id: true, numero: true, vencimento: true, asaasPaymentId: true },
    orderBy: { numero: 'asc' },
  });
  if (emAberto.length === 0) {
    return { error: 'Não há parcelas em aberto para alterar.' };
  }

  const ctx = await getLoteadoraAsaasContext(venda.lote.loteamento.loteadoraId);
  let alteradas = 0;
  let falharam = 0;

  for (const p of emAberto) {
    const atual = p.vencimento;
    if (atual.getDate() === dia) continue; // já está no dia pedido

    // Meio-dia: evita que o fuso empurre a data para o dia anterior ao gravar.
    const nova = new Date(atual.getFullYear(), atual.getMonth(), dia, 12, 0, 0);
    const novaISO = nova.toISOString().slice(0, 10);

    // Asaas primeiro: se falhar, a parcela não é tocada e o sistema continua
    // dizendo a mesma data que a cobrança na mão do cliente.
    if (p.asaasPaymentId && ctx) {
      try {
        await updatePayment(ctx, p.asaasPaymentId, { dueDate: novaISO });
      } catch {
        falharam++;
        continue;
      }
    }

    await prisma.parcela.update({
      where: { id: p.id },
      data: { vencimento: nova },
    });
    alteradas++;
  }

  if (alteradas > 0) {
    await prisma.venda.update({
      where: { id: vendaId },
      data: {
        observacoes:
          (venda.observacoes ? venda.observacoes + '\n\n' : '') +
          `[${new Date().toLocaleDateString('pt-BR')}] Vencimento alterado para o dia ${dia} ` +
          `em ${alteradas} parcela(s) em aberto por ${session.email}.` +
          (falharam
            ? ` ${falharam} parcela(s) mantiveram a data: a cobrança no Asaas não pôde ser atualizada.`
            : ''),
      },
    });
  }

  revalidatePath(`/admin/vendas/${vendaId}`);
  revalidatePath('/admin/financeiro');

  return { ok: true, alteradas, falharam };
}
