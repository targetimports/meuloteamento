#!/usr/bin/env bash
# Deploy in-place - meuloteamento
#
# Uso na VPS (como root):
#   bash /var/www/meuloteamento/deploy/deploy.sh            # deploy real
#   bash /var/www/meuloteamento/deploy/deploy.sh --dry-run  # so builda, nao troca nada
#   bash /var/www/meuloteamento/deploy/deploy.sh --rollback # volta o build anterior
#
# Layout real (a app roda direto no diretorio, nao ha symlink de release):
#   /var/www/meuloteamento         -> clone do git + app rodando via PM2
#   /var/www/meuloteamento/.next   -> build em uso
#
# Decisoes importantes:
#  - O build vai para .next-build e so no fim substitui o .next. Buildar por cima
#    do .next em uso derruba a app com MODULE_NOT_FOUND (aconteceu em maio/2026).
#  - npm ci so roda se o package-lock.json mudou. npm ci apaga o node_modules
#    inteiro, e o Next carrega modulos sob demanda: apagar com a app no ar quebra
#    requisicoes.
#  - prisma migrate deploy NAO roda por padrao. Este schema foi evoluido com
#    `db push` e so tem a migration inicial, entao migrate deploy nao reflete o
#    banco real. Para rodar mesmo assim: RUN_MIGRATIONS=1 bash deploy/deploy.sh

set -euo pipefail

APP_DIR="/var/www/meuloteamento"
PM2_NAME="meuloteamento"
HEALTH_URL="http://127.0.0.1:3000/"

LIVE=".next"
BUILD=".next-build"
PREV=".next-anterior"

MODE="deploy"
case "${1:-}" in
  --dry-run)  MODE="dry-run" ;;
  --rollback) MODE="rollback" ;;
  "")         ;;
  *) echo "opcao desconhecida: $1 (use --dry-run ou --rollback)"; exit 2 ;;
esac

log() { echo "[deploy] $*"; }

cd "$APP_DIR"

# ---------------------------------------------------------------- rollback
if [[ "$MODE" == "rollback" ]]; then
  if [[ ! -d "$PREV" ]]; then
    log "ERRO: nao existe $PREV para voltar."
    exit 1
  fi
  log "Voltando build anterior..."
  rm -rf "$LIVE.descartado"
  [[ -d "$LIVE" ]] && mv "$LIVE" "$LIVE.descartado"
  mv "$PREV" "$LIVE"
  pm2 reload "$PM2_NAME" --update-env
  rm -rf "$LIVE.descartado"
  log "OK - rollback aplicado. Confira o site."
  exit 0
fi

# ------------------------------------------------- 1. producao esta limpa?
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  log "ERRO: ha alteracoes nao commitadas na producao:"
  git status --short --untracked-files=no
  log "Alguem editou direto no servidor. Commite ou descarte antes de deployar."
  exit 1
fi

# ------------------------------------------------------------- 2. git pull
lock_antes=$(md5sum package-lock.json | cut -d' ' -f1)

log "Buscando origin/main..."
git fetch --quiet origin main
atual=$(git rev-parse HEAD)
novo=$(git rev-parse origin/main)

if [[ "$atual" == "$novo" ]]; then
  log "Ja esta no commit mais recente ($(git rev-parse --short HEAD))."
else
  log "Atualizando $(git rev-parse --short HEAD) -> $(git rev-parse --short origin/main)"
  git merge --ff-only origin/main
fi

lock_depois=$(md5sum package-lock.json | cut -d' ' -f1)

# ----------------------------------------------------------- 3. dependencias
if [[ "$lock_antes" != "$lock_depois" ]] || [[ ! -d node_modules ]]; then
  log "package-lock.json mudou - rodando npm ci (a app pode oscilar aqui)..."
  npm ci --include=dev
else
  log "package-lock.json inalterado - pulando npm ci."
fi

# --------------------------------------------------------------- 4. prisma
log "Gerando Prisma client..."
npx prisma generate

if [[ "${RUN_MIGRATIONS:-0}" == "1" ]]; then
  log "Rodando migracoes (RUN_MIGRATIONS=1)..."
  npx prisma migrate deploy
else
  log "Migracoes puladas (schema e mantido por db push). Use RUN_MIGRATIONS=1 se precisar."
fi

# ------------------------------------------------- 5. build isolado do .next
log "Buildando em $BUILD (o $LIVE em uso nao e tocado)..."
rm -rf "$BUILD"
NODE_ENV=production NEXT_DIST_DIR="$BUILD" npm run build

if [[ ! -d "$BUILD" ]]; then
  log "ERRO: build nao gerou $BUILD."
  exit 1
fi

# O Next grava o distDir usado dentro do manifesto; como vamos renomear a pasta
# para .next, o manifesto precisa apontar para o nome final.
if [[ -f "$BUILD/required-server-files.json" ]]; then
  sed -i "s#\"distDir\":\"$BUILD\"#\"distDir\":\"$LIVE\"#g" "$BUILD/required-server-files.json"
fi

if [[ "$MODE" == "dry-run" ]]; then
  log "OK - dry-run. Build pronto em $BUILD, nada foi trocado."
  log "Para publicar: bash deploy/deploy.sh"
  exit 0
fi

# ----------------------------------------------------------------- 6. swap
log "Trocando build..."
rm -rf "$PREV"
[[ -d "$LIVE" ]] && mv "$LIVE" "$PREV"
mv "$BUILD" "$LIVE"

# --------------------------------------------------------------- 7. reload
log "Recarregando PM2..."
pm2 reload "$PM2_NAME" --update-env

# ---------------------------------------------------------- 8. healthcheck
log "Verificando a app..."
ok=0
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)
  if [[ "$code" == "200" ]]; then ok=1; break; fi
  sleep 2
done

if [[ "$ok" != "1" ]]; then
  log "FALHOU (ultimo HTTP: ${code:-sem resposta}). Revertendo..."
  rm -rf "$LIVE"
  mv "$PREV" "$LIVE"
  pm2 reload "$PM2_NAME" --update-env
  log "Rollback automatico aplicado. Veja: pm2 logs $PM2_NAME"
  exit 1
fi

pm2 save --force >/dev/null 2>&1 || true
log "OK - no ar em $(git rev-parse --short HEAD). Build anterior guardado em $PREV."
log "Se algo estiver errado: bash deploy/deploy.sh --rollback"
