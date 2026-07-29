import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { saveUploadedFile } from '@/lib/upload';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true },
  });
  if (!loteamento) {
    return NextResponse.json({ error: 'loteamento not found' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field missing' }, { status: 400 });
  }

  try {
    const result = await saveUploadedFile({
      file,
      subdir: loteamento.slug,
      filenameBase: 'mapa',
    });

    await prisma.loteamento.update({
      where: { id: loteamento.id },
      data: { imagemMapa: result.url },
    });

    return NextResponse.json({ ok: true, url: result.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro no upload';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
