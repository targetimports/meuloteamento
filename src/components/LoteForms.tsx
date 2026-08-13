'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

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

// =====================================================================
// CRIAR LOTE INDIVIDUAL
// =====================================================================

export function NovoLoteForm({
  action,
  tipos,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  tipos?: TipoLoteUI[];
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const { lista, tipo, tipoId, setTipoId, preco, setPreco } = usePrecoPorTipo(tipos);

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900 mb-3">Adicionar lote individual</h3>

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
        <div className="flex items-end gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="esquina" type="checkbox" className="rounded" />
            <span>Esquina</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="fronteAreaVerde" type="checkbox" className="rounded" />
            <span>Frente p/ área verde</span>
          </label>
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
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  tipos?: TipoLoteUI[];
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const { lista, tipo, tipoId, setTipoId, preco, setPreco } = usePrecoPorTipo(tipos);

  return (
    <form action={formAction} className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900 mb-1">Criar lotes em massa</h3>
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
// EDITAR LOTE
// =====================================================================

export function EditarLoteForm({
  loteId,
  initial,
  action,
  onDelete,
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
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const { lista, tipo, tipoId, setTipoId, preco, setPreco } = usePrecoPorTipo(
    tipos,
    initial.preco
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
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

        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="esquina" type="checkbox" defaultChecked={initial.esquina} className="rounded" />
            <span>Esquina</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input name="fronteAreaVerde" type="checkbox" defaultChecked={initial.fronteAreaVerde} className="rounded" />
            <span>Frente para área verde</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Fotos (uma URL por linha)</label>
          <textarea
            name="fotos"
            defaultValue={initial.fotos.join('\n')}
            rows={2}
            className={inputClass}
            placeholder="https://exemplo.com/foto1.jpg"
          />
        </div>

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
