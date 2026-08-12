'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Flag, Pencil, Plus, Trash2, Trophy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  atualizarEtapa,
  criarEtapa,
  excluirEtapa,
  reordenarEtapas,
} from '@/app/admin/(dashboard)/leads/etapas/actions';

export interface EtapaUI {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  slaHoras: number | null;
  ehFinal: boolean;
  ehGanho: boolean;
  statusLegado: string | null;
  leads: number;
}

const CORES = [
  '#64748b',
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

type Rascunho = {
  nome: string;
  cor: string;
  slaHoras: string;
  ehFinal: boolean;
  ehGanho: boolean;
};

const VAZIO: Rascunho = { nome: '', cor: CORES[0], slaHoras: '', ehFinal: false, ehGanho: false };

export function EtapasEditor({ etapas }: { etapas: EtapaUI[] }) {
  const [editando, setEditando] = useState<EtapaUI | null>(null);
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState<EtapaUI | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(VAZIO);
  const [destino, setDestino] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function abrirCriacao() {
    setRascunho(VAZIO);
    setErro(null);
    setCriando(true);
  }

  function abrirEdicao(etapa: EtapaUI) {
    setRascunho({
      nome: etapa.nome,
      cor: etapa.cor ?? CORES[0],
      slaHoras: etapa.slaHoras ? String(etapa.slaHoras) : '',
      ehFinal: etapa.ehFinal,
      ehGanho: etapa.ehGanho,
    });
    setErro(null);
    setEditando(etapa);
  }

  function salvar() {
    const payload = {
      nome: rascunho.nome,
      cor: rascunho.cor,
      slaHoras: rascunho.slaHoras ? Number(rascunho.slaHoras) : null,
      ehFinal: rascunho.ehFinal,
      ehGanho: rascunho.ehFinal && rascunho.ehGanho,
    };
    setErro(null);
    startTransition(async () => {
      const r = editando ? await atualizarEtapa(editando.id, payload) : await criarEtapa(payload);
      if (!r.ok) return setErro(r.error ?? 'Não foi possível salvar');
      setEditando(null);
      setCriando(false);
    });
  }

  function confirmarExclusao() {
    if (!excluindo || !destino) return;
    setErro(null);
    startTransition(async () => {
      const r = await excluirEtapa(excluindo.id, destino);
      if (!r.ok) return setErro(r.error ?? 'Não foi possível excluir');
      setExcluindo(null);
      setDestino('');
    });
  }

  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= etapas.length) return;
    const ids = etapas.map((e) => e.id);
    [ids[indice], ids[alvo]] = [ids[alvo], ids[indice]];
    startTransition(async () => {
      await reordenarEtapas(ids);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-body-sm text-muted-foreground">
          As colunas do funil. Renomear ou reordenar não move ninguém de lugar — o lead continua
          na etapa em que estava.
        </p>
        <Button onClick={abrirCriacao} disabled={pendente}>
          <Plus /> Nova etapa
        </Button>
      </div>

      <div className="space-y-2">
        {etapas.map((etapa, i) => (
          <Card key={etapa.id} className="flex items-center gap-3 p-3">
            <span
              className="h-8 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: etapa.cor ?? '#64748b' }}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-lg font-medium text-foreground">{etapa.nome}</span>
                {etapa.ehGanho && (
                  <Badge variant="successSoft">
                    <Trophy className="mr-1 h-3 w-3" /> Ganho
                  </Badge>
                )}
                {etapa.ehFinal && !etapa.ehGanho && (
                  <Badge variant="neutralSoft">
                    <Flag className="mr-1 h-3 w-3" /> Final
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-body-sm text-muted-foreground">
                {etapa.leads} {etapa.leads === 1 ? 'lead' : 'leads'}
                {etapa.slaHoras ? ` · alerta após ${etapa.slaHoras}h parado` : ' · sem alerta de tempo'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => mover(i, -1)}
                disabled={pendente || i === 0}
                aria-label={`Mover ${etapa.nome} para cima`}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => mover(i, 1)}
                disabled={pendente || i === etapas.length - 1}
                aria-label={`Mover ${etapa.nome} para baixo`}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => abrirEdicao(etapa)}
                disabled={pendente}
                aria-label={`Editar ${etapa.nome}`}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setErro(null);
                  setDestino(etapas.find((e) => e.id !== etapa.id)?.id ?? '');
                  setExcluindo(etapa);
                }}
                disabled={pendente || etapas.length <= 2}
                aria-label={`Excluir ${etapa.nome}`}
              >
                <Trash2 />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Criar / editar */}
      <Dialog
        open={criando || editando !== null}
        onOpenChange={(aberto) => {
          if (aberto) return;
          setCriando(false);
          setEditando(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
            <DialogDescription>
              O alerta de tempo é o que faz um lead parado aparecer como parado, em vez de
              envelhecer no meio da coluna sem ninguém notar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="etapa-nome">Nome</Label>
              <Input
                id="etapa-nome"
                value={rascunho.nome}
                onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
                placeholder="Visita agendada"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setRascunho({ ...rascunho, cor })}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-transform',
                      rascunho.cor === cor
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: cor }}
                    aria-label={`Cor ${cor}`}
                    aria-pressed={rascunho.cor === cor}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="etapa-sla">Alertar após quantas horas parado?</Label>
              <Input
                id="etapa-sla"
                type="number"
                min={1}
                value={rascunho.slaHoras}
                onChange={(e) => setRascunho({ ...rascunho, slaHoras: e.target.value })}
                placeholder="Deixe vazio para não alertar"
              />
            </div>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={rascunho.ehFinal}
                onChange={(e) =>
                  setRascunho({
                    ...rascunho,
                    ehFinal: e.target.checked,
                    ehGanho: e.target.checked ? rascunho.ehGanho : false,
                  })
                }
              />
              <span className="text-body-sm">
                <span className="font-medium text-foreground">Etapa final</span>
                <span className="block text-muted-foreground">
                  Encerra o atendimento. Não cobra tempo parado nem próxima ação.
                </span>
              </span>
            </label>

            {rascunho.ehFinal && (
              <label className="ml-6 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={rascunho.ehGanho}
                  onChange={(e) => setRascunho({ ...rascunho, ehGanho: e.target.checked })}
                />
                <span className="text-body-sm">
                  <span className="font-medium text-foreground">É a etapa de ganho</span>
                  <span className="block text-muted-foreground">
                    Lead que chega aqui conta como convertido na taxa do funil.
                  </span>
                </span>
              </label>
            )}

            {erro && <p className="text-body-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCriando(false);
                setEditando(null);
              }}
              disabled={pendente}
            >
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={pendente || rascunho.nome.trim().length < 2}>
              {pendente ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <Dialog open={excluindo !== null} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir “{excluindo?.nome}”</DialogTitle>
            <DialogDescription>
              {excluindo?.leads
                ? `${excluindo.leads} ${excluindo.leads === 1 ? 'lead está' : 'leads estão'} nesta etapa. Escolha para onde ${excluindo.leads === 1 ? 'ele vai' : 'eles vão'}.`
                : 'Nenhum lead está nesta etapa.'}
            </DialogDescription>
          </DialogHeader>

          {(excluindo?.leads ?? 0) > 0 && (
            <div className="space-y-1.5">
              <Label>Mover para</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas
                    .filter((e) => e.id !== excluindo?.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {erro && <p className="text-body-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={pendente}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={pendente || !destino}>
              {pendente ? 'Excluindo…' : 'Excluir etapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
