'use client';

/**
 * A planta do loteamento com um único lote destacado.
 *
 * É a mesma imagem e o mesmo sistema de coordenadas do mapa em
 * `/admin/loteamentos/{id}/mapa`: as posições são percentuais sobre um viewBox
 * de 0 a 100, esticado por cima da imagem. Aqui só muda quantos retângulos
 * aparecem — um, o que está sendo editado.
 *
 * Serve para responder "qual lote é este?" sem sair do modal. Código e quadra
 * dizem o nome; o mapa diz o lugar, que é o que se reconhece de fato.
 */

export function MapaDoLote({
  imagemMapa,
  codigo,
  x,
  y,
  largura,
  altura,
}: {
  imagemMapa: string | null;
  codigo: string;
  x: number | null;
  y: number | null;
  largura: number | null;
  altura: number | null;
}) {
  if (!imagemMapa) return null;

  const posicionado = x !== null && y !== null && largura !== null && altura !== null;

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">Posição no mapa</label>

      <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagemMapa}
          alt={`Planta do loteamento com o lote ${codigo} destacado`}
          className="block w-full select-none"
          draggable={false}
        />

        {posicionado && (
          // preserveAspectRatio="none" para o overlay esticar junto com a
          // imagem: as coordenadas foram gravadas em relação a ela, não a um
          // quadrado.
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <rect
              x={x!}
              y={y!}
              width={largura!}
              height={altura!}
              className="fill-primary-500/45 stroke-primary-700"
              strokeWidth={0.35}
            />
          </svg>
        )}
      </div>

      {!posicionado && (
        <p className="text-[11px] text-amber-700 mt-1">
          Este lote ainda não foi posicionado na planta — marque a área dele em Mapa do
          loteamento.
        </p>
      )}
    </div>
  );
}
