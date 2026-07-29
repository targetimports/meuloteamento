# Contrato digital — Parque Tucano + Clicksign

## O que foi feito

1. **Schema estendido** com TODOS os campos legais que o contrato exige:
   - `Cliente`: `nacionalidade`, `estadoCivil`, `profissao`
   - `Loteadora`: `representanteNome`, `representanteCpf`, `representanteRg`, `representanteCargo`, `signProvider`, `signApiToken`, `signSandbox`
   - `Loteamento`: `cartorio`, `comarca`
   - `Lote`: `matricula`, `viaFrente`, `ladoVia`, `confrontacaoEsquerdo/Direito/Frente/Fundo`
   - `Venda`: `taxaCorretagem`, `descontoPontualidadePct`

2. **Template HTML completo** em [src/lib/templates/parque-tucano.ts](../src/lib/templates/parque-tucano.ts) — todas as cláusulas do `.docx` original, com 50+ variáveis mapeadas (`{{cliente.nome}}`, `{{lote.matricula}}`, `{{venda.valorTotalExtenso}}`, etc.)

3. **Lib `numero-extenso`** ([src/lib/numero-extenso.ts](../src/lib/numero-extenso.ts)) — converte número/real/data para texto por extenso (necessário pelo padrão jurídico brasileiro).

4. **Integração Clicksign** ([src/lib/contrato.ts](../src/lib/contrato.ts)) — 3 chamadas: criar documento, criar signatário, vincular. Suporta sandbox e produção, lê chave da loteadora ou env global.

5. **PDF via puppeteer** — Clicksign exige PDF (não aceita HTML). Adicionado helper `htmlParaPdf()` que usa puppeteer se instalado. Sem puppeteer, retorna erro descritivo.

6. **Botão "Importar modelo Parque Tucano"** em `/admin/contratos` que pluga o template oficial e marca como padrão da loteadora em 1 clique.

## Como usar (passo a passo)

### Na VPS — 1× só

```bash
ssh root@meuloteamento.com
cd /var/www/meuloteamento

# 1. Instalar puppeteer para geração de PDF
npm i puppeteer

# 2. Aplicar migration (vai criar todos os campos novos)
npx prisma migrate dev --name contrato_parque_tucano

# 3. Adicionar env vars novas no /etc/meuloteamento/.env:
#    CLICKSIGN_API_TOKEN=seu_token_aqui
#    SIGN_PROVIDER=clicksign
#    SIGN_SANDBOX=true        # mude pra false em produção

# 4. Rebuild + reload
NODE_ENV=production npm run build
pm2 reload meuloteamento --update-env
```

### No painel admin

#### Antes de gerar o primeiro contrato:

1. **Em `/admin/minha-loteadora`** — preencha:
   - Razão social + CNPJ
   - Endereço completo
   - **Representante legal**: nome, CPF, cargo (vai aparecer na assinatura)
   - **(Opcional)** chave Clicksign própria (`signApiToken`) se não for usar a global

2. **Em `/admin/loteamentos/[id]`** — para o Parque Tucano, preencha:
   - Cartório de registro de imóveis
   - Comarca (se diferente da cidade)

3. **Em `/admin/loteamentos/[id]/lotes/[id]`** — para CADA lote:
   - Matrícula no cartório
   - Via de frente (Rua X)
   - Lado (par / ímpar)
   - Confrontações: esquerda, direita, frente, fundo

4. **Para CADA cliente** (você pode editar pelo `/admin/clientes/[id]`):
   - Nacionalidade
   - Estado civil
   - Profissão

#### Importar o template:

1. Vá em `/admin/contratos`
2. Clique no botão verde **"Importar modelo Parque Tucano"**
3. O template é criado e marcado como padrão para sua loteadora

#### Gerar e enviar para assinatura:

