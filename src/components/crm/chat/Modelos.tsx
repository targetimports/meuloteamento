'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  excluirModelo,
  listarModelos,
  salvarModelo,
  usarModelo,
  type ModeloUI,
} from '@/app/admin/(dashboard)/whatsapp/modelo-actions';

/**
 * Modelos de mensagem.
 *
 * Quem atende repete as mesmas cinco frases o dia inteiro — dados do lote,
 * formas de pagamento, horário de visita. Digitar de novo a cada conversa é
 * onde o atendimento perde tempo e ganha erro de digitação.
 *
 * O texto entra no campo em vez de ser enviado direto: quase toda mensagem
 * pronta precisa de um ajuste antes de sair, e enviar sem deixar revisar
 * transformaria o atalho em fonte de mensagem errada.
 */
export function Modelos({
  conversaId,
  onEscolher,
}: {
  conversaId: string;
  onEscolher: (texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [modelos, setModelos] = useState<ModeloUI[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<ModeloUI | null>(null);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [atalho, setAtalho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    void listarModelos()
      .then(setModelos)
      .finally(() => setCarregando(false));
  }, [aberto, pendente]);

  function abrirEdicao(m: ModeloUI | null) {
    setEditando(m);
    setCriando(m === null);
    setTitulo(m?.titulo ?? '');
    setTexto(m?.texto ?? '');
    setAtalho(m?.atalho ?? '');
    setErro(null);
  }

  function fecharEdicao() {
    setEditando(null);
    setCriando(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setAberto(true)}
        aria-label="Modelos de mensagem"
        title="Modelos de mensagem"
      >
        <Zap />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modelos de mensagem</DialogTitle>
            <DialogDescription>
              O texto entra no campo para você revisar antes de enviar. Use{' '}
              <code className="text-body-sm">{'{{nome}}'}</code>,{' '}
              <code className="text-body-sm">{'{{primeiro_nome}}'}</code>,{' '}
              <code className="text-body-sm">{'{{telefone}}'}</code> ou{' '}
              <code className="text-body-sm">{'{{atendente}}'}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {carregando ? (
              <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
            ) : modelos.length === 0 ? (
              <p className="py-6 text-center text-body-sm text-muted-foreground">
                Nenhum modelo ainda.
              </p>
            ) : (
              modelos.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-2 rounded-md border border-border p-2.5"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    disabled={pendente}
                    onClick={() =>
                      iniciar(async () => {
                        const r = await usarModelo(m.id, conversaId);
                        if (r.ok && r.texto) {
                          onEscolher(r.texto);
                          setAberto(false);
                        } else {
                          setErro(r.erro ?? 'Não foi possível usar o modelo.');
                        }
                      })
                    }
                  >
                    <p className="flex items-center gap-1.5 text-body-sm font-medium text-foreground">
                      {m.titulo}
                      {m.atalho && (
                        <span className="rounded bg-muted px-1 text-caption text-muted-foreground">
                          /{m.atalho}
                        </span>
                      )}
                      {m.usos > 0 && (
                        <span className="text-caption text-muted-foreground">· {m.usos} usos</span>
                      )}
                    </p>
                    <p className="line-clamp-2 text-caption text-muted-foreground">{m.texto}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => abrirEdicao(m)}
                    aria-label="Editar"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={pendente}
                    onClick={() => iniciar(async () => void (await excluirModelo(m.id)))}
                    aria-label="Excluir"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))
            )}
          </div>

          {erro && <p className="text-body-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => abrirEdicao(null)}>
              <Plus /> Novo modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar / editar */}
      <Dialog open={criando || editando !== null} onOpenChange={(a) => !a && fecharEdicao()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="modelo-titulo">Título</Label>
              <Input
                id="modelo-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Formas de pagamento"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelo-atalho">Atalho (opcional)</Label>
              <Input
                id="modelo-atalho"
                value={atalho}
                onChange={(e) => setAtalho(e.target.value)}
                placeholder="pagamento"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modelo-texto">Texto</Label>
              <Textarea
                id="modelo-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={5}
                placeholder="Olá {{primeiro_nome}}! As formas de pagamento são…"
              />
            </div>
            {erro && <p className="text-body-sm text-destructive">{erro}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharEdicao} disabled={pendente}>
              Cancelar
            </Button>
            <Button
              disabled={pendente || !titulo.trim() || !texto.trim()}
              onClick={() =>
                iniciar(async () => {
                  const r = await salvarModelo({
                    id: editando?.id,
                    titulo,
                    texto,
                    atalho,
                  });
                  if (!r.ok) return setErro(r.erro ?? 'Não foi possível salvar.');
                  fecharEdicao();
                })
              }
            >
              {pendente ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
