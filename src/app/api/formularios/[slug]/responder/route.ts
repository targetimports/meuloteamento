/**
 * Endpoint público — recebe o preenchimento de um formulário.
 *
 * Body: multipart/form-data
 *   - dados:  JSON string com { campoId: valor }
 *   - arquivo:<campoId>: arquivo enviado (pode haver vários no mesmo campo)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseCampos } from '@/lib/formulario-tipos';
import { gravarDocumento } from '@/lib/storage-seguro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB hard limit per file
const MAX_FILES = 20;

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120);
}

function onlyDigits(s?: string | null) {
  return (s || '').replace(/\D/g, '');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const formulario = await prisma.formulario.findUnique({
      where: { slug: params.slug },
    });
    if (!formulario) {
      return NextResponse.json({ error: 'Formulário não encontrado' }, { status: 404 });
    }
    if (!formulario.ativo) {
      return NextResponse.json(
        { error: 'Formulário não está aceitando respostas' },
        { status: 410 }
      );
    }

    const campos = parseCampos(formulario.campos);
    const camposPorId = new Map(campos.map((c) => [c.id, c]));

    const fd = await req.formData();
    const dadosRaw = fd.get('dados');
    let dados: Record<string, unknown> = {};
    try {
      dados = JSON.parse(typeof dadosRaw === 'string' ? dadosRaw : '{}');
    } catch {
      return NextResponse.json({ error: 'dados malformados' }, { status: 400 });
    }

    // Coleta arquivos (qualquer chave com prefixo "arquivo:")
    const arquivosParaSalvar: { campoId: string; file: File }[] = [];
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith('arquivo:')) continue;
      if (!(value instanceof File)) continue;
      const campoId = key.slice('arquivo:'.length);
      const campo = camposPorId.get(campoId);
      if (!campo) continue;
      if (!['arquivo', 'foto', 'documento'].includes(campo.tipo)) continue;
      const max = (campo.tamanhoMaxMb ?? 10) * 1024 * 1024;
      if (value.size > max || value.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `Arquivo "${value.name}" passou do limite.` },
          { status: 413 }
        );
      }
      arquivosParaSalvar.push({ campoId, file: value });
      if (arquivosParaSalvar.length > MAX_FILES) {
        return NextResponse.json({ error: 'Muitos arquivos' }, { status: 413 });
      }
    }

    // Valida obrigatórios
    for (const c of campos) {
      if (!c.obrigatorio) continue;
      if (c.tipo === 'titulo' || c.tipo === 'paragrafo') continue;
      if (['arquivo', 'foto', 'documento'].includes(c.tipo)) {
        const tem = arquivosParaSalvar.some((a) => a.campoId === c.id);
        if (!tem) {
          return NextResponse.json(
            { error: `Campo obrigatório "${c.label}" não foi preenchido` },
            { status: 400 }
          );
        }
      } else {
        const v = dados[c.id];
        if (v === undefined || v === null || v === '') {
          return NextResponse.json(
            { error: `Campo obrigatório "${c.label}" não foi preenchido` },
            { status: 400 }
          );
        }
        if (c.tipo === 'checkbox' && (!Array.isArray(v) || v.length === 0)) {
          return NextResponse.json(
            { error: `Campo obrigatório "${c.label}" não foi preenchido` },
            { status: 400 }
          );
        }
      }
    }

    // Extrai campos indexados (nome, cpf, email, telefone, loteCodigo)
    let nome: string | null = null;
    let cpfCnpj: string | null = null;
    let email: string | null = null;
    let telefone: string | null = null;
    let loteCodigo: string | null = null;
    for (const c of campos) {
      const v = dados[c.id];
      if (typeof v !== 'string' || !v) continue;
      if (c.tipo === 'nome' && !nome) nome = v;
      if (c.tipo === 'cpf' && !cpfCnpj) cpfCnpj = onlyDigits(v);
      if (c.tipo === 'email' && !email) email = v.toLowerCase();
      if (c.tipo === 'telefone' && !telefone) telefone = v;
      if (c.tipo === 'lote' && !loteCodigo) loteCodigo = v;
    }
    if (!cpfCnpj || cpfCnpj.length < 11) cpfCnpj = null;

    // Tracking
    const ipHeader =
      req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
    const ip = ipHeader ? ipHeader.split(',')[0].trim() : null;
    const ua = req.headers.get('user-agent') ?? null;

    // Cria a resposta primeiro
    const resposta = await prisma.formularioResposta.create({
      data: {
        formularioId: formulario.id,
        dados: dados as object,
        nome,
        cpfCnpj,
        email,
        telefone,
        loteCodigo,
        ipAddress: ip,
        userAgent: ua,
      },
    });

    // Salva os arquivos no cofre (fora do webroot) e registra.
    //
    // São documentos pessoais — identidade, comprovante de residência. Eles não
    // podem cair em `public/`, onde o nginx os entregaria a qualquer um que
    // soubesse a URL.
    for (const { campoId, file } of arquivosParaSalvar) {
      const safeName = sanitizeFilename(file.name) || `arquivo-${Date.now()}`;
      const finalName = `${Date.now()}-${campoId}-${safeName}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const relativo = await gravarDocumento({
        subdir: `formularios/${resposta.id}`,
        nomeArquivo: finalName,
        conteudo: buf,
      });
      await prisma.formularioArquivo.create({
        data: {
          respostaId: resposta.id,
          campoId,
          nomeOriginal: file.name,
          caminho: relativo,
          mimeType: file.type || null,
          tamanho: file.size,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      id: resposta.id,
    });
  } catch (err) {
    console.error('[formulario/responder]', err);
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
