import crypto from 'crypto';
import { prisma } from './prisma';
import { renderTemplate } from './template';
import { formatBRL, formatCpfCnpj, formatPhone, formatDate, formatArea } from './format';
import {
  realPorExtenso,
  numeroPorExtenso,
  metrosPorExtenso,
  metrosQuadradosPorExtenso,
  dataPorExtenso,
} from './numero-extenso';

function addMeses(d: Date, meses: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + meses);
  return x;
}

function setDia(d: Date, dia: number): Date {
  const x = new Date(d);
  x.setDate(dia);
  return x;
}

function joinEndereco(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(', ');
}

export async function montarContextoContrato(vendaId: string) {
  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: {
      cliente: true,
      lote: { include: { loteamento: { include: { loteadora: true } } } },
      parcelas: { orderBy: { numero: 'asc' } },
    },
  });
  if (!venda) throw new Error('Venda não encontrada');

  const { cliente, lote } = venda;
  const loteamento = lote.loteamento;
  const loteadora = loteamento.loteadora;

  // Primeiro vencimento: tenta parcela #1 ou calcula a partir de dataContrato + diaVencimento
  const parcela1 = venda.parcelas.find((p) => p.numero === 1 || p.tipo === 'ENTRADA');
  const primeiroVenc =
    parcela1?.vencimento ??
    setDia(addMeses(venda.dataContrato, 1), venda.diaVencimento);

  const valorTotal = Number(venda.valorTotal);
  const valorEntrada = Number(venda.valorEntrada);
  const valorParcela = Number(venda.valorParcela);
  const taxaCorretagem = Number(venda.taxaCorretagem ?? 0);
  const descPontPct = Number(venda.descontoPontualidadePct ?? 0);

  const area = Number(lote.area);
  const testada = lote.testada ? Number(lote.testada) : 0;
  const fundo = lote.fundo ? Number(lote.fundo) : 0;

  const enderecoCliente = joinEndereco([
    cliente.logradouro && cliente.numero ? `${cliente.logradouro}, ${cliente.numero}` : cliente.logradouro,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade,
    cliente.estado,
  ]);
  const enderecoLoteadora = joinEndereco([
    loteadora.endereco,
    loteadora.cidade,
    loteadora.estado,
  ]);

  return {
    cliente: {
      nome: cliente.nome,
      cpfCnpj: formatCpfCnpj(cliente.cpfCnpj),
      email: cliente.email,
      telefone: formatPhone(cliente.telefone),
      endereco: enderecoCliente || 'Não informado',
      cep: cliente.cep ?? '',
      rg: cliente.rg ?? '',
      nacionalidade: cliente.nacionalidade ?? 'Brasileiro(a)',
      estadoCivil: cliente.estadoCivil ?? 'Não informado',
      profissao: cliente.profissao ?? 'Não informado',
    },
    lote: {
      codigo: lote.codigo,
      quadra: lote.quadra,
      numero: lote.numero,
      area: formatArea(area),
      areaExtenso: metrosQuadradosPorExtenso(area),
      testada: testada ? `${testada.toFixed(2).replace('.', ',')}m` : '',
      testadaExtenso: testada ? metrosPorExtenso(testada) : '',
      fundo: fundo ? `${fundo.toFixed(2).replace('.', ',')}m` : '',
      fundoExtenso: fundo ? metrosPorExtenso(fundo) : '',
      viaFrente: lote.viaFrente ?? '',
      ladoVia: lote.ladoVia ?? '',
      confrontacaoEsquerdo: lote.confrontacaoEsquerdo ?? '',
      confrontacaoDireito: lote.confrontacaoDireito ?? '',
      confrontacaoFrente: lote.confrontacaoFrente ?? '',
      confrontacaoFundo: lote.confrontacaoFundo ?? '',
      matricula: lote.matricula ?? '____',
    },
    loteamento: {
      nome: loteamento.nome,
      endereco: loteamento.endereco,
      cidade: loteamento.cidade,
      estado: loteamento.estado,
      cartorio:
        loteamento.cartorio ??
        `Cartório de Registro de Imóveis de ${loteamento.cidade}/${loteamento.estado}`,
      comarca: loteamento.comarca ?? loteamento.cidade,
    },
    venda: {
      numero: String(venda.numero),
      valorTotal: formatBRL(valorTotal).replace('R$', '').trim(),
      valorTotalExtenso: realPorExtenso(valorTotal),
      valorEntrada: formatBRL(valorEntrada).replace('R$', '').trim(),
      valorEntradaExtenso: realPorExtenso(valorEntrada),
      valorParcela: formatBRL(valorParcela).replace('R$', '').trim(),
      valorParcelaExtenso: realPorExtenso(valorParcela),
      numeroParcelas: String(venda.numeroParcelas),
      numeroParcelasExtenso: numeroPorExtenso(venda.numeroParcelas),
      diaVencimento: String(venda.diaVencimento),
      diaVencimentoExtenso: numeroPorExtenso(venda.diaVencimento),
      primeiroVencimento: formatDate(primeiroVenc),
      primeiroVencimentoExtenso: dataPorExtenso(primeiroVenc),
      dataContrato: formatDate(venda.dataContrato),
      dataContratoExtenso: dataPorExtenso(venda.dataContrato),
      taxaCorretagem: formatBRL(taxaCorretagem).replace('R$', '').trim(),
      taxaCorretagemExtenso: realPorExtenso(taxaCorretagem),
      descontoPontualidadePct: descPontPct.toFixed(0),
      formaPagamento: venda.formaPagamento,
    },
    loteadora: {
      nome: loteadora.nome,
      razaoSocial: loteadora.razaoSocial ?? loteadora.nome,
      cnpj: loteadora.cnpj ? formatCpfCnpj(loteadora.cnpj) : '',
      endereco: enderecoLoteadora || loteadora.endereco || '',
      email: loteadora.email ?? '',
      telefone: loteadora.telefone ? formatPhone(loteadora.telefone) : (loteadora.whatsapp ? formatPhone(loteadora.whatsapp) : ''),
      representanteNome: loteadora.representanteNome ?? '_________________________',
      representanteCpf: loteadora.representanteCpf ? formatCpfCnpj(loteadora.representanteCpf) : '_______________',
      representanteCargo: loteadora.representanteCargo ?? 'Sócio Administrador',
    },
  };
}

