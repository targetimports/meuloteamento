import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { tenantId, whereClienteDaLoteadora } from '@/lib/tenant';
import { formatCpfCnpj, formatPhone, formatDateTime } from '@/lib/format';
import { TabelaClientes, type ClienteLinha } from '@/components/clientes/TabelaClientes';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const tid = await tenantId();

  /**
   * A lista vai inteira para a tela, e é lá que se filtra e ordena.
   *
   * O teto existe só como rede: hoje são dezenas de clientes por empresa, e
   * mandar tudo é mais barato que uma consulta por tecla digitada. Se um dia
   * uma empresa passar disso, o recorte precisa voltar para o banco — como já
   * é no financeiro, onde são milhares de parcelas.
   */
  const clientes = await prisma.cliente.findMany({
    where: whereClienteDaLoteadora(tid),
    orderBy: { createdAt: 'desc' },
    take: 2000,
    include: {
      _count: { select: { vendas: true, reservas: true } },
      vendas: {
        where: tid ? { lote: { loteamento: { loteadoraId: tid } } } : {},
        select: { valorTotal: true },
      },
    },
  });

  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  const linhas: ClienteLinha[] = clientes.map((c) => ({
    id: c.id,
    nome: c.nome,
    email: c.email,
    cpfCnpj: c.cpfCnpj,
    cpfLabel: formatCpfCnpj(c.cpfCnpj),
    telefone: c.telefone,
    telefoneLabel: formatPhone(c.telefone),
    vendas: c._count.vendas,
    reservas: c._count.reservas,
    totalComprado: c.vendas.reduce((acc, v) => acc + Number(v.valorTotal), 0),
    // A data vira texto aqui: formatada no navegador, o cadastro da meia-noite
    // apareceria no dia anterior para quem está a oeste de Greenwich.
    cadastro: `${c.createdAt.getFullYear()}-${doisDigitos(c.createdAt.getMonth() + 1)}-${doisDigitos(c.createdAt.getDate())}`,
    cadastroLabel: formatDateTime(c.createdAt),
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Compradores e interessados {tid ? 'da sua loteadora' : 'da plataforma'} ·{' '}
            <strong className="font-medium text-slate-700 dark:text-slate-300">
              {linhas.length}
            </strong>{' '}
            cadastrado(s)
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Novo cliente
        </Link>
      </div>

      <TabelaClientes clientes={linhas} />
    </div>
  );
}
