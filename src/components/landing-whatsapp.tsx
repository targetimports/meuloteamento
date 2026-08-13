'use client';

/**
 * Vitrine do atendimento (WhatsApp + CRM) para a landing page.
 *
 * São telas RENDERIZADAS com dados fictícios, não capturas de tela — mesmo
 * padrão de landing-mockups.tsx. O motivo é prático: print vira imagem velha
 * na primeira mudança de layout e ainda pesa no LCP; aqui a vitrine acompanha
 * o design system sozinha.
 *
 * 🔴 Os rótulos são os MESMOS do produto (Lista/Quadro, Por espera/Por status,
 * "Até 15 min", "Aguardando cliente", "Tempo até responder"). Vitrine que
 * inventa nome de coluna cria expectativa que a tela real não cumpre.
 */

import { useState } from 'react';

type Aba = 'caixa' | 'quadro' | 'funil' | 'desempenho';

const ABAS: { chave: Aba; rotulo: string; legenda: string }[] = [
  { chave: 'caixa', rotulo: 'Caixa de entrada', legenda: 'Conversa, mídia, áudio transcrito e o CRM do lado' },
  { chave: 'quadro', rotulo: 'Quadro', legenda: 'Conversas viram cartões por tempo de espera ou por status' },
  { chave: 'funil', rotulo: 'Funil', legenda: 'Etapas que você configura, com SLA por etapa' },
  { chave: 'desempenho', rotulo: 'Desempenho', legenda: 'Quanto tempo o cliente esperou para ser respondido' },
];

