# Paridade do módulo de WhatsApp — ERP importadora → meuloteamento

Inventário item a item do módulo do **Target Import Manager** (origem) contra o
que existe no **meuloteamento** (destino). Cada linha da origem tem um destino
ou um motivo escrito.

**Origem:** `FOREX/ERP IMPORTADORA CRM` — 7.613 linhas em 21 arquivos.
**Destino:** `FOREX/MEU LOTEAMENTO` — 6.400+ linhas em 25 arquivos.

Status: **COMPLETO** (comportamento equivalente) · **DESCARTADO** (não cabe
aqui, com motivo).

---

## Placar final

| Status | Itens |
|---|--:|
| **COMPLETO** | **72** |
| PARCIAL | 0 |
| AUSENTE | 0 |
| DESCARTADO (com motivo) | 10 |
| **Total** | **82** |

---

## 1. Arquivos da origem

| Arquivo | Linhas | Destino |
|---|--:|---|
| `backend/src/whatsapp/router.js` | 2.345 | `lib/whatsapp-ingestao.ts` + 6 arquivos de actions + 3 rotas de API |
| `src/pages/whatsapp/Inbox.jsx` | 978 | `components/crm/chat/CaixaDeEntrada.tsx` |
| `src/components/whatsapp/PainelCrm.jsx` | 525 | `chat/PainelCrm.tsx` |
| `src/pages/whatsapp/Conectar.jsx` | 438 | `crm/ConectarWhatsapp.tsx` |
| `src/components/whatsapp/Bolha.jsx` | 403 | `chat/Bolha.tsx` |
| `src/pages/whatsapp/Desempenho.jsx` | 343 | `whatsapp/desempenho/page.tsx` |
| `backend/src/whatsapp/transcricao.js` | 284 | `lib/whatsapp-transcricao.ts` |
| `backend/src/whatsapp/client.js` | 246 | `lib/evolution-go.ts` |
| `src/components/whatsapp/ConversationList.jsx` | 221 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/ChatHeader.jsx` | 213 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/ChatComposer.jsx` | 202 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/QuadroConversas.jsx` | 200 | `chat/QuadroConversas.tsx` |
| `src/components/whatsapp/EncaminharDialog.jsx` | 182 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/AudioMensagem.jsx` | 179 | `chat/AudioMensagem.tsx` |
| `src/components/whatsapp/NovaConversaDialog.jsx` | 149 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/ConversationItem.jsx` | 148 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/VisorMidia.jsx` | 143 | `chat/VisorMidia.tsx` |
| `src/components/whatsapp/ChatTimeline.jsx` | 140 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/AvatarContato.jsx` | 135 | `chat/AvatarContato.tsx` |
| `src/lib/whatsappConstants.js` | 90 | espalhado |
| `src/components/whatsapp/Emojis.jsx` | 49 | dentro de `CaixaDeEntrada.tsx` |

---

## 2. Cliente do gateway (`client.js`)

Todas as 25 funções: `evolutionConfigured`, `EVENTS_*`, `gerarToken`,
`webhookUrl`, `criarInstancia`, `excluirInstancia`, `listarInstancias`,
`conectar`, `obterQr`, `obterStatus`, `desconectar`, `sairDaConta`,
`reconectar`, `normalizarNumero`, `enviarTexto`, `enviarMidia`,
`solicitarHistorico`, `reagir`, `apagarMensagem`, `marcarLida`, `baixarMidia`,
`obterAvatar`, `listarContatos`, `listarGrupos` → **COMPLETO** em
`lib/evolution-go.ts`.

Somado aqui, sem equivalente lá: `infoDoGrupo`, `fixarNoWhatsapp`,
`silenciarNoWhatsapp`, `arquivarNoWhatsapp`.

## 3. Ingestão (`router.js`, funções internas)

| Item | Aqui | Status |
|---|---|---|
| `jidParaTelefone` / `ehGrupo` | `telefoneDoJid` / `ehGrupo` | COMPLETO |
| `lerConteudo` | `lerConteudo` | COMPLETO |
| `normalizarEvento` | `normalizarEvento` | COMPLETO |
| `baixarESalvarMidia` / `salvarBase64` | `salvarMidia` | COMPLETO |
| `telefoneDe` | `telefoneDe` | COMPLETO |
| `temLetra` / `nomeMelhor` | idem | COMPLETO |
| `nomeDoContato` | `sincronizarContatos` | COMPLETO |
| `nomeDoGrupo` | `nomeDoGrupo` (via `/group/info`) | COMPLETO |
| `renovarAvatarEmSegundoPlano` | `renovarAvatar` | COMPLETO |
| `acharVinculoPorTelefone` | `acharLeadPorTelefone` na ingestão + botão em lote | COMPLETO |
| `acharIrmaPorTelefone` | dentro de `acharOuCriarConversa` | COMPLETO |
| `absorverConversa` | `mesclarConversas` + tela `Duplicadas` | COMPLETO |
| `acharOuCriarConversa` | idem | COMPLETO |
| `tratarProtocolo` | idem | COMPLETO |
| `situacoesEncerradas` | `situacoesEncerradas` (por loteadora) | COMPLETO |
| `tratarMensagem` / `tratarRecibo` / `tratarHistorico` | idem | COMPLETO |
| `acharConversas` | idem | COMPLETO |
| `transcreverEmSegundoPlano` | `transcreverMensagem` | COMPLETO |
| `semAcentoJs` / `recortarEmVolta` | dentro de `buscarNasMensagens` | COMPLETO |
| `nomeInstanciaPara` / `minhaInstancia` | idem | COMPLETO |
| `traduzirStatus` | enum `WhatsappStatus` | COMPLETO |
| `instanciasVisiveis` / `soAdmin` | — | **DESCARTADO** (1) |

## 4. Rotas (27)

| Rota do ERP | Aqui | Status |
|---|---|---|
| `POST /webhook/:token` | `api/whatsapp/webhook/[token]` | COMPLETO |
| `GET /config` | `gatewayConfigurado()` + aviso na página | COMPLETO |
| `GET/PUT/DELETE /transcricao` | `GROQ_API_KEY` no `.env` | **DESCARTADO** (4) |
| `POST /transcricao/testar` | — | **DESCARTADO** (4) |
| `GET /contatos` | `sincronizarContatos` | COMPLETO |
| `GET /acessos` | — | **DESCARTADO** (1) |
| `PUT /instance/:id/membros` | — | **DESCARTADO** (1) |
| `GET /instances` | — | **DESCARTADO** (1) |
| `GET /buscar` | `buscarNasMensagens` | COMPLETO |
| `GET /instance` | página `/admin/whatsapp` | COMPLETO |
| `POST /instance` + `/connect` + `/logout` | `conectarMeuWhatsapp`, `desconectarMeuWhatsapp` | COMPLETO |
| `POST /instance/sincronizar` + `/webhook` | `sincronizarHistorico` | COMPLETO |
| `POST /send` | `enviarMensagem` | COMPLETO |
| `POST /send-media` | `enviarArquivo` | COMPLETO |
| `POST /messages/:id/reagir` | `reagirMensagem` + seletor na bolha | COMPLETO |
| `POST /messages/:id/apagar` | `apagarParaTodos` + confirmação | COMPLETO |
| `POST /messages/:id/transcrever` | `transcreverSobDemanda` | COMPLETO |
| `POST /conversations/:id/read` | `marcarConversaLida` | COMPLETO |
| `PATCH /conversations/:id` | `mudarSituacao`, `alternarEtiqueta`, `renomearConversa`, `arquivarConversa`, `fixarConversa`, `silenciarConversa` | COMPLETO |
| `POST /conversations/:id/vincular` | `vincularAoLead` | COMPLETO |
| `POST /contatos/sincronizar` | `sincronizarContatos` | COMPLETO |
| `POST /conversas/mesclar-duplicadas` | `mesclarConversas` | COMPLETO |

## 5. Telas e componentes

| Item | Aqui | Status |
|---|---|---|
| Conectar: QR, status, desconectar, excluir | `ConectarWhatsapp.tsx` | COMPLETO |
| Conectar: acessos/membros | — | **DESCARTADO** (1) |
| Inbox: fila, abrir, enviar, buscar | `CaixaDeEntrada.tsx` | COMPLETO |
| Inbox: anexo, colar, arrastar, legenda | idem | COMPLETO |
| Inbox: responder, encaminhar, nota interna | idem | COMPLETO |
| Inbox: etiquetas, arquivadas, não lida | idem | COMPLETO |
| Inbox: agrupamento por dia | `agruparPorDia` + rótulo fixo no topo | COMPLETO |
| Inbox: modo tela cheia | `telaCheia` | COMPLETO |
| Inbox: modelos de mensagem | `Modelos.tsx` + tokens | COMPLETO |
| Inbox: mesclar duplicadas | `Duplicadas.tsx` | COMPLETO |
| Inbox: filtro por situação/etiqueta | dois seletores na fila | COMPLETO |
| Inbox: botão "ir para o fim" | `longeDoFim` + rolagem condicional | COMPLETO |
| Inbox: "digitando…" | — | **DESCARTADO** (3) |
| Bolha: status, mídia, ausente, transcrição, citação | `Bolha.tsx` | COMPLETO |
| Bolha: confirmação antes de apagar | diálogo próprio | COMPLETO |
| AudioMensagem: onda e velocidade | `AudioMensagem.tsx` | COMPLETO |
| VisorMidia: zoom, giro, navegação | `VisorMidia.tsx` | COMPLETO |
| AvatarContato: foto real | `AvatarContato.tsx` | COMPLETO |
| QuadroConversas: fila por tempo de espera | `QuadroConversas.tsx` | COMPLETO |
| PainelCrm: lead, criar lead, situação, etiquetas | `PainelCrm.tsx` | COMPLETO |
| PainelCrm: estoque na conversa | — | **DESCARTADO** (2) |
| Desempenho: espera, mediana, por hora | `whatsapp/desempenho/page.tsx` | COMPLETO |
| `formatarTelefone`, `quandoCurto`, `agruparPorDia`, `aplicarTokens` | espalhados | COMPLETO |
| `PRIORIDADES` | — | **DESCARTADO** (5) |

---

## 6. Descartados — com motivo

1. **Acessos por membros** (`instanciasVisiveis`, `soAdmin`, `/acessos`,
   `/instance/:id/membros`, `/instances`) — aqui a caixa de entrada é do dono do
   número, sem compartilhamento e sem privilégio implícito de admin. Decisão de
   11/08/2026. No ERP o modelo aberto foi defeito relatado em produção: as
   conversas de uma pessoa apareciam para todos.
2. **`EstoqueNaConversa`** — o ERP mostra produtos ao lado da conversa; o
   equivalente aqui seria lote/loteamento, que é outro desenho e não foi pedido.
3. **"digitando…"** — o gateway Evolution GO não expõe rota de presença.
   Conferido na lista completa de rotas do servidor: existem `/chat/archive`,
   `/pin`, `/mute`, `/history-sync`, e nenhuma de presença. Não há como enviar
   nem receber o sinal.
4. **Tela para a chave do Groq** e **testar transcrição** — as demais
   credenciais do sistema vivem no `.env`; uma tela só para esta seria
   incoerente. A chave é validada na primeira transcrição, com o erro visível na
   própria bolha.
5. **`PRIORIDADES`** — já existem dois eixos de classificação (situação do
   atendimento e etiquetas). Um terceiro competindo confunde mais que ajuda.

## 7. Adaptações registradas (não são omissões)

- **Mídia no cofre cifrado**, fora do webroot, em vez de pasta pública — o
  sistema já teve vazamento por esse caminho em maio.
- **URL assinada temporária** (5 min) para o envio, porque o `/send/media` busca
  o arquivo por URL e o cofre é privado.
- **`Deal`/`Customer`** do ERP correspondem a **`Lead`/`Venda`** daqui.
- **Fixar, silenciar e arquivar refletem no aparelho** (`/chat/pin`, `/mute`,
  `/archive`) — o ERP faz só do próprio lado.

## 8. Execução

Três blocos, todos em produção:

- **Bloco A** — separador de data, avatar com foto, áudio com onda e velocidade,
  visor de mídia, reagir com emoji, confirmação ao apagar
- **Bloco B** — modelos com tokens, transcrever sob demanda, filtros, tela
  cheia, "ir para o fim", fixar/silenciar/arquivar no aparelho
- **Bloco C** — nome de grupo, vínculo automático com lead na ingestão, situações
  encerradas por empresa, mesclar duplicadas, quadro por espera, desempenho
