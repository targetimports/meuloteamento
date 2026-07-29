import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getClienteSession } from '@/lib/auth-cliente';

export const dynamic = 'force-dynamic';

export default async function ContratoPage({ params }: { params: { id: string } }) {
  const session = await getClienteSession();
  if (!session) redirect('/minha-conta/login');

  const venda = await prisma.venda.findFirst({
    where: { id: params.id, clienteId: session.sub },
    include: {
      lote: { include: { loteamento: true } },
    },
  });
  if (!venda) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/minha-conta" className="text-sm text-slate-500 hover:text-slate-700">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mt-2">
          Contrato — Venda #{venda.numero}
        </h1>
        <p className="text-slate-600 text-sm">
          Lote {venda.lote.codigo} — {venda.lote.loteamento.nome}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="text-sm text-slate-600 mb-2">
          Status: <span className="font-medium">{venda.contratoStatus}</span>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          {venda.contratoHtml && (
            <a
              href={`/api/cliente/contrato/${venda.id}/html`}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded"
            >
              Ver contrato
            </a>
          )}
          {venda.contratoSignerUrl && venda.contratoStatus === 'ENVIADO_ASSINATURA' && (
            <a
              href={venda.contratoSignerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
            >
              Assinar agora
            </a>
          )}
          {venda.contratoAssinadoPdfUrl && (
            <a
              href={venda.contratoAssinadoPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
            >
              Baixar contrato assinado
            </a>
          )}
        </div>

        {!venda.contratoHtml && (
          <p className="text-sm text-slate-500 mt-3">
            Seu contrato ainda está sendo preparado pela loteadora.
          </p>
        )}
      </div>
    </div>
  );
}
