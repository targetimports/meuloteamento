'use client';

/**
 * Documentos anexados à venda.
 *
 * O campo de arquivo era o `<input type="file">` cru com o botão nativo
 * pintado de dourado: não dava para arrastar, mostrava "Nenhum arquivo
 * escolhido" e, com vários selecionados, só dizia "3 arquivos" — quem
 * escolhia o RG errado no meio de cinco páginas descobria depois de enviar.
 * Agora a área aceita arrastar, lista o que foi escolhido e deixa tirar um
 * item antes de mandar.
 */

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
  { value: '', label: 'Sem categoria' },
  { value: 'RG', label: 'RG' },
  { value: 'CPF', label: 'CPF' },
  { value: 'COMPROVANTE_RESIDENCIA', label: 'Comprovante de residência' },
  { value: 'COMPROVANTE_RENDA', label: 'Comprovante de renda' },
  { value: 'CONTRATO', label: 'Contrato (físico)' },
  { value: 'RECIBO', label: 'Recibo' },
  { value: 'CHEQUE', label: 'Foto do cheque' },
  { value: 'OUTRO', label: 'Outro' },
];

/** Tetos do servidor. Passar deles aqui só adiantaria uma recusa lá. */
const MAX_ARQUIVOS = 20;
/** O nginx corta o corpo em 30 MB; a folga cobre os campos do formulário. */
const MAX_LOTE_BYTES = 28 * 1024 * 1024;

const ACEITOS =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*,application/pdf';

