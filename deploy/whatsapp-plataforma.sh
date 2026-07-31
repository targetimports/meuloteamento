#!/usr/bin/env bash
# WhatsApp DA PLATAFORMA (Meu Loteamento) - conectar e testar.
#
# Este e o WhatsApp que RECEBE o aviso de novo interessado. Nao confundir com o
# WhatsApp das loteadoras clientes (Grupo Germanos etc), que fica nas colunas
# whatsapp* da tabela loteadoras e serve para cobrar compradores de lote.
#
# Uso na VPS:
#   bash /var/www/meuloteamento/deploy/whatsapp-plataforma.sh status
#   bash /var/www/meuloteamento/deploy/whatsapp-plataforma.sh qr
#   bash /var/www/meuloteamento/deploy/whatsapp-plataforma.sh teste
#
# Para conectar:
#   1. Tenha o celular do numero em maos.
#   2. Rode `qr` - ele salva o QR em /root/whatsapp-plataforma-qr.png
#   3. No celular: WhatsApp > Aparelhos conectados > Conectar aparelho
#   4. Aponte para o QR. Ele expira em ~40s; se perder, rode `qr` de novo.
#   5. Confirme com `status` (deve dizer open) e depois `teste`.
#
# Tudo o que era configuracao ja esta pronto no .env: WHATSAPP_PROVIDER,
# WHATSAPP_TOKEN, WHATSAPP_INSTANCE, WHATSAPP_BASE_URL e NOTIFICAR_WHATSAPP.
# So falta a sessao do WhatsApp, que exige o celular.

set -euo pipefail

APP_DIR="/var/www/meuloteamento"
QR_PNG="/root/whatsapp-plataforma-qr.png"

cd "$APP_DIR"
env_val() { grep "^$1=" .env | cut -d= -f2- | tr -d '"'; }

URL=$(env_val EVOLUTION_API_URL)
KEY=$(env_val EVOLUTION_API_KEY)
INSTANCIA=$(env_val WHATSAPP_INSTANCE)
DESTINO=$(env_val NOTIFICAR_WHATSAPP)

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "ERRO: EVOLUTION_API_URL / EVOLUTION_API_KEY nao estao no .env"
  exit 1
fi

case "${1:-status}" in
  status)
    echo "Instancia: $INSTANCIA"
    echo "Destino do aviso: $DESTINO"
    echo -n "Estado: "
    curl -s -H "apikey: $KEY" "$URL/instance/connectionState/$INSTANCIA" \
      | grep -o '"state":"[a-z]*"' | cut -d: -f2 | tr -d '"'
    echo "(open = conectado | connecting = aguardando QR | close = desconectado)"
    ;;

  qr)
    echo "Gerando QR para a instancia '$INSTANCIA'..."
    RESP=$(curl -s -H "apikey: $KEY" "$URL/instance/connect/$INSTANCIA")

    B64=$(echo "$RESP" | grep -o '"base64":"[^"]*"' | head -1 | cut -d: -f2- | tr -d '"')
    if [[ -n "$B64" ]]; then
      echo "${B64#data:image/png;base64,}" | base64 -d > "$QR_PNG"
      echo "QR salvo em: $QR_PNG"
      echo "Baixe com:   scp germanos-vps:$QR_PNG ."
    else
      echo "AVISO: a Evolution nao devolveu QR em base64."
    fi

    PAIR=$(echo "$RESP" | grep -o '"pairingCode":"[^"]*"' | head -1 | cut -d: -f2- | tr -d '"')
    if [[ -n "$PAIR" && "$PAIR" != "null" ]]; then
      echo "Codigo de pareamento (alternativa ao QR): $PAIR"
    fi

    echo
    echo "No celular: WhatsApp > Aparelhos conectados > Conectar aparelho."
    echo "O QR expira em cerca de 40 segundos."
    ;;

  teste)
    NUM="${2:-$DESTINO}"
    if [[ -z "$NUM" ]]; then
      echo "ERRO: informe o numero ou defina NOTIFICAR_WHATSAPP no .env"
      exit 1
    fi
    echo "Enviando mensagem de teste para $NUM..."
    curl -s -X POST "$URL/message/sendText/$INSTANCIA" \
      -H "apikey: $KEY" -H "Content-Type: application/json" \
      -d "{\"number\":\"$NUM\",\"text\":\"Teste do Meu Loteamento: o aviso de novo interessado chegara por aqui.\"}"
    echo
    ;;

  *)
    echo "uso: $0 [status|qr|teste [numero]]"
    exit 2
    ;;
esac
