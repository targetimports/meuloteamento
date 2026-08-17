import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CorretorForm } from '@/components/CorretorForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { atualizarCorretor, excluirCorretor } from '../actions';
import { whereLoteadora } from '@/lib/tenant';
import { formatDate } from '@/lib/format';
import {
  ComissoesDoCorretor,
  type VendaComissaoLinha,
} from '@/components/corretores/ComissoesDoCorretor';

export const dynamic = 'force-dynamic';

export default async function EditCorretorPage({ params }: { params: { id: string } }) {
  // findFirst com o filtro da loteadora, e nao findUnique pelo id: assim um
  // admin nao abre o corretor de outra empresa sabendo o id.
  const corretor = await prisma.corretor.findFirst({
    where: { id: params.id, ...(await whereLoteadora()) },
    include: { _count: { select: { vendas: true, leads: true } } },
  });
  if (!corretor) notFound();

  /**
   * Vendas deste corretor, com TODAS as comissões de cada uma.
   *
   * As comissões vêm sem filtro de corretor de propósito: numa troca, as
   * parcelas já liberadas ficam com quem vendeu antes. Sem elas o total da
   * venda apareceria menor do que é, e o ajuste de valor — que trabalha sobre
   * a venda inteira — mostraria um piso errado.
   */
  const vendas = await prisma.venda.findMany({
    where: { corretorId: corretor.id },
    orderBy: { dataContrato: 'desc' },
    select: {
      id: true,
      numero: true,
      dataContrato: true,
      valorTotal: true,
      status: true,
      cliente: { select: { nome: true } },
      lote: { select: { codigo: true, loteamento: { select: { nome: true } } } },
      comissaoParcelas: {
        orderBy: { numero: 'asc' },
        select: {
          id: true,
          numero: true,
          valor: true,
          status: true,
          liberadaEm: true,
          pagaEm: true,
          corretorId: true,
          corretor: { select: { nome: true } },
        },
      },
    },
  });

  const linhasVendas: VendaComissaoLinha[] = vendas.map((v) => {
    const parcelas = v.comissaoParcelas;
    const doCorretor = parcelas.filter((p) => p.corretorId === corretor.id);
    const soma = (lista: typeof parcelas) => lista.reduce((s, p) => s + Number(p.valor), 0);
    return {
      id: v.id,
      numero: v.numero,
      data: v.dataContrato.toISOString(),
      dataLabel: formatDate(v.dataContrato),
      loteCodigo: v.lote.codigo,
      loteamentoNome: v.lote.loteamento.nome,
      clienteNome: v.cliente.nome,
      valorVenda: Number(v.valorTotal),
      statusVenda: v.status,
      comissaoDoCorretor: soma(doCorretor.filter((p) => p.status !== 'CANCELADA')),
      comissaoTotal: soma(parcelas.filter((p) => p.status !== 'CANCELADA')),
      comprometido: soma(parcelas.filter((p) => p.status === 'PAGA' || p.status === 'LIBERADA')),
      bloqueadas: parcelas.filter((p) => p.status === 'BLOQUEADA').length,
      liberadas: parcelas.filter((p) => p.status === 'LIBERADA').length,
      pagas: parcelas.filter((p) => p.status === 'PAGA').length,
      // Venda fechada não tem mais comissão a mexer, e não há bloqueada onde
      // acomodar a diferença.
      podeAjustar:
        (v.status === 'ATIVA' || v.status === 'INADIMPLENTE') &&
        parcelas.some((p) => p.status === 'BLOQUEADA'),
      parcelas: parcelas.map((p) => ({
        id: p.id,
        numero: p.numero,
        valor: Number(p.valor),
        status: p.status,
        liberadaEmLabel: p.liberadaEm ? formatDate(p.liberadaEm) : null,
        pagaEmLabel: p.pagaEm ? formatDate(p.pagaEm) : null,
        desteCorretor: p.corretorId === corretor.id,
        corretorNome: p.corretor.nome,
      })),
    };
  });

  const updateAction = atualizarCorretor.bind(null, corretor.id);
  const deleteAction = async () => {
    'use server';
    await excluirCorretor(corretor.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/corretores" className="text-sm text-slate-500 hover:text-slate-700">
          ← Corretores
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{corretor.nome}</h1>
        <p className="text-sm text-slate-500">
          {corretor._count.vendas} venda(s) · {corretor._count.leads} lead(s)
        </p>
      </div>

      <CorretorForm
        action={updateAction}
        submitLabel="Salvar alterações"
        initial={{
          nome: corretor.nome,
          email: corretor.email,
          telefone: corretor.telefone,
          cpfCnpj: corretor.cpfCnpj,
          creci: corretor.creci,
          comissaoPadrao: Number(corretor.comissaoPadrao),
          ativo: corretor.ativo,
          observacoes: corretor.observacoes,
        }}
      />

      <ComissoesDoCorretor vendas={linhasVendas} />

      {corretor._count.vendas === 0 && (
        <section className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="font-semibold text-red-900 mb-1">Zona perigosa</h2>
          <p className="text-sm text-red-700 mb-3">
            Excluir o corretor é irreversível. Se já houver vendas vinculadas, prefira inativar.
          </p>
          <form action={deleteAction}>
            <ConfirmButton
              message="Excluir o corretor?"
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Excluir corretor
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}
