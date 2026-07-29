'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

/**
 * Mockup do painel administrativo — 8 telas que alternam automaticamente
 * a cada 5s. Visual fiel ao produto real, com dados realistas.
 *
 * Telas:
 *   1. Dashboard     — KPIs, gráfico de vendas, conversão
 *   2. Vendas        — Tabela de últimas vendas com badge "online"
 *   3. Mapa de lotes — Grade visual maior + status reais
 *   4. Financeiro    — Saldos por conta + parcelas + PIX
 *   5. PIX Rápido    — Modal de geração de cobrança com QR code
 *   6. Comissões     — 4 parcelas por venda residencial, ciclo BLQ/LIB/PAGA
 *   7. Leads CRM     — Kanban com score IA
 *   8. Modo TV       — Plantão de vendas (KPIs grandes + ranking corretores)
 */

const ABAS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: '📊' },
  { id: 'vendas',     label: 'Vendas',     icon: '💼' },
  { id: 'mapa',       label: 'Mapa',       icon: '🗺' },
  { id: 'financeiro', label: 'Financeiro', icon: '💰' },
  { id: 'pix',        label: 'PIX Rápido', icon: '⚡' },
  { id: 'comissoes',  label: 'Comissões',  icon: '🤝' },
  { id: 'leads',      label: 'Leads CRM',  icon: '👥' },
  { id: 'tv',         label: 'Modo TV',    icon: '📺' },
] as const;

type AbaId = (typeof ABAS)[number]['id'];