export function VitrineAtendimento() {
  const [aba, setAba] = useState<Aba>('caixa');
  const atual = ABAS.find((a) => a.chave === aba)!;

  return (
    <div>
      {/* O mesmo controle segmentado que existe no topo do chat real. */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex flex-wrap justify-center gap-1 p-1 bg-white/[0.06] backdrop-blur border border-white/10 rounded-xl">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAba(a.chave)}
              aria-pressed={aba === a.chave}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                aba === a.chave
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mb-5">{atual.legenda}</p>

      {aba === 'caixa' && <CaixaMock />}
      {aba === 'quadro' && <QuadroMock />}
      {aba === 'funil' && <FunilMock />}
      {aba === 'desempenho' && <DesempenhoMock />}
    </div>
  );
}

// =====================================================================
// MOLDURA — a janelinha com os três pontos, igual aos outros mockups
// =====================================================================

function Janela({
  titulo,
  selo,
  seloClasse = 'bg-emerald-100 text-emerald-700',
  children,
}: {
  titulo: string;
  selo?: string;
  seloClasse?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <p className="text-xs font-medium text-slate-500 truncate px-2">{titulo}</p>
        {selo ? (
          <span className={`text-[10px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${seloClasse}`}>
            {selo}
          </span>
        ) : (
          <span className="w-12" />
        )}
      </div>
      {children}
    </div>
  );
}

// =====================================================================
// CAIXA DE ENTRADA — lista + conversa + painel do lead
// =====================================================================

const CONVERSAS = [
  { nome: 'Maria Oliveira', previa: 'Ainda tem lote na quadra C?', hora: '14:32', naoLidas: 2, ativa: true, etiqueta: 'quente' },
  { nome: 'Carlos Souza', previa: '🎤 Áudio · 0:42', hora: '14:07', naoLidas: 0, ativa: false, etiqueta: 'proposta' },
  { nome: 'João Pedro', previa: 'Você: Segue o contrato em PDF', hora: '13:20', naoLidas: 0, ativa: false, etiqueta: '' },
  { nome: 'Ana Paula', previa: '📷 Foto', hora: 'ontem', naoLidas: 0, ativa: false, etiqueta: 'visita' },
];

function CaixaMock() {
  return (
    <Janela titulo="WhatsApp · Caixa de entrada" selo="● conectado">
      <div className="grid grid-cols-12 bg-slate-100/60 text-left">
        {/* coluna 1 — lista de conversas */}
        <div className="col-span-4 sm:col-span-3 border-r border-slate-200 bg-white">
          <div className="p-2 border-b border-slate-100">
            <div className="flex gap-1 mb-1.5">
              {['Ativas', 'Não lidas', 'Arquivadas'].map((f, i) => (
                <span
                  key={f}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
            <div className="h-5 rounded bg-slate-100 flex items-center px-1.5">
              <span className="text-[9px] text-slate-400">Buscar nome, número ou mensagem</span>
            </div>
          </div>
          {CONVERSAS.map((c) => (
            <div
              key={c.nome}
              className={`flex gap-2 px-2 py-2 border-b border-slate-50 ${c.ativa ? 'bg-primary-50' : ''}`}
            >
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                {c.nome.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <p className="text-[10px] font-semibold text-slate-800 truncate">{c.nome}</p>
                  <span className="text-[8px] text-slate-400 ml-auto flex-shrink-0">{c.hora}</span>
                </div>
                <p className="text-[9px] text-slate-500 truncate">{c.previa}</p>
                {c.etiqueta && (
                  <span className="inline-block mt-0.5 text-[7px] px-1 py-px rounded bg-amber-100 text-amber-700 font-medium">
                    {c.etiqueta}
                  </span>
                )}
              </div>
              {c.naoLidas > 0 && (
                <span className="self-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                  {c.naoLidas}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* coluna 2 — a conversa */}
        <div className="col-span-8 sm:col-span-6 flex flex-col bg-[#efeae2]">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white">
              M
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-800">Maria Oliveira</p>
              <p className="text-[8px] text-slate-400">+55 75 99144-6349 · lead #4187</p>
            </div>
            <div className="ml-auto flex gap-1">
              {['Nota', 'Resolver'].map((b) => (
                <span key={b} className="text-[8px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 p-3 space-y-2">
            <div className="max-w-[80%] bg-white rounded-lg rounded-tl-none px-2.5 py-1.5 shadow-sm">
              <p className="text-[10px] text-slate-700 leading-snug">
                Boa tarde! Vi o Parque Tucano no site. Ainda tem lote na quadra C?
              </p>
              <p className="text-[7px] text-slate-400 text-right mt-0.5">14:30</p>
            </div>

            {/* áudio com transcrição — é o que a tela real faz */}
            <div className="max-w-[85%] bg-white rounded-lg rounded-tl-none px-2.5 py-1.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[7px]">
                  ▶
                </span>
                <div className="flex-1 flex items-center gap-px h-3">
                  {[3, 6, 4, 8, 5, 9, 4, 7, 3, 6, 8, 4, 5, 7, 3, 5].map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 bg-emerald-300 rounded-full"
                      style={{ height: `${h * 11}%` }}
                    />
                  ))}
                </div>
                <span className="text-[7px] text-slate-400">0:42</span>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-100">
                <p className="text-[7px] font-semibold text-primary-600 uppercase tracking-wide">
                  Transcrição automática
                </p>
                <p className="text-[9px] text-slate-600 italic leading-snug">
                  &ldquo;Consigo pagar de entrada uns 15 mil e o resto parcelado, dá certo?&rdquo;
                </p>
              </div>
            </div>

            <div className="max-w-[80%] ml-auto bg-[#d9fdd3] rounded-lg rounded-tr-none px-2.5 py-1.5 shadow-sm">
              <p className="text-[10px] text-slate-700 leading-snug">
                Tem sim, Maria! Quadra C, lote 14, 200m². Dá certo: entrada de R$ 15.000 e 120×
                de R$ 444,42.
              </p>
              <p className="text-[7px] text-slate-400 text-right mt-0.5">14:31 ✓✓</p>
            </div>
          </div>

          <div className="px-3 py-2 bg-white border-t border-slate-200 flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-600 font-medium">
              ⚡ Modelos
            </span>
            <div className="flex-1 h-5 rounded-full bg-slate-100 flex items-center px-2">
              <span className="text-[8px] text-slate-400">Mensagem…</span>
            </div>
            <span className="text-[9px] text-slate-400">📎</span>
            <span className="text-[9px] text-slate-400">🎤</span>
          </div>
        </div>

        {/* coluna 3 — o CRM ao lado da conversa */}
        <div className="hidden sm:block col-span-3 bg-white border-l border-slate-200 p-2.5">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Lead vinculado
          </p>
          <div className="space-y-1.5 text-[9px]">
            {[
              ['Etapa', 'Em atendimento'],
              ['Origem', 'Simulação no site'],
              ['Interesse', 'Quadra C · lote 14'],
              ['Valor', 'R$ 55.000'],
              ['Corretor', 'Rafael M.'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-1">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-700 text-right truncate">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Nota interna
            </p>
            <p className="text-[9px] text-slate-600 leading-snug bg-amber-50 rounded p-1.5">
              Só fecha depois do dia 10. Confirmar entrada por PIX.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {['quente', 'entrada 15k'].map((e) => (
              <span key={e} className="text-[7px] px-1 py-px rounded bg-slate-100 text-slate-600">
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Janela>
  );
}

// =====================================================================
// QUADRO — conversas por tempo de espera
// =====================================================================

function QuadroMock() {
  const colunas = [
    {
      rotulo: 'Até 15 min',
      cor: 'bg-emerald-500',
      itens: [{ nome: 'Ana Paula', previa: 'Pode me mandar a planta?', espera: '4min' }],
    },
    {
      rotulo: '15 min a 1h',
      cor: 'bg-sky-500',
      itens: [
        { nome: 'Maria Oliveira', previa: 'Ainda tem lote na quadra C?', espera: '38min' },
        { nome: 'Rita Alves', previa: '🎤 Áudio · 0:18', espera: '52min' },
      ],
    },
    {
      rotulo: '1h a 4h',
      cor: 'bg-amber-500',
      itens: [{ nome: 'Carlos Souza', previa: 'Fico no aguardo do boleto', espera: '2h' }],
    },
    {
      rotulo: 'Mais de 4h',
      cor: 'bg-red-500',
      itens: [{ nome: 'João Pedro', previa: 'Bom dia, tudo bem?', espera: '6h' }],
    },
  ];

  return (
    <Janela
      titulo="WhatsApp · Quadro"
      selo="Por espera"
      seloClasse="bg-slate-900 text-white"
    >
      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-100/60">
        {colunas.map((col) => (
          <div key={col.rotulo} className="bg-slate-50 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${col.cor}`} />
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide truncate">
                {col.rotulo}
              </p>
              <span className="ml-auto text-[10px] text-slate-400">{col.itens.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.itens.map((c) => (
                <div key={c.nome} className="bg-white rounded-md border border-slate-200 p-2">
                  <p className="text-[11px] font-semibold text-slate-800 truncate">{c.nome}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 truncate">{c.previa}</p>
                  <p className="text-[9px] font-medium text-slate-500 mt-1">esperando {c.espera}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-100 bg-white">
        Um clique troca para <span className="font-semibold text-slate-700">Por status</span> —
        Novo · Em atendimento · Aguardando cliente · Encerrado.
      </p>
    </Janela>
  );
}

// =====================================================================
// FUNIL — etapas configuráveis com SLA
// =====================================================================

function FunilMock() {
  const etapas = [
    { nome: 'Novo', cor: 'bg-sky-500', sla: 'SLA 24h', cards: [{ n: 'Maria Oliveira', o: 'simulação', v: 'R$ 55.000', atraso: false }, { n: 'Rita Alves', o: 'whatsapp', v: 'R$ 55.000', atraso: false }] },
    { nome: 'Em atendimento', cor: 'bg-amber-500', sla: 'SLA 72h', cards: [{ n: 'Carlos Souza', o: 'checkout', v: 'R$ 81.995', atraso: true }] },
    { nome: 'Agendado', cor: 'bg-violet-500', sla: 'SLA 48h', cards: [{ n: 'João Pedro', o: 'whatsapp', v: 'R$ 120.000', atraso: false }] },
    { nome: 'Convertido', cor: 'bg-emerald-500', sla: '', cards: [{ n: 'Beatriz Lima', o: 'feira', v: 'R$ 55.000', atraso: false }] },
  ];

  return (
    <Janela titulo="CRM · Funil de vendas" selo="Etapas configuráveis" seloClasse="bg-slate-900 text-white">
      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-100/60">
        {etapas.map((col) => (
          <div key={col.nome} className="bg-slate-50 rounded-lg p-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${col.cor}`} />
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide truncate">
                {col.nome}
              </p>
              <span className="ml-auto text-[10px] text-slate-400">{col.cards.length}</span>
            </div>
            <p className="text-[8px] text-slate-400 mb-2 ml-3">{col.sla || 'sem prazo'}</p>
            <div className="space-y-1.5">
              {col.cards.map((c) => (
                <div
                  key={c.n}
                  className={`bg-white rounded-md border p-2 ${
                    c.atraso ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-slate-800 truncate">{c.n}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">{c.o}</p>
                  <p className="text-[10px] font-medium text-slate-600 mt-1">{c.v}</p>
                  {c.atraso && (
                    <p className="text-[8px] font-bold text-red-600 mt-1">⚠ SLA estourado</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-100 bg-white">
        Você cria, renomeia, reordena e define o prazo de cada etapa. Quem passa do prazo fica
        marcado em vermelho.
      </p>
    </Janela>
  );
}

// =====================================================================
// DESEMPENHO — os quatro números da tela real
// =====================================================================

function DesempenhoMock() {
  const kpis = [
    { titulo: 'Tempo até responder', valor: '7min', nota: 'mediana · 30 dias', cor: 'text-emerald-600' },
    { titulo: 'Respondidas em até 1h', valor: '92%', nota: '184 de 200', cor: 'text-emerald-600' },
    { titulo: 'Sem resposta', valor: '3', nota: 'esperando há mais de 4h', cor: 'text-red-600' },
    { titulo: 'Conversas ativas', valor: '47', nota: '12 não lidas', cor: 'text-slate-800' },
  ];

  return (
    <Janela titulo="WhatsApp · Desempenho do atendimento" selo="últimos 30 dias" seloClasse="bg-slate-100 text-slate-600">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-slate-100/60">
        {kpis.map((k) => (
          <div key={k.titulo} className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-[9px] text-slate-500 uppercase tracking-wide">{k.titulo}</p>
            <p className={`text-xl font-bold mt-1 ${k.cor}`}>{k.valor}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{k.nota}</p>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 bg-slate-100/60">
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <p className="text-[9px] text-slate-500 uppercase tracking-wide mb-2">
            Resposta por corretor
          </p>
          {[
            { nome: 'Rafael M.', tempo: '4min', pct: 96 },
            { nome: 'Juliana C.', tempo: '9min', pct: 88 },
            { nome: 'Diego P.', tempo: '26min', pct: 61 },
          ].map((c) => (
            <div key={c.nome} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <span className="text-[10px] text-slate-600 w-16 truncate">{c.nome}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    c.pct > 85 ? 'bg-emerald-500' : c.pct > 70 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${c.pct}%` }}
                />
              </div>
              <span className="text-[9px] font-medium text-slate-500 w-9 text-right">{c.tempo}</span>
            </div>
          ))}
        </div>
      </div>
    </Janela>
  );
}
