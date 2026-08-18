import { prisma } from '@/lib/prisma';
import { tenantId, loteadoraAlvoId } from '@/lib/tenant';
import { evolutionConfigured, getConnectionState, instanceNameForLoteadora } from '@/lib/evolution';
import { ConfiguracaoEnvios } from '@/components/envios/ConfiguracaoEnvios';
import { TabelaEnvios, type EnvioLinha } from '@/components/envios/TabelaEnvios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Envios — Admin' };

export default async function EnviosPage() {
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
    where: tid ? { loteadoraId: tid } : {},
    // O teto é rede: são algumas centenas por empresa, e a lista inteira vai
    // para a tela porque é lá que se filtra.
    take: 2000,
    orderBy: { createdAt: 'desc' },
    include: {
      parcela: {
        include: { venda: { select: { numero: true, cliente: { select: { nome: true } } } } },
      },
    },
  });

  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  const linhas: EnvioLinha[] = envios.map((e) => ({
    id: e.id,
    data: `${e.createdAt.getFullYear()}-${doisDigitos(e.createdAt.getMonth() + 1)}-${doisDigitos(e.createdAt.getDate())}`,
    dataLabel: e.createdAt.toLocaleString('pt-BR'),
    canal: e.canal,
    destinatario: e.destinatario,
    clienteNome: e.parcela?.venda?.cliente?.nome ?? null,
    referencia: e.parcela
      ? `Venda #${e.parcela.venda.numero} · parcela ${e.parcela.numero}`
      : null,
    status: e.status,
    erro: e.erro,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Envios automáticos</h1>
        <p className="text-sm text-slate-500">
          Histórico das comunicações enviadas pela régua de cobrança.
        </p>
      </div>

      {loteadora ? (
        <ConfiguracaoEnvios
          loteadoraId={loteadora.id}
          conectado={whatsappConectado}
          // Número que a Evolution reporta quando a sessão está viva; o do
          // cadastro serve de reserva, mas só quando há conexão de fato.
          numero={numeroConectado ?? (whatsappConectado ? loteadora.whatsapp : null)}
          configurado={evolutionConfigured()}
          cobrancaAtiva={loteadora.reguaCobranca?.ativa ?? false}
          diasAntes={diasAntes.length ? diasAntes : [5, 3]}
          noVencimento={passos.length ? noVencimento : true}
          atrasoDiario={atrasoDiario}
        />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Escolha uma loteadora em <span className="font-medium">Loteadoras</span> para conectar o
          WhatsApp e configurar a cobrança.
        </p>
      )}

      <TabelaEnvios envios={linhas} />
    </div>
  );
}
