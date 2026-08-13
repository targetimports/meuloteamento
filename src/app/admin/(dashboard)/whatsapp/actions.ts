'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/tenant';
import {
  conectar,
  criarInstancia,
  detalhesDaInstancia,
  excluirInstancia,
  gatewayConfigurado,
  gerarToken,
  obterQr,
  obterStatus,
  sairDaConta,
  urlDoWebhook,
} from '@/lib/evolution-go';
import { telefoneDoJid } from '@/lib/whatsapp-evento';

type Resultado = { ok: boolean; erro?: string };

/**
 * Traduz a falha do gateway para algo que a tela possa mostrar.
 *
 * `chamar()` devolve sempre o mesmo `error: 'erro_gateway'` e guarda o motivo
 * real em `detalhe` — repassar só o primeiro daria "erro_gateway" ao usuário,
 * que não diz nada e ainda esconde a causa de quem for investigar.
 */
function motivoDoGateway(r: { error: string; status?: number; detalhe?: unknown }): string {
  const d = r.detalhe as { error?: string } | null;
  if (d?.error) return d.error;
  if (r.error === 'timeout') return 'O gateway não respondeu a tempo.';
  if (r.error === 'inalcancavel') return 'O gateway está inacessível.';
  return `O gateway respondeu ${r.status ?? 'erro'}.`;
}

/**
 * Cria a instância deste usuário no gateway e devolve o primeiro QR.
 *
 * A ordem importa e não é a intuitiva: o token é gerado e GRAVADO no nosso
 * banco antes de existir instância no gateway. É ele que compõe a URL do
 * webhook e autentica as chamadas; se o create desse certo e a gravação
 * falhasse, ficaria uma instância órfã lá recebendo mensagens que nunca
 * conseguiríamos atribuir a ninguém.
 */
