'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import {
  enviarFotosDoLote,
  removerFotoDoLote,
} from '@/app/admin/(dashboard)/loteamentos/[id]/lotes/actions';
import { CarrosselFotos } from '@/components/lotes/CarrosselFotos';

type FormState = { error?: string; ok?: boolean; criados?: number };

/**
 * Tipo de lote cadastrado no simulador — vira opção de preço aqui.
 *
 * Digitar o preço à mão em 200 lotes é onde o erro aparece: basta um zero a
 * mais e a parcela que o site anuncia deixa de bater com a do lote. Escolhendo
 * o tipo, o preço vem do mesmo lugar que alimenta o simulador e a venda.
 *
 * Ausente ou vazio para empresa que não cadastrou tipos, e aí o formulário
 * fica igual ao que sempre foi.
 */
export interface TipoLoteUI {
  id: string;
  nome: string;
  preco: number;
  /** Vazio quando a loteadora não definiu — e aí o lote fica no padrão. */
  categoria?: 'RESIDENCIAL' | 'COMERCIAL' | '';
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Estado compartilhado pelos três formulários: o tipo escolhido manda no preço. */
function usePrecoPorTipo(tipos: TipoLoteUI[] | undefined, precoInicial?: number) {
  const [tipoId, setTipoId] = useState('');
  const [preco, setPreco] = useState(precoInicial === undefined ? '' : String(precoInicial));
  const lista = tipos ?? [];
  const tipo = lista.find((t) => t.id === tipoId) ?? null;

  useEffect(() => {
    if (tipo) setPreco(String(tipo.preco));
  }, [tipo]);

  return { lista, tipo, tipoId, setTipoId, preco, setPreco };
}

function SelectTipo({
  lista,
  tipoId,
  setTipoId,
}: {
  lista: TipoLoteUI[];
  tipoId: string;
  setTipoId: (v: string) => void;
}) {
  if (lista.length === 0) return null;
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de lote</label>
      <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={inputClass}>
        <option value="">— Preço livre —</option>
        {lista.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome} — {brl(t.preco)}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-400 mt-1">
        Escolher um tipo preenche o preço com o valor cadastrado no simulador, para o
        lote não sair de um valor que o site não anuncia.
      </p>
    </div>
  );
}

/**
 * Só envia o campo quando o tipo escolhido declara a categoria.
 *
 * Sem o campo no envio, a action não mexe no residencial/comercial do lote —
 * que é o que precisa acontecer para quem não usa tipos, e para os tipos que
 * ficaram sem categoria definida.
 */
function CategoriaDoTipo({ tipo }: { tipo: TipoLoteUI | null }) {
  if (!tipo?.categoria) return null;
  return <input type="hidden" name="tipo" value={tipo.categoria} />;
}

/** Preço travado sob um tipo: digitar aqui contradiria a opção escolhida. */
function InputPreco({
  preco,
  setPreco,
  travado,
  obrigatorio = true,
}: {
  preco: string;
  setPreco: (v: string) => void;
  travado: boolean;
  obrigatorio?: boolean;
}) {
  return (
    <input
      name="preco"
      type="number"
      step="0.01"
      required={obrigatorio}
      value={preco}
      onChange={(e) => setPreco(e.target.value)}
      readOnly={travado}
      className={`${inputClass} ${travado ? 'bg-slate-50 text-slate-600' : ''}`}
      placeholder="120000.00"
    />
  );
}

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg"
    >
      {pending ? loadingLabel ?? 'Salvando...' : label}
    </button>
  );
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm';

/**
 * Dentro de um modal o formulario nao precisa da propria moldura: o modal ja e
 * o cartao, e dois quadros aninhados sao ruido.
 */
const moldura = (embutido?: boolean) =>
  embutido ? '' : 'bg-white border border-slate-200 rounded-xl p-5';

// =====================================================================
// CRIAR LOTE INDIVIDUAL
// =====================================================================

