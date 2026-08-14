/**
 * Como a conversa se chama na tela.
 *
 * Vive aqui porque a mesma decisão aparece na lista, no cabeçalho do chat, no
 * painel do contato, no quadro e na tela de duplicadas — e estava escrita
 * diferente em cada uma: umas caíam para o telefone, outras iam direto para
 * "Sem nome", e a mesma conversa aparecia com dois rótulos dependendo de onde
 * você olhasse.
 */

/** `5575991234567` → `+55 75 99123-4567`. Devolve o original se não parecer telefone. */
export function formatarTelefone(v: string | null | undefined): string {
  if (!v) return '';
  const d = String(v).replace(/\D/g, '');
  if (d.length < 12) return String(v);
  const resto = d.slice(4);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${meio}-${resto.slice(meio.length)}`;
}

/**
 * Nome salvo; na falta dele, o número — como o próprio WhatsApp faz.
 *
 * "Sem nome" só sobra para a conversa que não tem nem um nem outro: a que
 * nasceu em modo LID, cujo identificador de 15 dígitos não contém telefone
 * nenhum. Mostrar esse número ali seria pior que não mostrar nada, porque tem
 * cara de telefone e não é.
 */
export function rotuloConversa(
  nome: string | null | undefined,
  telefone: string | null | undefined
): string {
  return nome || formatarTelefone(telefone) || 'Sem nome';
}
