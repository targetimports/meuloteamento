import Link from 'next/link';
import { IconInstagram } from './icons';

interface FooterProps {
  loteamento: {
    nome: string;
    slug: string;
    cidade: string;
    estado: string;
    endereco: string;
    contatoTelefone: string | null;
    contatoEmail: string | null;
  };
  loteadora: {
    nome: string;
    razaoSocial: string | null;
    cnpj: string | null;
    telefone: string | null;
    whatsapp: string | null;
    email: string | null;
    instagram: string | null;
    site: string | null;
    logo: string | null;
    sobreTexto: string | null;
  };
  corPrimaria: string;
}

/**
 * Skyline SVG: silhuetas de casas e palmeiras em horizonte.
 * Usa currentColor — herda do parent.
 */
function Skyline({ corPrimaria }: { corPrimaria: string }) {
  return (
    <svg
      viewBox="0 0 1200 90"
      preserveAspectRatio="none"
      className="w-full h-20 text-white/15"
      fill="currentColor"
      aria-hidden
    >
      {/* Casa 1 — pequena com telhado */}
      <g transform="translate(70 30)">
        <polygon points="0,22 22,0 44,22" />
        <rect x="2" y="22" width="40" height="38" />
        <rect x="18" y="38" width="8" height="22" fill="#000" />
        <rect x="6" y="28" width="6" height="6" fill="#000" />
        <rect x="32" y="28" width="6" height="6" fill="#000" />
      </g>

      {/* Palmeira 1 */}
      <g transform="translate(140 20)">
        <rect x="-1" y="20" width="2" height="40" />
        <path d="M-12 22 Q0 4 12 22 M-10 18 Q0 28 10 18 M-8 14 Q0 22 8 14" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </g>

      {/* Casa 2 — sobrado */}
      <g transform="translate(180 18)">
        <polygon points="0,12 32,0 64,12" />
        <rect x="0" y="12" width="64" height="48" />
        <rect x="10" y="20" width="8" height="10" fill="#000" />
        <rect x="28" y="20" width="8" height="10" fill="#000" />
        <rect x="46" y="20" width="8" height="10" fill="#000" />
        <rect x="10" y="36" width="8" height="10" fill="#000" />
        <rect x="46" y="36" width="8" height="10" fill="#000" />
        <rect x="26" y="36" width="12" height="24" fill="#000" />
      </g>

      {/* Casa 3 — bem pequena */}
      <g transform="translate(280 36)">
        <polygon points="0,16 16,0 32,16" />
        <rect x="0" y="16" width="32" height="28" />
        <rect x="12" y="26" width="8" height="18" fill="#000" />
      </g>

      {/* Palmeira 2 */}
      <g transform="translate(340 16)">
        <rect x="-1" y="22" width="2" height="42" />
        <path d="M-14 24 Q0 4 14 24 M-12 20 Q0 30 12 20 M-10 16 Q0 24 10 16" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </g>

      {/* Quadra de lotes (rectangles em grid) */}
      <g transform="translate(390 50)" opacity="0.7">
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={i * 14} y="0" width="12" height="14" fill="none" stroke="currentColor" strokeWidth="1" />
        ))}
      </g>

      {/* Casa 4 — moderna */}
      <g transform="translate(520 32)">
        <rect width="60" height="32" />
        <rect x="0" y="0" width="60" height="6" fill="currentColor" />
        <rect x="6" y="10" width="10" height="14" fill="#000" />
        <rect x="22" y="10" width="14" height="14" fill="#000" />
        <rect x="42" y="10" width="10" height="14" fill="#000" />
      </g>

      {/* Palmeira 3 — alta */}
      <g transform="translate(600 8)">
        <rect x="-1" y="24" width="2" height="52" />
        <path d="M-16 26 Q0 2 16 26 M-14 22 Q0 32 14 22 M-12 18 Q0 26 12 18" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </g>

      {/* Casa 5 — colonial larga */}
      <g transform="translate(640 24)">
        <polygon points="0,10 50,0 100,10" />
        <rect x="0" y="10" width="100" height="46" />
        <rect x="10" y="20" width="10" height="14" fill="#000" />
        <rect x="30" y="20" width="10" height="14" fill="#000" />
        <rect x="60" y="20" width="10" height="14" fill="#000" />
        <rect x="80" y="20" width="10" height="14" fill="#000" />
        <rect x="40" y="38" width="20" height="22" fill="#000" />
      </g>

      {/* Palmeira 4 */}
      <g transform="translate(770 22)">
        <rect x="-1" y="18" width="2" height="42" />
        <path d="M-12 20 Q0 2 12 20 M-10 16 Q0 26 10 16" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </g>

      {/* Casa 6 — moderna alta */}
      <g transform="translate(810 14)">
        <rect width="44" height="56" />
        <rect x="6" y="8" width="8" height="10" fill="#000" />
        <rect x="20" y="8" width="8" height="10" fill="#000" />
        <rect x="34" y="8" width="6" height="10" fill="#000" />
        <rect x="6" y="24" width="8" height="10" fill="#000" />
        <rect x="20" y="24" width="8" height="10" fill="#000" />
        <rect x="14" y="40" width="16" height="20" fill="#000" />
      </g>

      {/* Mais lotes em grid */}
      <g transform="translate(880 52)" opacity="0.7">
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={i * 12} y="0" width="10" height="12" fill="none" stroke="currentColor" strokeWidth="1" />
        ))}
      </g>

      {/* Casa 7 */}
      <g transform="translate(1010 28)">
        <polygon points="0,18 22,0 44,18" />
        <rect x="0" y="18" width="44" height="40" />
        <rect x="16" y="32" width="12" height="26" fill="#000" />
      </g>

      {/* Palmeira 5 */}
      <g transform="translate(1090 18)">
        <rect x="-1" y="22" width="2" height="42" />
        <path d="M-12 24 Q0 4 12 24 M-10 20 Q0 30 10 20" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </g>

      {/* Casa 8 */}
      <g transform="translate(1130 38)">
        <polygon points="0,14 14,0 28,14" />
        <rect x="0" y="14" width="28" height="32" />
      </g>

      {/* Linha do chão com glow laranja */}
      <line x1="0" y1="88" x2="1200" y2="88" stroke={corPrimaria} strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

