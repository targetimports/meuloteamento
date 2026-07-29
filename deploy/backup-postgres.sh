#!/usr/bin/env bash
# Backup diario do PostgreSQL.
# Adicionar ao crontab do root:
#   0 3 * * * /var/www/meuloteamento/deploy/backup-postgres.sh >> /var/log/meuloteamento/backup.log 2>&1
set -euo pipefail

DB_NAME="${DB_NAME:-meuloteamento}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/meuloteamento}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
ts=$(date +%Y%m%d-%H%M%S)
out="${BACKUP_DIR}/${DB_NAME}-${ts}.sql.gz"

echo "[backup] $(date) - dumping $DB_NAME -> $out"
sudo -u "$DB_USER" pg_dump --no-owner --no-privileges "$DB_NAME" | gzip -9 > "$out"

chmod 600 "$out"

echo "[backup] Limpando backups mais velhos que $RETENTION_DAYS dias..."
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[backup] OK - $(du -h "$out" | cut -f1)"
