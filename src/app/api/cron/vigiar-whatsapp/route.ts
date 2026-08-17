import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { CRON_TOKEN } from '@/lib/env';
import { conectar, obterStatus } from '@/lib/evolution-go';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vigia das sessões de WhatsApp.
 *
 * POR QUE ISTO EXISTE: em 14/08/2026 o gateway caiu e ficou três dias sem
 * receber nada. Ninguém percebeu, porque o status que a tela mostra é o que
 * está gravado aqui, e ele só muda quando alguém mexe na conexão — dizia
 * CONECTADA o tempo todo. Quem atendia via a caixa de entrada normal, com as
 * conversas de sempre, e concluía que os clientes é que tinham sumido.
 *
 * O vigia pergunta ao gateway como a sessão está de fato e grava a resposta.
 * Só isso já faz a tela parar de mentir: o aviso de desconectado aparece.
 *
 * Quando a sessão caiu mas as credenciais continuam no gateway, tenta religar
 * — foi o que resolveu naquele dia, sem QR nenhum. UMA tentativa por rodada,
 * de propósito: cada tentativa frustrada deixa conexões abertas no banco do
 * gateway, e foi justamente o acúmulo delas que esgotou o limite de 100 e
 * impediu qualquer sessão de subir. Insistir em laço aqui recriaria a falha
 * que este vigia deveria evitar.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-token') !== CRON_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Só as que se dizem conectadas. Uma instância em PAREANDO está com o QR na
  // tela de alguém neste momento; mexer no status dela aqui apagaria o
  // pareamento em curso.
  const instancias = await prisma.whatsappInstancia.findMany({
    where: { instanciaGateway: { not: null }, status: 'CONECTADA' },
    select: { id: true, nome: true, token: true, status: true },
  });

  const resultado: Array<{
    nome: string;
    antes: string;
    agora: string;
    religou?: boolean;
  }> = [];

  for (const inst of instancias) {
    const r = await obterStatus(inst.token);
    // Gateway fora do ar não é sessão derrubada: não sabemos o estado dela, e
    // marcar DESCONECTADA aqui seria trocar uma informação velha por uma
    // errada. Fica como está e a próxima rodada tenta de novo.
    if (!r.ok) {
      resultado.push({ nome: inst.nome, antes: inst.status, agora: 'gateway inacessível' });
      continue;
    }

    const conectada = !!r.data?.Connected && !!r.data?.LoggedIn;
    let religou: boolean | undefined;

    if (!conectada) {
      const tentativa = await conectar(inst.token);
      // `eventString` vazio significa que nenhum evento foi assinado: pareia e
      // não recebe mensagem. Sem conferir isso, "religou" seria mentira.
      religou = tentativa.ok && !!tentativa.data?.eventString;
    }

    const statusFinal = conectada || religou ? 'CONECTADA' : 'DESCONECTADA';
    if (statusFinal !== inst.status) {
      await prisma.whatsappInstancia.update({
        where: { id: inst.id },
        data: {
          status: statusFinal,
          ultimoErro:
            statusFinal === 'DESCONECTADA'
              ? 'Sessão caiu no gateway. Reconecte lendo o QR em /admin/whatsapp.'
              : null,
        },
      });
    }

    resultado.push({ nome: inst.nome, antes: inst.status, agora: statusFinal, religou });
  }

  return NextResponse.json({ ok: true, instancias: resultado });
}
