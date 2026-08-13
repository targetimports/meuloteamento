import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { acharLeadRecente, enriquecerLead } from '@/lib/lead-dedup';
import { mudarStatusLote, lockLote } from '@/lib/lote-status';

export const runtime = 'nodejs';

const schema = z.object({
  loteId: z.string().min(1),
  nome: z.string().trim().min(2),
  cpfCnpj: z.string().trim().min(11),
  email: z.string().trim().toLowerCase().email(),
  telefone: z.string().trim().min(8),
  mensagem: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { loteId, nome, cpfCnpj, email, telefone, mensagem } = parsed.data;
  const cpfClean = cpfCnpj.replace(/\D/g, '');
  if (cpfClean.length !== 11 && cpfClean.length !== 14) {
    return NextResponse.json({ ok: false, error: 'CPF/CNPJ inválido' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock pessimista do lote
      const lote = await lockLote(tx, loteId);
      if (!lote) throw new Error('Lote não encontrado');
      if (lote.status !== 'DISPONIVEL') {
        throw new Error('Este lote já foi reservado por outra pessoa. Escolha outro.');
      }

      // Loteamento (pra ler reservaMinutos)
      const loteamento = await tx.loteamento.findFirst({
        where: { lotes: { some: { id: loteId } } },
        select: { slug: true, reservaMinutos: true, id: true },
      });
      const minutos = loteamento?.reservaMinutos ?? 15;

      // Encontra ou cria cliente
      const existingByCpf = await tx.cliente.findUnique({ where: { cpfCnpj: cpfClean } });
      let clienteId: string;

      if (existingByCpf) {
        await tx.cliente.update({
          where: { id: existingByCpf.id },
          data: { nome, telefone, email },
        });
        clienteId = existingByCpf.id;
      } else {
        const existingByEmail = await tx.cliente.findUnique({ where: { email } });
        if (existingByEmail) {
          throw new Error(
            'Já existe um cadastro com este e-mail mas com CPF diferente. Verifique seus dados.'
          );
        }
        const novo = await tx.cliente.create({
          data: { nome, cpfCnpj: cpfClean, email, telefone },
        });
        clienteId = novo.id;
      }

      // Cancela qualquer reserva ativa anterior (defensivo)
      await tx.reserva.updateMany({
        where: { loteId, status: 'ATIVA' },
        data: { status: 'CANCELADA' },
      });

      const expiraEm = new Date(Date.now() + minutos * 60_000);
      const reserva = await tx.reserva.create({
        data: { loteId, clienteId, status: 'ATIVA', expiraEm },
      });

      await mudarStatusLote({
        loteId,
        novoStatus: 'RESERVADO',
        motivo: `Reservado por ${nome} (CPF ${cpfClean})${mensagem ? ` — ${mensagem}` : ''}`,
        userType: 'CLIENTE',
        tx,
      });

      // Lead para follow-up — reaproveitando o que ja existe deste contato.
      // Quem pediu informacao ontem e reserva hoje e a mesma pessoa: dois
      // registros fariam o funil contar dois interessados onde ha um, e o
      // corretor abordaria de novo quem ja avancou sozinho.
      if (loteamento) {
        const dadosLead = {
          nome,
          email,
          telefone,
          mensagem: mensagem || `Reservou o lote ${lote.id}`,
          origem: 'reserva',
        };
        const jaExiste = await acharLeadRecente({
          loteamentoId: loteamento.id,
          email,
          telefone,
        });
        if (jaExiste) {
          await enriquecerLead(jaExiste, { ...dadosLead, tx });
          await tx.lead.update({
            where: { id: jaExiste.id },
            data: { status: 'EM_ATENDIMENTO', loteId, temperatura: 'QUENTE' },
          });
        } else {
          await tx.lead.create({
            data: {
              ...dadosLead,
              loteamentoId: loteamento.id,
              loteId,
              status: 'EM_ATENDIMENTO',
              temperatura: 'QUENTE',
            },
          });
        }
      }

      return { reservaId: reserva.id, expiraEm, slug: loteamento?.slug };
    });

    if (result.slug) {
      revalidatePath(`/${result.slug}`);
    }

    return NextResponse.json({
      ok: true,
      reservaId: result.reservaId,
      expiraEm: result.expiraEm.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao reservar';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
