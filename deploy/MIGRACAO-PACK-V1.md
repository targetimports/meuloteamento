# Pack v1 — Críticos + Tático + Contrato + Cobrança + CRM + Área do cliente

Este documento explica o que rodar **uma vez** para ativar o pacote.
Tudo o que foi adicionado é aditivo: rotas novas, novos modelos no Prisma, scripts de deploy.

---

## 1. Backup ANTES de qualquer coisa

```bash
ssh root@meuloteamento.com
pg_dump --no-owner --no-privileges meuloteamento | gzip -9 > /root/pre-pack-v1-$(date +%Y%m%d).sql.gz
```

## 2. Variáveis de ambiente novas

Edite `/var/www/meuloteamento/.env` (ou `/etc/meuloteamento/.env` se você adotar o deploy atômico):

```bash
# OBRIGATÓRIO em produção (>=32 chars cada)
JWT_SECRET="<gere com: openssl rand -base64 48>"
JWT_SECRET_CLIENTE="<gere com: openssl rand -base64 48>"

# OBRIGATÓRIO em produção (>=24 chars)
CRON_TOKEN="<gere com: openssl rand -hex 24>"
CLIENTE_COOKIE_NAME="meuloteamento_cliente"

# OPCIONAL — só seta se for usar
WHATSAPP_PROVIDER="zapi"            # ou "meta_cloud"
WHATSAPP_TOKEN=""
WHATSAPP_INSTANCE=""

EMAIL_PROVIDER="resend"
EMAIL_API_KEY=""
EMAIL_FROM="no-reply@meuloteamento.com"

ZAPSIGN_API_TOKEN=""

LEAD_WEBHOOK_SECRET_FACEBOOK=""
LEAD_WEBHOOK_SECRET_TYPEFORM=""
```

A app vai **falhar ao subir** em produção se JWT_SECRET, JWT_SECRET_CLIENTE ou CRON_TOKEN faltarem.
Isso é intencional — antes era fallback fraco.

## 3. Aplicar migração Prisma

```bash
cd /var/www/meuloteamento
npx prisma generate
npx prisma migrate dev --name pack_v1_features
# OU em produção depois de revisar:
# npx prisma migrate deploy
```

Modelos novos: `VendaHistorico`, `ParcelaHistorico`, `ContratoTemplate`,
`ReguaCobranca`, `ReguaCobrancaPasso`, `EnvioComunicacao`, `PipelineLead`,
`PipelineStage`, `FiltroSalvo`, `RateLimitBucket`.

Campos novos em modelos existentes: `Cliente.{aceitaEmail, aceitaWhatsApp, emailVerificado, ...}`,
`Venda.{contratoTemplateId, contratoHtml, contratoStatus, contratoSignerUrl, ...}`,
`Parcela.{valorOriginal, ultimaCobrancaEm, cobrancasEnviadas}`,
`Lead.{score, statusDesde, stageId, utm*}`,
`Corretor.{aceitaLeadsAuto, capacidadeDiaria, cidadesAtende}`,
`AsaasWebhookLog.tentativas`,
`Loteadora.{whatsappProvider, whatsappToken, whatsappInstance, emailFromAddress, reguaCobrancaId}`.

## 4. Crontab — substituir o atual

```bash
crontab -e
```

Copie de [deploy/crontab.example](crontab.example). Pontos importantes:
- Token agora vai como **header** `X-Cron-Token`, não query string
- Webhook Asaas processa **assincronamente** via `/api/cron/processar-webhooks-asaas`
- Régua de cobrança roda 1× por dia (9h) + drain da fila a cada 10min

## 5. Build e reload

```bash
cd /var/www/meuloteamento
NODE_ENV=production npm run build
pm2 reload meuloteamento --update-env
```

## 6. (Opcional) Migrar para deploy atômico

```bash
mv /var/www/meuloteamento /var/www/meuloteamento_repo
mkdir -p /var/www/meuloteamento_rel
bash /var/www/meuloteamento_repo/deploy/deploy.sh
```

Após isso, o symlink `/var/www/meuloteamento` aponta sempre para o release atual.

---

## O que foi entregue

### Críticos
- [x] Webhook Asaas async (enfileira + worker `/api/cron/processar-webhooks-asaas`)
- [x] JWT/CRON env hard-fail em produção ([src/lib/env.ts](../src/lib/env.ts))
- [x] Rate limiting (in-memory + DB) em login admin, login cliente, leads, recuperação senha
- [x] CRON via header `X-Cron-Token` (query mantida só como fallback)
- [x] Auditoria de Venda (`VendaHistorico`) e Parcela (`ParcelaHistorico`)
- [x] Scripts: [deploy.sh](deploy.sh), [fix-permissions.sh](fix-permissions.sh), [backup-postgres.sh](backup-postgres.sh)
- [x] Health check enriquecido (DB + filas)
- [x] `metadataBase` no layout

