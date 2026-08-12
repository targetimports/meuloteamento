#!/usr/bin/env bash
#
# Backup dos documentos pessoais (cofre) para a nuvem.
#
# O backup do banco (backup-postgres.sh) nunca cobriu estes arquivos: ele salva
# as LINHAS de formulario_arquivos e venda_arquivos, que apontam para arquivos
# em disco. Restaurar só o banco devolveria 182 ponteiros para o nada.
#
# Variáveis lidas do .env:
#   UPLOADS_DIR           cofre (padrão /var/lib/meuloteamento/uploads)
#   BACKUP_RCLONE_REMOTE  destino no rclone (o mesmo do backup do banco)
#   BACKUP_ON             "false" desliga sem mexer no crontab
#
# Uso:  bash deploy/backup-documentos.sh
# Cron: 30 3 * * * bash /var/www/meuloteamento/deploy/backup-documentos.sh >> /var/log/meuloteamento/backup.log 2>&1
#
# ── Duas decisões que valem explicação ──────────────────────────────────────
#
# 1. NÃO cifra de novo. Os arquivos já estão cifrados em repouso com AES-256-GCM
#    (ver lib/storage-seguro.ts), então o que sobe para a nuvem já é ilegível
#    para o provedor. Isso é de propósito: a chave fica no .env do servidor e
#    NÃO acompanha o backup — quem obtiver o balde não obtém os documentos.
#
#    ⚠️ A contrapartida é dura: perder DOCS_ENCRYPTION_KEY torna este backup
#    inútil. A chave precisa de cópia própria, guardada em outro lugar.
#
# 2. `copy`, não `sync`. Sync apagaria no destino o que sumiu na origem, e um
#    `rm -rf` acidental no servidor se propagaria para o backup na mesma noite —
#    que é exatamente a hora em que o backup precisava existir. Copy só acrescenta.
#    O custo é que documento excluído continua no backup: quando houver política
#    de retenção/expurgo (LGPD), o expurgo terá de alcançar o destino também.

set -uo pipefail

ENV_FILE=/var/www/meuloteamento/.env

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [docs] $*"; }

getenv() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed 's/^"\(.*\)"$/\1/' | tr -d '\r'
}

if [ "$(getenv BACKUP_ON)" = "false" ]; then
  log "BACKUP_ON=false — desativado, saindo."
  exit 0
fi

COFRE="$(getenv UPLOADS_DIR)"; COFRE="${COFRE:-/var/lib/meuloteamento/uploads}"
REMOTE="$(getenv BACKUP_RCLONE_REMOTE)"

if [ ! -d "$COFRE" ]; then
  log "ERRO: cofre não encontrado em $COFRE"
  exit 1
fi

total=$(find "$COFRE" -type f | wc -l)
if [ "$total" -eq 0 ]; then
  log "cofre vazio — nada a enviar."
  exit 0
fi

# Um arquivo em claro no cofre significa que a cifra não rodou nele: sobe assim
# mesmo (perder o documento seria pior), mas o aviso precisa aparecer no log.
em_claro=0
while IFS= read -r f; do
  if [ "$(head -c 4 "$f" 2>/dev/null)" != "MLC1" ]; then
    em_claro=$((em_claro + 1))
  fi
done < <(find "$COFRE" -type f)
if [ "$em_claro" -gt 0 ]; then
  log "AVISO: $em_claro de $total arquivo(s) NÃO estão cifrados. Rode: node scripts/cifrar-documentos.mjs"
fi

if [ -z "$REMOTE" ]; then
  log "ERRO: BACKUP_RCLONE_REMOTE vazio — os documentos ficariam só na VPS."
  exit 1
fi

log "enviando $total arquivo(s) de $COFRE para $REMOTE/documentos"
if ! rclone copy "$COFRE" "$REMOTE/documentos" --transfers 4 --checkers 8 --stats-one-line; then
  log "ERRO: rclone copy falhou."
  exit 1
fi

remoto=$(rclone size "$REMOTE/documentos" --json 2>/dev/null | sed -n 's/.*"count":\([0-9]*\).*/\1/p')
log "OK — $total local / ${remoto:-?} no destino."
