import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento, requireAdmin } from '@/lib/tenant';
import { FormSimulador } from './FormSimulador';
import { salvarParametrosSimulador } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Padrões do componente SimuladorResidencial. Repetidos aqui para a tela
 * mostrar como placeholder o que de fato vale quando o campo fica vazio —
 * em vez de deixar a pessoa adivinhar.
 */
const PADROES = {
  preco: 55000,
  entrada: 5000,
  parcelas: 60,
  valorParcela: 1000,
};

export default async function SimuladorLoteamentoPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      nome: true,
      slug: true,
      publicado: true,
      loteadoraId: true,
      simPrecoResidencial: true,
      simPrecoComercial: true,
      simEntradaMinima: true,
      simParcelas: true,
      simValorParcela: true,
      simEntradasSugeridas: true,
    },
  });
  if (!loteamento) notFound();
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) notFound();

  const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const lista = Array.isArray(loteamento.simEntradasSugeridas)
    ? (loteamento.simEntradasSugeridas as number[]).join(', ')
    : '';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/loteamentos/${loteamento.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {loteamento.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Simulador</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Os valores que o visitante vê ao simular a compra de um lote deste
          loteamento. Campo em branco usa o padrão do sistema.
        </p>
      </div>

      {/* Configurar o simulador de um loteamento fora do ar não tem efeito
          visível — dizer isso evita a impressão de que o ajuste não funcionou. */}
      {!loteamento.publicado && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          Este loteamento não está publicado, então o simulador público ainda não
          está no ar. Os valores ficam salvos e passam a valer quando você
          publicar.
        </p>
      )}

      <FormSimulador
        loteamentoId={loteamento.id}
        padroes={PADROES}
        inicial={{
          simPrecoResidencial: txt(loteamento.simPrecoResidencial),
          simPrecoComercial: txt(loteamento.simPrecoComercial),
          simEntradaMinima: txt(loteamento.simEntradaMinima),
          simParcelas: txt(loteamento.simParcelas),
          simValorParcela: txt(loteamento.simValorParcela),
          simEntradasSugeridas: lista,
        }}
        action={salvarParametrosSimulador}
      />

      {loteamento.publicado && (
        <p className="text-xs text-slate-500">
          Ver como ficou:{' '}
          <a
            href={`/simulador/${loteamento.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            /simulador/{loteamento.slug}
          </a>
        </p>
      )}
    </div>
  );
}
