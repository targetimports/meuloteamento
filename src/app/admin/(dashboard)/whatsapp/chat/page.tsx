import Link from 'next/link';
import { Settings2 } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { CaixaDeEntrada, type ConversaUI } from '@/components/crm/chat/CaixaDeEntrada';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const sessao = await requireAdmin();

  // 🔴 A caixa é do DONO. Ver a conversa de outra pessoa não é permissão a
  // mais, é a caixa errada — nem admin entra por padrão.
  const instancia = await prisma.whatsappInstancia.findUnique({
    where: { userId: sessao.sub },
    select: { id: true, status: true, telefone: true },
  });

  if (!instancia) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Conversas</h1>
        <p className="rounded-lg border border-border bg-surface-soft p-4 text-body text-muted-foreground">
          Você ainda não conectou um número.{' '}
          <Link href="/admin/whatsapp" className="font-medium text-primary-strong hover:underline">
            Conectar meu WhatsApp
          </Link>
        </p>
      </div>
    );
  }

  // Arquivadas vêm juntas: a tela tem uma aba para elas, e buscar de novo a
  // cada troca de aba deixaria a alternância lenta sem ganho nenhum.
  const conversas = await prisma.whatsappConversa.findMany({
    where: { instanciaId: instancia.id },
    orderBy: [{ ultimaMensagemEm: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    include: { lead: { select: { id: true, nome: true } } },
  });

  const ui: ConversaUI[] = conversas.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    ehGrupo: c.ehGrupo,
    naoLidas: c.naoLidas,
    previa: c.ultimaMensagemPreview,
    ultimaMinha: c.ultimaMensagemMinha,
    ultimaEm: c.ultimaMensagemEm?.toISOString() ?? null,
    fotoUrl: c.fotoUrl,
    situacao: c.situacao,
    etiquetas: (c.etiquetas as string[] | null) ?? [],
    arquivada: c.arquivada,
    fixada: c.fixada,
    silenciada: c.silenciada,
    lead: c.lead,
  }));

  const naoLidas = ui.filter((c) => !c.arquivada).reduce((a, c) => a + c.naoLidas, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conversas</h1>
          <p className="text-body-sm text-muted-foreground">
            {instancia.status === 'CONECTADA' ? (
              <>
                {ui.filter((c) => !c.arquivada).length} conversa(s)
                {naoLidas > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-success-strong">{naoLidas} não lida(s)</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-destructive">
                Seu WhatsApp está desconectado — você não recebe nem envia mensagens.
              </span>
            )}
          </p>
        </div>
        <Link
          href="/admin/whatsapp"
          className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" /> Conexão
        </Link>
      </div>

      <CaixaDeEntrada conversas={ui} />
    </div>
  );
}
