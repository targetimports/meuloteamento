'use client';

/**
 * Fluxo de checkout do cliente final.
 *
 *  Steps:
 *   1. Simulação (entrada + qtd parcelas) — pré-preenche da última escolha do simulador
 *   2. Dados pessoais (nome, CPF, email, telefone, endereço — pro Asaas precisar)
 *   3. Forma de pagamento (PIX / Boleto / Cartão)
 *   4. Confirmar → POST /api/checkout → redireciona pra /checkout/sucesso/{vendaId}
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  loteId: string;
  loteCodigo: string;
  loteamentoNome: string;
  precoLote: number;
  corPrimaria: string;
  /** Param. da regra da loteadora (do simulador) */
  entradaMinima?: number;
  valorParcelaPadrao?: number;
  parcelasMax?: number;
  /** Callback opcional (ex.: fechar modal) */
  onClose?: () => void;
}

function brl(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function pmtPrice(pv: number, i: number, n: number): number {
  if (i === 0) return pv / n;
  return (pv * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

function descobrirTaxa(pv: number, pmt: number, n: number): number {
  function calc(i: number) {
    if (i === 0) return pv / n;
    return (pv * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  }
  let lo = 0,
    hi = 0.5,
    mid = 0;
  for (let k = 0; k < 200; k++) {
    mid = (lo + hi) / 2;
    if (calc(mid) > pmt) hi = mid;
    else lo = mid;
  }
  return mid;
}

export function CheckoutFlow({
  loteId,
  loteCodigo,
  loteamentoNome,
  precoLote,
  corPrimaria,
  entradaMinima = 5000,
  valorParcelaPadrao = 1000,
  parcelasMax = 60,
  onClose,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Taxa Price implícita
  const taxaMensal = useMemo(
    () => descobrirTaxa(precoLote - entradaMinima, valorParcelaPadrao, parcelasMax),
    [precoLote, entradaMinima, valorParcelaPadrao, parcelasMax]
  );

  // Step 1 — Simulação
  const [aVista, setAVista] = useState(false);
  const [entrada, setEntrada] = useState(entradaMinima);
  const [qtdParcelas, setQtdParcelas] = useState(parcelasMax);

  const saldoFinanciado = aVista ? 0 : precoLote - entrada;
  const valorParcela = aVista ? 0 : pmtPrice(saldoFinanciado, taxaMensal, qtdParcelas);
  const totalAPagar = aVista ? precoLote : entrada + valorParcela * qtdParcelas;
  const valorPrimeiroPagto = aVista ? precoLote : entrada;

  // Step 2 — Dados pessoais
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Step 3 — Forma de pagamento da entrada
  // Pagamento online só por PIX (decisão do negócio)
  const billingType = 'PIX' as const;

  // ViaCEP — busca endereço quando CEP completo
  useEffect(() => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${clean}/json/`)
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) return;
        if (!endereco) setEndereco(d.logradouro || '');
        if (!bairro) setBairro(d.bairro || '');
        if (!cidade) setCidade(d.localidade || '');
        if (!estado) setEstado(d.uf || '');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep]);

  function validateStep(s: number): string | null {
    if (s === 2) {
      if (!nome.trim() || nome.trim().split(' ').length < 2)
        return 'Informe seu nome completo.';
      const cpf = cpfCnpj.replace(/\D/g, '');
      if (cpf.length !== 11 && cpf.length !== 14) return 'CPF ou CNPJ inválido.';
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'E-mail inválido.';
      if (telefone.replace(/\D/g, '').length < 10)
        return 'Telefone inválido — inclua DDD.';
      // Endereço pelo menos com cidade/estado pra dados fiscais
      if (!cep || !cidade || !estado)
        return 'Preencha pelo menos CEP, cidade e estado.';
    }
    return null;
  }

  // Captura lead 1x quando cliente termina o Step 2 — evita perder contato no abandono do checkout
  const [leadCaptured, setLeadCaptured] = useState(false);
  function captureLeadIfStep2() {
    if (leadCaptured || step !== 2) return;
    setLeadCaptured(true);
    fetch('/api/leads/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone,
        origem: 'checkout-iniciado',
        loteId,
        mensagem: `Iniciou checkout do lote ${loteCodigo}`,
        simulacao: {
          valorTotal: precoLote,
          valorEntrada: aVista ? precoLote : entrada,
          qtdParcelas: aVista ? 0 : qtdParcelas,
          valorParcela: aVista ? 0 : Number(valorParcela.toFixed(2)),
        },
      }),
    }).catch(() => {});
  }

  function next() {
    setError(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    if (step === 2) captureLeadIfStep2();
    setStep((step + 1) as 1 | 2 | 3 | 4);
  }

  function back() {
    setError(null);
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loteId,
            nome,
            cpfCnpj,
            email,
            telefone,
            cep,
            endereco,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            valorTotal: precoLote,
            valorEntrada: aVista ? precoLote : entrada,
            qtdParcelas: aVista ? 0 : qtdParcelas,
            valorParcela: aVista ? 0 : Number(valorParcela.toFixed(2)),
            billingType,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error || 'Erro ao processar a compra.');
          return;
        }
        router.push(data.redirectUrl);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  // ============ RENDER ============
  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-1.5 mb-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              s <= step ? '' : 'bg-slate-200'
            }`}
            style={s <= step ? { background: corPrimaria } : undefined}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Passo {step} de 4 ·{' '}
        {step === 1 && 'Simulação'}
        {step === 2 && 'Seus dados'}
        {step === 3 && 'Forma de pagamento'}
        {step === 4 && 'Confirmação'}
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ============ STEP 1 — Simulação ============ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Você está comprando
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">Lote {loteCodigo}</p>
            <p className="text-sm text-slate-600">{loteamentoNome}</p>
            <p className="text-lg font-bold mt-2" style={{ color: corPrimaria }}>
              {brl(precoLote, 0)} à vista
            </p>
          </div>

          {/* Toggle à vista / parcelado */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAVista(true)}
              className={`p-3 rounded-xl border-2 text-left transition ${
                aVista ? 'text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
              style={aVista ? { background: corPrimaria, borderColor: corPrimaria } : undefined}
            >
              <p className="text-xs uppercase font-semibold">À vista</p>
              <p className="font-bold mt-0.5">{brl(precoLote, 0)}</p>
            </button>
            <button
              onClick={() => setAVista(false)}
              className={`p-3 rounded-xl border-2 text-left transition ${
                !aVista ? 'text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
              style={!aVista ? { background: corPrimaria, borderColor: corPrimaria } : undefined}
            >
              <p className="text-xs uppercase font-semibold">Parcelado</p>
              <p className="font-bold mt-0.5">Entrada + parcelas</p>
            </button>
          </div>

          {!aVista && (
            <>
              {/* Slider entrada */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-700">Entrada</span>
                  <span className="text-lg font-bold" style={{ color: corPrimaria }}>
                    {brl(entrada, 0)}{' '}
                    <span className="text-xs text-slate-400">
                      ({((entrada / precoLote) * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={entradaMinima}
                  max={precoLote - 1000}
                  step={500}
                  value={entrada}
                  onChange={(e) => setEntrada(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
                  style={{ accentColor: corPrimaria }}
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Mín {brl(entradaMinima, 0)}</span>
                  <span>{brl(precoLote - 1000, 0)}</span>
                </div>
              </div>

              {/* Slider parcelas */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-700">Parcelas</span>
                  <span className="text-lg font-bold" style={{ color: corPrimaria }}>
                    {qtdParcelas}x
                  </span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={parcelasMax}
                  step={6}
                  value={qtdParcelas}
                  onChange={(e) => setQtdParcelas(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
                  style={{ accentColor: corPrimaria }}
                />
              </div>
            </>
          )}

          {/* Resumo */}
          <div
            className="rounded-xl p-4 text-white"
            style={{ background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)` }}
          >
            {aVista ? (
              <>
                <p className="text-xs uppercase tracking-wider text-white/80">Você paga</p>
                <p className="text-3xl font-black">{brl(precoLote, 0)}</p>
                <p className="text-sm text-white/80 mt-1">À vista</p>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wider text-white/80">
                  Parcela mensal
                </p>
                <p className="text-3xl font-black">{brl(valorParcela)}</p>
                <p className="text-sm text-white/80 mt-1">
                  Por {qtdParcelas}x após entrada de {brl(entrada, 0)}
                </p>
                <p className="text-xs text-white/70 mt-2 pt-2 border-t border-white/20">
                  Total a pagar: <strong>{brl(totalAPagar, 0)}</strong>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============ STEP 2 — Dados pessoais ============ */}
      {step === 2 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">Seus dados</h3>
          <Input label="Nome completo *" value={nome} onChange={setNome} placeholder="Nome e sobrenome" />
          <Input
            label="CPF ou CNPJ *"
            value={cpfCnpj}
            onChange={setCpfCnpj}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
          <Input
            label="E-mail *"
            value={email}
            onChange={setEmail}
            placeholder="voce@email.com"
            type="email"
          />
          <Input
            label="Telefone / WhatsApp *"
            value={telefone}
            onChange={setTelefone}
            placeholder="(00) 90000-0000"
            inputMode="tel"
          />

          <h3 className="font-semibold text-slate-900 pt-2">Endereço</h3>
          <div className="grid grid-cols-3 gap-2">
            <Input label="CEP *" value={cep} onChange={setCep} placeholder="00000-000" inputMode="numeric" />
            <Input label="UF *" value={estado} onChange={(v) => setEstado(v.toUpperCase().slice(0, 2))} placeholder="BA" />
            <Input label="Cidade *" value={cidade} onChange={setCidade} placeholder="Tucano" />
          </div>
          <Input label="Endereço *" value={endereco} onChange={setEndereco} placeholder="Rua/Avenida" />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Número *" value={numero} onChange={setNumero} placeholder="123" />
            <Input label="Complemento" value={complemento} onChange={setComplemento} placeholder="Apt 12" />
            <Input label="Bairro" value={bairro} onChange={setBairro} placeholder="Centro" />
          </div>
        </div>
      )}

      {/* ============ STEP 3 — Pagamento (só PIX) ============ */}
      {step === 3 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">
            Pagamento via PIX
          </h3>
          <div
            className="rounded-2xl p-5 text-white shadow"
            style={{ background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}dd)` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
                💚
              </div>
              <div>
                <p className="font-bold text-lg">PIX instantâneo</p>
                <p className="text-xs text-white/80">Pague em segundos, sem taxas</p>
              </div>
            </div>
            <p className="text-2xl font-black mb-1">{brl(valorPrimeiroPagto, 0)}</p>
            <p className="text-xs text-white/80">
              {aVista ? 'Valor total à vista' : 'Entrada da compra'}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            <p className="font-bold">⏰ Atenção ao prazo</p>
            <p>
              O QR PIX tem validade de <strong>60 minutos</strong> após gerado. Se você não
              concluir o pagamento nesse tempo, o lote volta para disponível e a reserva é
              cancelada automaticamente.
            </p>
          </div>

          {!aVista && (
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
              ℹ️ As <strong>{qtdParcelas}x de {brl(valorParcela)}</strong> serão emitidas
              mês a mês como boletos PIX (você recebe cada um por WhatsApp/e-mail).
            </div>
          )}
        </div>
      )}

      {/* ============ STEP 4 — Confirmação ============ */}
      {step === 4 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900">Confira e confirme</h3>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <Linha label="Lote" valor={`${loteCodigo} — ${loteamentoNome}`} />
            <Linha label="Valor total" valor={brl(precoLote, 0)} bold />
            {!aVista && (
              <>
                <Linha label="Entrada" valor={brl(entrada, 0)} />
                <Linha label="Parcelas" valor={`${qtdParcelas}x de ${brl(valorParcela)}`} />
                <Linha label="Total a pagar" valor={brl(totalAPagar, 0)} bold />
              </>
            )}
            <Linha
              label={aVista ? 'Pagamento' : 'Pagar entrada via'}
              valor="PIX (instantâneo)"
            />
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm">
            <Linha label="Comprador" valor={nome} />
            <Linha label="CPF/CNPJ" valor={cpfCnpj} />
            <Linha label="E-mail" valor={email} />
            <Linha label="Telefone" valor={telefone} />
            <Linha label="Endereço" valor={`${endereco}, ${numero} — ${cidade}/${estado}`} />
          </div>

          <p className="text-xs text-slate-500">
            Ao confirmar, geramos o QR PIX da {aVista ? 'compra' : 'entrada'}. Você terá{' '}
            <strong>60 minutos</strong> para pagar. Após o pagamento, nossa equipe entra em
            contato em até 24h para assinatura do contrato.
          </p>
        </div>
      )}

      {/* ============ AÇÕES ============ */}
      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <button
            onClick={back}
            disabled={pending}
            className="flex-1 py-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 font-medium text-slate-700 disabled:opacity-50"
          >
            ← Voltar
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={next}
            disabled={pending}
            className="flex-1 py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-50 transition"
            style={{ background: corPrimaria }}
          >
            Continuar →
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={pending}
            className="flex-1 py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-60 transition flex items-center justify-center gap-2"
            style={{ background: corPrimaria }}
          >
            {pending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processando...
              </>
            ) : (
              <>✓ Confirmar e finalizar compra</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Helpers internos ============

function Input({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        {...rest}
      />
    </div>
  );
}

function Linha({ label, valor, bold }: { label: string; valor: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm text-slate-900 ${bold ? 'font-bold' : ''}`}>{valor}</span>
    </div>
  );
}
