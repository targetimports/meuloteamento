'use client';

/**
 * Banner de convite para o LANÇAMENTO do Parque Tucano.
 *
 *   - Countdown ao vivo (D / H / M / S)
 *   - CTA principal: confirmar presença via WhatsApp
 *   - CTA secundário: adicionar ao calendário (.ics blob)
 *   - Visual cinematográfico: glow, pulse, gradientes, partículas
 *   - Auto-some 2h após início do evento
 *
 * Props com defaults pro Parque Tucano. Componentizado pra reuso futuro.
 */

import { useEffect, useMemo, useState } from 'react';

interface Props {
  /** Início do evento (ISO 8601 ou Date). */
  dataHora: string | Date;
  /** Duração em horas (pra esconder banner após terminar). Default 4h. */
  duracaoHoras?: number;
  /** Título principal. */
  titulo: string;
  /** Subtítulo (ex: "Lançamento oficial"). */
  subtitulo: string;
  /** Endereço do local. */
  local: string;
  /** WhatsApp pra confirmar presença (formato 5575988411277). */
  whatsapp: string;
  /** Mensagem pré-preenchida no WhatsApp. */
  msgWhatsapp?: string;
  /** Cor primária do gradient (hex). Default âmbar. */
  corPrimaria?: string;
  /** Subdomínio/path da página (pra link do .ics). */
  urlEvento?: string;
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

export function EventoLancamentoBanner({
  dataHora,
  duracaoHoras = 4,
  titulo,
  subtitulo,
  local,
  whatsapp,
  msgWhatsapp = 'Olá! Quero confirmar minha presença no lançamento.',
  corPrimaria = '#f59e0b',
  urlEvento,
}: Props) {
  const inicio = useMemo(() => new Date(dataHora), [dataHora]);
  const fim = useMemo(
    () => new Date(inicio.getTime() + duracaoHoras * 3600 * 1000),
    [inicio, duracaoHoras]
  );

  const [agora, setAgora] = useState<Date | null>(null);
  const [dismissido, setDismissido] = useState(false);

  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Esconde se evento já terminou OU usuário fechou
  if (dismissido || !agora || agora.getTime() > fim.getTime()) return null;

  const restanteMs = inicio.getTime() - agora.getTime();
  const acontecendoAgora = restanteMs <= 0;

  const dias = Math.floor(restanteMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((restanteMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((restanteMs % (1000 * 60 * 60)) / (1000 * 60));
  const segundos = Math.floor((restanteMs % (1000 * 60)) / 1000);

  const dataFormatada = inicio.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const horaFormatada = `${pad2(inicio.getHours())}:${pad2(inicio.getMinutes())}`;

  const whatsappHref = `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msgWhatsapp)}`;

  function baixarICS() {
    // Gera arquivo .ics in-memory e dispara download
    function fmt(d: Date): string {
      // YYYYMMDDTHHMMSSZ — formato UTC ICS
      return (
        d.getUTCFullYear().toString() +
        pad2(d.getUTCMonth() + 1) +
        pad2(d.getUTCDate()) +
        'T' +
        pad2(d.getUTCHours()) +
        pad2(d.getUTCMinutes()) +
        pad2(d.getUTCSeconds()) +
        'Z'
      );
    }
    const uid = `${Date.now()}@meuloteamento.com`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//meuloteamento//Lancamento//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(inicio)}`,
      `DTEND:${fmt(fim)}`,
      `SUMMARY:${titulo} — ${subtitulo}`,
      `LOCATION:${local}`,
      urlEvento ? `URL:${urlEvento}` : '',
      'DESCRIPTION:Reserve sua presença no lançamento. Apresentação do empreendimento, condições especiais e visita guiada ao loteamento.',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lançamento começa em 2 horas',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lancamento-parque-tucano.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="relative overflow-hidden text-white"
      role="region"
      aria-label="Banner de lançamento"
      style={{
        background: `linear-gradient(135deg, #0a0a0a 0%, ${corPrimaria}40 50%, #0a0a0a 100%)`,
      }}
    >
      {/* ===== Camadas de fundo ===== */}
      {/* Glow primário */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] blur-3xl opacity-30 pointer-events-none animate-pulse"
        style={{ background: `radial-gradient(ellipse at center, ${corPrimaria}80 0%, transparent 60%)` }}
      />
      {/* Grid de planta cadastral */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none"
        aria-hidden
      >
        <defs>
          <pattern id="evento-grid" width="80" height="60" patternUnits="userSpaceOnUse">
            <path d="M0 0H80V60H0Z" fill="none" stroke="white" strokeWidth="0.5" />
            <path d="M40 0V60M0 30H80" fill="none" stroke="white" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#evento-grid)" />
      </svg>
      {/* Partículas (8 bolinhas com float aleatório) */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {[...Array(8)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full opacity-40"
            style={{
              width: `${4 + (i % 3) * 2}px`,
              height: `${4 + (i % 3) * 2}px`,
              background: corPrimaria,
              top: `${15 + ((i * 11) % 70)}%`,
              left: `${(i * 13) % 100}%`,
              animation: `evento-float ${4 + (i % 4)}s ease-in-out ${i * 0.3}s infinite alternate`,
              boxShadow: `0 0 8px ${corPrimaria}`,
            }}
          />
        ))}
      </div>

      {/* ===== Botão fechar ===== */}
      <button
        type="button"
        onClick={() => setDismissido(true)}
        aria-label="Fechar"
        className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-white/80 hover:text-white transition flex items-center justify-center text-sm"
      >
        ✕
      </button>

      {/* ===== Conteúdo ===== */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-16 text-center">
        {/* Selo "ao vivo" */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/15 backdrop-blur border border-red-400/40 rounded-full mb-6">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-red-200">
            {acontecendoAgora ? 'Acontecendo agora' : 'Convite oficial'}
          </span>
        </div>

        {/* Subtítulo / overhead */}
        <p
          className="text-sm md:text-base font-bold uppercase tracking-[0.4em] mb-4 drop-shadow"
          style={{ color: corPrimaria }}
        >
          {subtitulo}
        </p>

        {/* Título grande */}
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-4 [text-shadow:0_4px_30px_rgba(0,0,0,0.7)]">
          {titulo}
        </h2>

        {/* Data + local em destaque */}
        <div className="inline-flex flex-col md:flex-row items-center gap-2 md:gap-4 mt-2 mb-8 text-base md:text-lg">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/15">
            📅 <strong className="capitalize">{dataFormatada}</strong> · às {horaFormatada}
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/15">
            📍 {local}
          </span>
        </div>

        {/* ===== COUNTDOWN ===== */}
        {acontecendoAgora ? (
          <div className="my-8">
            <p className="text-3xl md:text-5xl font-black text-emerald-300 animate-pulse">
              🎉 ESTÁ ACONTECENDO AGORA! 🎉
            </p>
            <p className="text-base text-white/80 mt-2">Venha já — estamos te esperando.</p>
          </div>
        ) : (
          <div className="my-10">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-4">
              Faltam apenas
            </p>
            <div className="flex items-stretch justify-center gap-2 md:gap-4">
              <CountdownBox valor={dias} label="dias" cor={corPrimaria} />
              <CountdownSep />
              <CountdownBox valor={horas} label="horas" cor={corPrimaria} />
              <CountdownSep />
              <CountdownBox valor={minutos} label="min" cor={corPrimaria} />
              <CountdownSep />
              <CountdownBox valor={segundos} label="seg" cor={corPrimaria} pulse />
            </div>
          </div>
        )}

        {/* ===== CTAs ===== */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-base md:text-lg shadow-2xl transition-all hover:scale-105 hover:shadow-3xl"
            style={{
              background: `linear-gradient(135deg, ${corPrimaria} 0%, #d97706 100%)`,
              boxShadow: `0 10px 40px ${corPrimaria}60`,
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.1 3.1c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3M12 2.2C6.6 2.2 2.2 6.6 2.2 12c0 1.7.5 3.4 1.3 4.9L2.2 22l5.2-1.4c1.4.8 3 1.2 4.6 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.8-9.8-9.8" />
            </svg>
            Quero confirmar presença
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>

          <button
            type="button"
            onClick={baixarICS}
            className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white font-medium transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M12 14v4M10 16h4" />
            </svg>
            Adicionar ao calendário
          </button>
        </div>

        {/* Microcopy abaixo dos CTAs */}
        <p className="text-xs text-white/60 mt-6">
          ✨ Lotes com <strong className="text-white">condições especiais</strong> exclusivas para
          presentes no evento · Coquetel de boas-vindas · Visita guiada
        </p>
      </div>

      {/* ===== Keyframes da partícula ===== */}
      <style>{`
        @keyframes evento-float {
          0% { transform: translateY(0) translateX(0); opacity: 0.3; }
          100% { transform: translateY(-25px) translateX(15px); opacity: 0.7; }
        }
      `}</style>
    </section>
  );
}

// =====================================================================
// SUB
// =====================================================================

function CountdownBox({
  valor,
  label,
  cor,
  pulse,
}: {
  valor: number;
  label: string;
  cor: string;
  pulse?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={`min-w-[72px] md:min-w-[96px] px-3 py-4 md:py-5 rounded-2xl bg-black/40 backdrop-blur border-2 ${
          pulse ? 'animate-pulse' : ''
        }`}
        style={{
          borderColor: `${cor}60`,
          boxShadow: `inset 0 0 30px ${cor}20`,
        }}
      >
        <p
          className="text-4xl md:text-6xl font-black tabular-nums leading-none [text-shadow:0_2px_15px_rgba(0,0,0,0.5)]"
          style={{ color: 'white' }}
        >
          {pad2(valor)}
        </p>
        <p className="text-[10px] md:text-xs uppercase tracking-widest text-white/70 mt-2 font-semibold">
          {label}
        </p>
      </div>
    </div>
  );
}

function CountdownSep() {
  return (
    <span
      className="text-3xl md:text-5xl font-black text-white/40 self-center pb-6"
      aria-hidden
    >
      :
    </span>
  );
}
