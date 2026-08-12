'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, QrCode, RefreshCw, Smartphone, Trash2, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  conectarMeuWhatsapp,
  desconectarMeuWhatsapp,
  excluirMeuWhatsapp,
  novoQr,
  statusDaMinhaInstancia,
} from '@/app/admin/(dashboard)/whatsapp/actions';

export interface InstanciaUI {
  existe: boolean;
  status: string;
  telefone: string | null;
  perfilNome: string | null;
  conectadaEm: string | null;
  ultimoErro: string | null;
  conversas: number;
}

/** O QR do WhatsApp expira em poucos segundos; renovamos antes disso. */
const INTERVALO_QR_MS = 25_000;
/** Frequência da consulta de pareamento — não há evento de conexão no gateway. */
const INTERVALO_STATUS_MS = 3_000;

export function ConectarWhatsapp({ instancia }: { instancia: InstanciaUI }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [pareando, setPareando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [pendente, startTransition] = useTransition();

  // Guarda o timer para o efeito não empilhar laços a cada re-render.
  const timers = useRef<{ qr?: ReturnType<typeof setInterval>; status?: ReturnType<typeof setInterval> }>({});

  const pararTimers = useCallback(() => {
    if (timers.current.qr) clearInterval(timers.current.qr);
    if (timers.current.status) clearInterval(timers.current.status);
    timers.current = {};
  }, []);

  useEffect(() => pararTimers, [pararTimers]);

  function iniciarPareamento() {
    setErro(null);
    startTransition(async () => {
      const r = await conectarMeuWhatsapp();
      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível iniciar.');
        return;
      }
      setQr(r.qr ?? null);
      setPareando(true);
    });
  }

  // Enquanto o QR está na tela: renova o código e pergunta se já pareou.
  useEffect(() => {
    if (!pareando) return;

    timers.current.qr = setInterval(async () => {
      const r = await novoQr();
      if (r.ok && r.qr) setQr(r.qr);
    }, INTERVALO_QR_MS);

    timers.current.status = setInterval(async () => {
      const s = await statusDaMinhaInstancia();
      if (s.conectada) {
        pararTimers();
        setPareando(false);
        setQr(null);
        router.refresh();
      }
    }, INTERVALO_STATUS_MS);

    return pararTimers;
  }, [pareando, pararTimers, router]);

  const conectada = instancia.existe && instancia.status === 'CONECTADA';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Meu WhatsApp
          </CardTitle>
          {instancia.existe && (
            <Badge variant={conectada ? 'successSoft' : instancia.status === 'ERRO' ? 'errorSoft' : 'neutralSoft'}>
              {conectada ? 'Conectado' : instancia.status === 'ERRO' ? 'Com erro' : 'Desconectado'}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {!instancia.existe && (
            <>
              <p className="text-body text-muted-foreground">
                Conecte o seu número para atender os clientes por aqui. As conversas ficam ligadas
                aos leads do funil, e cada pessoa da equipe usa o próprio número.
              </p>
              <Button onClick={iniciarPareamento} disabled={pendente}>
                {pendente ? <Loader2 className="animate-spin" /> : <QrCode />}
                Conectar meu WhatsApp
              </Button>
            </>
          )}

          {instancia.existe && conectada && (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-caption uppercase tracking-wide text-muted-foreground">Número</dt>
                  <dd className="text-body-lg font-medium text-foreground">
                    {instancia.telefone ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption uppercase tracking-wide text-muted-foreground">Perfil</dt>
                  <dd className="text-body-lg font-medium text-foreground">
                    {instancia.perfilNome ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption uppercase tracking-wide text-muted-foreground">Conversas</dt>
                  <dd className="text-body-lg font-medium text-foreground">{instancia.conversas}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      await desconectarMeuWhatsapp();
                      router.refresh();
                    })
                  }
                  disabled={pendente}
                >
                  <LogOut /> Desconectar
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmandoExclusao(true)}
                  disabled={pendente}
                >
                  <Trash2 /> Excluir instância
                </Button>
              </div>
            </>
          )}

          {instancia.existe && !conectada && !pareando && (
            <>
              {instancia.ultimoErro && (
                <p className="flex items-start gap-2 rounded-md bg-destructive/[0.12] p-3 text-body-sm text-destructive">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {instancia.ultimoErro}
                </p>
              )}
              <p className="text-body text-muted-foreground">
                {instancia.conversas > 0
                  ? `Seu número está desconectado. As ${instancia.conversas} conversas continuam guardadas — parear de novo retoma de onde parou.`
                  : 'Seu número está desconectado.'}
              </p>
              <Button onClick={iniciarPareamento} disabled={pendente}>
                {pendente ? <Loader2 className="animate-spin" /> : <QrCode />}
                Parear novamente
              </Button>
            </>
          )}

          {erro && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/[0.12] p-3 text-body-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pareamento */}
      <Dialog
        open={pareando}
        onOpenChange={(aberto) => {
          if (aberto) return;
          pararTimers();
          setPareando(false);
          setQr(null);
          router.refresh();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leia o código no seu celular</DialogTitle>
            <DialogDescription>
              WhatsApp → Aparelhos conectados → Conectar aparelho. O código se renova sozinho.
              <span className="mt-2 block text-caption">
                É neste momento que o WhatsApp envia as conversas antigas — ele faz isso uma vez,
                ao parear. Depois de conectar, aguarde alguns minutos com a página aberta.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code para conectar o WhatsApp"
                className="h-64 w-64 rounded-md bg-white p-2"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-md bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Esperando a leitura…
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                pararTimers();
                setPareando(false);
                setQr(null);
                router.refresh();
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclusão */}
      <Dialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir a instância?</DialogTitle>
            <DialogDescription>
              {instancia.conversas > 0
                ? `Isto apaga ${instancia.conversas} conversa(s) e todo o histórico de mensagens, aqui e no gateway. Não há como desfazer. Se você só trocou de celular, use "Desconectar".`
                : 'Isto remove a instância aqui e no gateway. Não há como desfazer.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoExclusao(false)} disabled={pendente}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendente}
              onClick={() =>
                startTransition(async () => {
                  const r = await excluirMeuWhatsapp();
                  setConfirmandoExclusao(false);
                  if (!r.ok) setErro(r.erro ?? 'Falha ao excluir.');
                  router.refresh();
                })
              }
            >
              {pendente ? 'Excluindo…' : 'Excluir tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