function categoriaLabel(value: string | null): string {
  if (!value) return '—';
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

function formatBytes(n: number | null): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Extensão como selo: diz o formato sem depender de emoji. */
function extensao(nome: string, mime: string | null): string {
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (ext && ext.length <= 4) return ext.toUpperCase();
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'IMG';
  if (m === 'application/pdf') return 'PDF';
  return 'DOC';
}

const CORES_SELO: Record<string, string> = {
  PDF: 'bg-red-50 text-red-700 ring-red-600/20',
  JPG: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  JPEG: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  PNG: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  WEBP: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  HEIC: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  IMG: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  DOC: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  DOCX: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  XLS: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  XLSX: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  CSV: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

function Selo({ nome, mime }: { nome: string; mime: string | null }) {
  const ext = extensao(nome, mime);
  return (
    <span
      className={`inline-flex h-8 w-11 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-wide ring-1 ring-inset ${
        CORES_SELO[ext] ?? 'bg-slate-100 text-slate-600 ring-slate-500/20'
      }`}
    >
      {ext}
    </span>
  );
}

const campoClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400';

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
  const [selecionados, setSelecionados] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro(null);
    setSelecionados((atuais) => {
      // Mesmo nome e mesmo tamanho é o mesmo arquivo escolhido duas vezes —
      // enviar duplicado só suja a lista de documentos da venda.
      const chave = (f: File) => `${f.name}::${f.size}`;
      const vistos = new Set(atuais.map(chave));
      const novos = Array.from(lista).filter((f) => !vistos.has(chave(f)));
      const juntos = [...atuais, ...novos];
      if (juntos.length > MAX_ARQUIVOS) {
        setErro(`O envio aceita no máximo ${MAX_ARQUIVOS} arquivos por vez.`);
        return juntos.slice(0, MAX_ARQUIVOS);
      }
      return juntos;
    });
    // Zera o input para que escolher o mesmo arquivo de novo dispare o evento.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    if (selecionados.length === 0) {
      setErro('Selecione pelo menos 1 arquivo.');
      return;
    }
    // Vai tudo numa requisição só. Estourando o limite do servidor web, a
    // recusa vem em HTML e o erro que aparecia era "Falha ao enviar" — sem
    // dizer que o problema era o tamanho, nem o que fazer.
    const somaBytes = selecionados.reduce((s, f) => s + f.size, 0);
    if (somaBytes > MAX_LOTE_BYTES) {
      setErro(
        `São ${formatBytes(somaBytes)} de uma vez — o limite por envio é ${formatBytes(MAX_LOTE_BYTES)}. Mande em duas partes.`
      );
      return;
    }

    const fd = new FormData();
    for (const f of selecionados) fd.append('arquivo', f);
    if (categoria) fd.append('categoria', categoria);
    if (descricao) fd.append('descricao', descricao);

    setUploading(true);
    setProgresso(`Enviando ${selecionados.length} arquivo(s)…`);
    try {
      const res = await fetch(`/api/admin/vendas/${vendaId}/arquivos`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(
          data.error ??
            (res.status === 413
              ? 'Os arquivos somam mais do que o servidor aceita por envio. Mande em partes.'
              : 'Falha ao enviar arquivos')
        );
        setProgresso(null);
        setUploading(false);
        return;
      }
      setProgresso(`${data.criados?.length ?? 0} arquivo(s) enviado(s)`);
      setCategoria('');
      setDescricao('');
      setSelecionados([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      const res = await fetch(`/api/admin/vendas/arquivo/${arquivoId}`, { method: 'DELETE' });
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

  const totalSelecionado = selecionados.reduce((s, f) => s + f.size, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Documentos da venda</h2>
          <p className="text-xs text-slate-500">
            RG, CPF, comprovantes, contratos físicos, fotos de cheques.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {arquivos.length} arquivo(s) · até 25 MB cada
        </p>
      </div>

      <form onSubmit={handleUpload} className="mb-5 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Categoria (opcional)
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={campoClass}
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
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Frente do RG, comprovante de março…"
              className={campoClass}
              maxLength={160}
              disabled={uploading}
            />
          </div>
        </div>

        {/* Área de seleção: clicar abre o seletor, arrastar também serve. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            if (!uploading) adicionar(e.dataTransfer.files);
          }}
          className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
            arrastando ? 'border-primary-500 bg-primary-50/60' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACEITOS}
            onChange={(e) => adicionar(e.target.files)}
            className="sr-only"
            id={`arquivos-${vendaId}`}
            disabled={uploading}
          />
          <label
            htmlFor={`arquivos-${vendaId}`}
            className={`text-sm font-medium text-primary-700 ${
              uploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:underline'
            }`}
          >
            Escolher arquivos
          </label>
          <span className="text-sm text-slate-500"> ou arraste aqui</span>
          <p className="mt-1 text-xs text-slate-400">PDF, imagens, doc, xls — até 25 MB cada</p>
        </div>

        {selecionados.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {selecionados.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <Selo nome={f.name} mime={f.type} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={f.name}>
                  {f.name}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setSelecionados((l) => l.filter((_, j) => j !== i))}
                  disabled={uploading}
                  className="shrink-0 text-xs font-medium text-slate-500 transition hover:text-red-600 disabled:opacity-50"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={uploading || pending || selecionados.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? 'Enviando…'
              : selecionados.length > 0
                ? `Enviar ${selecionados.length} arquivo(s) · ${formatBytes(totalSelecionado)}`
                : 'Enviar arquivos'}
          </button>
          {progresso && <span className="text-xs font-medium text-emerald-700">{progresso}</span>}
          {erro && <span className="text-xs font-medium text-red-700">{erro}</span>}
        </div>
      </form>

      {arquivos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Nenhum documento anexado a esta venda.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Arquivo</th>
                  <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">
                    Categoria
                  </th>
                  <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">
                    Tamanho
                  </th>
                  <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">
                    Enviado em
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {arquivos.map((a) => {
                  const dt = new Date(a.createdAt);
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <Selo nome={a.nomeOriginal} mime={a.mimeType} />
                          <div className="min-w-0">
                            <p
                              className="truncate font-medium text-slate-900"
                              title={a.nomeOriginal}
                            >
                              {a.nomeOriginal}
                            </p>
                            {a.descricao && (
                              <p className="truncate text-xs text-slate-500" title={a.descricao}>
                                {a.descricao}
                              </p>
                            )}
                            {/* Em tela estreita as colunas somem: os dados vêm para cá. */}
                            <p className="mt-0.5 text-[10px] text-slate-400 sm:hidden">
                              {categoriaLabel(a.categoria)} · {formatBytes(a.tamanho)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-700 sm:table-cell">
                        {categoriaLabel(a.categoria)}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-700 md:table-cell">
                        {formatBytes(a.tamanho)}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-500 md:table-cell">
                        {dt.toLocaleDateString('pt-BR')}{' '}
                        {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-3">
                          <a
                            href={`/api/admin/vendas/arquivo/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary-600 hover:underline"
                            title="Abrir em nova aba"
                          >
                            Ver
                          </a>
                          <a
                            href={`/api/admin/vendas/arquivo/${a.id}?download=1`}
                            className="text-xs font-medium text-slate-600 hover:underline"
                            title="Baixar arquivo"
                          >
                            Baixar
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id, a.nomeOriginal)}
                            disabled={pending}
                            className="text-xs font-medium text-red-600 transition hover:underline disabled:opacity-50"
                            title="Excluir"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
