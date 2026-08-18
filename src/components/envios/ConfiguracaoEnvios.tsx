'use client';

/**
 * Estado da cobrança automática, com a configuração atrás de um botão.
 *
 * Os dois cartões de configuração — conectar WhatsApp e escolher os dias —
 * ocupavam a metade de cima da página, todos os dias, para uma configuração
 * que se mexe uma vez e não se toca mais. O que precisa ficar à vista é o
 * estado: se o número está conectado e se a régua está enviando.
 *
 * 🔴 O estado continua no topo de propósito. Em 29/07/2026 a sessão do
 * WhatsApp caiu e a tela seguiu dizendo "conectado" por 14 dias enquanto a
 * régua acumulava falhas logo abaixo — ninguém percebeu porque o topo da
 * página afirmava que estava tudo bem. Esconder isto dentro do modal
 * recriaria exatamente essa cegueira.
 */

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import WhatsAppConnectCard from '@/components/WhatsAppConnectCard';
import CobrancaScheduleCard from '@/components/CobrancaScheduleCard';

export function ConfiguracaoEnvios({
  loteadoraId,
  conectado,
  numero,
  configurado,
  cobrancaAtiva,
  diasAntes,
  noVencimento,
  atrasoDiario,
}: {
  loteadoraId: string;
  conectado: boolean;
  numero: string | null;
  configurado: boolean;
  cobrancaAtiva: boolean;
  diasAntes: number[];
  noVencimento: boolean;
  atrasoDiario: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  const resumoAgenda = [
    diasAntes.length ? `${diasAntes.join(' e ')} dia(s) antes` : null,
    noVencimento ? 'no vencimento' : null,
    atrasoDiario ? 'todo dia em atraso' : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Estado
            rotulo="WhatsApp"
            ok={conectado}
            texto={
              conectado
                ? numero
                  ? `Conectado · ${numero}`
                  : 'Conectado'
                : 'Desconectado'
            }
          />
          <Estado
            rotulo="Cobrança automática"
            ok={cobrancaAtiva && conectado}
            texto={
              !cobrancaAtiva
                ? 'Pausada — nenhum lembrete sai'
                : conectado
                  ? resumoAgenda.length
                    ? `Enviando ${resumoAgenda.join(', ')}`
                    : 'Ativa'
                  : 'Ativa, mas sem WhatsApp conectado'
            }
          />
        </div>

        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Configurar cobrança
        </button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar cobrança automática</DialogTitle>
            <p className="text-sm text-slate-500">
              O número que envia os lembretes e os dias em que eles saem.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <WhatsAppConnectCard
              loteadoraId={loteadoraId}
              connected={conectado}
              number={numero}
              configured={configurado}
              cobrancaAtiva={cobrancaAtiva}
            />
            <CobrancaScheduleCard
              loteadoraId={loteadoraId}
              diasAntes={diasAntes}
              noVencimento={noVencimento}
              atrasoDiario={atrasoDiario}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Estado({ rotulo, ok, texto }: { rotulo: string; ok: boolean; texto: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-900">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            ok ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
          aria-hidden
        />
        {texto}
      </p>
    </div>
  );
}
