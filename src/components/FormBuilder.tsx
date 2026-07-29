'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CAMPOS_PADRAO_QUALIFICACAO,
  CAMPO_TIPOS_ARQUIVO,
  slugify,
  type FormCampo,
  type FormCampoTipo,
} from '@/lib/formulario-tipos';
import { salvarFormulario, atualizarFormulario } from '@/app/admin/(dashboard)/formularios/actions';

interface LoteamentoOption {
  id: string;
  nome: string;
  loteadoraNome?: string;
}

interface Props {
  modo: 'novo' | 'editar';
  formularioId?: string;
  loteamentos: LoteamentoOption[];
  initial?: {
    nome: string;
    slug?: string;
    descricao?: string | null;
    ativo: boolean;
    loteamentoId?: string | null;
    campos: FormCampo[];
    mensagemSucesso?: string | null;
    redirectUrl?: string | null;
    corPrimaria?: string | null;
  };
}

const TIPO_LABELS: Record<FormCampoTipo, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  nome: 'Nome completo',
  cpf: 'CPF / CNPJ',
  email: 'E-mail',
  telefone: 'Telefone / WhatsApp',
  numero: 'Número',
  data: 'Data',
  select: 'Lista (dropdown)',
  radio: 'Opção única (botões)',
  checkbox: 'Múltipla escolha',
  sim_nao: 'Sim / Não',
  arquivo: 'Upload de arquivo',
  foto: 'Foto (com câmera)',
  documento: 'Documento (RG/CPF)',
  lote: 'Lote de interesse',
  titulo: 'Título de seção',
  paragrafo: 'Parágrafo / aviso',
};

const TIPO_ICONS: Record<FormCampoTipo, string> = {
  text: '📝',
  textarea: '📄',
  nome: '👤',
  cpf: '🆔',
  email: '✉️',
  telefone: '📞',
  numero: '🔢',
  data: '📅',
  select: '▾',
  radio: '◉',
  checkbox: '☑',
  sim_nao: '👍',
  arquivo: '📎',
  foto: '📸',
  documento: '🪪',
  lote: '🏠',
  titulo: 'H',
  paragrafo: '¶',
};

function generateId(label: string, existing: string[]): string {
  let base = slugify(label).replace(/-/g, '_') || `campo`;
  let id = base;
  let i = 1;
  while (existing.includes(id)) {
    i++;
    id = `${base}_${i}`;
  }
  return id;
}