1. Abra uma venda em `/admin/vendas/[id]` (depois de você plugar o `ContratoActions` component — veja seção abaixo)
2. Clique em **"Gerar contrato"** → renderiza o HTML com todos os dados da venda
3. Clique em **"Ver / imprimir"** para revisar
4. Clique em **"Enviar para assinatura"** → Clicksign recebe o PDF, dispara e-mail para o cliente, retorna o link de assinatura
5. Cliente assina por e-mail (clicksign envia automaticamente). O link também aparece em `/minha-conta/contratos/[id]` do cliente.

#### Status do contrato:
- `PENDENTE` — venda nova, nenhum contrato ainda
- `GERADO` — HTML pronto, ainda não foi enviado
- `ENVIADO_ASSINATURA` — cliente recebeu o e-mail da Clicksign
- `ASSINADO` — atualizado via webhook da Clicksign (a implementar — ver Próximos passos)
- `CANCELADO` — admin cancelou

## Pluggar o componente na tela de detalhe da venda

O componente `ContratoActions` já está pronto em [src/components/ContratoActions.tsx](../src/components/ContratoActions.tsx). Adicione no arquivo `src/app/admin/(dashboard)/vendas/[id]/page.tsx` (ou onde fica o detalhe da venda):

```tsx
import ContratoActions from '@/components/ContratoActions';
import { prisma } from '@/lib/prisma';
import { tenantId } from '@/lib/tenant';

// dentro do componente, após buscar `venda`:
const tid = await tenantId();
const templates = await prisma.contratoTemplate.findMany({
  where: tid ? { loteadoraId: tid, ativo: true } : { ativo: true },
  select: { id: true, nome: true, default: true },
  orderBy: { default: 'desc' },
});

// no JSX:
<ContratoActions
  vendaId={venda.id}
  contratoStatus={venda.contratoStatus}
  contratoHtml={venda.contratoHtml}
  contratoSignerUrl={venda.contratoSignerUrl}
  templates={templates}
/>
```

## Próximos passos opcionais

1. **Webhook Clicksign** — receber notificação quando o cliente assina e atualizar `contratoStatus → ASSINADO` + baixar PDF assinado:
   - Endpoint: `POST /api/webhooks/clicksign`
   - Configurar no painel Clicksign > Conta > Webhooks → `https://meuloteamento.com/api/webhooks/clicksign`
   - Validar HMAC com `CLICKSIGN_WEBHOOK_SECRET`

2. **Editor visual de campos faltantes no lote** — hoje o admin precisa preencher matrícula/confrontações por lote manualmente. Ideal: um "wizard" na criação do lote que avisa quando faltam dados pra gerar contrato.

3. **Preview render no admin** — botão "Pré-visualizar com dados desta venda" antes de gerar definitivamente.

## Troubleshooting

**"puppeteer não instalado"** — execute `npm i puppeteer` na VPS. Ele baixa o Chromium (~170MB), mas é necessário para Clicksign. Alternativa: usar ZapSign (aceita HTML direto, sem puppeteer).

**"Clicksign documents 401"** — verifique o token. Em sandbox, gere em <https://sandbox.clicksign.com>. Em produção, em <https://app.clicksign.com>.

**Caracteres acentuados quebrados no PDF** — o template já está em UTF-8 com `<meta charset>`, mas se ainda aparecer, garantir que `<html lang="pt-BR">` e fonte com suporte cirílico (Georgia é OK).

**Variáveis aparecem literais (`{{cliente.nome}}`)** — o renderer só substitui se o caminho existir no contexto. Veja [src/lib/contrato.ts → montarContextoContrato()](../src/lib/contrato.ts) para a lista completa dos campos populados.

## Validação rápida

```bash
# Type-check
npx tsc --noEmit                      # → 0 erros

# Validar schema
DATABASE_URL=xxx npx prisma validate  # → "valid"

# Verificar template carregado
psql -d meuloteamento -c "SELECT nome, ativo, \"default\" FROM contrato_templates;"
```