export function envolverComoDocumentoHtml(corpo: string, titulo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${titulo}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #111; line-height: 1.55; }
  h1, h2, h3 { font-family: 'Helvetica Neue', Arial, sans-serif; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 24px; }
  h2 { font-size: 13pt; margin: 18px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 11.5pt; margin: 14px 0 6px; }
  p { margin: 0 0 10px; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #999; padding: 6px 8px; font-size: 10pt; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; width: 38%; }
  .assinatura { margin-top: 56px; display: grid; grid-template-columns: 1fr 1fr; gap: 36px; page-break-inside: avoid; }
  .assinatura > div { text-align: center; }
  .assinatura .linha { border-top: 1px solid #111; margin-top: 36px; padding-top: 6px; font-size: 9.5pt; }
  .destaque { background: #fffae6; padding: 8px 12px; border-left: 4px solid #f5b800; margin: 16px 0; }
</style>
</head>
<body>
${corpo}
</body>
</html>`;
}

export async function gerarContratoVenda(input: {
  vendaId: string;
  templateId?: string | null;
  userId?: string | null;
}): Promise<{ html: string; hash: string }> {
  const venda = await prisma.venda.findUnique({
    where: { id: input.vendaId },
    select: {
      id: true,
      lote: { select: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) throw new Error('Venda não encontrada');
  const loteadoraId = venda.lote.loteamento.loteadoraId;

  const templateId = input.templateId ?? null;
  const template = templateId
    ? await prisma.contratoTemplate.findUnique({ where: { id: templateId } })
    : await prisma.contratoTemplate.findFirst({
        where: { loteadoraId, ativo: true, default: true },
        orderBy: { updatedAt: 'desc' },
      });

  if (!template) {
    throw new Error('Nenhum template de contrato configurado para esta loteadora');
  }

  const ctx = await montarContextoContrato(input.vendaId);
  const corpoRender = renderTemplate(template.conteudoHtml, ctx as unknown as Record<string, unknown>);
  const html = envolverComoDocumentoHtml(
    corpoRender,
    `Contrato — Venda #${ctx.venda.numero}`
  );
  const hash = crypto.createHash('sha256').update(html).digest('hex');

  await prisma.venda.update({
    where: { id: input.vendaId },
    data: {
      contratoTemplateId: template.id,
      contratoHtml: html,
      contratoHash: hash,
      contratoStatus: 'GERADO',
    },
  });

  return { html, hash };
}

/**
 * Converte HTML em PDF usando puppeteer (instalação opcional).
 * Se o módulo não existir, retorna null — a UI deve avisar o admin.
 */
export async function htmlParaPdf(html: string): Promise<Buffer | null> {
  try {
    // import dinâmico — puppeteer é opcional
    const mod = await (Function('m', 'return import(m)') as (s: string) => Promise<unknown>)('puppeteer');
    const puppeteer = mod as { launch: (opts?: object) => Promise<{
      newPage: () => Promise<{ setContent: (h: string, o?: object) => Promise<void>; pdf: (o: object) => Promise<Buffer> }>;
      close: () => Promise<void>;
    }> };
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
        printBackground: true,
      });
      return pdf;
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.warn('[contrato] puppeteer não disponível:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Resolve credenciais do provedor de assinatura: prioriza loteadora,
 * cai para variável de ambiente global.
 */
async function getSignContext(loteadoraId: string | null): Promise<{
  provider: 'clicksign' | 'zapsign';
  token: string;
  sandbox: boolean;
} | null> {
  const lot = loteadoraId
    ? await prisma.loteadora.findUnique({
        where: { id: loteadoraId },
        select: { signProvider: true, signApiToken: true, signSandbox: true },
      })
    : null;

  const provider = (lot?.signProvider || process.env.SIGN_PROVIDER || 'clicksign').toLowerCase();
  const token =
    lot?.signApiToken ||
    (provider === 'clicksign'
      ? process.env.CLICKSIGN_API_TOKEN
      : process.env.ZAPSIGN_API_TOKEN) ||
    '';
  if (!token) return null;
  const sandbox = lot?.signSandbox ?? process.env.SIGN_SANDBOX === 'true';
  return { provider: provider as 'clicksign' | 'zapsign', token, sandbox };
}

function clicksignBaseUrl(sandbox: boolean): string {
  return sandbox ? 'https://sandbox.clicksign.com' : 'https://api.clicksign.com';
}

async function enviarParaClicksign(
  venda: {
    id: string;
    numero: number;
    contratoHtml: string | null;
    cliente: { nome: string; email: string; telefone: string; cpfCnpj: string };
  },
  token: string,
  sandbox: boolean
): Promise<{ ok: boolean; signerUrl?: string; signerId?: string; erro?: string }> {
  const base = clicksignBaseUrl(sandbox);

  if (!venda.contratoHtml) return { ok: false, erro: 'Contrato ainda não foi gerado' };

  const pdf = await htmlParaPdf(venda.contratoHtml);
  if (!pdf) {
    return {
      ok: false,
      erro: 'puppeteer não instalado — rode "npm i puppeteer" na VPS para habilitar geração de PDF',
    };
  }

  const base64 = pdf.toString('base64');

  try {
    // 1. Cria o documento
    const docRes = await fetch(`${base}/api/v1/documents?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        document: {
          path: `/contratos/venda-${venda.numero}.pdf`,
          content_base64: `data:application/pdf;base64,${base64}`,
          deadline_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          auto_close: true,
          locale: 'pt-BR',
          sequence_enabled: false,
        },
      }),
    });
    if (!docRes.ok) {
      const t = await docRes.text();
      return { ok: false, erro: `Clicksign documents ${docRes.status}: ${t.slice(0, 300)}` };
    }
    const docData = (await docRes.json()) as { document: { key: string } };
    const documentKey = docData.document.key;

    // 2. Cria o signatário
    const cpfDigits = venda.cliente.cpfCnpj.replace(/\D/g, '');
    const phoneDigits = venda.cliente.telefone.replace(/\D/g, '');
    const signerRes = await fetch(`${base}/api/v1/signers?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        signer: {
          email: venda.cliente.email,
          phone_number: phoneDigits.length >= 10 ? `+55${phoneDigits}` : null,
          auths: ['email'],
          name: venda.cliente.nome,
          documentation: cpfDigits,
          has_documentation: cpfDigits.length === 11,
        },
      }),
    });
    if (!signerRes.ok) {
      const t = await signerRes.text();
      return { ok: false, erro: `Clicksign signers ${signerRes.status}: ${t.slice(0, 300)}` };
    }
    const signerData = (await signerRes.json()) as { signer: { key: string } };
    const signerKey = signerData.signer.key;

    // 3. Adiciona o signatário à lista do documento
    const listRes = await fetch(`${base}/api/v1/lists?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        list: {
          document_key: documentKey,
          signer_key: signerKey,
          sign_as: 'party',
          message: `Contrato de Compromisso de Compra e Venda — Venda #${venda.numero}. Verifique e assine.`,
        },
      }),
    });
    if (!listRes.ok) {
      const t = await listRes.text();
      return { ok: false, erro: `Clicksign lists ${listRes.status}: ${t.slice(0, 300)}` };
    }
    const listData = (await listRes.json()) as {
      list: { request_signature_key?: string; url?: string };
    };
    const requestKey = listData.list.request_signature_key;
    const signerUrl = requestKey
      ? `${clicksignBaseUrl(sandbox).replace('api.', 'app.').replace('sandbox.', 'sandbox.')}/sign/${requestKey}`
      : (listData.list.url ?? `${base}/sign/${requestKey ?? ''}`);

    return { ok: true, signerUrl, signerId: documentKey };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

