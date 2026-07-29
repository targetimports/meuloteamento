#!/usr/bin/env bash
# Deploy atomico - meuloteamento
# Build em diretorio paralelo + symlink swap. Zero downtime.
#
# Uso na VPS:
#   cd /var/www/meuloteamento_repo
#   git pull
#   bash deploy/deploy.sh
#
# Layout esperado:
#   /var/www/meuloteamento_repo  -> codigo (git)
#   /var/www/meuloteamento       -> symlink para release atual
#   /var/www/meuloteamento_rel/<timestamp>  -> releases
#
# Mantem 5 releases anteriores para rollback.

set -euo pipefail

REPO_DIR="/var/www/meuloteamento_repo"
RELEASES_DIR="/var/www/meuloteamento_rel"
CURRENT_LINK="/var/www/meuloteamento"
LOG_DIR="/var/log/meuloteamento"
PM2_NAME="meuloteamento"
APP_USER="${APP_USER:-www-data}"
KEEP_RELEASES=5

ts=$(date +%Y%m%d-%H%M%S)
target="${RELEASES_DIR}/${ts}"

mkdir -p "$RELEASES_DIR" "$LOG_DIR"

echo "[deploy] Copiando codigo para ${target}..."
mkdir -p "$target"
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'public/uploads' \
  "$REPO_DIR"/ "$target"/

# Reaproveita public/uploads do release anterior (ou cria vazio)
if [[ -L "$CURRENT_LINK" && -d "$CURRENT_LINK/public/uploads" ]]; then
  mkdir -p "$target/public"
  cp -al "$CURRENT_LINK/public/uploads" "$target/public/uploads"
else
  mkdir -p "$target/public/uploads"
fi

# .env producao vem de fora do repositorio
if [[ -f /etc/meuloteamento/.env ]]; then
  cp /etc/meuloteamento/.env "$target/.env"
elif [[ -L "$CURRENT_LINK" && -f "$CURRENT_LINK/.env" ]]; then
  cp "$CURRENT_LINK/.env" "$target/.env"
else
  echo "[deploy] AVISO: nenhum .env encontrado em /etc/meuloteamento/.env"
fi

cd "$target"

echo "[deploy] Instalando deps..."
npm ci --omit=dev=false

echo "[deploy] Gerando Prisma client..."
npx prisma generate

echo "[deploy] Rodando migracoes..."
npx prisma migrate deploy

echo "[deploy] Build..."
NODE_ENV=production npm run build

echo "[deploy] Ajustando permissoes..."
chown -R "$APP_USER":"$APP_USER" "$target" 2>/dev/null || true

echo "[deploy] Trocando symlink..."
tmp_link="${CURRENT_LINK}.new"
ln -sfn "$target" "$tmp_link"
mv -Tf "$tmp_link" "$CURRENT_LINK"

echo "[deploy] Reload PM2..."
pm2 reload "$PM2_NAME" --update-env || pm2 start "$CURRENT_LINK/ecosystem.config.js"
pm2 save

echo "[deploy] Limpando releases antigos..."
cd "$RELEASES_DIR"
ls -1t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

echo "[deploy] OK - release ${ts}"
