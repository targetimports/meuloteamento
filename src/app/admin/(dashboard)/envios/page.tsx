import { prisma } from '@/lib/prisma';
import { tenantId, loteadoraAlvoId } from '@/lib/tenant';
import { evolutionConfigured, getConnectionState, instanceNameForLoteadora } from '@/lib/evolution';
import WhatsAppConnectCard from '@/components/WhatsAppConnectCard';
import CobrancaScheduleCard from '@/components/CobrancaScheduleCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Envios — Admin' };

export default async function EnviosPage({
  searchParams,
}: {
  searchParams: { canal?: string; status?: string };
}) {
  const tid = await tenantId();
  // Admin geral também consegue operar (usa a única loteadora existente).
  const alvoId = await loteadoraAlvoId();

  const loteadora = alvoId
    ? await prisma.loteadora.findUnique({
        where: { id: alvoId },
        select: {
          id: true,
          whatsappProvider: true,
          whatsappInstance: true,
          whatsapp: true,
          reguaCobranca: {
            select: {
              ativa: true,
              cobrarAtrasoDiario: true,
              passos: { select: { diasOffset: true } },
            },
          },
        },
      })
    : null;

  /**
   * ESTADO REAL DA CONEXÃO, consultado na Evolution.
   *
   * Antes o card recebia `whatsappProvider === 'evolution'`, que só diz que o
   * WhatsApp foi configurado um dia — e continua verdadeiro para sempre. Em
   * 29/07/2026 a sessão caiu (código 401, derrubada pelo WhatsApp) e a tela
   * seguiu exibindo "Conectado" por 14 dias, enquanto a régua acumulava falhas
   * logo abaixo. Ninguém percebeu porque o topo da página afirmava que estava
   * tudo bem.
   *
   * Falha de rede ou Evolution fora do ar NÃO derruba a página: cai no catch e
   * o card mostra desconectado, que é a leitura segura — pior seria dizer
   * "conectado" sem ter como confirmar.
   */
  let whatsappConectado = false;
  let numeroConectado: string | null = null;

  if (loteadora && evolutionConfigured()) {
    try {
      // Teto de 4s. evoFetch não tem timeout próprio, e outras chamadas dele
      // (parear, criar instância) legitimamente demoram — então o limite fica
      // aqui, e não no lib, para não encurtar o que precisa de tempo.
      // Sem isso, uma Evolution pendurada travaria a tela de envios inteira:
      // trocaríamos um status errado por uma página que não abre.
      const info = await Promise.race([
        getConnectionState(
          instanceNameForLoteadora(loteadora.id, loteadora.whatsappInstance)
        ),
        new Promise<null>((r) => setTimeout(() => r(null), 4000)),
      ]);
      whatsappConectado = info?.state === 'open';
      numeroConectado = info?.number ?? null;
    } catch {
      whatsappConectado = false;
    }
  }

  const passos = loteadora?.reguaCobranca?.passos ?? [];
  const diasAntes = passos
    .filter((p) => p.diasOffset < 0)
    .map((p) => -p.diasOffset)
    .sort((a, b) => b - a);
  const noVencimento = passos.some((p) => p.diasOffset === 0);
  const atrasoDiario = loteadora?.reguaCobranca?.cobrarAtrasoDiario ?? false;

  const envios = await prisma.envioComunicacao.findMany({
    where: {
      ...(tid ? { loteadoraId: tid } : {}),
      ...(searchParams.canal ? { canal: searchParams.canal as any } : {}),
      ...(searchParams.status ? { status: searchParams.status as any } : {}),
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: {
      parcela: {
        include: { venda: { select: { numero: true, cliente: { select: { nome: true } } } } },
      },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Envios automáticos</h1>
      <p className="text-sm text-slate-500">
        Histórico das comunicações enviadas pela régua de cobrança.
      </p>

      {loteadora ? (
        <>
          <WhatsAppConnectCard
            loteadoraId={loteadora.id}
            connected={whatsappConectado}
            // Número que a Evolution reporta quando a sessão está viva; o do
            // cadastro serve de reserva, mas só quando há conexão de fato.
            number={numeroConectado ?? (whatsappConectado ? loteadora.whatsapp : null)}
            configured={evolutionConfigured()}
            cobrancaAtiva={loteadora.reguaCobranca?.ativa ?? false}
          />
          <CobrancaScheduleCard
            loteadoraId={loteadora.id}
            diasAntes={diasAntes.length ? diasAntes : [5, 3]}
            noVencimento={passos.length ? noVencimento : true}
            atrasoDiario={atrasoDiario}
          />
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
          Escolha uma loteadora em <span className="font-medium">Loteadoras</span> para conectar o
          WhatsApp e configurar a cobrança.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2">Destinatário</th>
              <th className="px-3 py-2">Cliente / Parcela</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {envios.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {e.createdAt.toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2">{e.canal}</td>
                <td className="px-3 py-2">{e.destinatario}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {e.parcela?.venda?.cliente?.nome ?? '—'}
                  {e.parcela ? ` · venda #${e.parcela.venda.numero} parcela ${e.parcela.numero}` : ''}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      e.status === 'ENVIADO' || e.status === 'ENTREGUE' || e.status === 'LIDO'
                        ? 'bg-emerald-50 text-emerald-700'
                        : e.status === 'FALHOU'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {e.status}
                  </span>
                  {e.erro && (
                    <span className="block text-xs text-red-600 mt-0.5">{e.erro}</span>
                  )}
                </td>
              </tr>
            ))}
            {envios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-sm">
                  Nenhum envio registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
