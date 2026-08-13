'use client';

/**
 * Componentes "premium" da landing principal.
 *
 * - StatsAnimadas: números grandes com counter animado ao entrar no viewport
 * - EcossistemaOrbit: círculo central + módulos orbitando com glow
 * - IADestaque: bloco com 6 cards de funcionalidades de IA
 * - ComparativoConcorrentes: tabela Meu Loteamento vs Sistemas antigos
 * - CTAFlutuante: barra fixa no rodapé que aparece após scroll
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// =====================================================================
// HOOK — animação de contagem quando o elemento entra no viewport
// =====================================================================

function useCountUp(target: number, durationMs = 1500): { value: number; ref: (el: HTMLElement | null) => void } {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!elRef.current || started) return;
    const el = elRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          setStarted(true);
          const start = performance.now();
          function tick(now: number) {
            const t = Math.min(1, (now - start) / durationMs);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.floor(target * eased));
            if (t < 1) requestAnimationFrame(tick);
            else setValue(target);
          }
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, durationMs, started]);

  return {
    value,
    ref: (el: HTMLElement | null) => {
      elRef.current = el;
    },
  };
}

// =====================================================================
// STATS ANIMADAS
// =====================================================================

interface Stat {
  /** valor numérico para animação */
  number: number;
  /** prefixo (R$, +, etc) */
  prefix?: string;
  /** sufixo (M, k, %, etc) */
  suffix?: string;
  /** texto descritivo */
  label: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function StatsAnimadas({ stats }: { stats: Stat[] }) {
  return (
    <section className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-20 border-y border-white/5 relative overflow-hidden">
      {/* glow de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[300px] bg-primary-500/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-primary-400 uppercase tracking-[0.25em] mb-2">
            Operando agora
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Plataforma <span className="gradient-text">ativa, viva e em escala</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <StatItem key={i} stat={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatItem({ stat }: { stat: Stat }) {
  const { value, ref } = useCountUp(stat.number);
  return (
    <div
      ref={ref}
      className="text-center rounded-2xl bg-white/[0.03] backdrop-blur border border-white/10 p-6 hover:border-primary-500/40 transition group"
    >
      <p className="text-3xl md:text-5xl font-bold text-white leading-none">
        {stat.prefix}
        <span className="gradient-text">{formatNumber(value)}</span>
        {stat.suffix}
      </p>
      <p className="text-[11px] uppercase tracking-widest text-slate-400 mt-3 group-hover:text-slate-200 transition">
        {stat.label}
      </p>
    </div>
  );
}

// =====================================================================
// IA DESTAQUE
// =====================================================================

interface IAFeature {
  icon: string;
  title: string;
  desc: string;
}

const IA_FEATURES: IAFeature[] = [
  {
    icon: '🎯',
    title: 'Identifica leads quentes',
    desc: 'Score por comportamento. Quem está prestes a comprar sobe pro topo do Kanban.',
  },
  {
    icon: '💬',
    title: 'Responde clientes 24/7',
    desc: 'Atendimento automático via WhatsApp com tom da sua marca. Filtra dúvidas comuns.',
  },
  {
    icon: '🔀',
    title: 'Distribui atendimento',
    desc: 'Round-robin inteligente por cidade, disponibilidade e taxa de conversão do corretor.',
  },
  {
    icon: '📉',
    title: 'Prevê inadimplência',
    desc: 'Modelo identifica parcelas com risco antes do vencimento. Cobrança preventiva personalizada.',
  },
  {
    icon: '💡',
    title: 'Sugere condições',
    desc: 'Recomenda o parcelamento mais provável de fechar pra cada perfil de cliente.',
  },
  {
    icon: '📝',
    title: 'Resume atendimentos',
    desc: 'Lê o histórico do lead e gera um briefing de 3 linhas pro próximo corretor que atender.',
  },
];

export function IADestaque() {
  return (
    <section className="relative bg-slate-950 py-24 overflow-hidden">
      {/* background neural */}
      <div className="absolute inset-0 opacity-30">
        <svg className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <pattern id="ia-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <circle cx="25" cy="25" r="1" fill="#a855f7" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ia-grid)" />
        </svg>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-500/20 via-fuchsia-500/10 to-transparent blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-500/10 backdrop-blur border border-violet-500/30 rounded-full mb-5">
            <span className="text-xl">🧠</span>
            <span className="text-xs font-semibold text-violet-200 uppercase tracking-[0.2em]">
              Inteligência Artificial
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
            IA para loteadoras{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              que vendem mais
            </span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Modelos treinados pra reduzir inadimplência, qualificar leads e devolver horas pro seu time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {IA_FEATURES.map((f, i) => (
            <div
              key={i}
              className="group relative bg-gradient-to-br from-white/[0.04] to-white/[0.02] backdrop-blur border border-white/10 rounded-2xl p-6 hover:border-violet-400/50 transition overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition" />
              <div className="relative">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-1.5 text-lg">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <span className="inline-flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Modelos integrados — sem setup técnico
          </span>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// ECOSSISTEMA — círculo central + módulos orbitando
// =====================================================================

const MODULOS = [
  { icon: '🗺', label: 'Mapa Interativo', cor: 'from-primary-500 to-amber-500' },
  { icon: '👥', label: 'CRM de Leads', cor: 'from-violet-500 to-fuchsia-500' },
  { icon: '💰', label: 'Financeiro', cor: 'from-emerald-500 to-teal-500' },
  { icon: '📱', label: 'Portal Cliente', cor: 'from-sky-500 to-blue-500' },
  { icon: '✍️', label: 'Contrato Digital', cor: 'from-rose-500 to-pink-500' },
  { icon: '⚡', label: 'PIX & Boleto', cor: 'from-yellow-500 to-orange-500' },
  { icon: '💬', label: 'WhatsApp', cor: 'from-green-500 to-emerald-500' },
  { icon: '📊', label: 'BI & Métricas', cor: 'from-indigo-500 to-violet-500' },
  { icon: '🤝', label: 'Corretores', cor: 'from-cyan-500 to-sky-500' },
  { icon: '🤖', label: 'IA Integrada', cor: 'from-fuchsia-500 to-pink-500' },
  { icon: '🏗', label: 'Gestão Obras', cor: 'from-amber-500 to-red-500' },
  { icon: '🔌', label: 'API & Integrações', cor: 'from-slate-500 to-slate-700' },
];

export function EcossistemaOrbit() {
  return (
    <section className="relative bg-gradient-to-b from-slate-50 to-white py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-[0.25em] mb-3">
            Tudo conectado
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 max-w-3xl mx-auto">
            Um ecossistema, <span className="gradient-text">não um amontoado de ferramentas</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-4">
            12 módulos integrados nativamente. Dado entra uma vez, aparece em todo o sistema.
          </p>
        </div>

        {/* Grid responsivo dos módulos com card central */}
        <div className="relative mt-16">
          {/* Glow central */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-br from-primary-500/20 via-violet-500/20 to-pink-500/20 blur-3xl pointer-events-none" />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 relative">
            {/* Slot central — sobreposto no grid em md+ */}
            <div className="lg:col-span-4 lg:order-none order-first lg:hidden">
              <CardCentral />
            </div>

            {MODULOS.map((m, i) => {
              // Em layout 4 colunas, posiciona o card central no meio (linha 2, cols 2-3)
              const isCentral = false; // sempre módulo
              if (isCentral) return null;
              return (
                <div
                  key={i}
                  className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div
                    className={`inline-flex w-10 h-10 rounded-lg bg-gradient-to-br ${m.cor} items-center justify-center text-xl mb-2 shadow-md group-hover:scale-110 transition`}
                  >
                    {m.icon}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{m.label}</p>
                </div>
              );
            })}
          </div>

          {/* Card central só em lg+ — flutua por cima do grid */}
          <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <CardCentral />
          </div>
        </div>
      </div>
    </section>
  );
}

function CardCentral() {
  return (
    <div className="relative w-44 h-44 mx-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-violet-500 to-pink-500 rounded-3xl blur-2xl opacity-50 animate-pulse" />
      <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border-2 border-white shadow-2xl flex flex-col items-center justify-center">
        <span className="text-4xl mb-1">⚡</span>
        <p className="text-white font-bold text-sm text-center px-2">meuloteamento</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">
          Plataforma central
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// COMPARATIVO CONCORRENTES
// =====================================================================

const COMPARATIVO = [
  { feature: 'Mapa de lotes em tempo real', nos: true, eles: 'partial' },
  { feature: 'Reserva com lock automático', nos: true, eles: false },
  { feature: 'CRM integrado nativamente', nos: true, eles: false },
  { feature: 'Webhook PIX automático', nos: true, eles: false },
  { feature: 'Portal do comprador self-service', nos: true, eles: 'partial' },
  { feature: 'IA pra qualificar leads', nos: true, eles: false },
  { feature: 'WhatsApp com cobrança PIX no texto', nos: true, eles: 'partial' },
  { feature: 'Régua de cobrança configurável', nos: true, eles: false },
  { feature: 'Contrato digital com assinatura', nos: true, eles: 'partial' },
  { feature: 'Site personalizado por loteamento', nos: true, eles: 'partial' },
  { feature: 'Multi-tenant (várias loteadoras)', nos: true, eles: false },
  { feature: 'Setup em 30 min sem técnico', nos: true, eles: false },
];

export function ComparativoConcorrentes() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-[0.25em] mb-3">
            Diferenciação técnica
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">
            Por que <span className="gradient-text">não é só mais um sistema</span>
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Comparativo objetivo com plataformas e ERPs tradicionais de loteamento.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr,140px,140px] bg-slate-900 text-white">
            <div className="px-5 py-4 text-xs uppercase tracking-widest font-semibold">
              Recurso
            </div>
            <div className="px-5 py-4 text-xs uppercase tracking-widest font-semibold text-center bg-gradient-to-br from-primary-600 to-primary-700">
              meuloteamento
            </div>
            <div className="px-5 py-4 text-xs uppercase tracking-widest font-semibold text-center text-slate-300">
              Sistemas antigos
            </div>
          </div>
          {COMPARATIVO.map((row, i) => (
            <div
              key={i}
              className={`grid grid-cols-[1fr,140px,140px] items-center ${
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
              } border-t border-slate-100`}
            >
              <div className="px-5 py-3.5 text-sm text-slate-800 font-medium">{row.feature}</div>
              <div className="px-5 py-3.5 text-center bg-primary-50/30">
                {row.nos ? (
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold">
                    ✓
                  </span>
                ) : (
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-slate-200 text-slate-400">
                    —
                  </span>
                )}
              </div>
              <div className="px-5 py-3.5 text-center">
                {row.eles === true ? (
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold">
                    ✓
                  </span>
                ) : row.eles === 'partial' ? (
                  <span
                    className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold"
                    title="Parcial / limitado"
                  >
                    ⚠
                  </span>
                ) : (
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-red-100 text-red-600 text-sm font-bold">
                    ✕
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          ✓ nativo · ⚠ parcial ou via integração paga · ✕ não suportado
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// NOVIDADES — funções recentes
// =====================================================================

const NOVIDADES = [
  {
    badge: 'NOVO',
    icon: '💬',
    titulo: 'WhatsApp completo dentro do CRM',
    desc: 'Caixa de entrada, quadro por tempo de espera, mídia, modelos, etiquetas e nota interna. Cada corretor conecta o próprio número por QR Code.',
    cor: 'from-emerald-500 to-green-600',
  },
  {
    badge: 'NOVO',
    icon: '🎧',
    titulo: 'Áudio do cliente vira texto',
    desc: 'Todo áudio recebido é transcrito automaticamente embaixo da bolha. Dá para ler no meio da reunião — e a busca acha o que foi dito falando.',
    cor: 'from-teal-500 to-emerald-500',
  },
  {
    badge: 'NOVO',
    icon: '🎚',
    titulo: 'Etapas do funil configuráveis',
    desc: 'Crie, renomeie e reordene as etapas do seu processo e defina o prazo (SLA) de cada uma. Lead parado além do prazo aparece marcado.',
    cor: 'from-indigo-500 to-violet-500',
  },
  {
    badge: 'NOVO',
    icon: '🔐',
    titulo: 'Cofre de documentos cifrado',
    desc: 'RG, CPF e comprovantes saem da pasta pública: gravados com AES-256-GCM, sem EXIF, abertos só por link assinado que expira em minutos.',
    cor: 'from-slate-500 to-slate-700',
  },
  {
    badge: 'NOVO',
    icon: '📺',
    titulo: 'Modo TV — Plantão ao vivo',
    desc: 'Tela cheia 16:9 com KPIs gigantes, mapa em tempo real e ranking de corretores. Acesse /tv direto na TV do seu plantão de vendas.',
    cor: 'from-fuchsia-500 to-pink-500',
  },
  {
    badge: 'NOVO',
    icon: '🤖',
    titulo: 'Fernando — Atendente IA',
    desc: 'IA pré-treinada qualifica leads pelo WhatsApp 24/7, responde dúvidas técnicas e escala pra humano só quando precisa fechar.',
    cor: 'from-violet-500 to-indigo-500',
  },
  {
    badge: 'NOVO',
    icon: '🎯',
    titulo: 'Banner de lançamento com countdown',
    desc: 'Convite oficial no topo da landing com data, local, contagem regressiva ao vivo, CTA de WhatsApp e .ics pra adicionar ao calendário.',
    cor: 'from-amber-500 to-orange-500',
  },
  {
    badge: 'NOVO',
    icon: '💰',
    titulo: 'Saldos por conta + Asaas sync',
    desc: 'Cada PIX recebido cai automaticamente no saldo da conta certa (Asaas, Caixa, Banco). Botão de sync ativa pra checar fora do webhook.',
    cor: 'from-emerald-500 to-teal-500',
  },
  {
    badge: 'NOVO',
    icon: '🤝',
    titulo: 'Comissões parceladas — R$ 2.500 / 4×',
    desc: 'Ciclo automático BLOQUEADA → LIBERADA (cliente pagou) → PAGA (admin transferiu). Cada lote residencial gera 4 parcelas de R$ 625 ao corretor.',
    cor: 'from-sky-500 to-blue-500',
  },
  {
    badge: 'NOVO',
    icon: '🗺',
    titulo: 'Editor de planta com "Mover fundo"',
    desc: 'Em vez de reposicionar 200 lotes um por um, arrasta a imagem da planta inteira até alinhar. Sistema move todos automaticamente.',
    cor: 'from-rose-500 to-fuchsia-500',
  },
  {
    badge: 'NOVO',
    icon: '📑',
    titulo: 'Recibo separado por lote',
    desc: 'Vendas multi-lote geram 1 recibo independente por lote, com valor proporcional, page-break automático na impressão.',
    cor: 'from-cyan-500 to-sky-500',
  },
  {
    badge: 'NOVO',
    icon: '🌐',
    titulo: 'Badge "Online" nas vendas',
    desc: 'Distingue na listagem o que veio do site sem corretor vs vendido pelo painel. Métrica de conversão direta do checkout público.',
    cor: 'from-blue-500 to-indigo-500',
  },
];

export function NovidadesGrid() {
  return (
    <section className="relative bg-slate-950 py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid-dark opacity-40" />
      <div className="absolute top-0 right-1/4 w-[700px] h-[400px] conic-bg opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 backdrop-blur border border-emerald-500/30 rounded-full mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-emerald-200 uppercase tracking-[0.2em]">
              Releases recentes
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Plataforma <span className="gradient-text">em evolução semanal</span>
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Funções liberadas só nas últimas semanas. Você ganha sem pagar mais.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {NOVIDADES.map((n, i) => (
            <div
              key={i}
              className="group relative bg-gradient-to-br from-white/[0.04] to-white/[0.02] backdrop-blur border border-white/10 rounded-2xl p-5 hover:border-white/30 transition-all hover:-translate-y-0.5 overflow-hidden"
            >
              <div
                className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition bg-gradient-to-br ${n.cor}`}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex w-10 h-10 rounded-xl items-center justify-center text-xl shadow-md bg-gradient-to-br ${n.cor}`}>
                    {n.icon}
                  </div>
                  <span className="text-[9px] px-2 py-0.5 bg-emerald-500/15 text-emerald-300 rounded font-bold uppercase tracking-widest border border-emerald-500/30">
                    {n.badge}
                  </span>
                </div>
                <h3 className="font-bold text-white mb-1.5 leading-tight">{n.titulo}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{n.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-sm text-slate-400">
            🚀 <strong className="text-white">~3 novas funções por semana</strong> · sem update manual · sem custo extra
          </p>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// CTA FLUTUANTE — barra fixa após scroll
// =====================================================================

export function CTAFlutuante({
  pricingHref = '#pricing',
  whatsappHref = 'https://wa.me/5575988411277?text=Quero%20conhecer%20o%20meuloteamento',
}: {
  pricingHref?: string;
  whatsappHref?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    function onScroll() {
      // aparece após rolar 600px e some perto do final (footer)
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setVisivel(y > 600 && y < max - 400);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 transition-all duration-500 ${
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visivel}
    >
      <div className="flex items-center gap-2 bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl shadow-2xl shadow-black/30 px-2 py-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-sm font-medium transition"
          title="Falar no WhatsApp"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8" />
          </svg>
          <span className="hidden sm:inline">WhatsApp</span>
        </a>

        <Link
          href={pricingHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold shadow-lg shadow-primary-500/30 transition"
        >
          <span>Começar grátis</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