export function NovoLoteForm({
  action,
  tipos,
  embutido,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  tipos?: TipoLoteUI[];
  embutido?: boolean;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const { lista, tipo, tipoId, setTipoId, preco, setPreco } = usePrecoPorTipo(tipos);

  return (
    <form action={formAction} className={moldura(embutido)}>
      {!embutido && (
        <h3 className="font-semibold text-slate-900 mb-3">Adicionar lote individual</h3>
      )}

      {state.error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          Lote criado.
        </div>
      )}

      <SelectTipo lista={lista} tipoId={tipoId} setTipoId={setTipoId} />
      <CategoriaDoTipo tipo={tipo} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Quadra *</label>
          <input name="quadra" required className={inputClass} placeholder="A" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Número *</label>
          <input name="numero" required className={inputClass} placeholder="01" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Área (m²) *</label>
          <input name="area" type="number" step="0.01" required className={inputClass} placeholder="300.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Preço (R$) *</label>
          <InputPreco preco={preco} setPreco={setPreco} travado={Boolean(tipo)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Testada (m)</label>
          <input name="testada" type="number" step="0.01" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fundo (m)</label>
          <input name="fundo" type="number" step="0.01" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Orientação solar</label>
          <select name="orientacaoSolar" className={inputClass} defaultValue="">
            <option value="">—</option>
            <option value="NORTE">Norte</option>
            <option value="SUL">Sul</option>
            <option value="LESTE">Leste</option>
            <option value="OESTE">Oeste</option>
            <option value="NORDESTE">Nordeste</option>
            <option value="NOROESTE">Noroeste</option>
            <option value="SUDESTE">Sudeste</option>
            <option value="SUDOESTE">Sudoeste</option>
          </select>
        </div>
        {/* Empilhados, não lado a lado: na largura de uma coluna da grade
            "Frente p/ área verde" quebrava em duas linhas e o quadradinho
            ficava centralizado no meio do texto, desalinhado do vizinho. */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Características</label>
          <div className="flex flex-col gap-1.5 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input name="esquina" type="checkbox" className="shrink-0 rounded border-slate-300" />
              <span>Esquina</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                name="fronteAreaVerde"
                type="checkbox"
                className="shrink-0 rounded border-slate-300"
              />
              <span>Frente p/ área verde</span>
            </label>
          </div>
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
          <input name="descricao" className={inputClass} placeholder="Observações adicionais" />
        </div>
      </div>

      <SubmitButton label="Adicionar lote" loadingLabel="Criando..." />
    </form>
  );
}

// =====================================================================
// CRIAR LOTES EM MASSA
// =====================================================================

export function NovosLotesEmMassaForm({
  action,
  tipos,
  embutido,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  tipos?: TipoLoteUI[];
  embutido?: boolean;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const { lista, tipo, tipoId, setTipoId, preco, setPreco } = usePrecoPorTipo(tipos);

  return (
    <form action={formAction} className={moldura(embutido)}>
      {!embutido && <h3 className="font-semibold text-slate-900 mb-1">Criar lotes em massa</h3>}
      <p className="text-xs text-slate-500 mb-3">
        Útil para cadastrar uma quadra inteira de uma vez. Todos os lotes terão a mesma área e preço — ajuste individualmente depois se necessário.
      </p>

      {state.error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mb-3 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          {state.criados} lote(s) criado(s).
        </div>
      )}

      <SelectTipo lista={lista} tipoId={tipoId} setTipoId={setTipoId} />
      <CategoriaDoTipo tipo={tipo} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Quadra *</label>
          <input name="quadra" required className={inputClass} placeholder="A" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nº inicial *</label>
          <input name="numeroInicial" type="number" min="1" defaultValue="1" required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Quantidade *</label>
          <input name="quantidade" type="number" min="1" max="200" defaultValue="20" required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Área (m²) *</label>
          <input name="area" type="number" step="0.01" required className={inputClass} placeholder="300.00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Preço (R$) *</label>
          <InputPreco preco={preco} setPreco={setPreco} travado={Boolean(tipo)} />
        </div>
      </div>

      <SubmitButton label="Criar lotes em massa" loadingLabel="Criando..." />
    </form>
  );
}

// =====================================================================
// FOTOS DO LOTE
// =====================================================================

/** 8 MB, o mesmo teto que o servidor aplica. */
const MAX_FOTO_BYTES = 8 * 1024 * 1024;

/**
 * Envia as fotos na hora, fora do formulário do lote.
 *
 * De propósito não faz parte do "Salvar": upload de imagem é lento e falha por
 * motivos próprios (arquivo grande, formato errado), e amarrá-lo ao salvamento
 * faria uma foto recusada derrubar a edição inteira do lote.
 */
function FotosDoLote({ loteId, fotos }: { loteId: string; fotos: string[] }) {
  const [lista, setLista] = useState(fotos);
  /** Índice da foto aberta em tela cheia; null = visualizador fechado. */
  const [vendo, setVendo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  function enviar(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setErro(null);

    // Barra o arquivo grande antes de subir: esperar o upload de 20 MB para
    // ouvir "acima de 8 MB" é o pior jeito de dar essa notícia.
    const grandes = Array.from(arquivos).filter((a) => a.size > MAX_FOTO_BYTES);
    if (grandes.length > 0) {
      setErro(`Acima de 8 MB: ${grandes.map((a) => a.name).join(', ')}.`);
      if (campo.current) campo.current.value = '';
      return;
    }

    const dados = new FormData();
    for (const a of Array.from(arquivos)) dados.append('fotos', a);

    iniciar(async () => {
      const r = await enviarFotosDoLote(loteId, dados);
      if (r.erro) setErro(r.erro);
      if (r.fotos) setLista(r.fotos);
      if (campo.current) campo.current.value = '';
    });
  }

  function remover(url: string) {
    setErro(null);
    iniciar(async () => {
      const r = await removerFotoDoLote(loteId, url);
      if (!r.ok) setErro(r.erro ?? 'Não foi possível remover.');
      else setLista((l) => l.filter((f) => f !== url));
    });
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">Fotos</label>

      {lista.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {lista.map((url, i) => (
            <div key={url} className="relative group">
              {/* Botão, não img com onClick: o teclado precisa alcançar a foto
                  para abri-la, e o cursor precisa dizer que ali se clica. */}
              <button
                type="button"
                onClick={() => setVendo(i)}
                title="Ver maior"
                className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Foto ${i + 1} do lote`}
                  className="h-20 w-20 rounded-lg border border-slate-200 object-cover transition hover:brightness-90"
                />
              </button>
              <button
                type="button"
                onClick={() => remover(url)}
                disabled={pendente}
                title="Remover foto"
                aria-label="Remover foto"
                className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-slate-900/80 text-white text-xs leading-none opacity-0 group-hover:opacity-100 focus:opacity-100 transition disabled:opacity-40"
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
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={pendente}
        onChange={(e) => enviar(e.target.files)}
        className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-60"
      />
      <p className="text-[11px] text-slate-400 mt-1">
        PNG, JPG ou WebP, até 8 MB cada. A foto é enviada na hora, sem precisar salvar o lote.
      </p>
      {pendente && <p className="text-[11px] text-slate-500 mt-1">Enviando…</p>}
      {erro && <p className="text-[11px] text-red-600 mt-1">{erro}</p>}

      <CarrosselFotos fotos={lista} inicial={vendo} aoFechar={() => setVendo(null)} />
    </div>
  );
}

// =====================================================================
// EDITAR LOTE
// =====================================================================

export function EditarLoteForm({
  loteId,
  initial,
  action,
  onDelete,
  tipos,
  embutido,
}: {
  loteId: string;
  initial: {
    area: number;
    preco: number;
    descricao: string | null;
    status: string;
    motivoBloqueio: string | null;
    orientacaoSolar: string | null;
    esquina: boolean;
    fronteAreaVerde: boolean;
    fotos: string[];
  };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onDelete: () => Promise<void>;
  tipos?: TipoLoteUI[];
  embutido?: boolean;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const { lista, tipo, tipoId, setTipoId, preco, setPreco } = usePrecoPorTipo(
    tipos,
    initial.preco
  );

  return (
    <div className={moldura(embutido)}>
      <form action={formAction} className="space-y-3">
        {state.error && (
          <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            Atualizado.
          </div>
        )}

        <SelectTipo lista={lista} tipoId={tipoId} setTipoId={setTipoId} />
      <CategoriaDoTipo tipo={tipo} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Área (m²)</label>
            <input name="area" type="number" step="0.01" defaultValue={initial.area} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Preço (R$)</label>
            <InputPreco preco={preco} setPreco={setPreco} travado={Boolean(tipo)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select name="status" defaultValue={initial.status} className={inputClass}>
              <option value="DISPONIVEL">Disponível</option>
              <option value="RESERVADO">Reservado</option>
              <option value="EM_PAGAMENTO">Em pagamento</option>
              <option value="VENDIDO">Vendido</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Orientação</label>
            <select name="orientacaoSolar" defaultValue={initial.orientacaoSolar ?? ''} className={inputClass}>
              <option value="">—</option>
              <option value="NORTE">Norte</option>
              <option value="SUL">Sul</option>
              <option value="LESTE">Leste</option>
              <option value="OESTE">Oeste</option>
              <option value="NORDESTE">Nordeste</option>
              <option value="NOROESTE">Noroeste</option>
              <option value="SUDESTE">Sudeste</option>
              <option value="SUDOESTE">Sudoeste</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Motivo do bloqueio (se status = Bloqueado)</label>
          <input
            name="motivoBloqueio"
            defaultValue={initial.motivoBloqueio ?? ''}
            className={inputClass}
            placeholder="Ex: reserva interna, manutenção"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              name="esquina"
              type="checkbox"
              defaultChecked={initial.esquina}
              className="shrink-0 rounded border-slate-300"
            />
            <span>Esquina</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              name="fronteAreaVerde"
              type="checkbox"
              defaultChecked={initial.fronteAreaVerde}
              className="shrink-0 rounded border-slate-300"
            />
            <span>Frente para área verde</span>
          </label>
        </div>

        <FotosDoLote loteId={loteId} fotos={initial.fotos} />

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
          <input name="descricao" defaultValue={initial.descricao ?? ''} className={inputClass} />
        </div>

        <SubmitButton label="Salvar" />
      </form>

      <form action={onDelete} className="mt-3 pt-3 border-t border-slate-100">
        <button
          type="submit"
          className="text-xs text-red-600 hover:text-red-700 font-medium"
          onClick={(e) => {
            if (!confirm('Excluir este lote? A ação é irreversível.')) e.preventDefault();
          }}
        >
          Excluir lote
        </button>
      </form>
    </div>
  );
}
