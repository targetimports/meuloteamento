/**
 * Timeline de eventos de uma venda.
 *
 * Server component: recebe os eventos já calculados, formata as datas aqui e
 * entrega ao componente de tela a lista pronta. A data é formatada no
 * servidor de propósito — o resto da página faz igual, e formatar no navegador
 * mostraria horas diferentes das que aparecem nas parcelas logo acima.
 */

import { formatDateTime } from '@/lib/format';
import { TimelineLista, type TimelineItem } from '@/components/vendas/TimelineLista';

export interface TimelineEvent {
  data: Date;
  tipo: 'criada' | 'pago' | 'reaberta' | 'reservada' | 'distratada' | 'quitada' | 'lote_status';
  titulo: string;
  descricao?: string;
}

export function VendaTimeline({ eventos }: { eventos: TimelineEvent[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm italic text-slate-500">Sem eventos registrados ainda.</p>;
  }

  // Mais recente em cima: o que acabou de acontecer é o que se procura.
  const itens: TimelineItem[] = [...eventos]
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .map((ev) => ({
      tipo: ev.tipo,
      titulo: ev.titulo,
      descricao: ev.descricao ?? null,
      dataLabel: formatDateTime(ev.data),
    }));

  return <TimelineLista itens={itens} />;
}
