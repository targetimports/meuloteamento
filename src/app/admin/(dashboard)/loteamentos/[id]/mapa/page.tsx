import { existsSync } from 'fs';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canAccessLoteamento } from '@/lib/tenant';
import { MapaUploader } from '@/components/MapaUploader';
import { MapaEditor } from '@/components/MapaEditor';
import { salvarPosicoes, salvarCalibracaoSatelite, resetarCalibracaoSatelite } from './actions';

/** Normaliza calibração do satélite (compat com formato legado `scale` único).
 *  Inlinado aqui porque MapaEditor é 'use client' — funções exportadas dele
 *  viram client references e não podem rodar no server. */
function normalizeSateliteCalib(raw: unknown) {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacyScale = typeof c.scale === 'number' ? c.scale : 1;
  return {
    offsetX: typeof c.offsetX === 'number' ? c.offsetX : 0,
    offsetY: typeof c.offsetY === 'number' ? c.offsetY : 0,
    scaleX: typeof c.scaleX === 'number' ? c.scaleX : legacyScale,
    scaleY: typeof c.scaleY === 'number' ? c.scaleY : legacyScale,
    rotation: typeof c.rotation === 'number' ? c.rotation : 0,
  };
}

export const dynamic = 'force-dynamic';

export default async function MapaPage({ params }: { params: { id: string } }) {
  const loteamento = await prisma.loteamento.findUnique({
    where: { id: params.id },
    select: {
      id: true, nome: true, loteadoraId: true, slug: true, imagemMapa: true,
      lat: true, lng: true, updatedAt: true,
      mapaSateliteCalib: true,
    },
  });
  if (!loteamento) notFound();
  // Sem esta checagem um admin abre o loteamento de outra empresa pelo id.
  if (!(await canAccessLoteamento(loteamento.loteadoraId))) notFound();

  // Lê calibração do satélite (normaliza compat com formato legado de `scale` único)
  const sateliteCalib = normalizeSateliteCalib(loteamento.mapaSateliteCalib);

  // Checa se existe satélite pré-gerado pra esse loteamento
  const satelitePath = `/uploads/${loteamento.slug}/satelite-stand.jpg`;
  const sateliteExiste = existsSync(
    path.join(process.cwd(), 'public', satelitePath)
  );
  const sateliteUrl = sateliteExiste
    ? `${satelitePath}?v=${loteamento.updatedAt.getTime()}`
    : null;

  const lotes = await prisma.lote.findMany({
    where: { loteamentoId: loteamento.id },
    orderBy: [{ quadra: 'asc' }, { numero: 'asc' }],
    select: {
      id: true,
      codigo: true,
      quadra: true,
      numero: true,
      status: true,
      mapaX: true,
      mapaY: true,
      mapaLargura: true,
      mapaAltura: true,
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <Link
          href={`/admin/loteamentos/${loteamento.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {loteamento.nome}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Mapeamento dos lotes</h1>
        <p className="text-sm text-slate-500">
          Envie a planta do loteamento (PDF ou imagem) e demarque cada lote na posição correta. Os lotes
          ficam clicáveis na LP pública.
        </p>
      </div>

      <MapaUploader loteamentoId={loteamento.id} hasMap={!!loteamento.imagemMapa} />

      {loteamento.imagemMapa ? (
        lotes.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
            <p className="text-slate-600 mb-3">Nenhum lote cadastrado ainda.</p>
            <Link
              href={`/admin/loteamentos/${loteamento.id}/lotes`}
              className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Cadastrar lotes primeiro
            </Link>
          </div>
        ) : (
          <MapaEditor
            loteamentoId={loteamento.id}
            imagemMapa={loteamento.imagemMapa}
            sateliteUrl={sateliteUrl}
            sateliteCalib={sateliteCalib}
            lotes={lotes.map((l) => ({
              id: l.id,
              codigo: l.codigo,
              quadra: l.quadra,
              numero: l.numero,
              status: l.status,
              mapaX: l.mapaX,
              mapaY: l.mapaY,
              mapaLargura: l.mapaLargura,
              mapaAltura: l.mapaAltura,
            }))}
            salvarAction={salvarPosicoes}
            salvarSateliteCalibAction={salvarCalibracaoSatelite}
            resetarSateliteCalibAction={resetarCalibracaoSatelite}
          />
        )
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 text-sm">
          Envie o mapa do loteamento acima pra começar a demarcar os lotes.
        </div>
      )}
    </div>
  );
}
