'use client';

import { useMemo, useRef, useState } from 'react';
import type { FormCampo } from '@/lib/formulario-tipos';

interface LoteOption {
  id: string;
  codigo: string;
  quadra: string;
  area: number;
  preco: number;
}

interface Props {
  slug: string;
  nome: string;
  descricao: string | null;
  campos: FormCampo[];
  lotes: LoteOption[];
  mensagemSucesso?: string | null;
  redirectUrl?: string | null;
  corPrimaria?: string | null;
  loteadoraNome?: string | null;
  loteadoraLogo?: string | null;
  loteamentoNome?: string | null;
}

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function FormularioPublico({
  slug,
  nome,
  descricao,
  campos,
  lotes,
  mensagemSucesso,
  redirectUrl,
  corPrimaria,
  loteadoraNome,
  loteadoraLogo,
  loteamentoNome,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [arquivos, setArquivos] = useState<Record<string, File[]>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const cor = corPrimaria ?? '#10b981';

  // ----- valida e envia -----
  const obrigatoriosFaltando = useMemo(() => {
    const faltam: string[] = [];
    for (const c of campos) {
      if (!c.obrigatorio) continue;
      if (c.tipo === 'titulo' || c.tipo === 'paragrafo') continue;
      if (['arquivo', 'foto', 'documento'].includes(c.tipo)) {
        if (!arquivos[c.id] || arquivos[c.id].length === 0) faltam.push(c.label);
      } else if (c.tipo === 'checkbox') {
        const v = valores[c.id];
        if (!Array.isArray(v) || v.length === 0) faltam.push(c.label);
      } else {
        const v = valores[c.id];
        if (v === undefined || v === null || v === '') faltam.push(c.label);
      }
    }
    return faltam;
  }, [campos, valores, arquivos]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (obrigatoriosFaltando.length > 0) {
      setErro(`Preencha: ${obrigatoriosFaltando.join(', ')}`);
      return;
    }

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('dados', JSON.stringify(valores));
      for (const [campoId, arr] of Object.entries(arquivos)) {
        for (const file of arr) {
          fd.append(`arquivo:${campoId}`, file);
        }
      }
      const res = await fetch(`/api/formularios/${slug}/responder`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErro(json.error || `Erro ${res.status}`);
        return;
      }
      setSucesso(true);
      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 2000);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setEnviando(false);
    }
  }

  // ----- tela de sucesso -----
  if (sucesso) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: `linear-gradient(135deg, ${cor}15, ${cor}05)`,
        }}
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white text-3xl mb-4"
            style={{ background: cor }}
          >
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Enviado!</h1>
          <p className="text-sm text-slate-600">
            {mensagemSucesso ??
              'Recebemos suas informações. Em breve entraremos em contato.'}
          </p>
          {redirectUrl && (
            <p className="text-xs text-slate-400 mt-4">Redirecionando…</p>
          )}
        </div>
      </div>
    );
  }

  // ----- form -----
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <form ref={formRef} onSubmit={submit} className="max-w-2xl mx-auto">
        {/* HEADER */}
        <div
          className="rounded-t-2xl p-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${cor}, ${cor}cc)`,
          }}
        >
          <div className="flex items-center gap-3">
            {loteadoraLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loteadoraLogo}
                alt={loteadoraNome ?? ''}
                className="w-12 h-12 rounded-lg bg-white p-1 object-contain"
              />
            ) : null}
            <div>
              {loteadoraNome && (
                <p className="text-xs text-white/80 uppercase tracking-widest font-semibold">
                  {loteadoraNome}
                </p>
              )}
              <h1 className="text-xl font-bold leading-tight">{nome}</h1>
              {loteamentoNome && (
                <p className="text-xs text-white/80">{loteamentoNome}</p>
              )}
            </div>
          </div>
          {descricao && (
            <p className="text-sm text-white/90 mt-4 leading-snug">{descricao}</p>
          )}
        </div>

        {/* CAMPOS */}
        <div className="bg-white rounded-b-2xl shadow-sm divide-y divide-slate-100">
          {campos.map((campo) => (
            <div key={campo.id} className="p-5">
              <CampoInput
                campo={campo}
                valor={valores[campo.id]}
                arquivos={arquivos[campo.id]}
                lotes={lotes}
                cor={cor}
                onChange={(v) => setValores({ ...valores, [campo.id]: v })}
                onArquivosChange={(files) =>
                  setArquivos({ ...arquivos, [campo.id]: files })
                }
              />
            </div>
          ))}
        </div>

        {/* ERROR */}
        {erro && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {erro}
          </div>
        )}

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={enviando}
          className="mt-6 w-full text-white font-semibold py-3.5 rounded-2xl shadow-lg disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2"
          style={{ background: cor }}
        >
          {enviando ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Enviando…
            </>
          ) : (
            'Enviar'
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          🔒 Suas informações são tratadas com privacidade.
        </p>
      </form>
    </div>
  );
}

