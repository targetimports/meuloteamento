'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export type VendaArquivoItem = {
  id: string;
  nomeOriginal: string;
  mimeType: string | null;
  tamanho: number | null;
  categoria: string | null;
  descricao: string | null;
  createdAt: Date | string;
};

const CATEGORIAS = [
  { value: '', label: '— sem categoria —' },
  { value: 'RG', label: '🪪 RG' },
  { value: 'CPF', label: '🪪 CPF' },
  { value: 'COMPROVANTE_RESIDENCIA', label: '🏠 Comprovante de residência' },
  { value: 'COMPROVANTE_RENDA', label: '💰 Comprovante de renda' },
  { value: 'CONTRATO', label: '📄 Contrato (físico)' },
  { value: 'RECIBO', label: '🧾 Recibo' },
  { value: 'CHEQUE', label: '🧾 Foto do cheque' },
  { value: 'OUTRO', label: '📎 Outro' },
];

function categoriaLabel(value: string | null): string {
  if (!value) return '—';
  const item = CATEGORIAS.find((c) => c.value === value);
  return item?.label ?? value;
}

function formatBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconePorMime(mime: string | null, nome: string): string {
  const m = (mime ?? '').toLowerCase();
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(ext))
    return '🖼️';
  if (m === 'application/pdf' || ext === 'pdf') return '📄';
  if (m.includes('word') || ['doc', 'docx'].includes(ext)) return '📝';
  if (m.includes('excel') || m.includes('sheet') || ['xls', 'xlsx', 'csv'].includes(ext))
    return '📊';
  if (ext === 'txt') return '📃';
  return '📎';
}

export function VendaArquivosCard({
  vendaId,
  arquivos,
}: {
  vendaId: string;
  arquivos: VendaArquivoItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const input = fileInputRef.current;
    if (!input || !input.files || input.files.length === 0) {
      setErro('Selecione pelo menos 1 arquivo.');
      return;
    }
    const fd = new FormData();
    for (const f of Array.from(input.files)) {
      fd.append('arquivo', f);
    }
    if (categoria) fd.append('categoria', categoria);
    if (descricao) fd.append('descricao', descricao);

    setUploading(true);
    setProgresso(`Enviando ${input.files.length} arquivo(s)...`);
    try {
      const res = await fetch(`/api/admin/vendas/${vendaId}/arquivos`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? 'Falha ao enviar arquivos');
        setProgresso(null);
        setUploading(false);
        return;
      }
      // Sucesso — limpa form e refresca
      setProgresso(`✓ ${data.criados?.length ?? 0} arquivo(s) enviado(s)`);
      setCategoria('');
      setDescricao('');
      if (input) input.value = '';
      startTransition(() => router.refresh());
      setTimeout(() => setProgresso(null), 3000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
      setProgresso(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(arquivoId: string, nome: string) {
    if (
      !confirm(
        `Remover "${nome}"?\n\nO arquivo será excluído do servidor e não poderá ser recuperado.`
      )
    ) {
      return;
    }
    setErro(null);
    try {
      const res = await fetch(`/api/admin/vendas/arquivo/${arquivoId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? 'Falha ao remover');
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
    }
  }

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>📎</span> Documentos da venda
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Anexe RG, CPF, comprovantes, contratos físicos, fotos de cheques, etc.
          </p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {arquivos.length} arquivo(s) · até 25 MB cada
        </p>
      </div>

      {/* Upload form */}
      <form
        onSubmit={handleUpload}
        className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4 space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Categoria (opcional)
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              disabled={uploading}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Frente do RG, Comprovante mar/2025…"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              maxLength={160}
              disabled={uploading}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Selecionar arquivos (PDF, imagens, doc, xls…)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*,application/pdf"
            className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 file:cursor-pointer"
            disabled={uploading}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={uploading || pending}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {uploading ? 'Enviando…' : '📤 Enviar arquivos'}
          </button>
          {progresso && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              {progresso}
            </span>
          )}
          {erro && (
            <span className="text-xs text-red-700 dark:text-red-400 font-semibold">
              {erro}
            </span>
          )}
        </div>
      </form>

      {/* Lista */}
      {arquivos.length === 0 ? (
        <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          Nenhum documento anexado a esta venda.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Arquivo</th>
                <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">
                  Categoria
                </th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">
                  Tamanho
                </th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">
                  Enviado em
                </th>
                <th className="text-right px-3 py-2 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {arquivos.map((a) => {
                const dt = new Date(a.createdAt);
                return (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl flex-shrink-0">
                          {iconePorMime(a.mimeType, a.nomeOriginal)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate" title={a.nomeOriginal}>
                            {a.nomeOriginal}
                          </p>
                          {a.descricao && (
                            <p
                              className="text-xs text-slate-500 dark:text-slate-400 truncate"
                              title={a.descricao}
                            >
                              {a.descricao}
                            </p>
                          )}
                          {/* mobile: mostra categoria/tamanho inline */}
                          <p className="text-[10px] text-slate-400 sm:hidden mt-0.5">
                            {categoriaLabel(a.categoria)} · {formatBytes(a.tamanho)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 hidden sm:table-cell text-xs">
                      {categoriaLabel(a.categoria)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 hidden md:table-cell text-xs">
                      {formatBytes(a.tamanho)}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden md:table-cell text-xs">
                      {dt.toLocaleDateString('pt-BR')} {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1 items-center justify-end">
                        <a
                          href={`/api/admin/vendas/arquivo/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                          title="Abrir em nova aba"
                        >
                          👁 Ver
                        </a>
                        <a
                          href={`/api/admin/vendas/arquivo/${a.id}?download=1`}
                          className="text-xs px-2 py-1 rounded bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-medium"
                          title="Baixar arquivo"
                        >
                          ⬇
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, a.nomeOriginal)}
                          disabled={pending}
                          className="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-300 font-medium disabled:opacity-50"
                          title="Excluir"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
