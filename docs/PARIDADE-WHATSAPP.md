# Paridade do módulo de WhatsApp — ERP importadora → meuloteamento

Inventário item a item do módulo do **Target Import Manager** (origem) contra o
que existe no **meuloteamento** (destino). Cada linha da origem precisa de um
destino ou de um motivo escrito.

**Origem:** `FOREX/ERP IMPORTADORA CRM` — 7.613 linhas em 21 arquivos.
**Destino:** `FOREX/MEU LOTEAMENTO` — 4.753 linhas em 18 arquivos.

Status: **COMPLETO** (comportamento equivalente) · **PARCIAL** (existe, falta
parte) · **AUSENTE** (não portado) · **DESCARTADO** (não cabe aqui, com motivo).

---

## 1. Arquivos da origem

| Arquivo | Linhas | Destino |
|---|--:|---|
| `backend/src/whatsapp/router.js` | 2.345 | `lib/whatsapp-ingestao.ts` + 4 arquivos de actions + 3 rotas de API |
| `src/pages/whatsapp/Inbox.jsx` | 978 | `components/crm/chat/CaixaDeEntrada.tsx` |
| `src/components/whatsapp/PainelCrm.jsx` | 525 | `components/crm/chat/PainelCrm.tsx` |
| `src/pages/whatsapp/Conectar.jsx` | 438 | `components/crm/ConectarWhatsapp.tsx` |
| `src/components/whatsapp/Bolha.jsx` | 403 | `components/crm/chat/Bolha.tsx` |
| `src/pages/whatsapp/Desempenho.jsx` | 343 | — |
| `backend/src/whatsapp/transcricao.js` | 284 | `lib/whatsapp-transcricao.ts` |
| `backend/src/whatsapp/client.js` | 246 | `lib/evolution-go.ts` |
| `src/components/whatsapp/ConversationList.jsx` | 221 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/ChatHeader.jsx` | 213 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/ChatComposer.jsx` | 202 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/QuadroConversas.jsx` | 200 | — |
| `src/components/whatsapp/EncaminharDialog.jsx` | 182 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/AudioMensagem.jsx` | 179 | player nativo em `Bolha.tsx` |
| `src/components/whatsapp/NovaConversaDialog.jsx` | 149 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/ConversationItem.jsx` | 148 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/VisorMidia.jsx` | 143 | — |
| `src/components/whatsapp/ChatTimeline.jsx` | 140 | dentro de `CaixaDeEntrada.tsx` |
| `src/components/whatsapp/AvatarContato.jsx` | 135 | iniciais em `CaixaDeEntrada.tsx` |
| `src/lib/whatsappConstants.js` | 90 | espalhado |
| `src/components/whatsapp/Emojis.jsx` | 49 | dentro de `CaixaDeEntrada.tsx` |

---

## 2. Backend — cliente do gateway (`client.js`, 25 funções)

| Item | Aqui | Status |
|---|---|---|
| `evolutionConfigured` | `gatewayConfigurado` | COMPLETO |
| `EVENTS_VALIDOS` / `EVENTS_PADRAO` | `EVENTOS_VALIDOS` / `EVENTOS_PADRAO` | COMPLETO |
| `gerarToken` | `gerarToken` | COMPLETO |
| `webhookUrl` | `urlDoWebhook` | COMPLETO |
| `criarInstancia` | `criarInstancia` | COMPLETO |
| `excluirInstancia` | `excluirInstancia` | COMPLETO |
| `listarInstancias` | `listarInstancias` + `detalhesDaInstancia` | COMPLETO |
| `conectar` | `conectar` | COMPLETO |
| `obterQr` | `obterQr` | COMPLETO |
| `obterStatus` | `obterStatus` | COMPLETO |
| `desconectar` | `desconectar` | COMPLETO |
| `sairDaConta` | `sairDaConta` | COMPLETO |
| `reconectar` | `reconectar` | COMPLETO |
| `normalizarNumero` | `normalizarDestino` | COMPLETO |
| `enviarTexto` | `enviarTexto` | COMPLETO |
| `enviarMidia` | `enviarMidia` | COMPLETO |
| `solicitarHistorico` | `solicitarHistorico` | COMPLETO |
| `reagir` | `reagir` | COMPLETO |
| `apagarMensagem` | `apagarMensagem` | COMPLETO |
| `marcarLida` | `marcarLida` | COMPLETO |
| `baixarMidia` | `baixarMidia` | COMPLETO |
| `obterAvatar` | `obterFotoPerfil` | COMPLETO |
| `listarContatos` | `listarContatos` | COMPLETO |
| `listarGrupos` | — | **AUSENTE** |

## 3. Backend — ingestão (`router.js`, funções internas)

