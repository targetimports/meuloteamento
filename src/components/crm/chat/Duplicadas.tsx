'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Merge, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  acharDuplicadas,
  mesclarConversas,
  type GrupoDuplicado,
} from '@/app/admin/(dashboard)/whatsapp/duplicadas-actions';

/**
 * Conversas duplicadas — o mesmo telefone em mais de uma conversa.
 *
 * Acontece porque o mesmo contato chega ora como `…@s.whatsapp.net`, ora como
 * `…@lid`. O resultado é o histórico partido: metade das mensagens em cada uma.
 *
 * 🔴 A mesclagem NÃO é automática, e nunca será. Fundir a conversa errada
 * mistura o histórico de dois clientes e não há como separar depois. Aqui o
 * sistema mostra o que encontrou, marca a candidata natural a principal (a que
 * tem mais mensagens) e deixa a decisão com quem conhece os contatos.
 */
export function Duplicadas({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const [grupos, setGrupos] = useState<GrupoDuplicado[] | null>(null);
  const [principais, setPrincipais] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // A busca dispara ao abrir, não ao montar: o componente vive montado junto
  // com a caixa, e procurar duplicadas a cada carregamento da tela seria uma
  // consulta pesada que quase ninguém pediu.
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setGrupos(null);
    iniciar(async () => {
      const r = await acharDuplicadas();
      setGrupos(r);
      // Pré-seleciona a que tem mais mensagens: quase sempre é a certa, e
      // deixar tudo sem escolha faria a tela parecer um formulário em branco.
      setPrincipais(Object.fromEntries(r.map((g) => [g.telefone, g.conversas[0]?.id ?? ''])));
    });
  }, [aberto]);

  return (
    <>
      <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversas duplicadas</DialogTitle>
            <DialogDescription>
              O mesmo contato pode ter chegado por dois identificadores diferentes do WhatsApp,
              partindo o histórico. Escolha qual conversa fica como principal — as outras têm as
              mensagens movidas para ela.
            </DialogDescription>
          </DialogHeader>

          {pendente && !grupos ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" />
          ) : !grupos || grupos.length === 0 ? (
            <p className="py-8 text-center text-body text-muted-foreground">
              Nenhuma duplicata encontrada.
            </p>
          ) : (
            <div className="max-h-96 space-y-4 overflow-y-auto">
              <p className="flex items-start gap-2 rounded-md bg-warning/[0.12] p-3 text-body-sm text-warning-strong">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Fundir não tem desfazer. Confira que é a mesma pessoa antes.
              </p>

              {grupos.map((g) => (
                <div key={g.telefone} className="rounded-md border border-border p-3">
                  <p className="mb-2 text-body-sm font-medium text-foreground">
                    Final {g.telefone} — {g.conversas.length} conversas
                  </p>

                  <div className="space-y-1.5">
                    {g.conversas.map((c) => {
                      const ehPrincipal = principais[g.telefone] === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setPrincipais((p) => ({ ...p, [g.telefone]: c.id }))}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors',
                            ehPrincipal
                              ? 'border-primary bg-primary/[0.08]'
                              : 'border-border hover:bg-accent'
                          )}
                        >
                          <span
                            className={cn(
                              'h-3 w-3 shrink-0 rounded-full border-2',
                              ehPrincipal ? 'border-primary bg-primary' : 'border-muted-foreground'
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm text-foreground">
                              {c.nome || 'Sem nome'}
                            </span>
                            <span className="block truncate text-caption text-muted-foreground">
                              {c.mensagens} mensagem(ns) ·{' '}
                              {c.ultimaEm
                                ? new Date(c.ultimaEm).toLocaleDateString('pt-BR')
                                : 'sem mensagens'}{' '}
                              · {c.remoteJid.includes('@lid') ? 'identificador interno' : 'telefone'}
                            </span>
                          </span>
                          {ehPrincipal && (
                            <span className="shrink-0 text-caption font-medium text-primary-strong">
                              principal
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={pendente || !principais[g.telefone]}
                    onClick={() =>
                      iniciar(async () => {
                        const principal = principais[g.telefone];
                        const secundarias = g.conversas
                          .filter((c) => c.id !== principal)
                          .map((c) => c.id);
                        const r = await mesclarConversas(principal, secundarias);
                        if (!r.ok) return setErro(r.erro ?? 'Não foi possível fundir.');
                        setGrupos((atual) =>
                          (atual ?? []).filter((x) => x.telefone !== g.telefone)
                        );
                        router.refresh();
                      })
                    }
                  >
                    <Merge /> Fundir nesta conversa
                  </Button>
                </div>
              ))}
            </div>
          )}

          {erro && <p className="text-body-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={aoFechar}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
