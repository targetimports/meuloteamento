import Link from 'next/link';

export function PublicHeader({ nomeEmpresa }: { nomeEmpresa: string }) {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-primary-700">
          {nomeEmpresa}
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-slate-700 hover:text-primary-700">
            Início
          </Link>
          <Link href="/sobre" className="text-slate-700 hover:text-primary-700">
            Sobre
          </Link>
          <Link href="/contato" className="text-slate-700 hover:text-primary-700">
            Contato
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter({
  nomeEmpresa,
  telefone,
  email,
  cnpj,
}: {
  nomeEmpresa: string;
  telefone: string | null;
  email: string | null;
  cnpj: string | null;
}) {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-12">
      <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-1">{nomeEmpresa}</p>
        {cnpj && <p className="text-xs">CNPJ {cnpj}</p>}
        <div className="mt-2 text-xs">
          {telefone && <span>{telefone}</span>}
          {telefone && email && <span className="mx-2">·</span>}
          {email && <span>{email}</span>}
        </div>
      </div>
    </footer>
  );
}
