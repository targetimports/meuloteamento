#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Vigia do backup: avisa por e-mail se o banco ficar mais de N horas sem cópia.
#
# POR QUE É UM SCRIPT SEPARADO, e não uma checagem dentro do backup-postgres.sh:
# em 31/07/2026 o backup ficou 3 dias parado e ninguém soube. A causa foi o
# script perder o bit de execução — o cron nem conseguia iniciá-lo, então
# qualquer alerta escrito lá dentro também nunca teria rodado. Um vigia só
# serve se falhar por motivos diferentes do que ele vigia.
#
# Pela mesma razão o crontab chama este arquivo via `bash ...` em vez de
# executá-lo direto: assim ele funciona mesmo sem o +x.
#
# Confere as DUAS pontas, porque falham de formas diferentes:
#   - cópia local  ausente/velha -> o dump não rodou
#   - cópia no Drive velha, com a local em dia -> o upload é que está falhando
#     (é o caso mais perigoso: parece que há backup, mas não há cópia fora daqui)
#
# Configuração no .env:
#   BACKUP_ALERTA_EMAIL   destinatário do aviso. Vazio = não alerta.
#   BACKUP_ALERTA_HORAS   limite de horas sem backup (padrão 24)
#   EMAIL_API_KEY         chave do Resend, a mesma que a aplicação usa
#   EMAIL_FROM            remetente
#
# Respeita BACKUP_ON=false: backup desligado de propósito não vira alerta.
#
# Crontab (root) — 13h, uma hora depois do backup do meio-dia:
#   0 13 * * * bash /var/www/meuloteamento/deploy/checar-backup.sh >> /var/log/meuloteamento/backup.log 2>&1
#
# Roda uma vez por dia de propósito: com o limite em 24h, alertar de hora em
# hora só produziria o mesmo aviso repetido até alguém consertar.
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/var/www/meuloteamento"
log() { echo "$(date '+%F %T') [checar-backup] $*"; }

# Mesma leitura do .env usada pelo backup-postgres.sh: sem `source`, porque os
# valores podem ter caracteres que quebrariam o shell.
getenv() {
  grep -E "^${1}=" "$APP_DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true
}

if [ "$(getenv BACKUP_ON)" = "false" ]; then
  log "BACKUP_ON=false — backup desligado de propósito, nada a alertar."
  exit 0
fi

DEST="$(getenv BACKUP_ALERTA_EMAIL)"
if [ -z "$DEST" ]; then
  log "BACKUP_ALERTA_EMAIL vazio — sem destinatário configurado, saindo."
  exit 0
fi

LIMITE_H="$(getenv BACKUP_ALERTA_HORAS)"; LIMITE_H="${LIMITE_H:-24}"
LIMITE_S=$(( LIMITE_H * 3600 ))

DB_NAME="$(getenv DATABASE_URL | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
DB_NAME="${DB_NAME:-meuloteamento}"
BACKUP_DIR="$(getenv BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-/var/backups/meuloteamento}"
REMOTE="$(getenv BACKUP_RCLONE_REMOTE)"

AGORA=$(date +%s)

# -1 significa "nenhuma cópia encontrada", que é pior que uma cópia velha.
idade_local=-1
ultimo_local="$(ls -1t "$BACKUP_DIR/${DB_NAME}-db-"*.sql.gz 2>/dev/null | head -1 || true)"
if [ -n "$ultimo_local" ]; then
  idade_local=$(( AGORA - $(stat -c %Y "$ultimo_local") ))
fi

idade_remoto=-1
if [ -n "$REMOTE" ]; then
  # lsl devolve "tamanho AAAA-MM-DD HH:MM:SS.nanos nome"; o cut tira os
  # nanossegundos, que o `date -d` não precisa.
  data_remota="$(rclone lsl "$REMOTE" --include "${DB_NAME}-db-*.sql.gz" 2>/dev/null \
    | awk '{print $2" "$3}' | cut -d. -f1 | sort -r | head -1 || true)"
  if [ -n "$data_remota" ]; then
    idade_remoto=$(( AGORA - $(date -d "$data_remota" +%s) ))
  fi
