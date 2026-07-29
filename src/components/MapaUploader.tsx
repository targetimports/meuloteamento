'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function MapaUploader({
  loteamentoId,
  hasMap,
}: {
  loteamentoId: string;
  hasMap: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch(`/api/admin/loteamentos/${loteamentoId}/mapa-upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Falha no upload');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900 mb-1">
        {hasMap ? 'Substituir mapa' : 'Enviar mapa do loteamento'}
      </h3>
      <p className="text-sm text-slate-500 mb-4">
        Envie o PDF da planta ou uma imagem (PNG/JPG/WebP). PDFs são convertidos em alta resolução automaticamente.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="hidden"
      />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Escolher arquivo
            </>
          )}
        </button>
        <p className="text-xs text-slate-500 self-center">
          Tamanho máximo: 25 MB
        </p>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
          {error}
        </p>
      )}
    </div>
  );
}
