import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import { CaixaDeEntrada, type ConversaUI } from '@/components/crm/chat/CaixaDeEntrada';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { tel?: string };
}) {
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
  /**
   * `?tel=` abre a conversa daquele número, criando-a se ainda não existir.
   *
   * É o caminho de quem vem de uma venda ou de um cadastro e quer falar com a
   * pessoa: o contato pode nunca ter escrito, e nesse caso não há conversa
   * nenhuma para abrir. Criar aqui não envia nada — só reserva o lugar dela na
   * fila. Diferente de `novaConversa`, não exige o WhatsApp conectado: a tela
   * abre, avisa que está desconectado, e a mensagem espera a reconexão.
   */
  let conversaInicial: string | null = null;
  const digitos = (searchParams.tel ?? '').replace(/\D/g, '');
  if (digitos.length >= 10) {
    const completo = digitos.length <= 11 ? `55${digitos}` : digitos;
    const remoteJid = `${completo}@s.whatsapp.net`;
    const achada = await prisma.whatsappConversa.findUnique({
      where: { instanciaId_remoteJid: { instanciaId: instancia.id, remoteJid } },
      select: { id: true },
    });
    if (achada) {
      conversaInicial = achada.id;
    } else {
      // Pode existir com outro remoteJid (modo LID) e o mesmo telefone — nesse
      // caso reaproveita, senão o contato ganharia duas conversas.
      const porTelefone = await prisma.whatsappConversa.findFirst({
        where: { instanciaId: instancia.id, telefone: completo, ehGrupo: false },
        orderBy: { ultimaMensagemEm: 'desc' },
        select: { id: true },
      });
      conversaInicial =
        porTelefone?.id ??
        (
          await prisma.whatsappConversa.create({
            data: {
              instanciaId: instancia.id,
              remoteJid,
              telefone: completo,
              ehGrupo: false,
            },
            select: { id: true },
          })
        ).id;
    }
  }

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

  // A margem negativa puxa contra o padding do main: esta tela é do tipo
  // "aplicativo", ocupa a altura toda, e cada pixel gasto no topo sai da
  // lista de conversas. O título saiu pelo mesmo motivo — a barra da caixa já
  // diz onde se está, e os contadores ela mostra em badge.
  return (
    <div className="-mt-3 space-y-2 lg:-mt-5">
      {/* O aviso de desconexão fica: sem ele a tela parece funcionar enquanto
          nada entra nem sai, e a pessoa só descobre pelo cliente reclamando. */}
      {instancia.status !== 'CONECTADA' && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-destructive/30 bg-destructive/[0.08] px-3 py-2 text-body-sm text-destructive">
          Seu WhatsApp está desconectado — você não recebe nem envia mensagens.
          <Link href="/admin/whatsapp" className="font-medium underline underline-offset-2">
            Reconectar
          </Link>
        </p>
      )}

      <CaixaDeEntrada conversas={ui} conversaInicial={conversaInicial} />
    </div>
  );
}