async function enviarParaZapSign(
  venda: {
    id: string;
    numero: number;
    contratoHtml: string;
    cliente: { nome: string; email: string; telefone: string };
  },
  token: string
): Promise<{ ok: boolean; signerUrl?: string; signerId?: string; erro?: string }> {
  const base64 = Buffer.from(venda.contratoHtml, 'utf-8').toString('base64');
  try {
    const res = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: `Contrato Venda #${venda.numero}`,
        base64_html: base64,
        signers: [
          {
            name: venda.cliente.nome,
            email: venda.cliente.email,
            phone_country: '55',
            phone_number: venda.cliente.telefone.replace(/\D/g, ''),
            auth_mode: 'assinaturaTela',
            send_automatic_email: true,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, erro: `ZapSign ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      open_id: number;
      token: string;
      signers: { sign_url: string }[];
    };
    return {
      ok: true,
      signerUrl: data.signers?.[0]?.sign_url,
      signerId: data.token,
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function enviarParaAssinatura(vendaId: string): Promise<{
  ok: boolean;
  signerUrl?: string;
  signerId?: string;
  erro?: string;
}> {
  const venda = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: {
      cliente: true,
      lote: { select: { loteamento: { select: { loteadoraId: true } } } },
    },
  });
  if (!venda) return { ok: false, erro: 'Venda não encontrada' };
  if (!venda.contratoHtml) return { ok: false, erro: 'Contrato ainda não foi gerado' };

  const ctx = await getSignContext(venda.lote.loteamento.loteadoraId);
  if (!ctx) return { ok: false, erro: 'Provedor de assinatura não configurado' };

  const dadosVenda = {
    id: venda.id,
    numero: venda.numero,
    contratoHtml: venda.contratoHtml,
    cliente: {
      nome: venda.cliente.nome,
      email: venda.cliente.email,
      telefone: venda.cliente.telefone,
      cpfCnpj: venda.cliente.cpfCnpj,
    },
  };

  const r =
    ctx.provider === 'clicksign'
      ? await enviarParaClicksign(dadosVenda, ctx.token, ctx.sandbox)
      : await enviarParaZapSign(dadosVenda, ctx.token);

  if (r.ok) {
    await prisma.venda.update({
      where: { id: vendaId },
      data: {
        contratoStatus: 'ENVIADO_ASSINATURA',
        contratoSignerUrl: r.signerUrl,
        contratoSignerId: r.signerId,
      },
    });
  }
  return r;
}
