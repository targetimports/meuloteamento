import Link from 'next/link';
import { loginAction } from './actions';
import { LoginForm } from '@/components/LoginForm';
import { LogoMark, Logo } from '@/components/Logo';

export const metadata = { title: 'Login — meuloteamento' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_1fr] bg-white">
      {/* ====== Painel BRANDING (esquerda no desktop) ====== */}
      <aside className="hidden lg:flex relative overflow-hidden mesh-hero text-white">
        {/* Padrão de grid sobre fundo escuro */}
        <div className="absolute inset-0 bg-grid-dark opacity-40" />

        {/* Conic blobs animados */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] conic-bg animate-spin-slow opacity-30" />
        <div className="absolute -bottom-40 -right-20 w-[420px] h-[420px] conic-bg animate-spin-slow opacity-25" />

        {/* Glow central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-primary-500/20 rounded-full blur-3xl animate-pulse-glow" />

        {/* Marca flutuante decorativa */}
        <div className="absolute top-16 right-16 animate-float opacity-30">
          <LogoMark size={120} variant="light" className="text-white" />
        </div>
        <div className="absolute bottom-24 left-12 animate-float-slow opacity-25">
          <LogoMark size={70} variant="light" className="text-primary-200" />
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <Link href="/" className="inline-flex">
              <Logo variant="light" size={32} />
            </Link>
          </div>

          <div className="space-y-6 max-w-md animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur border border-white/15 rounded-full text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium">Painel administrativo</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">
              Bem-vindo de volta ao <span className="gradient-text">meu</span>
              <span className="gradient-text">loteamento</span>.
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed">
              Gerencie seus loteamentos, lotes, vendas e parcelas em um único painel —
              tudo em tempo real.
            </p>

            <ul className="space-y-2 pt-2">
              {[
                'Reserva com lock automático',
                'Integração Asaas para pagamentos',
                'Mapeamento visual dos lotes',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-primary-500/20 border border-primary-400/40 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-primary-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <p>© {new Date().getFullYear()} meuloteamento</p>
            <Link href="/" className="hover:text-white transition flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
              </svg>
              Voltar ao site
            </Link>
          </div>
        </div>
      </aside>

      {/* ====== Painel LOGIN (direita) ====== */}
      <section className="flex flex-col items-center justify-center px-6 py-12 lg:py-20 bg-slate-50 lg:bg-white relative">
        {/* Padrão sutil de pontos no mobile */}
        <div className="absolute inset-0 bg-grid opacity-30 lg:hidden" />

        <div className="relative w-full max-w-sm">
          {/* Logo só no mobile (no desktop está no painel esquerdo) */}
          <Link href="/" className="lg:hidden inline-flex mb-10">
            <Logo variant="dark" size={28} />
          </Link>

          {/* Cabeçalho */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-primary-50 border border-primary-100 text-primary-700 rounded-full text-xs font-semibold uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-9V6m-7 6h2m10 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4l1.4-1.4m10-10 1.4-1.4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
              </svg>
              Acesso restrito
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">
              Entre na sua conta
            </h2>
            <p className="text-slate-500 mt-1.5">
              Use seu e-mail e senha do meuloteamento.
            </p>
          </div>

          {/* Mensagem de erro */}
          {searchParams.error && (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm animate-fade-up">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4v.01M5.07 19h13.86a2 2 0 0 0 1.74-3l-6.93-12a2 2 0 0 0-3.48 0l-6.93 12a2 2 0 0 0 1.74 3Z" />
              </svg>
              <p className="text-red-800">{searchParams.error}</p>
            </div>
          )}

          {/* Form */}
          <LoginForm action={loginAction} />

          {/* Footer info */}
          <div className="mt-10 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500">
              Ainda não é cliente?{' '}
              <Link
                href="/contato"
                className="font-semibold text-primary-600 hover:text-primary-700 transition"
              >
                Fale com vendas →
              </Link>
            </p>
          </div>

          {/* Selo de segurança */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
            </svg>
            Conexão segura — protegida por SSL
          </div>
        </div>
      </section>
    </main>
  );
}