| Item | Aqui | Status |
|---|---|---|
| `jidParaTelefone` / `ehGrupo` | `telefoneDoJid` / `ehGrupo` | COMPLETO |
| `lerConteudo` | `lerConteudo` | COMPLETO |
| `normalizarEvento` | `normalizarEvento` | COMPLETO |
| `baixarESalvarMidia` | `salvarMidia` | COMPLETO |
| `salvarBase64` | dentro de `salvarMidia` | COMPLETO |
| `telefoneDe` | `telefoneDe` | COMPLETO |
| `temLetra` / `nomeMelhor` | `temLetra` / `nomeMelhor` | COMPLETO |
| `nomeDoContato` | — | **AUSENTE** — nome de UM contato sob demanda |
| `nomeDoGrupo` | — | **AUSENTE** — nome do grupo vem só do histórico |
| `renovarAvatarEmSegundoPlano` | `renovarAvatar` | COMPLETO |
| `acharVinculoPorTelefone` | `vincularConversasAosLeads` (em lote) | **PARCIAL** — lá é automático na chegada da mensagem |
| `acharIrmaPorTelefone` | dentro de `acharOuCriarConversa` | COMPLETO |
| `absorverConversa` | — | **AUSENTE** — funde conversa duplicada |
| `acharOuCriarConversa` | `acharOuCriarConversa` | COMPLETO |
| `tratarProtocolo` | `tratarProtocolo` | COMPLETO |
| `situacoesEncerradas` | constante `ENCERRADAS` | **PARCIAL** — lá é configurável |
| `tratarMensagem` | `tratarMensagem` | COMPLETO |
| `tratarRecibo` | `tratarRecibo` | COMPLETO |
| `acharConversas` / `tratarHistorico` | idem | COMPLETO |
| `transcreverEmSegundoPlano` | `transcreverMensagem` | COMPLETO |
| `semAcentoJs` / `recortarEmVolta` | dentro de `buscarNasMensagens` | COMPLETO |
| `nomeInstanciaPara` | dentro de `conectarMeuWhatsapp` | COMPLETO |
| `minhaInstancia` | `minhaInstancia` | COMPLETO |
| `instanciasVisiveis` / `soAdmin` | — | **DESCARTADO** — aqui a caixa é do dono, sem membros (decisão de 11/08) |
| `traduzirStatus` | enum `WhatsappStatus` | COMPLETO |

## 4. Backend — rotas (27)

| Rota do ERP | Aqui | Status |
|---|---|---|
| `POST /webhook/:token` | `api/whatsapp/webhook/[token]` | COMPLETO |
| `GET /config` | `gatewayConfigurado()` na página | **PARCIAL** — sem diagnóstico exposto |
| `GET/PUT/DELETE /transcricao` | `GROQ_API_KEY` no `.env` | **PARCIAL** — sem tela para a chave |
| `POST /transcricao/testar` | — | **AUSENTE** |
| `GET /contatos` | `sincronizarContatos` | **PARCIAL** — sincroniza, não lista para escolher |
| `GET /acessos` | — | **DESCARTADO** — não há membros por instância |
| `PUT /instance/:id/membros` | — | **DESCARTADO** — idem |
| `GET /instances` (admin vê todas) | — | **DESCARTADO** — idem |
| `GET /buscar` | `buscarNasMensagens` | COMPLETO |
| `GET /instance` | página `/admin/whatsapp` | COMPLETO |
| `POST /instance` | `conectarMeuWhatsapp` | COMPLETO |
| `POST /instance/connect` | idem | COMPLETO |
| `POST /instance/logout` | `desconectarMeuWhatsapp` | COMPLETO |
| `POST /instance/sincronizar` | `sincronizarHistorico` | COMPLETO |
| `POST /instance/webhook` | dentro de `sincronizarHistorico` | COMPLETO |
| `POST /send` | `enviarMensagem` | COMPLETO |
| `POST /send-media` | `enviarArquivo` | COMPLETO |
| `POST /messages/:id/reagir` | `reagirMensagem` | **PARCIAL** — sem seletor de emoji na bolha |
| `POST /messages/:id/apagar` | `apagarParaTodos` | COMPLETO |
| `POST /messages/:id/transcrever` | — | **AUSENTE** — transcrever sob demanda |
| `POST /conversations/:id/read` | `marcarConversaLida` | COMPLETO |
| `PATCH /conversations/:id` | `mudarSituacao`, `alternarEtiqueta`, `renomearConversa`, `alternarArquivada` | COMPLETO |
| `POST /conversations/:id/vincular` | `vincularAoLead` | COMPLETO |
| `POST /contatos/sincronizar` | `sincronizarContatos` | COMPLETO |
| `POST /conversas/mesclar-duplicadas` | — | **AUSENTE** |

## 5. Telas e componentes

