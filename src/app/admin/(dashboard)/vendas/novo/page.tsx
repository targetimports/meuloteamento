import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { canAccessLoteadora, tenantId, whereClienteDaLoteadora } from '@/lib/tenant';
import { VendaForm, type PrefillCliente } from '@/components/VendaForm';
import { criarVenda } from './actions';

export const dynamic = 'force-dynamic';

function onlyDigits(s?: string | null): string {
  return (s || '').replace(/\D/g, '');
}

export default async function NovaVendaPage({
  searchParams,
}: {
  searchParams: { lote?: string; fromForm?: string };
}) {
  const tid = await tenantId();
  const tenantWhereLote = tid ? { loteamento: { loteadoraId: tid } } : {};
  const tenantWhereCorretor = tid ? { loteadoraId: tid } : {};

  const [lotes, clientes, corretores, contas] = await Promise.all([
    prisma.lote.findMany({
      where: {
        ...tenantWhereLote,
        status: { in: ['DISPONIVEL', 'RESERVADO'] },
      },
      orderBy: [{ loteamento: { nome: 'asc' } }, { quadra: 'asc' }, { numero: 'asc' }],
      take: 300,
      select: {
        id: true,
        codigo: true,
        area: true,
        preco: true,
        status: true,
        tipo: true,
        loteamento: { select: { nome: true } },
      },
    }),
    prisma.cliente.findMany({
      where: whereClienteDaLoteadora(tid),
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, nome: true, email: true, cpfCnpj: true, telefone: true },
    }),
    prisma.corretor.findMany({
      where: { ...tenantWhereCorretor, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, comissaoPadrao: true },
    }),
    prisma.contaFinanceira.findMany({
      where: tid ? { loteadoraId: tid, ativa: true } : { ativa: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, nome: true, tipo: true },
    }),
  ]);

  // ===== Pré-preenchimento a partir de FormularioResposta =====
  let prefillCliente: PrefillCliente | undefined;
  let clienteExistenteId: string | undefined;
  let loteIdInicial: string | undefined = searchParams.lote;

  if (searchParams.fromForm) {
    const resp = await prisma.formularioResposta.findUnique({
      where: { id: searchParams.fromForm },
      include: { formulario: { select: { nome: true, loteadoraId: true } } },
    });
    if (resp && (!resp.formulario.loteadoraId || (await canAccessLoteadora(resp.formulario.loteadoraId)))) {
      prefillCliente = {
        nome: resp.nome ?? undefined,
        cpfCnpj: resp.cpfCnpj ?? undefined,
        email: resp.email ?? undefined,
        telefone: resp.telefone ?? undefined,
        origemLabel: `Resposta de "${resp.formulario.nome}" recebida em ${new Date(resp.createdAt).toLocaleDateString('pt-BR')}`,
      };

      // Se cliente já existe (mesmo CPF), abre em modo "existente"
      if (resp.cpfCnpj) {
        const cpfClean = onlyDigits(resp.cpfCnpj);
        const ja = await prisma.cliente.findUnique({
          where: { cpfCnpj: cpfClean },
          select: { id: true },
        });
        if (ja) clienteExistenteId = ja.id;
      }

      // Se respondeu o lote, mapeia o código para o ID do lote disponível
      if (resp.loteCodigo && !loteIdInicial) {
        const lt = lotes.find((l) => l.codigo === resp.loteCodigo);
        if (lt) loteIdInicial = lt.id;
      }
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/vendas" className="text-sm text-slate-500 hover:text-slate-700">
          ← Vendas
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Nova venda</h1>
        <p className="text-sm text-slate-500">
          Registre uma venda manualmente (offline, via planilha, ou venda fechada por outro canal).
          Você pode optar por gerar as parcelas automaticamente ou cadastrar depois.
        </p>
      </div>

      {lotes.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-900">
          <p className="font-semibold mb-1">Nenhum lote disponível para venda</p>
          <p>Cadastre lotes em algum loteamento primeiro, ou libere lotes já vendidos via distrato.</p>
        </div>
      ) : (
        <VendaForm
          lotes={lotes.map((l) => ({
            id: l.id,
            codigo: l.codigo,
            area: Number(l.area),
            preco: Number(l.preco),
            status: l.status,
            tipo: l.tipo,
            loteamentoNome: l.loteamento.nome,
          }))}
          clientes={clientes}
          corretores={corretores.map((c) => ({
            id: c.id,
            nome: c.nome,
            comissaoPadrao: Number(c.comissaoPadrao),
          }))}
          contas={contas}
          loteIdInicial={loteIdInicial}
          prefillCliente={prefillCliente}
          clienteExistenteId={clienteExistenteId}
          action={criarVenda}
        />
      )}
    </div>
  );
}
