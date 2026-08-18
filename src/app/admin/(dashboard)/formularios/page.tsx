import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatDate } from '@/lib/format';
import {
  TabelaFormularios,
  type FormularioLinha,
} from '@/components/formularios/TabelaFormularios';

export const dynamic = 'force-dynamic';

export default async function FormulariosPage() {
  const tid = await tenantId();
  const where = tid ? { loteadoraId: tid } : {};

  const [formularios, novasPorForm, loteamentos] = await Promise.all([
    prisma.formulario.findMany({
      where,
      orderBy: [{ ativo: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        nome: true,
        descricao: true,
        ativo: true,
        updatedAt: true,
        loteamento: { select: { nome: true } },
        _count: { select: { respostas: true } },
      },
    }),
    prisma.formularioResposta.groupBy({
      by: ['formularioId'],
      where: { status: 'NOVA', formulario: where },
      _count: { _all: true },
    }),
    prisma.loteamento.findMany({
      where,
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, loteadora: { select: { nome: true } } },
    }),
  ]);

  const novasMap = new Map(novasPorForm.map((r) => [r.formularioId, r._count._all]));

  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  const linhas: FormularioLinha[] = formularios.map((f) => ({
    id: f.id,
    slug: f.slug,
    nome: f.nome,
    descricao: f.descricao,
    loteamentoNome: f.loteamento?.nome ?? null,
    ativo: f.ativo,
    respostas: f._count.respostas,
    novas: novasMap.get(f.id) ?? 0,
    // A data vira texto aqui; o campo AAAA-MM-DD ao lado é só para ordenar.
    atualizado: `${f.updatedAt.getFullYear()}-${doisDigitos(f.updatedAt.getMonth() + 1)}-${doisDigitos(f.updatedAt.getDate())}`,
    atualizadoLabel: formatDate(f.updatedAt),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Formulários</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Formulários públicos para captar dados e documentos dos clientes.
        </p>
      </div>

      <TabelaFormularios
        formularios={linhas}
        loteamentos={loteamentos.map((l) => ({
          id: l.id,
          nome: l.nome,
          loteadoraNome: l.loteadora?.nome,
        }))}
      />
    </div>
  );
}
