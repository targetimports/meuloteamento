import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { ClienteForm } from '@/components/ClienteForm';
import { atualizarCliente } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditarClientePage({
  params,
}: {
  params: { id: string };
}) {
  const tid = await tenantId();
  const cliente = await prisma.cliente.findUnique({ where: { id: params.id } });
  if (!cliente) notFound();

  // Tenants só editam quem tem vinculo
  if (tid) {
    const vinculo = await prisma.cliente.findFirst({
      where: {
        id: cliente.id,
        OR: [
          { vendas: { some: { lote: { loteamento: { loteadoraId: tid } } } } },
          { reservas: { some: { lote: { loteamento: { loteadoraId: tid } } } } },
        ],
      },
      select: { id: true },
    });
    if (!vinculo) notFound();
  }

  const updateAction = atualizarCliente.bind(null, cliente.id);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/admin/clientes/${cliente.id}`}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ← {cliente.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          Editar cliente
        </h1>
      </div>

      <ClienteForm
        action={updateAction}
        submitLabel="Salvar alterações"
        initial={{
          nome: cliente.nome,
          email: cliente.email,
          cpfCnpj: cliente.cpfCnpj,
          telefone: cliente.telefone,
          rg: cliente.rg,
          dataNascimento: cliente.dataNascimento
            ? cliente.dataNascimento.toISOString().slice(0, 10)
            : null,
          nacionalidade: cliente.nacionalidade,
          estadoCivil: cliente.estadoCivil,
          profissao: cliente.profissao,
          cep: cliente.cep,
          logradouro: cliente.logradouro,
          numero: cliente.numero,
          complemento: cliente.complemento,
          bairro: cliente.bairro,
          cidade: cliente.cidade,
          estado: cliente.estado,
          aceitaWhatsApp: cliente.aceitaWhatsApp,
          aceitaEmail: cliente.aceitaEmail,
        }}
      />
    </div>
  );
}