### Táticas
- [x] ISR de 60s na landing `/[slug]`
- [x] CSV export: leads, vendas, parcelas (`/api/admin/{leads,vendas,parcelas}/export`)
- [x] Componente `CustosCompra` (IPTU/cartório/ITBI)
- [x] Helper de persistência de checkout (`CheckoutPersist` + `loadCheckoutPersist`)
- [x] Índices Prisma adicionais
- [x] Bulk actions: mudar status, atribuir corretor, enviar mensagem em massa

### Contrato digital
- [x] Modelo `ContratoTemplate` com renderização de variáveis `{{cliente.nome}}` etc.
- [x] UI admin: criar/editar templates `/admin/contratos`
- [x] Server actions: gerar contrato, enviar para assinatura ZapSign
- [x] Componente `ContratoActions` (plugar no detalhe da venda)
- [x] Endpoint público (cliente logado) e admin para visualizar HTML

### Cobrança e financeiro
- [x] Régua de cobrança configurável `/admin/regua-cobranca`
- [x] Passos com offset em dias (negativo antes, positivo depois)
- [x] Canais WhatsApp / E-mail / SMS
- [x] Cron `/api/cron/regua-cobranca` (executa a régua + drena fila)
- [x] Lista de envios `/admin/envios`
- [x] Conciliação `/admin/financeiro/conciliacao`
- [x] Renegociação self-service na área do cliente
- [x] `marcarParcelasAtrasadas()` antes de cada execução da régua

### CRM evoluído
- [x] Score automático na criação de lead (regras simples, extensível)
- [x] Round-robin de corretores respeitando capacidade diária + cidade
- [x] `statusDesde` para cálculo de SLA visual (`LeadSLA` component)
- [x] Flags em Corretor: `aceitaLeadsAuto`, `capacidadeDiaria`, `cidadesAtende`
- [x] Webhook IN com HMAC: `/api/leads/webhook/{facebook,typeform}`
- [x] UTM captura no formulário de lead
- [x] Bulk actions (status, corretor, mensagem em massa)
- [x] Estrutura para pipeline configurável (`PipelineLead`/`PipelineStage`)

### Área do comprador (`/minha-conta`)
- [x] Cadastro de senha usando e-mail + CPF da compra
- [x] Login com rate-limit
- [x] Recuperação de senha por e-mail
- [x] Dashboard com próximas parcelas e lotes
- [x] Listagem de parcelas com PIX copia-e-cola, boleto, status
- [x] Renegociação self-service (limite: 1 a cada 30 dias)
- [x] Visualização do contrato (HTML + link para assinatura)
- [x] Perfil (dados, preferências de comunicação, troca de senha)
- [x] Cookie distinto do admin, JWT separado, middleware gating

---

## O que ainda precisa ser feito manualmente

1. **Configurar provedor WhatsApp** (ZAPI ou Meta Cloud API) e popular as 3 env vars
2. **Configurar Resend** (ou outro provedor de email) para envio transacional
3. **Configurar ZapSign** se quiser assinatura eletrônica de contratos
4. **Criar o primeiro modelo de contrato** em `/admin/contratos/novo` (já vem com modelo-exemplo no formulário)
5. **Criar régua de cobrança da loteadora** em `/admin/regua-cobranca/nova` e ativá-la
6. **Plugar o `ContratoActions` component** no detalhe da venda (`/admin/(dashboard)/vendas/[id]/page.tsx`):
   ```tsx
   import ContratoActions from '@/components/ContratoActions';
   <ContratoActions
     vendaId={venda.id}
     contratoStatus={venda.contratoStatus}
     contratoHtml={venda.contratoHtml}
     contratoSignerUrl={venda.contratoSignerUrl}
     templates={templates}
   />
   ```
7. **Plugar o `BulkLeadActions`** no `/admin/leads/page.tsx` (controle de seleção fica no Kanban existente)
8. **Plugar o `CustosCompra`** dentro do `SimuladorResidencial` ou na página do lote
9. **Cadastrar webhook Asaas** no painel Asaas apontando para `/api/webhooks/asaas` com o `ASAAS_WEBHOOK_TOKEN`
10. **Configurar webhook do Facebook Lead Ads** com o secret `LEAD_WEBHOOK_SECRET_FACEBOOK`

---

## Rollback

Se algo der errado:

```bash
# 1. Restaura o symlink para o release anterior
ls -1t /var/www/meuloteamento_rel | head -2 | tail -1   # release anterior
ln -sfn /var/www/meuloteamento_rel/<anterior> /var/www/meuloteamento
pm2 reload meuloteamento

# 2. Reverter migração Prisma (se aplicada)
# Faça um pg_restore do backup feito no item 1
```
