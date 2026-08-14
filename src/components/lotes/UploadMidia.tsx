'use client';

/**
 * Campos de mídia por upload, no lugar de colar URL.
 *
 * O valor continua sendo a URL — é o que o banco guarda e o que a landing lê.
 * O que muda é de onde ela vem: antes a pessoa precisava hospedar o arquivo em
 * algum lugar e colar o endereço; agora escolhe o arquivo e o servidor devolve
 * a URL já pronta.
 *
 * O arquivo sobe na hora, mas o campo só passa a valer quando o formulário do
 * loteamento é salvo. Isso é de propósito: sair sem salvar deixa um arquivo
 * órfão no disco, o que é bem mais barato que gravar meia edição no banco.
 */

import { useRef, useState, useTransition } from 'react';

import { enviarMidiaLoteamento } from '@/app/admin/(dashboard)/loteamentos/midia-actions';

const ACEITA = {
  imagem: 'image/png,image/jpeg,image/webp',
  video: 'video/mp4,video/webm',
} as const;

const LIMITE = { imagem: 8, video: 25 } as const;

type Tipo = keyof typeof ACEITA;

function useUpload(subdir: string) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(arquivos: FileList | null, tipo: Tipo, aoTerminar: (url: string) => void) {
    const lista = arquivos ? Array.from(arquivos) : [];
    if (lista.length === 0) return;
    setErro(null);

    // Barra o tamanho antes de subir: esperar o upload inteiro para ouvir que
    // o arquivo é grande demais é a pior hora de dar essa notícia.
    const teto = LIMITE[tipo] * 1024 * 1024;
    const grandes = lista.filter((a) => a.size > teto);
    if (grandes.length > 0) {
      setErro(`Acima de ${LIMITE[tipo]} MB: ${grandes.map((a) => a.name).join(', ')}.`);
      return;
    }

    iniciar(async () => {
      for (const arquivo of lista) {
        const dados = new FormData();
        dados.append('arquivo', arquivo);
        dados.append('subdir', subdir);
        const r = await enviarMidiaLoteamento(dados);
        if (r.ok && r.url) aoTerminar(r.url);
        else setErro(r.erro ?? 'Falha ao enviar.');
      }
    });
  }

  return { enviar, erro, pendente, setErro };
}

const classeInput =
  'block w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 disabled:opacity-60';

/** Uma mídia só: capa, planta, vídeo, pôster. */
export function UploadUnico({
  label,
  hint,
  value,
  onChange,
  subdir,
  tipo = 'imagem',
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  subdir: string;
  tipo?: Tipo;
}) {
  const { enviar, erro, pendente } = useUpload(subdir);
  const campo = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </label>

      {value && (
        <div className="relative mb-2 w-fit">
          {tipo === 'video' ? (
            <video
              src={value}
              controls
              className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={label}
              className="max-h-40 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
            />
          )}
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={pendente}
            title="Remover"
            aria-label="Remover"
            className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-slate-900/80 text-xs leading-none text-white transition hover:bg-slate-900 disabled:opacity-40"
          >
            ×
          </button>
        </div>
      )}

      <input
        ref={campo}
        type="file"
        accept={ACEITA[tipo]}
        disabled={pendente}
        onChange={(e) => {
          enviar(e.target.files, tipo, onChange);
          if (campo.current) campo.current.value = '';
        }}
        className={classeInput}
      />

      <p className="mt-1 text-[11px] text-slate-400">
        {hint ? `${hint} · ` : ''}
        {tipo === 'video' ? 'MP4 ou WebM' : 'PNG, JPG ou WebP'}, até {LIMITE[tipo]} MB.
      </p>
      {pendente && <p className="mt-1 text-[11px] text-slate-500">Enviando…</p>}
      {erro && <p className="mt-1 text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}

/** Várias imagens, com a ordem preservada. */
export function UploadGaleria({
  items,
  onChange,
  subdir,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  subdir: string;
}) {
  const { enviar, erro, pendente } = useUpload(subdir);
  const campo = useRef<HTMLInputElement>(null);

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {items.map((url, i) => (
            <div key={`${url}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                disabled={pendente}
                title="Remover"
                aria-label="Remover"
                className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-slate-900/80 text-xs leading-none text-white transition hover:bg-slate-900 disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={campo}
        type="file"
        accept={ACEITA.imagem}
        multiple
        disabled={pendente}
        onChange={(e) => {
          // Acumula em vez de substituir: mandar cinco fotos de uma vez e ficar
          // só com a última seria o contrário do que "adicionar" quer dizer.
          const novas: string[] = [];
          enviar(e.target.files, 'imagem', (url) => {
            novas.push(url);
            onChange([...items, ...novas]);
          });
          if (campo.current) campo.current.value = '';
        }}
        className={classeInput}
      />

      <p className="mt-1 text-[11px] text-slate-400">
        PNG, JPG ou WebP, até {LIMITE.imagem} MB cada. Pode escolher várias de uma vez.
      </p>
      {pendente && <p className="mt-1 text-[11px] text-slate-500">Enviando…</p>}
      {erro && <p className="mt-1 text-[11px] text-red-600">{erro}</p>}
    </div>
  );
}
