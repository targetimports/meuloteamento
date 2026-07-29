'use client';

export function ImprimirButton({ label = '🖨️ Imprimir / Salvar PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
    >
      {label}
    </button>
  );
}
