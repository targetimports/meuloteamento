import { prisma } from './prisma';
import { sendEmail, sendWhatsApp } from './comunicacao';

/**
 * Avisa os administradores DA PLATAFORMA (meuloteamento) que entrou um novo
 * interessado em assinar o sistema.
 *
 * Nao avisa admins de loteadora: o interessado e prospect da plataforma, nao
 * cliente deles.
 *
 * Destinos:
 *   - E-mail   → todo AdminUser SUPER_ADMIN ativo e sem loteadora vinculada.
 *   - WhatsApp → numeros em NOTIFICAR_WHATSAPP (separados por virgula), porque
 *                AdminUser nao tem telefone cadastrado.
 *
 * Cada tentativa vira uma linha em EnvioComunicacao, com sucesso ou com o erro
 * do provedor — sem isso uma notificacao que falha some sem deixar rastro.
 */

export interface DadosInteressado {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  plano: string;
  mensagem?: string | null;
}

const URL_PAINEL = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://meuloteamento.com'}/admin/interessados`;

function montarTexto(i: DadosInteressado) {
  return [
    '🔔 Novo interessado na plataforma',
    '',
    `Nome: ${i.nome}`,
    `E-mail: ${i.email}`,
    `WhatsApp: ${i.telefone}`,
    `Plano: ${i.plano}`,
    i.mensagem ? `\nMensagem:\n${i.mensagem}` : '',
    '',
    URL_PAINEL,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function montarHtml(i: DadosInteressado) {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">Novo interessado na plataforma</h2>
      <p style="color:#64748b;margin:0 0 20px">Pediu contato pelos planos do site.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
        <tr><td style="color:#64748b">Nome</td><td><strong>${esc(i.nome)}</strong></td></tr>
        <tr><td style="color:#64748b">E-mail</td><td><a href="mailto:${esc(i.email)}">${esc(i.email)}</a></td></tr>
        <tr><td style="color:#64748b">WhatsApp</td><td>${esc(i.telefone)}</td></tr>
        <tr><td style="color:#64748b">Plano</td><td><strong>${esc(i.plano)}</strong></td></tr>
      </table>
      ${
        i.mensagem
          ? `<p style="color:#64748b;margin:20px 0 4px">Mensagem</p>
             <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap">${esc(i.mensagem)}</div>`
          : ''
      }
      <p style="margin:24px 0 0">
        <a href="${URL_PAINEL}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir no painel</a>
      </p>
    </div>`;
}

async function registrar(params: {
  canal: 'EMAIL' | 'WHATSAPP';
  destinatario: string;
  assunto?: string;
  corpo: string;
  interessadoId: string;
  resultado: { ok: boolean; providerId?: string | null; erro?: string };
}) {
  try {
    await prisma.envioComunicacao.create({
      data: {
        canal: params.canal,
        destinatario: params.destinatario,
        assunto: params.assunto ?? null,
        corpo: params.corpo,
        status: params.resultado.ok ? 'ENVIADO' : 'FALHOU',
        providerId: params.resultado.providerId ?? null,
        erro: params.resultado.erro ?? null,
        tentativas: 1,
        enviadoEm: params.resultado.ok ? new Date() : null,
        // Evita duplicar o aviso se a rota for chamada duas vezes.
        idempotencyKey: `interessado:${params.interessadoId}:${params.canal}:${params.destinatario}`,
      },
    });
  } catch {
    // idempotencyKey duplicada ou falha de escrita nao pode derrubar o fluxo
  }
}

export async function notificarNovoInteressado(i: DadosInteressado): Promise<void> {
  const texto = montarTexto(i);
  const assunto = `Novo interessado: ${i.nome} — plano ${i.plano}`;

  const [admins, numeros] = await Promise.all([
    prisma.adminUser.findMany({
      where: { role: 'SUPER_ADMIN', loteadoraId: null, ativo: true },
      select: { email: true },
    }),
    Promise.resolve(
      (process.env.NOTIFICAR_WHATSAPP ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
    ),
  ]);

  const tarefas: Promise<void>[] = [];

  for (const admin of admins) {
    tarefas.push(
      sendEmail({
        loteadoraId: null,
        destinatario: admin.email,
        assunto,
        corpo: montarHtml(i),
      }).then((r) =>
        registrar({
          canal: 'EMAIL',
          destinatario: admin.email,
          assunto,
          corpo: texto,
          interessadoId: i.id,
          resultado: r,
        })
      )
    );
  }

  for (const numero of numeros) {
    tarefas.push(
      sendWhatsApp({
        // Sem loteadoraId: usa a config de plataforma (WHATSAPP_* do .env),
        // nao a conta de WhatsApp de um cliente.
        loteadoraId: null,
        destinatario: numero,
        corpo: texto,
      }).then((r) =>
        registrar({
          canal: 'WHATSAPP',
          destinatario: numero,
          corpo: texto,
          interessadoId: i.id,
          resultado: r,
        })
      )
    );
  }

  // allSettled: um canal quebrado nao pode impedir o outro de sair.
  await Promise.allSettled(tarefas);
}