// =====================================================================
// CAMPO INDIVIDUAL
// =====================================================================
function CampoInput({
  campo,
  valor,
  arquivos,
  lotes,
  cor,
  onChange,
  onArquivosChange,
}: {
  campo: FormCampo;
  valor: unknown;
  arquivos?: File[];
  lotes: LoteOption[];
  cor: string;
  onChange: (v: unknown) => void;
  onArquivosChange: (files: File[]) => void;
}) {
  const baseInput =
    'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm bg-white text-slate-900';
  const focusStyle = { outlineColor: cor };

  if (campo.tipo === 'titulo') {
    return (
      <div>
        <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
          {campo.label}
        </h2>
        {campo.descricao && (
          <p className="text-xs text-slate-500 mt-1">{campo.descricao}</p>
        )}
      </div>
    );
  }
  if (campo.tipo === 'paragrafo') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-sm text-slate-700 whitespace-pre-wrap">
          {campo.descricao || campo.label}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-900 mb-1">
        {campo.label}
        {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {campo.descricao && (
        <p className="text-xs text-slate-500 mb-2">{campo.descricao}</p>
      )}

      {campo.tipo === 'text' || campo.tipo === 'nome' || campo.tipo === 'email' || campo.tipo === 'numero' || campo.tipo === 'data' ? (
        <input
          type={
            campo.tipo === 'email' ? 'email'
              : campo.tipo === 'numero' ? 'number'
                : campo.tipo === 'data' ? 'date'
                  : 'text'
          }
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder}
          minLength={campo.minLength}
          maxLength={campo.maxLength}
          className={baseInput}
          style={focusStyle}
        />
      ) : campo.tipo === 'cpf' ? (
        <input
          inputMode="numeric"
          value={maskCpfCnpj(String(valor ?? ''))}
          onChange={(e) => onChange(maskCpfCnpj(e.target.value))}
          placeholder={campo.placeholder ?? '000.000.000-00'}
          className={baseInput}
          style={focusStyle}
        />
      ) : campo.tipo === 'telefone' ? (
        <input
          inputMode="numeric"
          value={maskTelefone(String(valor ?? ''))}
          onChange={(e) => onChange(maskTelefone(e.target.value))}
          placeholder={campo.placeholder ?? '(00) 00000-0000'}
          className={baseInput}
          style={focusStyle}
        />
      ) : campo.tipo === 'textarea' ? (
        <textarea
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder}
          rows={4}
          className={baseInput}
          style={focusStyle}
        />
      ) : campo.tipo === 'select' ? (
        <select
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          style={focusStyle}
        >
          <option value="">— Selecione —</option>
          {(campo.opcoes ?? []).map((op) => (
            <option key={op.valor} value={op.label}>
              {op.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === 'radio' ? (
        <div className="space-y-2">
          {(campo.opcoes ?? []).map((op) => (
            <label key={op.valor} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
              <input
                type="radio"
                name={campo.id}
                checked={valor === op.label}
                onChange={() => onChange(op.label)}
              />
              <span className="text-sm text-slate-900">{op.label}</span>
            </label>
          ))}
        </div>
      ) : campo.tipo === 'checkbox' ? (
        <div className="space-y-2">
          {(campo.opcoes ?? []).map((op) => {
            const arr = Array.isArray(valor) ? (valor as string[]) : [];
            const checked = arr.includes(op.label);
            return (
              <label key={op.valor} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, op.label]);
                    else onChange(arr.filter((v) => v !== op.label));
                  }}
                />
                <span className="text-sm text-slate-900">{op.label}</span>
              </label>
            );
          })}
        </div>
      ) : campo.tipo === 'sim_nao' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange('sim')}
            className={`p-3 rounded-lg border-2 text-sm font-semibold transition ${
              valor === 'sim'
                ? 'text-white'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            style={valor === 'sim' ? { background: cor, borderColor: cor } : {}}
          >
            ✓ Sim
          </button>
          <button
            type="button"
            onClick={() => onChange('nao')}
            className={`p-3 rounded-lg border-2 text-sm font-semibold transition ${
              valor === 'nao'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            ✗ Não
          </button>
        </div>
      ) : campo.tipo === 'lote' ? (
        <select
          value={String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          style={focusStyle}
        >
          <option value="">— Selecione o lote —</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.codigo}>
              {l.codigo} · Quadra {l.quadra} · {l.area.toFixed(0)} m² · {formatBRL(l.preco)}
            </option>
          ))}
        </select>
      ) : (
        // arquivo / foto / documento
        <UploadArquivos
          campo={campo}
          arquivos={arquivos ?? []}
          onChange={onArquivosChange}
          cor={cor}
        />
      )}
    </div>
  );
}