export function DashboardMockup() {
  const [aba, setAba] = useState<AbaId>('dashboard');
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (hover) return;
    const id = setInterval(() => {
      setAba((atual) => {
        const idx = ABAS.findIndex((a) => a.id === atual);
        return ABAS[(idx + 1) % ABAS.length].id;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [hover]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-950"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/80 border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-amber-400/80" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/60 rounded-md max-w-xs w-full">
            <svg className="w-2.5 h-2.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" d="M11 4.4 4.5 7v4.7c0 4 2.8 7.7 6.5 8.6 3.7-.9 6.5-4.6 6.5-8.6V7L11 4.4z" />
            </svg>
            <span className="text-[10px] text-slate-400 font-mono truncate">
              admin.meuloteamento.com/{aba === 'dashboard' ? '' : aba === 'tv' ? 'parquetucano/tv' : aba}
            </span>
          </div>
        </div>
        {/* Selo DEMO — deixa claro que os dados não são reais */}
        <span
          className="text-[9px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded uppercase tracking-widest"
          title="Esta tela usa dados de demonstração — não representa cliente real"
        >
          DEMO
        </span>
      </div>

      <div className="flex min-h-[480px]">
        {/* sidebar */}
        <aside className="w-44 bg-slate-900/60 border-r border-white/5 p-3 hidden md:flex md:flex-col flex-shrink-0">
          <div className="flex items-center gap-2 px-2 pb-3 border-b border-white/5">
            <LogoMark size={20} variant="light" />
            <div className="leading-tight">
              <p className="text-xs font-bold text-white">admin</p>
              <p className="text-[9px] text-slate-500">Grupo Germanos</p>
            </div>
          </div>
          <nav className="mt-3 space-y-0.5 flex-1">
            {ABAS.map((a) => {
              const active = a.id === aba;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAba(a.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-primary-500/15 text-primary-300 font-medium ring-1 ring-primary-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                  }`}
                >
                  <span className="text-[10px]">{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-3 pt-3 border-t border-white/5 text-[9px] text-slate-500 leading-tight space-y-1">
            <p className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              3 usuários online
            </p>
            <p>v2.4 · 99.9% uptime</p>
          </div>
        </aside>

        {/* main */}
        <main className="flex-1 p-5 bg-slate-950 min-w-0">
          {aba === 'dashboard' && <TelaDashboard />}
          {aba === 'vendas' && <TelaVendas />}
          {aba === 'mapa' && <TelaMapa />}
          {aba === 'financeiro' && <TelaFinanceiro />}
          {aba === 'pix' && <TelaPix />}
          {aba === 'comissoes' && <TelaComissoes />}
          {aba === 'leads' && <TelaLeads />}
          {aba === 'tv' && <TelaTv />}
        </main>
      </div>

      {/* dots indicator */}
      <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-900/80 border-t border-white/5">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-label={`Ver ${a.label}`}
            className={`h-1 transition-all rounded-full ${
              a.id === aba ? 'w-6 bg-primary-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// 1. DASHBOARD
// =====================================================================
function TelaDashboard() {
  return (
    <>
      <Header titulo="Dashboard" subtitulo="Visão geral em tempo real · Grupo Germanos" />
      <div className="grid grid-cols-4 gap-2 mb-4">
        <KPI label="Lotes" value="248" tint="text-white" delta="+12" />
        <KPI label="Disponíveis" value="127" tint="text-emerald-400" pct="51%" />
        <KPI label="Vendidos" value="94" tint="text-primary-400" pct="38%" />
        <KPI label="Leads 24h" value="32" tint="text-blue-400" delta="+8" />
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Vendas · 12 meses</p>
            <p className="text-base font-bold text-white">R$ 4,8M <span className="text-[10px] text-emerald-400 font-medium">▲ 23%</span></p>
          </div>
          <div className="flex gap-1 text-[9px]">
            <span className="px-1.5 py-0.5 bg-primary-500/15 text-primary-300 rounded font-medium">12M</span>
            <span className="px-1.5 py-0.5 text-slate-500 rounded">6M</span>
            <span className="px-1.5 py-0.5 text-slate-500 rounded">30d</span>
          </div>
        </div>
        <svg viewBox="0 0 200 60" className="w-full h-16">
          <defs>
            <linearGradient id="chartFill1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,50 L20,42 L40,46 L60,30 L80,33 L100,22 L120,28 L140,18 L160,21 L180,10 L200,14 L200,60 L0,60 Z" fill="url(#chartFill1)" />
          <path d="M0,50 L20,42 L40,46 L60,30 L80,33 L100,22 L120,28 L140,18 L160,21 L180,10 L200,14" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
          {/* pontos no gráfico */}
          {[[0,50],[40,46],[80,33],[120,28],[160,21],[200,14]].map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="2" fill="#0ea5e9" />
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniCard titulo="Conversão lead→venda" valor="14,2%" delta="+2,1pp" up />
        <MiniCard titulo="Ticket médio" valor="R$ 67k" delta="+R$ 4k" up />
        <MiniCard titulo="Inadimplência" valor="2,8%" delta="-0,4pp" up />
      </div>
    </>
  );
}

// =====================================================================
// 2. VENDAS
// =====================================================================
function TelaVendas() {
  // Dados fictícios — todos prefixados com "DEMO" pra evitar qualquer
  // confusão com clientes reais. Lotes seguem padrão LDEMO-XX.
  const linhas = [
    { num: 142, cliente: 'Cliente DEMO 06', lote: 'LDEMO-24', valor: 'R$ 65k', status: 'ATIVA',         cor: 'text-emerald-400 bg-emerald-500/10', online: true },
    { num: 141, cliente: 'Cliente DEMO 05', lote: 'LDEMO-18', valor: 'R$ 58k', status: 'QUITADA',       cor: 'text-primary-400 bg-primary-500/10' },
    { num: 140, cliente: 'Cliente DEMO 04', lote: 'LDEMO-35', valor: 'R$ 72k', status: 'ATIVA',         cor: 'text-emerald-400 bg-emerald-500/10' },
    { num: 139, cliente: 'Cliente DEMO 03', lote: 'LDEMO-07', valor: 'R$ 55k', status: 'INADIMPLENTE', cor: 'text-amber-400 bg-amber-500/10' },
    { num: 138, cliente: 'Cliente DEMO 02', lote: 'LDEMO-51', valor: 'R$ 88k', status: 'ATIVA',         cor: 'text-emerald-400 bg-emerald-500/10', online: true },
    { num: 137, cliente: 'Cliente DEMO 01', lote: 'LDEMO-22', valor: 'R$ 65k', status: 'QUITADA',       cor: 'text-primary-400 bg-primary-500/10' },
  ];
  return (
    <>
      <Header titulo="Vendas" subtitulo="142 contratos · R$ 4,8M VGV · 19 online" />
      <div className="grid grid-cols-4 gap-2 mb-3">
        <KPI label="Ativas" value="98" tint="text-emerald-400" />
        <KPI label="Quitadas" value="36" tint="text-primary-400" />
        <KPI label="Inadimpl." value="8" tint="text-amber-400" />
        <KPI label="🌐 Online" value="19" tint="text-sky-400" />
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Últimas vendas</p>
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 text-[9px] bg-primary-500/15 text-primary-300 rounded">Todas</span>
            <span className="px-2 py-0.5 text-[9px] text-slate-500">Ativas</span>
            <span className="px-2 py-0.5 text-[9px] text-slate-500">Quitadas</span>
          </div>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {linhas.map((l) => (
            <li key={l.num} className="grid grid-cols-[1fr,80px,100px] gap-2 px-3 py-2 text-[11px] items-center hover:bg-white/[0.02]">
              <div className="min-w-0">
                <p className="text-white truncate flex items-center gap-1.5">
                  <span className="font-mono text-slate-400">#{l.num}</span> {l.cliente}
                  {l.online && (
                    <span className="text-[8px] px-1 py-0.5 bg-sky-500 text-white rounded font-bold leading-none">🌐 ONLINE</span>
                  )}
                </p>
                <p className="text-[9px] text-slate-500 font-mono">{l.lote}</p>
              </div>
              <p className="text-right text-slate-200 font-mono text-[10px]">{l.valor}</p>
              <p className={`text-right font-semibold text-[9px] px-2 py-0.5 rounded ${l.cor}`}>{l.status}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// =====================================================================
// 3. MAPA
// =====================================================================
function TelaMapa() {
  const lotes = Array.from({ length: 96 }, (_, i) => {
    const status = i % 13 === 0 ? 'sold' : i % 7 === 0 ? 'reserved' : i % 19 === 0 ? 'blocked' : i % 23 === 0 ? 'pagando' : 'available';
    return { i, status };
  });
  return (
    <>
      <Header titulo="Mapa de lotes" subtitulo="Parque Tucano · 248 lotes · interativo em tempo real" />
      <div className="flex items-center gap-3 mb-3 text-[9px] text-slate-400 flex-wrap">
        <Legenda cor="bg-emerald-500/70" texto="Disponível" />
        <Legenda cor="bg-amber-400/80" texto="Reservado" />
        <Legenda cor="bg-sky-500/80" texto="Pagando" />
        <Legenda cor="bg-primary-500/80" texto="Vendido" />
        <Legenda cor="bg-slate-500/50" texto="Bloqueado" />
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Quadras A → H · zoom 100%</p>
          <div className="flex gap-1 text-[9px]">
            <button className="px-1.5 py-0.5 bg-white/5 rounded text-slate-300">−</button>
            <button className="px-1.5 py-0.5 bg-white/5 rounded text-slate-300">+</button>
            <button className="px-1.5 py-0.5 bg-white/5 rounded text-slate-300">⛶</button>
          </div>
        </div>
        <div className="grid grid-cols-16 gap-1" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
          {lotes.map((l) => {
            const cor =
              l.status === 'sold'
                ? 'bg-primary-500/80'
                : l.status === 'reserved'
                  ? 'bg-amber-400/80'
                  : l.status === 'blocked'
                    ? 'bg-slate-500/40'
                    : l.status === 'pagando'
                      ? 'bg-sky-500/80'
                      : 'bg-emerald-500/60';
            return (
              <div
                key={l.i}
                className={`aspect-square rounded-sm ${cor} ring-1 ring-white/10 hover:scale-110 hover:ring-white/40 transition cursor-pointer`}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5 text-[9px]">
        <StatusMini cor="text-emerald-400" valor="62%" label="Disp" />
        <StatusMini cor="text-amber-400" valor="15%" label="Res" />
        <StatusMini cor="text-sky-400" valor="8%" label="Pag" />
        <StatusMini cor="text-primary-400" valor="13%" label="Vend" />
        <StatusMini cor="text-slate-400" valor="2%" label="Bloq" />
      </div>
    </>
  );
}

// =====================================================================
// 4. FINANCEIRO
// =====================================================================
function TelaFinanceiro() {
  const contas = [
    { nome: '⚡ Asaas - Recebimentos', valor: 'R$ 100.000,00', tipo: 'ASAAS', cor: 'border-l-primary-500' },
    { nome: '💵 Caixa Interno', valor: 'R$ 145.000,00', tipo: 'CAIXA', cor: 'border-l-emerald-500' },
  ];
  const parcelas = [
    { vence: 'Hoje',     cliente: 'Cliente DEMO 06', valor: 'R$ 1.000', status: 'pago',     cor: 'text-emerald-400 bg-emerald-500/10', icon: '✓' },
    { vence: 'Hoje',     cliente: 'Cliente DEMO 05', valor: 'R$ 1.200', status: 'pago',     cor: 'text-emerald-400 bg-emerald-500/10', icon: '✓' },
    { vence: 'Amanhã',   cliente: 'Cliente DEMO 02', valor: 'R$ 1.500', status: 'pendente', cor: 'text-slate-400 bg-white/5', icon: '⌛' },
    { vence: 'Atrasado', cliente: 'Cliente DEMO 03', valor: 'R$ 880',   status: 'atrasado', cor: 'text-red-400 bg-red-500/10', icon: '⚠' },
  ];
  return (
    <>
      <Header titulo="Financeiro" subtitulo="Saldos · parcelas · cobrança automática" />
      <div className="grid grid-cols-4 gap-2 mb-3">
        <KPI label="Total recebido" value="R$ 245k" tint="text-emerald-400" />
        <KPI label="A receber" value="R$ 1.6M" tint="text-primary-400" />
        <KPI label="Atrasadas" value="R$ 0" tint="text-emerald-400" />
        <KPI label="30 dias" value="R$ 30k" tint="text-amber-400" />
      </div>

      {/* Saldos por conta */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Saldos por conta · consolidado R$ 245.000</p>
        <div className="grid grid-cols-2 gap-2">
          {contas.map((c) => (
            <div key={c.nome} className={`bg-white/[0.03] border border-white/5 border-l-2 ${c.cor} rounded-lg p-2.5`}>
              <p className="text-[10px] text-slate-400">{c.nome}</p>
              <p className="text-base font-bold text-white mt-0.5">{c.valor}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela parcelas */}
      <div className="bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[80px,1fr,90px,80px] gap-2 px-3 py-2 bg-white/[0.04] text-[9px] uppercase tracking-wider text-slate-500 font-semibold border-b border-white/5">
          <span>Vencimento</span>
          <span>Cliente</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Status</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {parcelas.map((p, i) => (
            <li key={i} className="grid grid-cols-[80px,1fr,90px,80px] gap-2 px-3 py-2 text-[11px] items-center">
              <p className="text-slate-300 text-[10px]">{p.vence}</p>
              <p className="text-white truncate">{p.cliente}</p>
              <p className="text-right text-slate-200 font-mono text-[10px]">{p.valor}</p>
              <p className={`text-right font-semibold text-[9px] uppercase px-1.5 py-0.5 rounded ${p.cor}`}>
                {p.icon} {p.status}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
        ⚡ <span>PIX confirmado via webhook em &lt;3s · 5 pagamentos hoje</span>
      </p>
    </>
  );
}

// =====================================================================
// 5. PIX RÁPIDO (novo)
// =====================================================================
function TelaPix() {
  return (
    <>
      <Header titulo="PIX Rápido" subtitulo="Gere cobrança avulsa em segundos" />
      <div className="grid grid-cols-2 gap-3">
        {/* Formulário */}
        <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 space-y-2.5">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Cliente</p>
            <div className="bg-slate-800/60 border border-white/5 rounded px-2 py-1.5">
              <p className="text-[11px] text-white">Cliente DEMO 01</p>
              <p className="text-[9px] text-slate-500">CPF 000.000.000-00</p>
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Descrição</p>
            <div className="bg-slate-800/60 border border-white/5 rounded px-2 py-1.5">
              <p className="text-[11px] text-white">Sinal Lote LDEMO-24</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Valor</p>
              <div className="bg-slate-800/60 border border-white/5 rounded px-2 py-1.5">
                <p className="text-[11px] text-white font-bold">R$ 5.000,00</p>
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Vence em</p>
              <div className="bg-slate-800/60 border border-white/5 rounded px-2 py-1.5">
                <p className="text-[11px] text-white">3 dias</p>
              </div>
            </div>
          </div>
          <button className="w-full bg-primary-500 hover:bg-primary-400 text-white text-[11px] font-bold py-2 rounded transition">
            ⚡ Gerar PIX
          </button>
        </div>

        {/* Resultado QR */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-primary-500/10 border border-emerald-500/30 rounded-lg p-3">
          <p className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold mb-2">✓ PIX gerado</p>
          <div className="bg-white rounded p-2 mb-2 aspect-square max-w-[120px] mx-auto">
            {/* QR code fake (grid de 11x11 quadrados pretos/brancos) */}
            <svg viewBox="0 0 11 11" className="w-full h-full">
              {Array.from({ length: 121 }).map((_, i) => {
                const hash = (i * 7 + 3) % 11 + i % 5;
                return hash % 3 === 0 ? (
                  <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" fill="#000" />
                ) : null;
              })}
              {/* 3 cantos do QR */}
              <rect x="0" y="0" width="3" height="3" fill="white" />
              <rect x="0" y="0" width="3" height="3" fill="none" stroke="#000" />
              <rect x="0.5" y="0.5" width="2" height="2" fill="#000" />
              <rect x="8" y="0" width="3" height="3" fill="white" />
              <rect x="8" y="0" width="3" height="3" fill="none" stroke="#000" />
              <rect x="8.5" y="0.5" width="2" height="2" fill="#000" />
              <rect x="0" y="8" width="3" height="3" fill="white" />
              <rect x="0" y="8" width="3" height="3" fill="none" stroke="#000" />
              <rect x="0.5" y="8.5" width="2" height="2" fill="#000" />
            </svg>
          </div>
          <p className="text-center text-[9px] text-slate-300 font-mono break-all leading-tight px-1">
            EXEMPLO-DEMO-CODIGO-PIX-NAO-VALIDO-00000...
          </p>
          <div className="grid grid-cols-2 gap-1 mt-2">
            <button className="bg-slate-900/60 hover:bg-slate-900 text-[9px] py-1.5 rounded text-white font-medium">
              📋 Copiar
            </button>
            <button className="bg-[#25D366] hover:bg-[#1cb858] text-[9px] py-1.5 rounded text-white font-medium">
              💬 WhatsApp
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-500 mt-3">
        💡 Cobrança avulsa para sinal, entrada ou serviço — sem amarrar a uma venda
      </p>
    </>
  );
}

// =====================================================================
// 6. COMISSÕES (novo)
// =====================================================================
function TelaComissoes() {
  const linhas = [
    { corretor: 'Corretor DEMO A', venda: '#142', lote: 'LDEMO-24', p: '4/4', valor: 'R$ 625', status: 'PAGA',      cor: 'bg-primary-500/15 text-primary-300' },
    { corretor: 'Corretor DEMO A', venda: '#142', lote: 'LDEMO-24', p: '3/4', valor: 'R$ 625', status: 'LIBERADA',  cor: 'bg-emerald-500/15 text-emerald-300' },
    { corretor: 'Corretor DEMO A', venda: '#142', lote: 'LDEMO-24', p: '2/4', valor: 'R$ 625', status: 'BLOQUEADA', cor: 'bg-slate-500/15 text-slate-300' },
    { corretor: 'Corretor DEMO B', venda: '#141', lote: 'LDEMO-18', p: '1/4', valor: 'R$ 625', status: 'PAGA',      cor: 'bg-primary-500/15 text-primary-300' },
    { corretor: 'Corretor DEMO C', venda: '#140', lote: 'LDEMO-35', p: '1/4', valor: 'R$ 625', status: 'LIBERADA',  cor: 'bg-emerald-500/15 text-emerald-300' },
  ];
  return (
    <>
      <Header titulo="Comissões" subtitulo="R$ 2.500 fixo por lote residencial · 4 parcelas vinculadas" />
      <div className="grid grid-cols-4 gap-2 mb-3">
        <KPI label="🔒 Bloqueadas" value="30" tint="text-slate-400" />
        <KPI label="✓ Liberadas" value="10" tint="text-emerald-400" />
        <KPI label="💰 Pagas" value="8" tint="text-primary-400" />
        <KPI label="Total mês" value="R$ 5k" tint="text-amber-400" />
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,60px,90px,90px,80px] gap-2 px-3 py-2 bg-white/[0.04] text-[9px] uppercase tracking-wider text-slate-500 font-semibold border-b border-white/5">
          <span>Corretor</span>
          <span>Parc.</span>
          <span>Venda · Lote</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Status</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {linhas.map((l, i) => (
            <li key={i} className="grid grid-cols-[1fr,60px,90px,90px,80px] gap-2 px-3 py-2 text-[11px] items-center">
              <p className="text-white truncate">{l.corretor}</p>
              <p className="text-slate-400 font-mono text-[10px]">{l.p}</p>
              <p className="text-slate-400 text-[9px] font-mono">{l.venda}·{l.lote}</p>
              <p className="text-right text-slate-200 font-mono text-[10px]">{l.valor}</p>
              <p className={`text-right font-semibold text-[9px] px-1.5 py-0.5 rounded ${l.cor}`}>
                {l.status}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        🔄 BLOQUEADA → LIBERADA (cliente pagou parcela) → PAGA (admin transferiu ao corretor)
      </p>
    </>
  );
}

// =====================================================================
// 7. LEADS CRM
// =====================================================================
function TelaLeads() {
  const cols = [
    {
      titulo: 'Novos', cor: 'text-blue-300', count: 12,
      cards: [
        { nome: 'Lead DEMO 01', score: 92, hot: true,  origem: '🌐' },
        { nome: 'Lead DEMO 02', score: 71, hot: false, origem: '📱' },
        { nome: 'Lead DEMO 03', score: 65, hot: false, origem: '🌐' },
      ],
    },
    {
      titulo: 'Em contato', cor: 'text-amber-300', count: 8,
      cards: [
        { nome: 'Lead DEMO 04', score: 88, hot: true,  origem: '💬' },
        { nome: 'Lead DEMO 05', score: 54, hot: false, origem: '🌐' },
      ],
    },
    {
      titulo: 'Negociação', cor: 'text-violet-300', count: 5,
      cards: [
        { nome: 'Lead DEMO 06', score: 95, hot: true,  origem: '📱' },
        { nome: 'Lead DEMO 07', score: 78, hot: false, origem: '🌐' },
      ],
    },
    {
      titulo: 'Fechado', cor: 'text-emerald-300', count: 3,
      cards: [
        { nome: 'Lead DEMO 08', score: 100, hot: false, origem: '🌐' },
      ],
    },
  ];
  return (
    <>
      <Header titulo="Leads · CRM" subtitulo="Pipeline em tempo real · IA classifica temperatura e distribui" />
      <div className="grid grid-cols-4 gap-1.5">
        {cols.map((col) => (
          <div key={col.titulo} className="bg-white/[0.03] border border-white/5 rounded-lg p-1.5">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <p className={`text-[9px] uppercase tracking-wider font-semibold ${col.cor}`}>
                {col.titulo}
              </p>
              <span className="text-[9px] text-slate-500 font-mono">{col.count}</span>
            </div>
            <div className="space-y-1">
              {col.cards.map((card, i) => (
                <div key={i} className="bg-slate-900/80 border border-white/5 rounded p-1.5 hover:border-white/20 transition cursor-pointer">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] text-white truncate font-medium flex items-center gap-1">
                      <span className="text-[10px]">{card.origem}</span> {card.nome}
                    </p>
                    {card.hot && <span className="text-[10px]">🔥</span>}
                  </div>
                  <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${card.score >= 80 ? 'bg-emerald-400' : card.score >= 60 ? 'bg-amber-400' : 'bg-slate-400'}`}
                      style={{ width: `${card.score}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-slate-500 mt-0.5">Score {card.score}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div className="bg-white/[0.03] rounded px-2 py-1.5 text-center">
          <span className="text-white font-bold">🤖 IA</span>
          <p className="text-[9px] text-slate-400 mt-0.5">distribui leads</p>
        </div>
        <div className="bg-white/[0.03] rounded px-2 py-1.5 text-center">
          <span className="text-white font-bold">💬 WhatsApp</span>
          <p className="text-[9px] text-slate-400 mt-0.5">notifica quente</p>
        </div>
        <div className="bg-white/[0.03] rounded px-2 py-1.5 text-center">
          <span className="text-white font-bold">📊 BI</span>
          <p className="text-[9px] text-slate-400 mt-0.5">conversão funil</p>
        </div>
      </div>
    </>
  );
}

// =====================================================================
// 8. MODO TV (novo)
// =====================================================================
function TelaTv() {
  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -m-5 p-4 min-h-[400px] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-slate-500">PARQUE TUCANO · PLANTÃO</p>
            <h3 className="text-base font-black text-white">Modo TV · Ao Vivo</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-mono font-bold text-white tabular-nums">14:23:08</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          </div>
        </div>

        {/* KPIs grandes */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <KPITv label="Disponíveis" value="127" cor="text-emerald-300" sub="51%" />
          <KPITv label="Reservados" value="35"  cor="text-amber-300"   sub="14%" />
          <KPITv label="Vendidos"   value="94"  cor="text-sky-300"     sub="38%" />
          <KPITv label="VGV"        value="R$ 4,8M" cor="text-fuchsia-300" sub="+R$ 720k reservado" />
        </div>

        {/* 2 colunas: Mini-mapa + Ranking */}
        <div className="grid grid-cols-[1.5fr,1fr] gap-2">
          {/* Mini-mapa */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Mapa ao vivo</p>
            <div className="grid grid-cols-14 gap-0.5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
              {Array.from({ length: 70 }, (_, i) => {
                const s = i % 11 === 0 ? 'sold' : i % 9 === 0 ? 'res' : 'avail';
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-sm ${
                      s === 'sold' ? 'bg-sky-500/70' : s === 'res' ? 'bg-amber-400/70' : 'bg-emerald-500/50'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Ranking */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">🏆 Top 30 dias</p>
            <div className="space-y-1.5">
              {[
                { medal: '🥇', nome: 'Corretor A', v: 5, val: 'R$ 280k', pct: 100 },
                { medal: '🥈', nome: 'Corretor B', v: 3, val: 'R$ 198k', pct: 70 },
                { medal: '🥉', nome: 'Corretor C', v: 2, val: 'R$ 145k', pct: 51 },
              ].map((r) => (
                <div key={r.nome}>
                  <div className="flex items-baseline justify-between text-[10px]">
                    <span className="text-white font-medium">{r.medal} {r.nome}</span>
                    <span className="text-slate-400 font-mono">{r.v}v</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-0.5">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-amber-500" style={{ width: `${r.pct}%` }} />
                  </div>
                  <p className="text-[8px] text-slate-500 mt-0.5">{r.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feed atividades */}
        <div className="mt-2 bg-white/[0.03] border border-white/10 rounded-lg p-2">
          <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">📡 Última hora</p>
          <ul className="space-y-1">
            <li className="text-[10px] text-white">🔒 <strong>Cliente DEMO</strong> reservou LDEMO-24 · <span className="text-slate-500">há 3min</span></li>
            <li className="text-[10px] text-white">✅ <strong>Cliente DEMO</strong> fechou LDEMO-18 · <span className="text-slate-500">há 12min</span></li>
            <li className="text-[10px] text-white">👀 <strong>3 visitas</strong> ao stand · <span className="text-slate-500">última 20min</span></li>
          </ul>
        </div>

        <p className="text-center text-[9px] text-slate-500 mt-2">
          F11 para tela cheia · atualiza a cada 30s
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// SUB
// =====================================================================
function Header({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-white truncate">{titulo}</h3>
        <p className="text-[10px] text-slate-500 truncate">{subtitulo}</p>
      </div>
      <span className="text-[10px] text-emerald-400 flex items-center gap-1 flex-shrink-0 ml-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        ao vivo
      </span>
    </div>
  );
}

function KPI({
  label, value, tint, delta, pct,
}: { label: string; value: string; tint: string; delta?: string; pct?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tint}`}>{value}</p>
      {(delta || pct) && (
        <p className="text-[9px] text-slate-400 mt-0.5">
          {delta && <span className="text-emerald-400">▲ {delta}</span>}
          {pct && <span>{pct}</span>}
        </p>
      )}
    </div>
  );
}

function KPITv({ label, value, cor, sub }: { label: string; value: string; cor: string; sub?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-2.5">
      <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400 font-semibold">{label}</p>
      <p className={`text-2xl font-black ${cor} leading-none mt-1`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function MiniCard({ titulo, valor, delta, up }: { titulo: string; valor: string; delta: string; up?: boolean }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="text-base font-bold text-white mt-0.5">{valor}</p>
      <p className={`text-[10px] mt-0.5 ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? '▲' : '▼'} {delta} vs mês
      </p>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-sm ${cor}`} />
      {texto}
    </span>
  );
}

function StatusMini({ cor, valor, label }: { cor: string; valor: string; label: string }) {
  return (
    <span className="bg-white/[0.03] rounded px-1.5 py-1 text-center">
      <span className={`font-bold ${cor}`}>{valor}</span>{' '}
      <span className="text-slate-500">{label}</span>
    </span>
  );
}