| Item | Aqui | Status |
|---|---|---|
| `Conectar.jsx` — QR, status, desconectar, excluir | `ConectarWhatsapp.tsx` | COMPLETO |
| `Conectar.jsx` — gestão de acessos/membros | — | **DESCARTADO** — caixa é do dono |
| `Inbox` — fila, abrir, enviar, buscar | `CaixaDeEntrada.tsx` | COMPLETO |
| `Inbox` — anexo, colar, arrastar, legenda | idem | COMPLETO |
| `Inbox` — responder, encaminhar, nota interna | idem | COMPLETO |
| `Inbox` — etiquetas, arquivadas, não lida | idem | COMPLETO |
| `Inbox` — **agrupamento por dia** (separador de data) | — | **AUSENTE** |
| `Inbox` — **modo tela cheia** | — | **AUSENTE** |
| `Inbox` — **"digitando…"** (`aoDigitar`, `ritmo`) | — | **AUSENTE** |
| `Inbox` — **modelos de mensagem** (`usarModelo`, `sugestoes`) | — | **AUSENTE** |
| `Inbox` — **mesclar duplicadas** (`planoMesclagem`) | — | **AUSENTE** |
| `Inbox` — **filtro por status/etiqueta** | filtro por texto e abas | **PARCIAL** |
| `Inbox` — **botão "ir para o fim"** (`longeDoFim`) | rolagem automática | **PARCIAL** |
| `Bolha` — status, mídia, ausente, transcrição, citação | `Bolha.tsx` | COMPLETO |
| `Bolha` — **confirmação antes de apagar** | apaga direto | **PARCIAL** |
| `AudioMensagem` — **forma de onda e velocidade** | `<audio controls>` | **PARCIAL** |
| `VisorMidia` — **lightbox com zoom/navegação** | abre em nova aba | **PARCIAL** |
| `AvatarContato` — **foto real do contato** | iniciais coloridas | **PARCIAL** — `fotoUrl` é gravado, não exibido |
| `QuadroConversas` — **fila como quadro por tempo de espera** | — | **AUSENTE** |
| `PainelCrm` — lead, criar lead, situação, etiquetas | `PainelCrm.tsx` | COMPLETO |
| `PainelCrm` — **estoque na conversa** (produtos) | — | **DESCARTADO** — não há catálogo; o equivalente seria lote |
| `Desempenho.jsx` — **tempo de espera, mediana, por hora** | — | **AUSENTE** |
| `whatsappConstants` — `formatarTelefone`, `quandoCurto` | em `CaixaDeEntrada.tsx` | COMPLETO |
| `whatsappConstants` — `agruparPorDia` | — | **AUSENTE** |
| `whatsappConstants` — `aplicarTokens` ({{nome}}) | — | **AUSENTE** |
| `whatsappConstants` — `PRIORIDADES` | — | **AUSENTE** |

---

## 3. Placar

| Status | Itens |
|---|--:|
| COMPLETO | 48 |
| PARCIAL | 12 |
| AUSENTE | 16 |
| DESCARTADO | 6 |
| **Total** | **82** |

**Descartados (com motivo):**
1. `instanciasVisiveis`, `soAdmin`, `/acessos`, `/instance/:id/membros`, `/instances` — a caixa de entrada aqui é do dono do número; não há compartilhamento por membros (decisão registrada em 11/08/2026).
2. `EstoqueNaConversa` — o ERP mostra produtos; aqui o equivalente seria lote/loteamento, que é outro desenho e não foi pedido.

**Adaptações registradas (não são omissões):**
- Mídia vai para o cofre cifrado (`lib/storage-seguro`), não para pasta pública — o sistema já teve vazamento por esse caminho.
- Envio de mídia usa URL assinada temporária (`lib/whatsapp-url-temporaria`), porque o gateway busca por URL e o cofre é privado.
- `Deal`/`Customer` do ERP correspondem a `Lead`/`Venda` daqui.
- Chave do Groq no `.env`, não em tabela de segredos com tela.

---

## 4. Ordem de execução do que falta

Do mais usado no dia a dia para o menos:

1. Separador de data na timeline (`agruparPorDia`)
2. Foto real do contato (o `fotoUrl` já é gravado)
3. Seletor de emoji para reagir na bolha
4. Confirmação antes de apagar
5. Visor de mídia com zoom e navegação
6. Player de áudio com forma de onda e velocidade
7. Modelos de mensagem com tokens `{{nome}}`
8. Transcrever sob demanda + tela da chave do Groq
9. Filtro por situação e etiqueta na fila
10. Botão "ir para o fim" quando longe do fim
11. Indicador "digitando…"
12. Modo tela cheia
13. Nome de contato/grupo sob demanda + `listarGrupos`
14. Vínculo automático com lead na chegada da mensagem
15. Situações encerradas configuráveis
16. Mesclar conversas duplicadas (`absorverConversa` + tela)
17. Quadro de conversas por tempo de espera
18. Painel de desempenho