export async function conectarMeuWhatsapp(): Promise<Resultado & { qr?: string }> {
  const sessao = await requireAdmin();
  if (!gatewayConfigurado()) {
    return { ok: false, erro: 'Gateway não configurado no servidor.' };
  }

  try {
    let instancia = await prisma.whatsappInstancia.findUnique({
      where: { userId: sessao.sub },
    });

    if (!instancia) {
      const token = gerarToken();
      // Nome único e legível no gateway: quem abrir o manager de lá precisa
      // saber de quem é cada instância.
      const nome = `ml-${sessao.sub.slice(-8)}-${Date.now().toString(36)}`;

      instancia = await prisma.whatsappInstancia.create({
        data: {
          userId: sessao.sub,
          loteadoraId: sessao.loteadoraId ?? null,
          nome,
          token,
          status: 'PAREANDO',
        },
      });

      const criada = await criarInstancia(nome, token);
      if (!criada.ok) {
        // Sem instância no gateway, o registro daqui não serve para nada e
        // impediria uma nova tentativa (userId é único).
        await prisma.whatsappInstancia.delete({ where: { id: instancia.id } });
        return { ok: false, erro: `Não foi possível criar a instância: ${criada.error}` };
      }

      await prisma.whatsappInstancia.update({
        where: { id: instancia.id },
        data: { instanciaGateway: criada.data?.id ?? null },
      });
    }

    // Conectar registra o webhook e assina os eventos no mesmo passo.
    const conexao = await conectar(instancia.token);
    if (!conexao.ok) {
      await prisma.whatsappInstancia.update({
        where: { id: instancia.id },
        data: { status: 'ERRO', ultimoErro: String(conexao.error) },
      });
      return { ok: false, erro: `Falha ao conectar: ${conexao.error}` };
    }

    // `eventString` vazio significa que NENHUM evento foi aceito: o pareamento
    // funciona e nenhuma mensagem chega. Falha silenciosa clássica — melhor
    // recusar agora do que descobrir com o cliente reclamando que não respondem.
    const assinou = conexao.data?.eventString;
    if (assinou !== undefined && !assinou) {
      await prisma.whatsappInstancia.update({
        where: { id: instancia.id },
        data: {
          status: 'ERRO',
          ultimoErro: 'O gateway não aceitou os eventos — nenhuma mensagem chegaria.',
        },
      });
      return {
        ok: false,
        erro: 'O gateway aceitou a conexão mas recusou os eventos. Nenhuma mensagem chegaria.',
      };
    }

    if (!urlDoWebhook(instancia.token)) {
      return {
        ok: false,
        erro: 'NEXT_PUBLIC_APP_URL não configurada: sem ela o gateway não sabe para onde mandar as mensagens.',
      };
    }

    const qr = await obterQr(instancia.token);
    await prisma.whatsappInstancia.update({
      where: { id: instancia.id },
      data: { status: 'PAREANDO', ultimoErro: null },
    });

    revalidatePath('/admin/whatsapp');
    return { ok: true, qr: qr.ok ? (qr.data?.qrcode ?? qr.data?.base64 ?? undefined) : undefined };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/** Novo QR — o código expira em segundos e a tela precisa renovar. */
export async function novoQr(): Promise<Resultado & { qr?: string }> {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({ where: { userId: sessao.sub } });
  if (!instancia) return { ok: false, erro: 'Nenhuma instância.' };

  const qr = await obterQr(instancia.token);
  if (!qr.ok) return { ok: false, erro: motivoDoGateway(qr) };
  return { ok: true, qr: qr.data?.qrcode ?? qr.data?.base64 ?? undefined };
}

/**
 * Consulta o pareamento. Chamada em laço pela tela enquanto o QR está aberto.
 *
 * Não existe evento de conexão no gateway — este polling é a única forma de
 * saber que o celular leu o código.
 */
export async function statusDaMinhaInstancia(): Promise<{
  status: string;
  telefone?: string | null;
  perfilNome?: string | null;
  conectada: boolean;
}> {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({ where: { userId: sessao.sub } });
  if (!instancia) return { status: 'SEM_INSTANCIA', conectada: false };

  const r = await obterStatus(instancia.token);
  if (!r.ok) {
    return {
      status: instancia.status,
      telefone: instancia.telefone,
      perfilNome: instancia.perfilNome,
      conectada: instancia.status === 'CONECTADA',
    };
  }

  const pareada = Boolean(r.data?.Connected && r.data?.LoggedIn);
  const nome = r.data?.Name || null;

  if (pareada) {
    // O número não vem no status — só na listagem, e só depois que o celular
    // termina de parear. Por isso a busca acontece aqui, a cada consulta em que
    // ainda falta o dado, e não uma única vez no momento da conexão: o `Name`
    // costuma chegar vazio nos primeiros segundos, e uma tentativa só deixava
    // a tela para sempre sem número e sem perfil.
    const faltaDado = !instancia.telefone || !instancia.perfilNome;
    let telefone = instancia.telefone;

    if (faltaDado) {
      const detalhes = await detalhesDaInstancia(instancia.nome);
      telefone = telefoneDoJid(detalhes?.jid ?? '') ?? instancia.telefone;
    }

    const virouConectada = instancia.status !== 'CONECTADA';
    if (virouConectada || (faltaDado && (telefone || nome))) {
      await prisma.whatsappInstancia.update({
        where: { id: instancia.id },
        data: {
          status: 'CONECTADA',
          ...(virouConectada ? { conectadaEm: new Date(), ultimoErro: null } : {}),
          ...(telefone ? { telefone } : {}),
          ...(nome ? { perfilNome: nome } : {}),
        },
      });
      revalidatePath('/admin/whatsapp');
    }

    return {
      status: 'CONECTADA',
      telefone: telefone ?? null,
      perfilNome: nome ?? instancia.perfilNome,
      conectada: true,
    };
  }

  if (!pareada && instancia.status === 'CONECTADA') {
    await prisma.whatsappInstancia.update({
      where: { id: instancia.id },
      data: { status: 'DESCONECTADA' },
    });
    revalidatePath('/admin/whatsapp');
  }

  return {
    status: pareada ? 'CONECTADA' : instancia.status,
    telefone: instancia.telefone,
    perfilNome: nome ?? instancia.perfilNome,
    conectada: pareada,
  };
}

/**
 * Desconecta o número, mantendo a instância e o histórico.
 *
 * Separado de excluir de propósito: quem trocou de celular quer parear de novo,
 * não perder as conversas.
 */
export async function desconectarMeuWhatsapp(): Promise<Resultado> {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({ where: { userId: sessao.sub } });
  if (!instancia) return { ok: false, erro: 'Nenhuma instância.' };

  await sairDaConta(instancia.token);
  await prisma.whatsappInstancia.update({
    where: { id: instancia.id },
    data: { status: 'DESCONECTADA', telefone: null, conectadaEm: null },
  });

  revalidatePath('/admin/whatsapp');
  return { ok: true };
}

/**
 * Remove a instância do gateway e daqui.
 *
 * Apaga as conversas e mensagens junto (cascata no banco). É destrutivo, e a
 * tela precisa pedir confirmação explícita antes de chamar.
 */
export async function excluirMeuWhatsapp(): Promise<Resultado> {
  const sessao = await requireAdmin();
  const instancia = await prisma.whatsappInstancia.findUnique({ where: { userId: sessao.sub } });
  if (!instancia) return { ok: false, erro: 'Nenhuma instância.' };

  // Primeiro o gateway: se apagássemos daqui antes e a chamada falhasse, a
  // instância continuaria lá, pareada, mandando eventos para um token que já
  // não existe no nosso banco.
  if (instancia.instanciaGateway) {
    const r = await excluirInstancia(instancia.instanciaGateway);
    if (!r.ok && r.status !== 404) {
      return { ok: false, erro: `O gateway recusou a exclusão: ${r.error}` };
    }
  }

  await prisma.whatsappInstancia.delete({ where: { id: instancia.id } });
  revalidatePath('/admin/whatsapp');
  return { ok: true };
}
