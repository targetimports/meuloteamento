#!/usr/bin/env bash
# Corrige ownership de /var/www/meuloteamento.
# Rodar UMA vez na VPS antes do primeiro deploy atomico.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/meuloteamento}"
APP_USER="${APP_USER:-www-data}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Diretorio nao existe: $APP_DIR"
  exit 1
fi

echo "Ajustando ownership para ${APP_USER} em ${APP_DIR}..."
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "Permissoes:"
chmod 600 "$APP_DIR/.env" 2>/dev/null || true
chmod -R u+rwX,g+rX,o+rX "$APP_DIR"
chmod -R u+rwX,g+rwX "$APP_DIR/public/uploads" 2>/dev/null || true
chmod -R u+rwX,g+rwX "$APP_DIR/.next" 2>/dev/null || true

echo "Done."
