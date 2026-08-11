/**
 * Simulador de demonstração — lote de R$ 50.000 com entrada de R$ 1.000.
 *
 * Rota própria, separada de /simulador/[slug]: aquela pertence a um
 * loteamento real, lê os dados dele e captura lead no CRM do cliente. Esta é
 * para mostrar a plataforma a interessados, então não pode injetar leads de
 * demonstração na base de ninguém.
 *
 * Os valores vêm daqui, não do banco. O componente já aceitava
 * precoResidencial e entradaMinima como props — a página do loteamento só
 * nunca os passava, ficando com os padrões de 55.000 e 5.000.
 *
 * NÃO INDEXÁVEL: é uma simulação com números fictícios. Aparecer no Google
 * como se fosse oferta de um loteamento real seria enganoso.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { SimuladorResidencial } from '@/components/SimuladorResidencial';

export const metadata: Metadata = {
  title: 'Simulador de financiamento — demonstração | meuloteamento',
  description:
    'Simulação demonstrativa: lote de R$ 50.000 com entrada a partir de R$ 1.000. Valores ilustrativos.',
  robots: { index: false, follow: false },
};

const PRECO_LOTE = 50000;
const ENTRADA_MINIMA = 1000;
const PARCELAS = 60;

/**
 * Parcela da condição padrão, usada pelo componente para inferir a taxa Price.
 *
 * Calculada a partir dos valores acima em vez de fixada: com 50.000 de lote e
 * 1.000 de entrada, repetir o R$ 1.000 do padrão antigo daria uma taxa
 * implícita diferente da que o Parque Tucano pratica, e a simulação sairia
 * mais cara sem que ninguém percebesse.
 *
 * Aqui mantemos a mesma taxa do padrão de referência (55.000 − 5.000 = 50.000
 * financiados em 60x de 1.000) aplicada ao saldo desta demonstração — que,
 * por coincidência de valores, dá o mesmo saldo financiado.
 */
const VALOR_PARCELA_PADRAO = 1000;

export default function SimuladorDemoPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gold-500 text-slate-950 flex items-center justify-center font-bold text-sm flex-shrink-0">
              ML
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                meuloteamento
              </p>
              <p className="text-[11px] text-slate-500">Simulador de demonstração</p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden md:inline"
          >
            ← Voltar ao site
          </Link>
        </div>
      </header>

      {/* O aviso vem antes da simulação, não no rodapé: quem abre um simulador
          começa a mexer nos números na hora, e descobrir depois que eram
          fictícios é pior do que saber antes. */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-6 py-2.5">
          <p className="text-xs text-amber-900 text-center">
            Demonstração com valores de exemplo — lote de R$ 50.000 e entrada a
            partir de R$ 1.000. Não corresponde a um loteamento à venda.
          </p>
        </div>
      </div>

      <main className="flex-1">
        <SimuladorResidencial
          precoResidencial={PRECO_LOTE}
          entradaMinima={ENTRADA_MINIMA}
          parcelas={PARCELAS}
          valorParcelaPadrao={VALOR_PARCELA_PADRAO}
          corPrimaria="#d4af37"
          loteamentoNome="este loteamento"
          loteadoraNome="meuloteamento"
          standalone
          /* Sem loteamentoId nem loteamentoSlug: assim o componente não tem
             onde registrar lead, e uma simulação de demonstração não entra no
             CRM de nenhum cliente. */
        />
      </main>

      <footer className="border-t border-slate-200 py-6 bg-white">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} meuloteamento · Simulação ilustrativa com
          valores de exemplo, sujeita à análise de crédito. ·{' '}
          <Link href="/" className="hover:underline">
            Conheça a plataforma
          </Link>
        </div>
      </footer>
    </div>
  );
}
