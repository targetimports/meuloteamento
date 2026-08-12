import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { gatewayConfigurado } from '@/lib/evolution-go';
import { ConectarWhatsapp, type InstanciaUI } from '@/components/crm/ConectarWhatsapp';

export const dynamic = 'force-dynamic';

export default async function WhatsappPage() {
  const sessao = await requireAdmin();

  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    include: { _count: { select: { conversas: true } } },
  });

  const ui: InstanciaUI = {
    existe: Boolean(instancia),
    status: instancia?.status ?? 'SEM_INSTANCIA',
    telefone: instancia?.telefone ?? null,
    perfilNome: instancia?.perfilNome ?? null,
    conectadaEm: instancia?.conectadaEm?.toISOString() ?? null,
    ultimoErro: instancia?.ultimoErro ?? null,
    conversas: instancia?._count.conversas ?? 0,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="text-body-sm text-muted-foreground">
          Cada pessoa da equipe conecta o próprio número. As conversas ficam ligadas aos leads do
          funil.
        </p>
      </div>

      {!gatewayConfigurado() ? (
        <p className="rounded-lg border border-border bg-surface-soft p-4 text-body text-muted-foreground">
          O gateway de WhatsApp ainda não está configurado neste servidor
          (<code className="text-body-sm">EVOLUTION_GO_URL</code> e{' '}
          <code className="text-body-sm">EVOLUTION_GO_API_KEY</code>). Fale com quem cuida da
          infraestrutura.
        </p>
      ) : (
        <ConectarWhatsapp instancia={ui} />
      )}
    </div>
  );
}
