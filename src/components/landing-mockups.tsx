/**
 * Mockups visuais das funcionalidades — usados na landing page.
 * São representações renderizadas (não screenshots) com dados fictícios.
 * Server-friendly: HTML/Tailwind puro, sem interatividade.
 */

// =====================================================================
// CRM KANBAN — captura automática de leads
// =====================================================================

export function CrmKanbanMock() {
  const colunas = [
    {
      nome: 'Novo',
      cor: 'bg-sky-500',
      cards: [
        { nome: 'Maria Oliveira', origem: 'simulação', temp: 'quente', valor: 'R$ 55.000' },
        { nome: 'Carlos Souza', origem: 'checkout', temp: 'quente', valor: 'R$ 81.995' },
      ],
    },
    {
      nome: 'Em atendimento',
      cor: 'bg-amber-500',
      cards: [
        { nome: 'Ana Paula', origem: 'site', temp: 'morno', valor: 'R$ 55.000' },
      ],
    },
    {
      nome: 'Agendado',
      cor: 'bg-violet-500',
      cards: [
        { nome: 'João Pedro', origem: 'whatsapp', temp: 'quente', valor: 'R$ 120.000' },
      ],
    },
    {
      nome: 'Convertido',
      cor: 'bg-emerald-500',
      cards: [
        { nome: 'Beatriz Lima', origem: 'feira', temp: 'quente', valor: 'R$ 55.000' },
      ],
    },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <p className="text-xs font-medium text-slate-500">CRM · Leads / Funil</p>
        <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded">Ações em massa</span>
      </div>
      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-100/60">
        {colunas.map((col) => (
          <div key={col.nome} className="bg-slate-50 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${col.cor}`} />
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide truncate">
                {col.nome}
              </p>
              <span className="ml-auto text-[10px] text-slate-400">{col.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((c) => (
                <div key={c.nome} className="bg-white rounded-md border border-slate-200 p-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        c.temp === 'quente' ? 'bg-red-500' : 'bg-amber-400'
                      }`}
                    />
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{c.nome}</p>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5">{c.origem}</p>
                  <p className="text-[10px] font-medium text-slate-600 mt-1">{c.valor}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// RÉGUA DE COBRANÇA — automação financeira
// =====================================================================

export function ReguaCobrancaMock() {
  const passos = [
    { quando: '−3 dias', canal: 'WhatsApp', texto: 'Olá Maria, sua parcela 7 de R$ 444,42 vence em 20/05.', cor: 'text-emerald-600 bg-emerald-50' },
    { quando: 'No dia', canal: 'WhatsApp', texto: 'Sua parcela vence hoje. PIX copia-e-cola disponível.', cor: 'text-emerald-600 bg-emerald-50' },
    { quando: '+3 dias', canal: 'WhatsApp', texto: 'Parcela em aberto há 3 dias. Regularize para manter o desconto.', cor: 'text-amber-600 bg-amber-50' },
    { quando: '+7 dias', canal: 'E-mail', texto: 'Notificação formal — parcela 7 em atraso.', cor: 'text-sky-600 bg-sky-50' },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-medium text-slate-500">Régua de cobrança · Parque Tucano</p>
        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">
          ● ativa
        </span>
      </div>
      <div className="p-4 space-y-2">
        {passos.map((p, i) => (
          <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-2.5">
            <div className="text-center w-14 flex-shrink-0">
              <p className="text-[9px] uppercase text-slate-400">Quando</p>
              <p className="text-[11px] font-bold text-slate-700">{p.quando}</p>
            </div>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${p.cor} flex-shrink-0`}>
              {p.canal}
            </span>
            <p className="text-[11px] text-slate-600 leading-snug flex-1">{p.texto}</p>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
          <p className="text-[10px] text-slate-400">Envios automáticos · sem você mexer um dedo</p>
          <p className="text-[10px] font-semibold text-slate-700">128 enviados este mês</p>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// CONTRATO DIGITAL — geração + assinatura eletrônica
// =====================================================================

export function ContratoDigitalMock() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-medium text-slate-500">Contrato — Venda #1042</p>
        <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-medium">
          enviado p/ assinatura
        </span>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-0">
        {/* Documento */}
        <div className="p-5 border-r border-slate-100">
          <p className="text-[11px] font-bold text-slate-800 text-center mb-2 leading-tight">
            INSTRUMENTO PARTICULAR DE COMPROMISSO DE COMPRA E VENDA
          </p>
          <div className="space-y-1.5">
            {[
              'PROMITENTE VENDEDOR: Residencial Parque Tucano SPE Ltda',
              'COMPROMISSÁRIO COMPRADOR: Maria Oliveira dos Santos',
              'OBJETO: Lote 12, Quadra A — área de 250,00 m²',
              'VALOR: R$ 55.000,00 (cinquenta e cinco mil reais)',
              'ENTRADA: R$ 5.000,00 · 60 parcelas de R$ 1.000,00',
            ].map((l, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                <p className="text-[9px] text-slate-500 leading-snug">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <div className="h-1.5 bg-slate-100 rounded w-full" />
            <div className="h-1.5 bg-slate-100 rounded w-11/12" />
            <div className="h-1.5 bg-slate-100 rounded w-full" />
            <div className="h-1.5 bg-slate-100 rounded w-4/5" />
          </div>
        </div>
        {/* Status / ações */}
        <div className="p-4 bg-slate-50/60 space-y-3">
          <div>
            <p className="text-[9px] uppercase text-slate-400 font-semibold">Modelo</p>
            <p className="text-[11px] font-medium text-slate-700">Compromisso — Lei 6.766/79</p>
          </div>
          <div className="space-y-1.5">
            <Step done label="Contrato gerado" />
            <Step done label="Enviado para assinatura" />
            <Step label="Cliente assina (Clicksign)" />
            <Step label="PDF assinado arquivado" />
          </div>
          <div className="bg-emerald-600 text-white text-[10px] font-semibold rounded-lg py-2 text-center">
            ✓ Variáveis preenchidas automático
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] flex-shrink-0 ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <p className={`text-[10px] ${done ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
        {label}
      </p>
    </div>
  );
}

// =====================================================================
// ÁREA DO COMPRADOR — portal do cliente
// =====================================================================

export function AreaClienteMock() {
  const parcelas = [
    { n: 6, venc: '20/04', valor: 'R$ 444,42', status: 'paga' },
    { n: 7, venc: '20/05', valor: 'R$ 444,42', status: 'aberta' },
    { n: 8, venc: '20/06', valor: 'R$ 444,42', status: 'aberta' },
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-medium text-slate-500">Minha conta · Maria Oliveira</p>
        <span className="text-[10px] text-slate-400">meuloteamento.com/minha-conta</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl p-3.5 text-white">
          <p className="text-[10px] text-white/60 uppercase tracking-wide">Lote 12 · Quadra A</p>
          <p className="text-sm font-bold">Parque Tucano</p>
          <div className="flex gap-4 mt-2 text-[10px]">
            <span>
              <span className="text-white/50">Pago: </span>
              <span className="font-semibold">R$ 7.666</span>
            </span>
            <span>
              <span className="text-white/50">Saldo: </span>
              <span className="font-semibold">R$ 47.333</span>
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          {parcelas.map((p) => (
            <div
              key={p.n}
              className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
            >
              <div>
                <p className="text-[11px] font-medium text-slate-800">Parcela {p.n}</p>
                <p className="text-[9px] text-slate-400">vence {p.venc}</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-700">{p.valor}</span>
              {p.status === 'paga' ? (
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                  paga
                </span>
              ) : (
                <span className="text-[9px] bg-emerald-600 text-white px-2 py-1 rounded font-semibold">
                  Pagar PIX
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="flex-1 text-center text-[10px] bg-slate-100 text-slate-600 rounded-lg py-1.5">
            Contrato
          </span>
          <span className="flex-1 text-center text-[10px] bg-slate-100 text-slate-600 rounded-lg py-1.5">
            Renegociar
          </span>
          <span className="flex-1 text-center text-[10px] bg-slate-100 text-slate-600 rounded-lg py-1.5">
            2ª via boleto
          </span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SIMULADOR + CAPTURA DE LEAD — recriação do simulador real
// =====================================================================

export function SimuladorLeadMock({ corPrimaria = '#ea580c' }: { corPrimaria?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-medium text-slate-500">Simulador público · captura de lead</p>
      </div>
      <div className="grid grid-cols-2 gap-0">
        <div className="p-4 space-y-3">
          <div>
            <p className="text-[9px] uppercase text-slate-400">Lote residencial à vista</p>
            <p className="text-lg font-black text-slate-900">R$ 55.000</p>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500 font-medium">Sua entrada</span>
              <span className="font-bold" style={{ color: corPrimaria }}>
                R$ 5.000
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full">
              <div
                className="h-full rounded-full w-[12%]"
                style={{ background: corPrimaria }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-500 font-medium">Parcelas</span>
              <span className="font-bold" style={{ color: corPrimaria }}>
                60x
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full">
              <div
                className="h-full rounded-full w-full"
                style={{ background: corPrimaria }}
              />
            </div>
          </div>
        </div>
        <div
          className="p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)` }}
        >
          <p className="text-[9px] uppercase text-white/70">Sua parcela mensal</p>
          <p className="text-2xl font-black">R$ 1.000</p>
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-[9px] uppercase text-white/70 font-semibold mb-1.5">
              💬 Quer que a gente te chame?
            </p>
            <div className="space-y-1.5">
              <div className="bg-white/15 rounded-md px-2 py-1.5 text-[10px] text-white/60">
                Seu nome
              </div>
              <div className="bg-white/15 rounded-md px-2 py-1.5 text-[10px] text-white/60">
                WhatsApp (DDD)
              </div>
              <div className="bg-white text-center rounded-md py-1.5 text-[10px] font-bold" style={{ color: corPrimaria }}>
                Escolher meu lote
              </div>
            </div>
            <p className="text-[8px] text-white/60 mt-1.5">
              → vira lead automático no CRM da loteadora
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// CONFIG DE INTEGRAÇÕES — keys editáveis pelo admin
// =====================================================================

export function IntegracoesMock() {
  const integracoes = [
    { nome: 'Asaas', desc: 'Cobrança PIX / boleto', on: true },
    { nome: 'WhatsApp', desc: 'Z-API · régua de cobrança', on: true },
    { nome: 'Clicksign', desc: 'Assinatura de contratos', on: true },
    { nome: 'E-mail', desc: 'Resend · transacional', on: true },
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-xs font-medium text-slate-500">Minha conta · Integrações</p>
      </div>
      <div className="p-4 space-y-2">
        {integracoes.map((i) => (
          <div
            key={i.nome}
            className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
              {i.nome.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-800">{i.nome}</p>
              <p className="text-[9px] text-slate-400">{i.desc}</p>
            </div>
            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
              conectado
            </span>
          </div>
        ))}
        <p className="text-[10px] text-slate-400 pt-1">
          Cada loteadora usa as próprias chaves — isoladas e criptografadas.
        </p>
      </div>
    </div>
  );
}
