'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { UploadGaleria, UploadUnico } from '@/components/lotes/UploadMidia';

// =====================================================================
// TIPOS
// =====================================================================

interface DocItem {
  nome: string;
  url: string;
}

export interface LoteamentoFormValues {
  loteadoraId?: string;
  nome?: string;
  slug?: string;
  tagline?: string | null;
  subtagline?: string | null;
  descricao?: string | null;
  parcelaAPartirDe?: number | null;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string | null;
  lat?: number | null;
  lng?: number | null;
  cartorio?: string | null;
  comarca?: string | null;
  imagemCapa?: string | null;
  imagensGaleria?: string[];
  imagemMapa?: string | null;
  diferenciais?: string[];
  documentos?: DocItem[];
  videoApresentacao?: string | null;
  videoApresentacaoPoster?: string | null;
  videoHero?: string | null;
  videoHeroPoster?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  reservaMinutos?: number;
  maxParcelas?: number;
  permiteFinanciamento?: boolean;
  ativo?: boolean;
  publicado?: boolean;
}

type FormState = { error?: string; ok?: boolean };

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: LoteamentoFormValues;
  submitLabel?: string;
  loteadoras: { id: string; nome: string }[];
  loteadoraFixa?: boolean;
}

type TabId =
  | 'geral'
  | 'localizacao'
  | 'marketing'
  | 'midia'
  | 'documentos'
  | 'contato'
  | 'configuracoes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'localizacao', label: 'Localização' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'midia', label: 'Mídia' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'contato', label: 'Contato' },
  { id: 'configuracoes', label: 'Configurações' },
];

// =====================================================================
// HELPERS
// =====================================================================

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================

