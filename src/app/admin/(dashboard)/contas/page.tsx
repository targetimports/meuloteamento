import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';
import { formatBRL } from '@/lib/format';
import { criarContaSimple, toggleAtivaConta, excluirConta } from './actions';
import { ConfirmButton } from '@/components/ConfirmButton';

export const dynamic = 'force-dynamic';

const TIPO_LABEL: Record<string, string> = {
  ASAAS: '⚡ Asaas',
  CAIXA: '💵 Caixa (espécie)',
  BANCO: '🏦 Banco',
  OUTROS: '• Outros',
};

const TIPO_BG: Record<string, string> = {
  ASAAS: 'bg-sky-50 text-sky-700 border-sky-200',
  CAIXA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BANCO: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  OUTROS: 'bg-slate-50 text-slate-700 border-slate-200',
};

export default async function ContasPage() {
  const tid = await tenantId();
  const where = tid ? { loteadoraId: tid } : {};

  const contas = await prisma.contaFinanceira.findMany({
    where,
    orderBy: [{ ativa: 'desc' }, { ordem: 'asc' }, { nome: 'asc' }],
    include: {
      loteadora: { select: { nome: true } },
      _count: { select: { parcelas: true } },
    },
  });

  // Somar saldos (parcelas PAGAS por conta)
  const saldosPorConta = await prisma.parcela.groupBy({
    by: ['contaId'],
    where: { status: 'PAGO', contaId: { not: null } },
    _sum: { valorPago: true, valor: true },
  });
  const saldoMap = new Map<string, number>();
  for (const s of saldosPorConta) {
    if (s.contaId) saldoMap.set(s.contaId, Number(s._sum.valorPago ?? s._sum.valor ?? 0));
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas financeiras</h1>
          <p className="text-sm text-slate-500">
            Onde caem os recebimentos. Asaas, caixa em espécie, contas bancárias externas.
          </p>
        </div>
      </div>

      {/* Form de criar nova conta */}
      <details className="bg-white border border-slate-200 rounded-xl mb-6">
        <summary className="cursor-pointer p-4 font-semibold text-slate-900 hover:bg-slate-50">
          + Cadastrar nova conta
        </summary>
        <form action={criarContaSimple} className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nome da conta *
            </label>
            <input
              name="nome"
              required
              minLength={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              placeholder="Ex: Conta Itaú 12345-6"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tipo *</label>
            <select
              name="tipo"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="BANCO">🏦 Banco</option>
              <option value="CAIXA">💵 Caixa (espécie)</option>
              <option value="ASAAS">⚡ Asaas</option>
              <option value="OUTROS">• Outros</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Banco</label>
            <input
              name="banco"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              placeholder="Banco do Brasil / Itaú / Caixa..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Titular</label>
            <input
              name="titular"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Agência</label>
            <input
              name="agencia"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nº Conta</label>
            <input
              name="numeroConta"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Chave PIX</label>
            <input
              name="chavePix"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              placeholder="CPF/CNPJ/email/celular ou chave aleatória"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Saldo inicial</label>
            <input
              name="saldoInicial"
              type="number"
              step="0.01"
              defaultValue="0"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Descrição</label>
            <input
              name="descricao"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              placeholder="Observações livres"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2 rounded-lg"
            >
              Salvar conta
            </button>
          </div>
        </form>
      </details>

      {/* Lista */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {contas.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-sm text-amber-800">
            Nenhuma conta cadastrada. Crie pelo menos uma conta de &ldquo;caixa&rdquo; e uma da Asaas para
            receber pagamentos.
          </div>
        )}
        {contas.map((c) => {
          const saldoMov = saldoMap.get(c.id) ?? 0;
          const saldoTotal = Number(c.saldoInicial) + saldoMov;
          return (
            <div
              key={c.id}
              className={`bg-white border-2 rounded-xl p-4 flex flex-col gap-2 ${
                c.ativa ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
              style={c.cor ? { borderTopColor: c.cor, borderTopWidth: 4 } : undefined}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900">{c.nome}</p>
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${TIPO_BG[c.tipo]}`}
                  >
                    {TIPO_LABEL[c.tipo]}
                  </span>
                </div>
                {!c.ativa && (
                  <span className="text-[10px] bg-red-100 text-red-700 font-semibold px-1.5 py-0.5 rounded">
                    INATIVA
                  </span>
                )}
              </div>

              {(c.banco || c.agencia || c.numeroConta) && (
                <p className="text-xs text-slate-600">
                  {c.banco && <>{c.banco}</>}
                  {c.agencia && <> · Ag {c.agencia}</>}
                  {c.numeroConta && <> · Cc {c.numeroConta}</>}
                </p>
              )}
              {c.chavePix && (
                <p className="text-xs text-slate-600 truncate" title={c.chavePix}>
                  PIX: <span className="font-mono">{c.chavePix}</span>
                </p>
              )}
              {c.titular && (
                <p className="text-xs text-slate-500">Titular: {c.titular}</p>
              )}

              <div className="border-t border-slate-100 pt-2 mt-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Inicial
                  </p>
                  <p className="font-semibold text-slate-700">{formatBRL(Number(c.saldoInicial))}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Recebido
                  </p>
                  <p className="font-bold text-emerald-700">{formatBRL(saldoMov)}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2 -mx-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Saldo atual
                </p>
                <p className="text-xl font-black text-slate-900">{formatBRL(saldoTotal)}</p>
              </div>
              <p className="text-[10px] text-slate-400">
                {c._count.parcelas} parcela(s) vinculadas
              </p>

              <div className="flex gap-1 mt-1">
                <form action={toggleAtivaConta.bind(null, c.id)} className="flex-1">
                  <button
                    type="submit"
                    className="w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-1.5 rounded"
                  >
                    {c.ativa ? '🚫 Desativar' : '✓ Reativar'}
                  </button>
                </form>
                {c._count.parcelas === 0 && (
                  <form action={excluirConta.bind(null, c.id)}>
                    <ConfirmButton
                      message={`Excluir conta "${c.nome}"?`}
                      className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-medium px-2 py-1.5 rounded"
                    >
                      🗑️
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