/** Marca em forma de lote (grid 3x3, igual ao logo do meuloteamento) */
function LotMark({ size = 60, corPrimaria }: { size?: number; corPrimaria: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="text-white">
      <rect x="3" y="3" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="18" y="3" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="33" y="3" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="3" y="18" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="17" y="17" width="14" height="14" rx="2" fill={corPrimaria} opacity="0.85" />
      <rect x="33" y="18" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="3" y="33" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="18" y="33" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
      <rect x="33" y="33" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

export function LoteamentoFooter({ loteamento, loteadora, corPrimaria }: FooterProps) {
  // Título dual-color (igual ao hero)
  const palavras = loteamento.nome.trim().split(/\s+/);
  const ultimaPalavra = palavras.length > 1 ? palavras[palavras.length - 1] : null;
  const inicio = palavras.length > 1 ? palavras.slice(0, -1).join(' ') : loteamento.nome;

  return (
    <footer className="relative bg-black text-white pt-32 pb-8 overflow-hidden">
      {/* ====== TOP: SKYLINE com horizon glow ====== */}
      <div className="absolute top-0 inset-x-0 h-28 pointer-events-none">
        {/* Glow do horizon (laranja brilhante) */}
        <div
          className="absolute top-[88px] inset-x-0 h-px"
          style={{
            background: corPrimaria,
            boxShadow: `0 0 50px 6px ${corPrimaria}, 0 0 100px 12px ${corPrimaria}50`,
          }}
        />
        {/* Estrelinhas/luzes acima do horizonte */}
        <div className="absolute top-2 inset-x-0 h-12 pointer-events-none">
          {[18, 32, 47, 63, 78, 91].map((x, i) => (
            <span
              key={i}
              className="absolute w-0.5 h-0.5 bg-white/40 rounded-full"
              style={{
                left: `${x}%`,
                top: `${(i * 11) % 50}px`,
                animation: `pulse-glow ${3 + i}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
        {/* Skyline */}
        <Skyline corPrimaria={corPrimaria} />
      </div>

      {/* ====== Pattern de fundo: grid de lotes ====== */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${corPrimaria} 1px, transparent 1px), linear-gradient(90deg, ${corPrimaria} 1px, transparent 1px)`,
          backgroundSize: '40px 22px',
          backgroundPosition: 'center bottom',
          maskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)',
        }}
      />

      {/* Lotes flutuantes decorativos */}
      <div className="absolute top-32 left-6 hidden lg:block rotate-12 pointer-events-none">
        <LotMark size={70} corPrimaria={corPrimaria} />
      </div>
      <div className="absolute bottom-32 right-6 hidden lg:block -rotate-6 pointer-events-none">
        <LotMark size={50} corPrimaria={corPrimaria} />
      </div>

      {/* Glow blob laranja decorativo */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: corPrimaria }}
      />

      {/* ====== CONTEÚDO ====== */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Brand block centralizado */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-4 mb-4">
            {loteadora.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loteadora.logo}
                alt={loteadora.nome}
                className="h-12 object-contain"
              />
            )}
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-none">
              <span className="text-white">{inicio}</span>
              {ultimaPalavra && (
                <>
                  {' '}
                  <span style={{ color: corPrimaria }}>{ultimaPalavra}</span>
                </>
              )}
            </h2>
          </div>
          <p className="text-xs uppercase tracking-[0.45em] text-white/50">
            {loteamento.cidade} · {loteamento.estado} — Loteamento residencial
          </p>
        </div>

        {/* Grid de colunas */}
        <div className="grid md:grid-cols-3 gap-10 mb-12">
          {/* Sobre / loteadora */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] mb-4 flex items-center gap-2" style={{ color: corPrimaria }}>
              <span className="w-6 h-px" style={{ background: corPrimaria }} />
              Sobre
            </p>
            <h3 className="font-bold text-lg mb-1">{loteadora.nome}</h3>
            {loteadora.razaoSocial && (
              <p className="text-sm text-white/60 mb-2">{loteadora.razaoSocial}</p>
            )}
            {loteadora.cnpj && (
              <p className="text-xs text-white/40 font-mono mb-3">CNPJ {loteadora.cnpj}</p>
            )}
            {loteadora.sobreTexto && (
              <p className="text-sm text-white/70 leading-relaxed line-clamp-4">
                {loteadora.sobreTexto}
              </p>
            )}

            {/* Bloco "Desenvolvido por" — referencia à Target Nexus */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-3"
                style={{ color: corPrimaria }}
              >
                Desenvolvido por
              </p>
              <a
                href="https://wa.me/5575988411277"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 hover:opacity-90 transition"
                aria-label="Site desenvolvido por Target Nexus"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/uploads/system/target-nexus-logo.jpg"
                  alt="Target Nexus"
                  className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/20 group-hover:ring-white/40 transition"
                />
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">
                    Target Nexus <span className="text-amber-400">AI</span>
                  </p>
                  <p className="text-[11px] text-white/60">
                    Tecnologia &amp; Soluções
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    📍 Tucano · BA
                  </p>
                </div>
              </a>
            </div>
          </div>

          {/* Navegação */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] mb-4 flex items-center gap-2" style={{ color: corPrimaria }}>
              <span className="w-6 h-px" style={{ background: corPrimaria }} />
              Navegue
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                ['#sobre', 'Sobre o empreendimento'],
                ['#investir', 'Por que investir'],
                ['#lotes', 'Escolher meu lote'],
                ['#planta', 'Mapa interativo'],
                ['#localizacao', 'Localização'],
                ['#faq', 'Perguntas frequentes'],
                ['#contato', 'Falar com consultor'],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="group inline-flex items-center gap-2 text-white/70 hover:text-white transition"
                  >
                    <span
                      className="inline-block w-0 h-px transition-all duration-300 group-hover:w-4"
                      style={{ background: corPrimaria }}
                    />
                    <span className="group-hover:translate-x-1 transition-transform">
                      {label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] mb-4 flex items-center gap-2" style={{ color: corPrimaria }}>
              <span className="w-6 h-px" style={{ background: corPrimaria }} />
              Fale conosco
            </p>
            <ul className="space-y-3 text-sm">
              {loteamento.endereco && (
                <li className="flex items-start gap-3">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${corPrimaria}25`, color: corPrimaria }}
                  >
                    📍
                  </span>
                  <span className="text-white/70 leading-snug">{loteamento.endereco}</span>
                </li>
              )}
              {(loteamento.contatoTelefone ?? loteadora.telefone) && (
                <li className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${corPrimaria}25`, color: corPrimaria }}
                  >
                    📞
                  </span>
                  <span className="text-white/80 font-medium">
                    {loteamento.contatoTelefone ?? loteadora.telefone}
                  </span>
                </li>
              )}
              {loteadora.whatsapp && (
                <li className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${corPrimaria}25`, color: corPrimaria }}
                  >
                    💬
                  </span>
                  <a
                    href={`https://wa.me/${loteadora.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition"
                  >
                    WhatsApp {loteadora.whatsapp}
                  </a>
                </li>
              )}
              {(loteamento.contatoEmail ?? loteadora.email) && (
                <li className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${corPrimaria}25`, color: corPrimaria }}
                  >
                    ✉️
                  </span>
                  <a
                    href={`mailto:${loteamento.contatoEmail ?? loteadora.email}`}
                    className="text-white/80 hover:text-white transition break-all"
                  >
                    {loteamento.contatoEmail ?? loteadora.email}
                  </a>
                </li>
              )}
              {loteadora.instagram && (
                <li className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `${corPrimaria}25`, color: corPrimaria }}
                  >
                    <IconInstagram className="w-4 h-4" />
                  </span>
                  <a
                    href={`https://instagram.com/${loteadora.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition"
                  >
                    {loteadora.instagram}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Marquee de valores */}
        <div className="overflow-hidden border-y border-white/10 py-3 mb-8 relative">
          <div
            className="absolute left-0 top-0 bottom-0 w-24 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, black, transparent)' }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-24 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to left, black, transparent)' }}
          />
          <div className="marquee-track text-xs uppercase tracking-[0.4em] text-white/40">
            {Array.from({ length: 2 }).flatMap((_, dup) =>
              ['Tradição', 'Qualidade', 'Confiança', 'Infraestrutura completa', 'Lotes escriturados', 'Tradição', 'Qualidade', 'Confiança'].map((item, i) => (
                <span key={`${dup}-${i}`} className="flex items-center gap-4 whitespace-nowrap">
                  <span style={{ color: corPrimaria }}>◆</span>
                  {item}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>
            © {new Date().getFullYear()} <span className="text-white/60">{loteadora.nome}</span>.
            Todos os direitos reservados.
          </p>
          <p className="flex items-center gap-1.5">
            <span>Site por</span>
            <Link
              href="/"
              className="font-semibold transition hover:text-white"
              style={{ color: corPrimaria }}
            >
              meu<span className="text-white/60">loteamento</span>
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