export function LoteamentoForm({
  action,
  initial,
  submitLabel = 'Salvar',
  loteadoras,
  loteadoraFixa,
}: Props) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const [tab, setTab] = useState<TabId>('geral');

  // Estado controlado dos campos
  const [loteadoraId, setLoteadoraId] = useState(initial?.loteadoraId ?? '');
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugManual, setSlugManual] = useState(!!initial?.slug);
  /**
   * Pasta das mídias no servidor. Segue o slug porque é o que as já existentes
   * usam (/uploads/parquetucano/...). Loteamento novo, ainda sem slug, cai numa
   * pasta genérica — os arquivos ficam achados do mesmo jeito, e mover depois
   * quebraria as URLs já gravadas.
   */
  const pastaMidia = (initial?.slug || slug || 'loteamentos').trim();
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [subtagline, setSubtagline] = useState(initial?.subtagline ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [parcelaAPartirDe, setParcelaAPartirDe] = useState(
    initial?.parcelaAPartirDe != null ? String(initial.parcelaAPartirDe) : ''
  );

  const [endereco, setEndereco] = useState(initial?.endereco ?? '');
  const [cidade, setCidade] = useState(initial?.cidade ?? '');
  const [estado, setEstado] = useState(initial?.estado ?? '');
  const [cep, setCep] = useState(initial?.cep ?? '');
  const [lat, setLat] = useState(initial?.lat != null ? String(initial.lat) : '');
  const [lng, setLng] = useState(initial?.lng != null ? String(initial.lng) : '');
  const [cartorio, setCartorio] = useState(initial?.cartorio ?? '');
  const [comarca, setComarca] = useState(initial?.comarca ?? '');

  const [imagemCapa, setImagemCapa] = useState(initial?.imagemCapa ?? '');
  const [imagemMapa, setImagemMapa] = useState(initial?.imagemMapa ?? '');
  const [galeria, setGaleria] = useState<string[]>(initial?.imagensGaleria ?? []);
  const [diferenciais, setDiferenciais] = useState<string[]>(initial?.diferenciais ?? []);
  const [documentos, setDocumentos] = useState<DocItem[]>(initial?.documentos ?? []);

  const [videoApresentacao, setVideoApresentacao] = useState(initial?.videoApresentacao ?? '');
  const [videoApresentacaoPoster, setVideoApresentacaoPoster] = useState(
    initial?.videoApresentacaoPoster ?? ''
  );
  const [videoHero, setVideoHero] = useState(initial?.videoHero ?? '');
  const [videoHeroPoster, setVideoHeroPoster] = useState(initial?.videoHeroPoster ?? '');

  const [contatoNome, setContatoNome] = useState(initial?.contatoNome ?? '');
  const [contatoTelefone, setContatoTelefone] = useState(initial?.contatoTelefone ?? '');
  const [contatoEmail, setContatoEmail] = useState(initial?.contatoEmail ?? '');

  const [reservaMinutos, setReservaMinutos] = useState(initial?.reservaMinutos ?? 15);
  const [maxParcelas, setMaxParcelas] = useState(initial?.maxParcelas ?? 120);
  const [permiteFinanciamento, setPermiteFinanciamento] = useState(
    initial?.permiteFinanciamento ?? true
  );
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [publicado, setPublicado] = useState(initial?.publicado ?? false);

  // Auto-slug do nome
  useEffect(() => {
    if (!slugManual && nome) setSlug(slugify(nome));
  }, [nome, slugManual]);

  // Contagem de issues por aba (validação simples client-side)
  const counts = useMemo(() => {
    return {
      geral: !nome || !loteadoraId ? 1 : 0,
      localizacao: !endereco || !cidade || estado.length !== 2 ? 1 : 0,
      marketing: 0,
      midia: 0,
      documentos: 0,
      contato: 0,
      configuracoes: 0,
    } as Record<TabId, number>;
  }, [nome, loteadoraId, endereco, cidade, estado]);

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden inputs para conteúdos serializados */}
      <input type="hidden" name="loteadoraId" value={loteadoraId} />
      <input type="hidden" name="nome" value={nome} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="tagline" value={tagline} />
      <input type="hidden" name="subtagline" value={subtagline} />
      <input type="hidden" name="descricao" value={descricao} />
      <input type="hidden" name="parcelaAPartirDe" value={parcelaAPartirDe} />
      <input type="hidden" name="endereco" value={endereco} />
      <input type="hidden" name="cidade" value={cidade} />
      <input type="hidden" name="estado" value={estado} />
      <input type="hidden" name="cep" value={cep} />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
      <input type="hidden" name="cartorio" value={cartorio} />
      <input type="hidden" name="comarca" value={comarca} />
      <input type="hidden" name="imagemCapa" value={imagemCapa} />
      <input type="hidden" name="imagemMapa" value={imagemMapa} />
      <input type="hidden" name="imagensGaleria" value={JSON.stringify(galeria)} />
      <input type="hidden" name="diferenciais" value={JSON.stringify(diferenciais)} />
      <input type="hidden" name="documentos" value={JSON.stringify(documentos)} />
      <input type="hidden" name="videoApresentacao" value={videoApresentacao} />
      <input type="hidden" name="videoApresentacaoPoster" value={videoApresentacaoPoster} />
      <input type="hidden" name="videoHero" value={videoHero} />
      <input type="hidden" name="videoHeroPoster" value={videoHeroPoster} />
      <input type="hidden" name="contatoNome" value={contatoNome} />
      <input type="hidden" name="contatoTelefone" value={contatoTelefone} />
      <input type="hidden" name="contatoEmail" value={contatoEmail} />
      <input type="hidden" name="reservaMinutos" value={reservaMinutos} />
      <input type="hidden" name="maxParcelas" value={maxParcelas} />
      {permiteFinanciamento && <input type="hidden" name="permiteFinanciamento" value="on" />}
      {ativo && <input type="hidden" name="ativo" value="on" />}
      {publicado && <input type="hidden" name="publicado" value="on" />}

      {state.error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
          ❌ {state.error}
        </div>
      )}
      {state.ok && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg p-3">
          ✓ Alterações salvas com sucesso.
        </div>
      )}

      {/* Abas: quebram de linha em vez de rolar. O overflow-x-auto de antes
          fazia o CSS calcular overflow-y como auto, e o -mb-px dos botões
          estourava um pixel — daí a barra de rolagem vertical numa faixa de
          40px de altura. */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex flex-wrap gap-0.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            const issues = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative -mb-px whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'border-primary-600 bg-primary-50/70 font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
                    : 'border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                }`}
              >
                {t.label}
                {issues > 0 && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT */}
      <div>
        {tab === 'geral' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Loteadora (proprietário)" required>
                <select
                  value={loteadoraId}
                  onChange={(e) => setLoteadoraId(e.target.value)}
                  disabled={loteadoraFixa}
                  className={inputCls}
                >
                  <option value="" disabled>
                    — Selecione —
                  </option>
                  {loteadoras.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <div className="flex flex-wrap gap-2 mt-1">
                  <Toggle label="Operacional" value={ativo} onChange={setAtivo} />
                  <Toggle
                    label="Publicado no site"
                    value={publicado}
                    onChange={setPublicado}
                  />
                </div>
              </Field>
              <Field label="Nome do loteamento" required>
                <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
              </Field>
              <Field label="URL pública (slug)" hint="/{slug}">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">/</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlug(slugify(e.target.value));
                      setSlugManual(true);
                    }}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </Field>
              <Field label="Tagline (chamada principal)" hint="ex: O melhor lugar para morar em Tucano">
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className={inputCls}
                  maxLength={120}
                />
              </Field>
              <Field label="Subtagline" hint="texto curto de apoio embaixo da tagline">
                <input
                  value={subtagline}
                  onChange={(e) => setSubtagline(e.target.value)}
                  className={inputCls}
                  maxLength={160}
                />
              </Field>
              <Field label="Descrição" wide>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  className={inputCls}
                />
              </Field>
              <Field label="Parcela a partir de (R$)" hint="usado em destaques de marketing">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={parcelaAPartirDe}
                  onChange={(e) => setParcelaAPartirDe(e.target.value)}
                  placeholder="599.00"
                  className={inputCls}
                />
              </Field>
              <Field label="Permite financiamento direto">
                <Toggle
                  label={permiteFinanciamento ? 'Sim — parcelamento ativo' : 'Não — só à vista'}
                  value={permiteFinanciamento}
                  onChange={setPermiteFinanciamento}
                />
              </Field>
            </div>
          </Card>
        )}

        {tab === 'localizacao' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Endereço" required wide>
                <input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="CEP">
                <input value={cep} onChange={(e) => setCep(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Cidade" required wide>
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="UF" required>
                <input
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  maxLength={2}
                  className={`${inputCls} uppercase`}
                />
              </Field>
              <Field label="Latitude" hint="ex: -10.97364">
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Longitude" hint="ex: -38.78812">
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Abrir no Maps" hint="cole de copiar coords lat,lng">
                {lat && lng ? (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 rounded-lg"
                  >
                    📍 Ver no Google Maps
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    preencha lat + lng pra ver o link
                  </p>
                )}
              </Field>

              <div className="md:col-span-3 mt-4">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                  📜 Dados cartoriais (usados em contratos)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Cartório" hint="ex: Cartório de Registro de Imóveis de Tucano/BA">
                    <input
                      value={cartorio}
                      onChange={(e) => setCartorio(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Comarca" hint="se vazio, usa Cidade">
                    <input
                      value={comarca}
                      onChange={(e) => setComarca(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Card>
        )}

        {tab === 'marketing' && (
          <Card>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              ⭐ Diferenciais do loteamento
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Aparecem como bullets/chips no site público (ex: Portaria 24h, Asfalto, Área de lazer)
            </p>
            <ChipsEditor
              items={diferenciais}
              onChange={setDiferenciais}
              placeholder="Ex: Portaria 24h"
              addLabel="+ Adicionar diferencial"
            />
          </Card>
        )}

        {tab === 'midia' && (
          <div className="space-y-4">
            <Card title="Imagens principais">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UploadUnico
                  label="Imagem de capa"
                  hint="aparece no card do loteamento (16:9 sugerido)"
                  value={imagemCapa}
                  onChange={setImagemCapa}
                  subdir={pastaMidia}
                />
                <UploadUnico
                  label="Imagem do mapa / planta"
                  hint="mostrada na seção mapa"
                  value={imagemMapa}
                  onChange={setImagemMapa}
                  subdir={pastaMidia}
                />
              </div>
            </Card>

            <Card title="Galeria de fotos">
              <UploadGaleria items={galeria} onChange={setGaleria} subdir={pastaMidia} />
            </Card>

            <Card title="Vídeos">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UploadUnico
                  label="Vídeo de apresentação"
                  hint="seção 'sobre o loteamento'"
                  tipo="video"
                  value={videoApresentacao}
                  onChange={setVideoApresentacao}
                  subdir={pastaMidia}
                />
                <UploadUnico
                  label="Pôster do vídeo de apresentação"
                  hint="imagem exibida antes de dar play"
                  value={videoApresentacaoPoster}
                  onChange={setVideoApresentacaoPoster}
                  subdir={pastaMidia}
                />
                <UploadUnico
                  label="Vídeo do hero"
                  hint="roda ao fundo do topo da página"
                  tipo="video"
                  value={videoHero}
                  onChange={setVideoHero}
                  subdir={pastaMidia}
                />
                <UploadUnico
                  label="Pôster do hero"
                  hint="primeiro quadro, enquanto o vídeo carrega"
                  value={videoHeroPoster}
                  onChange={setVideoHeroPoster}
                  subdir={pastaMidia}
                />
              </div>
            </Card>
          </div>
        )}

        {tab === 'documentos' && (
          <Card title="Documentos do loteamento">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Matrícula, memorial descritivo, alvarás. Aparecem na seção
              &ldquo;documentos&rdquo; do site público.
            </p>
            <DocumentosEditor items={documentos} onChange={setDocumentos} />
          </Card>
        )}

        {tab === 'contato' && (
          <Card title="Contato comercial">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Nome do responsável">
                <input
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input
                  value={contatoTelefone}
                  onChange={(e) => setContatoTelefone(e.target.value)}
                  placeholder="(75) 99999-9999"
                  className={inputCls}
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={contatoEmail}
                  onChange={(e) => setContatoEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Card>
        )}

        {tab === 'configuracoes' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Tempo de reserva (minutos)"
                hint="quanto tempo o lote fica reservado durante checkout antes de liberar"
              >
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={reservaMinutos}
                  onChange={(e) => setReservaMinutos(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Máximo de parcelas" hint="limite do financiamento direto">
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={maxParcelas}
                  onChange={(e) => setMaxParcelas(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
          </Card>
        )}
      </div>

      {/* STICKY ACTIONS */}
      <StickyActions submitLabel={submitLabel} />
    </form>
  );
}

// =====================================================================
// COMPONENTES DE APOIO
// =====================================================================

const inputCls =
  'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm';

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      {title && (
        <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
      )}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        value
          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          value ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {label}
    </button>
  );
}

// =====================================================================
// IMAGEM com preview
// =====================================================================
function ChipsEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const [novo, setNovo] = useState('');
  function adicionar() {
    const v = novo.trim();
    if (!v) return;
    onChange([...items, v]);
    setNovo('');
  }
  function remover(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder={placeholder}
          className={inputCls}
        />
        <button
          type="button"
          onClick={adicionar}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg whitespace-nowrap"
        >
          {addLabel ?? '+ Adicionar'}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Nenhum item ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 dark:bg-primary-500/20 text-primary-800 dark:text-primary-200 rounded-full text-xs font-medium"
            >
              {it}
              <button
                type="button"
                onClick={() => remover(i)}
                className="hover:text-red-600 text-xs"
                aria-label="Remover"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// DOCUMENTOS (lista nome|url)
// =====================================================================
function DocumentosEditor({
  items,
  onChange,
}: {
  items: DocItem[];
  onChange: (v: DocItem[]) => void;
}) {
  const [novoNome, setNovoNome] = useState('');
  const [novaUrl, setNovaUrl] = useState('');

  function adicionar() {
    const n = novoNome.trim();
    const u = novaUrl.trim();
    if (!n || !u) return;
    onChange([...items, { nome: n, url: u }]);
    setNovoNome('');
    setNovaUrl('');
  }
  function remover(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  function atualizar(i: number, patch: Partial<DocItem>) {
    onChange(items.map((d, j) => (i === j ? { ...d, ...patch } : d)));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-end p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Nome
          </label>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Memorial descritivo"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            URL do PDF/arquivo
          </label>
          <input
            type="url"
            value={novaUrl}
            onChange={(e) => setNovaUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={adicionar}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg whitespace-nowrap"
        >
          + Adicionar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 italic px-3">Nenhum documento cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((d, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <input
                value={d.nome}
                onChange={(e) => atualizar(i, { nome: e.target.value })}
                className={inputCls}
              />
              <input
                type="url"
                value={d.url}
                onChange={(e) => atualizar(i, { url: e.target.value })}
                className={`${inputCls} font-mono text-xs`}
              />
              <div className="flex items-center gap-1.5">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-2 text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  title="Abrir"
                >
                  ↗
                </a>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="px-2 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                  title="Remover"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// STICKY ACTION BAR
// =====================================================================
function StickyActions({ submitLabel }: { submitLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 -mx-6 lg:-mx-8 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 px-6 lg:px-8 py-3 mt-6 z-10">
      <div className="max-w-7xl mx-auto flex items-center justify-end gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400 mr-auto">
          As alterações são aplicadas em todas as abas ao salvar
        </span>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg inline-flex items-center gap-2"
        >
          {pending ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando…
            </>
          ) : (
            <>💾 {submitLabel}</>
          )}
        </button>
      </div>
    </div>
  );
}