export function FormBuilder({ modo, formularioId, loteamentos, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState(initial?.nome ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [loteamentoId, setLoteamentoId] = useState(initial?.loteamentoId ?? '');
  const [campos, setCampos] = useState<FormCampo[]>(initial?.campos ?? CAMPOS_PADRAO_QUALIFICACAO);
  const [mensagemSucesso, setMensagemSucesso] = useState(
    initial?.mensagemSucesso ?? 'Recebemos suas informações! Em breve nosso atendente entrará em contato.'
  );
  const [corPrimaria, setCorPrimaria] = useState(initial?.corPrimaria ?? '#10b981');

  function adicionarCampo(tipo: FormCampoTipo) {
    const labelPadrao =
      tipo === 'titulo'
        ? 'Nova seção'
        : tipo === 'paragrafo'
          ? 'Texto explicativo'
          : `Novo campo ${TIPO_LABELS[tipo]}`;
    const id = generateId(labelPadrao, campos.map((c) => c.id));
    const novo: FormCampo = {
      id,
      tipo,
      label: labelPadrao,
      obrigatorio: tipo !== 'titulo' && tipo !== 'paragrafo',
    };
    if (CAMPO_TIPOS_ARQUIVO.includes(tipo)) {
      novo.aceita = tipo === 'foto' ? 'image/*' : 'image/*,application/pdf';
      novo.tamanhoMaxMb = 10;
    }
    if (tipo === 'select' || tipo === 'radio' || tipo === 'checkbox') {
      novo.opcoes = [
        { valor: 'opcao_1', label: 'Opção 1' },
        { valor: 'opcao_2', label: 'Opção 2' },
      ];
    }
    setCampos([...campos, novo]);
  }

  function atualizarCampo(idx: number, patch: Partial<FormCampo>) {
    setCampos(campos.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removerCampo(idx: number) {
    setCampos(campos.filter((_, i) => i !== idx));
  }

  function moverCampo(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= campos.length) return;
    const novos = campos.slice();
    [novos[idx], novos[j]] = [novos[j], novos[idx]];
    setCampos(novos);
  }

  function carregarPadrao() {
    if (
      campos.length > 0 &&
      !confirm('Isso vai substituir todos os campos atuais. Continuar?')
    )
      return;
    setCampos(CAMPOS_PADRAO_QUALIFICACAO);
  }

  function submit() {
    setError(null);
    if (!nome.trim()) {
      setError('Informe o nome do formulário');
      return;
    }
    if (campos.length === 0) {
      setError('Adicione pelo menos um campo');
      return;
    }
    startTransition(async () => {
      const payload = {
        nome,
        slug: slug || undefined,
        descricao,
        ativo,
        loteamentoId: loteamentoId || undefined,
        campos,
        mensagemSucesso,
        corPrimaria,
      };
      const res =
        modo === 'novo'
          ? await salvarFormulario(payload)
          : await atualizarFormulario(formularioId!, payload);
      if (res.error) {
        setError(res.error);
      } else if (res.id) {
        router.push(`/admin/formularios/${res.id}`);
      }
    });
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      {/* CONFIGURAÇÃO BÁSICA */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Configuração</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome do formulário *">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pré-cadastro / Qualificação"
              className="input"
            />
          </Field>
          <Field label="URL pública (slug)" hint="Auto-gerado a partir do nome se vazio">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">/f/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder={slugify(nome) || 'meu-formulario'}
                className="input flex-1"
              />
            </div>
          </Field>
          <Field label="Descrição (opcional)" wide>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Texto que aparece no topo da página pública"
              className="input"
            />
          </Field>
          <Field label="Loteamento vinculado (opcional)" hint="Filtra os lotes mostrados no campo 'Lote de interesse'">
            <select
              value={loteamentoId}
              onChange={(e) => setLoteamentoId(e.target.value)}
              className="input"
            >
              <option value="">— Nenhum / Todos —</option>
              {loteamentos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                  {l.loteadoraNome ? ` · ${l.loteadoraNome}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cor primária">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-slate-300"
              />
              <input
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="input flex-1 font-mono text-xs"
              />
            </div>
          </Field>
          <Field label="Mensagem de sucesso" wide>
            <textarea
              value={mensagemSucesso}
              onChange={(e) => setMensagemSucesso(e.target.value)}
              rows={2}
              className="input"
            />
          </Field>
          <Field label="Status" wide>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {ativo
                  ? '✓ Ativo — aceita respostas'
                  : '✗ Pausado — link público mostra "indisponível"'}
              </span>
            </label>
          </Field>
        </div>
      </section>

      {/* CAMPOS DO FORMULÁRIO */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">
            Campos ({campos.length})
          </h2>
          <button
            onClick={carregarPadrao}
            className="text-xs text-primary-600 hover:underline"
          >
            ↻ Carregar campos padrão (qualificação completa)
          </button>
        </div>

        {/* Lista de campos */}
        <div className="space-y-2 mb-4">
          {campos.map((campo, idx) => (
            <CampoEditor
              key={`${campo.id}-${idx}`}
              campo={campo}
              idx={idx}
              total={campos.length}
              onChange={(patch) => atualizarCampo(idx, patch)}
              onRemove={() => removerCampo(idx)}
              onMoveUp={() => moverCampo(idx, -1)}
              onMoveDown={() => moverCampo(idx, 1)}
            />
          ))}
          {campos.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              Nenhum campo ainda. Adicione abaixo ⬇
            </p>
          )}
        </div>

        {/* Botões para adicionar */}
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
            ➕ Adicionar campo
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(Object.keys(TIPO_LABELS) as FormCampoTipo[]).map((tipo) => (
              <button
                key={tipo}
                onClick={() => adicionarCampo(tipo)}
                className="text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-500/10 border border-slate-200 dark:border-slate-700 hover:border-primary-300 rounded-lg text-xs transition-colors"
              >
                <span className="text-base mr-1">{TIPO_ICONS[tipo]}</span>
                <span className="text-slate-700 dark:text-slate-300">{TIPO_LABELS[tipo]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* AÇÕES */}
      <div className="flex items-center justify-end gap-2 pb-8">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg inline-flex items-center gap-2"
        >
          {pending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando…
            </>
          ) : (
            <>💾 {modo === 'novo' ? 'Criar formulário' : 'Salvar alterações'}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Editor de um único campo
// ----------------------------------------------------------------------
function CampoEditor({
  campo,
  idx,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  campo: FormCampo;
  idx: number;
  total: number;
  onChange: (patch: Partial<FormCampo>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOpcoes = ['select', 'radio', 'checkbox'].includes(campo.tipo);
  const isArquivo = CAMPO_TIPOS_ARQUIVO.includes(campo.tipo);
  const isInfo = campo.tipo === 'titulo' || campo.tipo === 'paragrafo';

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
      {/* HEADER colapsado */}
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-col gap-0">
          <button
            onClick={onMoveUp}
            disabled={idx === 0}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30 text-xs leading-none p-0.5"
            title="Mover para cima"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={idx === total - 1}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30 text-xs leading-none p-0.5"
            title="Mover para baixo"
          >
            ▼
          </button>
        </div>

        <span className="text-lg flex-shrink-0">{TIPO_ICONS[campo.tipo]}</span>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
            {campo.label}
            {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {TIPO_LABELS[campo.tipo]} · id: <span className="font-mono">{campo.id}</span>
          </p>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs px-2 py-1 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded"
        >
          {expanded ? 'Recolher' : 'Editar'}
        </button>
        <button
          onClick={onRemove}
          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
        >
          🗑
        </button>
      </div>

      {/* CORPO expandido */}
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Rótulo (label)">
              <input
                value={campo.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="ID (não muda após criar)" hint="usado para identificar o campo nas respostas">
              <input
                value={campo.id}
                onChange={(e) =>
                  onChange({ id: slugify(e.target.value).replace(/-/g, '_') })
                }
                className="input font-mono text-xs"
              />
            </Field>
            {!isInfo && (
              <Field label="Descrição / ajuda (opcional)" wide>
                <textarea
                  value={campo.descricao ?? ''}
                  onChange={(e) => onChange({ descricao: e.target.value })}
                  rows={2}
                  className="input"
                />
              </Field>
            )}
            {!isInfo && campo.tipo !== 'lote' && (
              <Field label="Placeholder">
                <input
                  value={campo.placeholder ?? ''}
                  onChange={(e) => onChange({ placeholder: e.target.value })}
                  className="input"
                />
              </Field>
            )}
            {!isInfo && (
              <Field label="Obrigatório">
                <label className="flex items-center gap-2 cursor-pointer mt-1.5">
                  <input
                    type="checkbox"
                    checked={!!campo.obrigatorio}
                    onChange={(e) => onChange({ obrigatorio: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Cliente é obrigado a preencher este campo
                  </span>
                </label>
              </Field>
            )}
            {isArquivo && (
              <>
                <Field label="Tipos aceitos" hint='Ex: "image/*" para só foto, "application/pdf" para só PDF'>
                  <input
                    value={campo.aceita ?? ''}
                    onChange={(e) => onChange({ aceita: e.target.value })}
                    placeholder="image/*,application/pdf"
                    className="input font-mono text-xs"
                  />
                </Field>
                <Field label="Tamanho máximo (MB)">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={campo.tamanhoMaxMb ?? 10}
                    onChange={(e) =>
                      onChange({ tamanhoMaxMb: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
              </>
            )}
          </div>

          {isOpcoes && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                Opções
              </p>
              <div className="space-y-1.5">
                {(campo.opcoes ?? []).map((op, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={op.label}
                      onChange={(e) => {
                        const novas = [...(campo.opcoes ?? [])];
                        novas[i] = { ...op, label: e.target.value };
                        onChange({ opcoes: novas });
                      }}
                      placeholder="Texto da opção"
                      className="input flex-1"
                    />
                    <button
                      onClick={() => {
                        onChange({
                          opcoes: (campo.opcoes ?? []).filter((_, j) => j !== i),
                        });
                      }}
                      className="text-red-500 hover:bg-red-50 rounded p-1.5 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const novas = [...(campo.opcoes ?? [])];
                    novas.push({
                      valor: `opcao_${novas.length + 1}`,
                      label: `Opção ${novas.length + 1}`,
                    });
                    onChange({ opcoes: novas });
                  }}
                  className="text-xs text-primary-600 hover:underline"
                >
                  + Adicionar opção
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
      )}
      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(15 23 42);
        }
        :global(.dark .input) {
          background: rgb(15 23 42);
          border-color: rgb(51 65 85);
          color: rgb(241 245 249);
        }
      `}</style>
    </div>
  );
}