// =====================================================================
// UPLOAD DE ARQUIVOS (com hint pra câmera no celular)
// =====================================================================
function UploadArquivos({
  campo,
  arquivos,
  onChange,
  cor,
}: {
  campo: FormCampo;
  arquivos: File[];
  onChange: (files: File[]) => void;
  cor: string;
}) {
  const aceita = campo.aceita || (campo.tipo === 'foto' ? 'image/*' : 'image/*,application/pdf');
  const maxMb = campo.tamanhoMaxMb ?? 10;
  const useCamera = campo.tipo === 'foto' || campo.tipo === 'documento';
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  function handleFiles(files: FileList | null, append: boolean) {
    if (!files) return;
    setErroLocal(null);
    const novos: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > maxMb * 1024 * 1024) {
        setErroLocal(`"${f.name}" passou de ${maxMb} MB`);
        continue;
      }
      novos.push(f);
    }
    onChange(append ? [...arquivos, ...novos] : novos);
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Upload normal */}
        <label
          className="cursor-pointer block p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 text-center transition"
        >
          <input
            type="file"
            accept={aceita}
            multiple
            onChange={(e) => handleFiles(e.target.files, false)}
            className="hidden"
          />
          <p className="text-2xl mb-1">📁</p>
          <p className="text-xs font-medium text-slate-700">Escolher arquivo</p>
          <p className="text-[10px] text-slate-500">do dispositivo</p>
        </label>

        {/* Câmera (só foto/documento) */}
        {useCamera && (
          <label
            className="cursor-pointer block p-3 border-2 border-dashed rounded-lg text-center transition text-white"
            style={{ borderColor: cor, background: `${cor}15` }}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files, true)}
              className="hidden"
            />
            <p className="text-2xl mb-1">📸</p>
            <p className="text-xs font-semibold" style={{ color: cor }}>
              Usar câmera
            </p>
            <p className="text-[10px]" style={{ color: cor }}>
              tirar foto agora
            </p>
          </label>
        )}
      </div>

      {erroLocal && (
        <p className="text-xs text-red-600 mt-2">{erroLocal}</p>
      )}

      {/* Lista de arquivos anexados */}
      {arquivos.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {arquivos.map((f, i) => {
            const isImg = f.type.startsWith('image/');
            const url = URL.createObjectURL(f);
            return (
              <div
                key={i}
                className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg"
              >
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-white rounded text-xl">
                    📄
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {Math.round(f.size / 1024)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(arquivos.filter((_, j) => j !== i))}
                  className="text-red-500 hover:bg-red-50 rounded p-1 text-xs"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-1.5">
        Aceita: {aceita.replace(/,/g, ', ')} · máx {maxMb} MB cada
      </p>
    </div>
  );
}
