import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { formatBRL, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Props {
  params: { vendaId: string };
}

async function getVenda(id: string) {
  return prisma.venda.findUnique({
    where: { id },
    include: {
      cliente: { select: { nome: true, email: true, telefone: true } },
      lote: {
        select: {
          codigo: true,
          quadra: true,
          numero: true,
          area: true,
          loteamento: {
            select: {
              nome: true,
              slug: true,
              cidade: true,
              estado: true,
              loteadora: {
                select: {
                  nome: true,
                  whatsapp: true,
                  corPrimaria: true,
                  logo: true,
                },
              },
            },
          },
        },
      },
      parcelas: {
        orderBy: { numero: 'asc' },
        take: 1, // só a primeira (entrada)
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Compra confirmada — meuloteamento',
    description: 'Sua compra foi registrada com sucesso.',
  };
}

export default async function CheckoutSucesso({ params }: Props) {
  const venda = await getVenda(params.vendaId);
  if (!venda) notFound();

  const { loteadora } = venda.lote.loteamento;
  const cor = loteadora.corPrimaria ?? '#0ea5e9';
  const primeira = venda.parcelas[0];
  const isAVista = venda.formaPagamento === 'A_VISTA';

  // Mensagem WhatsApp pra equipe acompanhar
  const wppMsg = encodeURIComponent(
    `Olá! Sou ${venda.cliente.nome} e acabei de iniciar a compra do lote ${venda.lote.codigo} no ${venda.lote.loteamento.nome} (contrato #${venda.numero}).\n\nGostaria de confirmar próximos passos.`
  );
  const wppHref = loteadora.whatsapp
    ? `https://wa.me/55${loteadora.whatsapp.replace(/\D/g, '')}?text=${wppMsg}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/${venda.lote.loteamento.slug}`} className="flex items-center gap-3">
            {loteadora.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loteadora.logo} alt={loteadora.nome} className="h-9 w-auto object-contain" />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: cor }}
              >
                {loteadora.nome.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">{loteadora.nome}</p>
              <p className="text-[11px] text-slate-500">{venda.lote.loteamento.nome}</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-12 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Hero confirmação */}
          <div
            className="rounded-3xl p-8 md:p-12 text-white shadow-2xl text-center mb-6"
            style={{ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-5xl font-black mb-2">Compra registrada! 🎉</h1>
            <p className="text-white/90 text-lg max-w-xl mx-auto">
              {venda.cliente.nome.split(' ')[0]}, sua reserva do lote{' '}
              <strong>{venda.lote.codigo}</strong> está garantida. Contrato{' '}
              <strong>#{venda.numero}</strong>.
            </p>
          </div>

          {/* Próximos passos */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Próximos passos</h2>
            <ol className="space-y-3">
              <Passo
                num={1}
                titulo={isAVista ? 'Realize o pagamento' : 'Pague a entrada'}
                texto={
                  primeira?.asaasInvoiceUrl
                    ? `Abra o link de pagamento abaixo e pague ${formatBRL(Number(primeira.valor))} até ${formatDate(primeira.vencimento)}.`
                    : 'Nossa equipe vai gerar o boleto/PIX e te enviar por WhatsApp em até 24h.'
                }
                cor={cor}
              />
              <Passo
                num={2}
                titulo="Confirmação do pagamento"
                texto="Após confirmarmos seu pagamento, você receberá o contrato de compra e venda assinado eletronicamente."
                cor={cor}
              />
              <Passo
                num={3}
                titulo="Acompanhamento mensal"
                texto={
                  isAVista
                    ? 'Após o pagamento, vamos agendar a entrega oficial do lote.'
                    : `Você receberá cada uma das ${venda.numeroParcelas} parcelas mensais por WhatsApp/e-mail, sempre próximo do vencimento.`
                }
                cor={cor}
              />
            </ol>
          </section>

          {/* CTA pagamento */}
          {primeira?.asaasInvoiceUrl && (
            <section className="bg-white border-2 rounded-2xl p-6 mb-6 shadow-lg" style={{ borderColor: cor }}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {isAVista ? 'Valor à pagar' : 'Entrada'} — vencimento{' '}
                    {formatDate(primeira.vencimento)}
                  </p>
                  <p className="text-3xl font-black mt-1" style={{ color: cor }}>
                    {formatBRL(Number(primeira.valor))}
                  </p>
                </div>
                <a
                  href={primeira.asaasInvoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-white shadow hover:scale-105 transition"
                  style={{ background: cor }}
                >
                  💳 Abrir pagamento
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0-7 7m7-7H3" />
                  </svg>
                </a>
              </div>
              {primeira.asaasPixCode && (
                <details className="mt-4 pt-4 border-t border-slate-100">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    Pagar via PIX copia-e-cola
                  </summary>
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg break-all font-mono text-xs text-slate-700">
                    {primeira.asaasPixCode}
                  </div>
                </details>
              )}
            </section>
          )}

          {/* Resumo do contrato */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">📄 Resumo do contrato</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Linha label="Contrato" valor={`#${venda.numero}`} />
              <Linha label="Lote" valor={`${venda.lote.codigo} · ${Number(venda.lote.area).toFixed(0)} m²`} />
              <Linha label="Loteamento" valor={venda.lote.loteamento.nome} />
              <Linha
                label="Localização"
                valor={`${venda.lote.loteamento.cidade}/${venda.lote.loteamento.estado}`}
              />
              <Linha label="Valor total" valor={formatBRL(Number(venda.valorTotal))} destaque />
              {!isAVista && (
                <>
                  <Linha label="Entrada" valor={formatBRL(Number(venda.valorEntrada))} />
                  <Linha
                    label="Parcelas"
                    valor={`${venda.numeroParcelas}x de ${formatBRL(Number(venda.valorParcela))}`}
                  />
                </>
              )}
              <Linha label="Forma" valor={venda.formaPagamento.replace('_', ' ')} />
            </dl>
          </section>

          {/* Dados do comprador */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">👤 Comprador</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Linha label="Nome" valor={venda.cliente.nome} />
              <Linha label="E-mail" valor={venda.cliente.email} />
              <Linha label="Telefone" valor={venda.cliente.telefone ?? '—'} />
            </dl>
          </section>

          {/* Contato com a equipe */}
          <section
            className="rounded-2xl p-6 text-center text-white"
            style={{ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }}
          >
            <h2 className="text-xl font-bold mb-2">📲 Em até 24h entraremos em contato</h2>
            <p className="text-white/90 mb-4">
              Nossa equipe vai te enviar o contrato para assinatura eletrônica e tirar qualquer
              dúvida sobre o cronograma de pagamento.
            </p>
            {wppHref && (
              <a
                href={wppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 font-bold px-6 py-3 rounded-xl shadow"
                style={{ color: cor }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8" />
                </svg>
                Adiantar pelo WhatsApp
              </a>
            )}
          </section>

          <p className="text-center text-xs text-slate-500 mt-8">
            Dúvidas? Volte para{' '}
            <Link href={`/${venda.lote.loteamento.slug}`} className="underline">
              {venda.lote.loteamento.nome}
            </Link>{' '}
            ou aguarde nosso contato.
          </p>
        </div>
      </main>
    </div>
  );
}

function Passo({
  num,
  titulo,
  texto,
  cor,
}: {
  num: number;
  titulo: string;
  texto: string;
  cor: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
        style={{ background: cor }}
      >
        {num}
      </span>
      <div>
        <p className="font-semibold text-slate-900">{titulo}</p>
        <p className="text-sm text-slate-600">{texto}</p>
      </div>
    </li>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</dt>
      <dd className={`mt-0.5 ${destaque ? 'text-lg font-bold text-slate-900' : 'text-slate-900'}`}>
        {valor}
      </dd>
    </div>
  );
}
