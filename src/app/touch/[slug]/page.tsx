/**
 * Stand de vendas — maquete 3D interativa para tela touch.
 *
 * Rota pública dedicada (sem header/footer do site). Cliente toca nos lotes
 * pra ver detalhes e demonstrar interesse via WhatsApp.
 *
 * URL: /touch/<slug-do-loteamento>
 */
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Stand3D, type Lote3D } from '@/components/Stand3D';
import {
  salvarCalibracaoSatelite,
  resetarCalibracaoSatelite,
} from '@/app/admin/(dashboard)/loteamentos/[id]/mapa/actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const l = await prisma.loteamento.findUnique({
    where: { slug: params.slug },
    select: { nome: true },
  });
  return {
    title: l ? `${l.nome} — Maquete 3D` : 'Maquete 3D',
    robots: { index: false, follow: false }, // não indexa
  };
}

export default async function TouchStandPage({
  params,
}: {
  params: { slug: string };
}) {
  const loteamento = await prisma.loteamento.findUnique({
    where: { slug: params.slug },
    include: {
      loteadora: {
        select: { nome: true, logo: true, whatsapp: true, telefone: true, corPrimaria: true, corSecundaria: true },
      },
      lotes: {
        orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
        select: {
          id: true,
          codigo: true,
          quadra: true,
          numero: true,
          area: true,
          preco: true,
          status: true,
          tipo: true,
          descricao: true,
          mapaX: true,
          mapaY: true,
          mapaLargura: true,
          mapaAltura: true,
        },
      },
    },
  });

  if (!loteamento || !loteamento.publicado || !loteamento.ativo) notFound();

  // Filtra apenas lotes com geometria definida (X/Y/W/H)
  const lotes3d: Lote3D[] = loteamento.lotes
    .filter(
      (l) =>
        l.mapaX != null && l.mapaY != null && l.mapaLargura != null && l.mapaAltura != null
    )
    .map((l) => ({
      id: l.id,
      codigo: l.codigo,
      quadra: l.quadra,
      numero: l.numero,
      area: Number(l.area),
      preco: Number(l.preco),
      status: l.status,
      tipo: l.tipo,
      descricao: l.descricao,
      x: l.mapaX!,
      y: l.mapaY!,
      w: l.mapaLargura!,
      h: l.mapaAltura!,
    }));

  // Caminho do satélite pré-gerado (Esri tiles compostos via script).
  // Cache buster baseado em updatedAt do loteamento (força reload quando admin regenera).
  const satelitePath =
    loteamento.lat && loteamento.lng
      ? `/uploads/${loteamento.slug}/satelite-stand.jpg?v=${loteamento.updatedAt.getTime()}`
      : null;

  // Calibração da vista satélite (não afeta posições da planta).
  // Compat com formato legado de `scale` único.
  const rawCalib = (loteamento.mapaSateliteCalib ?? {}) as Record<string, unknown>;
  const legacyScale = typeof rawCalib.scale === 'number' ? rawCalib.scale : 1;
  const sateliteCalib = {
    offsetX: typeof rawCalib.offsetX === 'number' ? rawCalib.offsetX : 0,
    offsetY: typeof rawCalib.offsetY === 'number' ? rawCalib.offsetY : 0,
    scaleX: typeof rawCalib.scaleX === 'number' ? rawCalib.scaleX : legacyScale,
    scaleY: typeof rawCalib.scaleY === 'number' ? rawCalib.scaleY : legacyScale,
    rotation: typeof rawCalib.rotation === 'number' ? rawCalib.rotation : 0,
  };

  // Detecta se admin está logado — se sim, mostra painel pra ajustar calibração na própria tela
  const session = await getSession();
  const isAdmin =
    !!session &&
    (session.loteadoraId === null || session.loteadoraId === loteamento.loteadoraId);

  return (
    <Stand3D
      loteamentoNome={loteamento.nome}
      loteamentoCidade={`${loteamento.cidade}/${loteamento.estado}`}
      loteamentoSlug={loteamento.slug}
      loteamentoEndereco={loteamento.endereco}
      imagemMapa={loteamento.imagemMapa}
      satelitePath={satelitePath}
      sateliteCalib={sateliteCalib}
      lat={loteamento.lat}
      lng={loteamento.lng}
      lotes={lotes3d}
      loteadora={{
        nome: loteamento.loteadora.nome,
        logo: loteamento.loteadora.logo,
        whatsapp: loteamento.loteadora.whatsapp,
        telefone: loteamento.loteadora.telefone,
        corPrimaria: loteamento.loteadora.corPrimaria,
        corSecundaria: loteamento.loteadora.corSecundaria,
      }}
      isAdmin={isAdmin}
      loteamentoId={loteamento.id}
      salvarSateliteCalibAction={isAdmin ? salvarCalibracaoSatelite : undefined}
      resetarSateliteCalibAction={isAdmin ? resetarCalibracaoSatelite : undefined}
    />
  );
}