fi

# "3 dias e 4h" lê melhor que "270000 segundos" num e-mail de madrugada.
humano() {
  local s="$1"
  if [ "$s" -lt 0 ]; then echo "nenhuma cópia encontrada"; return; fi
  local d=$(( s / 86400 )) h=$(( (s % 86400) / 3600 )) m=$(( (s % 3600) / 60 ))
  if [ "$d" -gt 0 ]; then echo "${d}d ${h}h atrás"
  elif [ "$h" -gt 0 ]; then echo "${h}h ${m}min atrás"
  else echo "${m}min atrás"; fi
}

# if em vez de `[ ... ] && problemas+=(...)`: com set -e, um teste que dá falso
# no fim da linha derruba o script — justamente quando está tudo certo.
problemas=()
if [ "$idade_local" -lt 0 ] || [ "$idade_local" -gt "$LIMITE_S" ]; then
  problemas+=("A cópia <strong>local</strong> (na VPS) está com $(humano "$idade_local").")
fi
if [ -n "$REMOTE" ] && { [ "$idade_remoto" -lt 0 ] || [ "$idade_remoto" -gt "$LIMITE_S" ]; }; then
  problemas+=("A cópia no <strong>Google Drive</strong> está com $(humano "$idade_remoto").")
fi

if [ ${#problemas[@]} -eq 0 ]; then
  log "ok — local: $(humano "$idade_local"); drive: $(humano "$idade_remoto")"
  exit 0
fi

log "ALERTA — enviando aviso para $DEST"

APIKEY="$(getenv EMAIL_API_KEY)"
FROM="$(getenv EMAIL_FROM)"; FROM="${FROM:-no-reply@meuloteamento.com}"
if [ -z "$APIKEY" ]; then
  log "ERRO: EMAIL_API_KEY vazio — o alerta NÃO foi enviado."
  exit 1
fi

lista=""
for p in "${problemas[@]}"; do lista="${lista}<li>${p}</li>"; done

CORPO="<div style=\"font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;max-width:560px\">
<h2 style=\"margin:0 0 12px\">Backup do banco parado</h2>
<p style=\"color:#475569;margin:0 0 16px\">O banco do meuloteamento passou de ${LIMITE_H}h sem uma cópia nova.</p>
<ul style=\"color:#475569;line-height:1.7\">${lista}</ul>
<p style=\"color:#475569\">O backup deveria rodar às <strong>03h</strong> e às <strong>12h</strong>.</p>
<p style=\"color:#475569;margin-top:20px\">Onde olhar, na VPS:</p>
<pre style=\"background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px;overflow-x:auto\">tail -30 /var/log/meuloteamento/backup.log
ls -la /var/www/meuloteamento/deploy/backup-postgres.sh
bash /var/www/meuloteamento/deploy/backup-postgres.sh</pre>
<p style=\"color:#94a3b8;font-size:13px;margin-top:20px\">Enviado por deploy/checar-backup.sh — $(date '+%d/%m/%Y %H:%M')</p>
</div>"

# jq monta o JSON: escapar aspas e quebras de linha à mão no HTML acima seria
# frágil demais.
payload="$(jq -n --arg from "$FROM" --arg to "$DEST" \
  --arg subject "[meuloteamento] Backup do banco parado há mais de ${LIMITE_H}h" \
  --arg html "$CORPO" \
  '{from:$from, to:[$to], subject:$subject, html:$html}')"

http=$(curl -s -o /tmp/checar-backup-resp.txt -w '%{http_code}' \
  -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $APIKEY" \
  -H "Content-Type: application/json" \
  -d "$payload" || echo "000")

if [ "$http" = "200" ]; then
  log "alerta enviado para $DEST"
else
  log "ERRO: Resend devolveu HTTP $http — $(head -c 300 /tmp/checar-backup-resp.txt 2>/dev/null)"
  rm -f /tmp/checar-backup-resp.txt
  exit 1
fi
rm -f /tmp/checar-backup-resp.txt
