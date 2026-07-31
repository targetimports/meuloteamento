#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Backup do PostgreSQL do meuloteamento, com cópia para o Google Drive.
#
# Gera um .sql.gz COMPLETO (schema + dados + enums + índices + FKs), capaz de
# reconstruir o banco do zero com uma única importação.
#
# Aqui o Postgres é NATIVO na VPS (não roda em container), por isso o dump sai
# via `sudo -u postgres`, que é superusuário e enxerga tudo.
#
# Configuração no .env:
#   BACKUP_RCLONE_REMOTE  destino no rclone (ex.: gdrive:MeuLoteamento-Backups)
#   BACKUP_KEEP           quantos backups manter, local e na nuvem (padrão 30)
#   BACKUP_DIR            pasta local (padrão /var/backups/meuloteamento)
#   BACKUP_ON             "false" desliga sem precisar mexer no crontab
#
# Crontab (root):
#   0 3 * * * /var/www/meuloteamento/deploy/backup-postgres.sh >> /var/log/meuloteamento/backup.log 2>&1
#
# Restaurar do zero:
#   gunzip -c meuloteamento-db-AAAAMMDD-HHMMSS.sql.gz | sudo -u postgres psql -d meuloteamento
#   (o dump traz DROP ... IF EXISTS, então serve tanto para banco vazio quanto
#    para sobrescrever um existente)
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/var/www/meuloteamento"
log() { echo "$(date '+%F %T') [backup] $*"; }

# Lê uma chave do .env SEM executar o arquivo — valores podem conter caracteres
# que quebrariam um `source`.
getenv() {
  grep -E "^${1}=" "$APP_DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true
}

if [ "$(getenv BACKUP_ON)" = "false" ]; then
  log "BACKUP_ON=false — desativado, saindo."
  exit 0
fi

# Nome do banco sai do próprio DATABASE_URL, para não divergir da aplicação.
DB_NAME="$(getenv DATABASE_URL | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
DB_NAME="${DB_NAME:-meuloteamento}"

BACKUP_DIR="$(getenv BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/meuloteamento}"
KEEP="$(getenv BACKUP_KEEP)";      KEEP="${KEEP:-30}"
REMOTE="$(getenv BACKUP_RCLONE_REMOTE)"

STAMP="$(date '+%Y%m%d-%H%M%S')"
FILE="$BACKUP_DIR/${DB_NAME}-db-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

log "dump de '$DB_NAME' -> $FILE"
# --clean --if-exists        : o arquivo recria tudo por cima, com banco vazio ou não
# --no-owner --no-privileges : restaura em qualquer servidor, sem depender de
#                              os mesmos roles existirem lá
if ! sudo -u postgres pg_dump --clean --if-exists --no-owner --no-privileges "$DB_NAME" \
     | gzip -9 > "$FILE"; then
  log "ERRO: pg_dump falhou — removendo arquivo parcial"
  rm -f "$FILE"
  exit 1
fi

# Backup que ninguém confere não é backup. Estas checagens pegam o caso comum:
# arquivo truncado, gzip corrompido, ou dump que saiu só com o cabeçalho.
if [ ! -s "$FILE" ] || ! gzip -t "$FILE" 2>/dev/null; then
  log "ERRO: arquivo vazio ou gzip corrompido — removendo"
  rm -f "$FILE"
  exit 1
fi
if ! gunzip -c "$FILE" | grep -q "CREATE TABLE"; then
  log "ERRO: dump sem CREATE TABLE — não capturou o schema"
  rm -f "$FILE"
  exit 1
fi

chmod 600 "$FILE"
log "dump ok ($(du -h "$FILE" | cut -f1))"

# Rotação local
ls -1t "$BACKUP_DIR/${DB_NAME}-db-"*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

# ------------------------------------------------------------------ nuvem
if [ -z "$REMOTE" ]; then
  log "AVISO: BACKUP_RCLONE_REMOTE vazio — o backup ficou SÓ na VPS."
  log "Se a VPS morrer, o backup morre junto. Defina o destino no .env."
  exit 0
fi

log "enviando para $REMOTE"
if ! rclone copy "$FILE" "$REMOTE" --no-traverse; then
  log "ERRO: upload falhou — existe backup local, mas NÃO há cópia fora da VPS"
  exit 1
fi

# Confere que o arquivo chegou mesmo, com o tamanho certo
tam_local=$(stat -c%s "$FILE")
tam_remoto=$(rclone lsl "$REMOTE/$(basename "$FILE")" 2>/dev/null | awk '{print $1}')
if [ "$tam_local" != "${tam_remoto:-0}" ]; then
  log "ERRO: tamanho na nuvem (${tam_remoto:-ausente}) difere do local ($tam_local)"
  exit 1
fi
log "upload confirmado ($tam_remoto bytes)"

# Rotação na nuvem
rclone lsf "$REMOTE" --include "${DB_NAME}-db-*.sql.gz" 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))" \
  | while read -r f; do rclone deletefile "$REMOTE/$f" 2>/dev/null || true; done

log "concluído."
