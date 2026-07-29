/**
 * Template completo do contrato de compromisso de compra e venda — Parque Tucano.
 * Mapeado a partir do arquivo "CONTRATO DE COMPRA E VENDA editando 2.docx".
 *
 * Variáveis usadas (todas com fallback no contexto):
 *   {{loteadora.razaoSocial}}, {{loteadora.cnpj}}, {{loteadora.endereco}},
 *     {{loteadora.email}}, {{loteadora.telefone}}, {{loteadora.representanteNome}},
 *     {{loteadora.representanteCpf}}, {{loteadora.representanteCargo}}
 *   {{cliente.nome}}, {{cliente.cpfCnpj}}, {{cliente.nacionalidade}},
 *     {{cliente.estadoCivil}}, {{cliente.profissao}}, {{cliente.endereco}},
 *     {{cliente.cep}}, {{cliente.email}}, {{cliente.telefone}}
 *   {{loteamento.nome}}, {{loteamento.endereco}}, {{loteamento.cidade}},
 *     {{loteamento.estado}}, {{loteamento.cartorio}}
 *   {{lote.quadra}}, {{lote.numero}}, {{lote.testada}}, {{lote.testadaExtenso}},
 *     {{lote.fundo}}, {{lote.fundoExtenso}}, {{lote.area}}, {{lote.areaExtenso}},
 *     {{lote.viaFrente}}, {{lote.ladoVia}}, {{lote.confrontacaoEsquerdo}},
 *     {{lote.confrontacaoDireito}}, {{lote.confrontacaoFrente}},
 *     {{lote.confrontacaoFundo}}, {{lote.matricula}}
 *   {{venda.valorTotal}}, {{venda.valorTotalExtenso}}, {{venda.valorEntrada}},
 *     {{venda.valorEntradaExtenso}}, {{venda.valorParcela}}, {{venda.valorParcelaExtenso}},
 *     {{venda.primeiroVencimento}}, {{venda.primeiroVencimentoExtenso}},
 *     {{venda.diaVencimento}}, {{venda.diaVencimentoExtenso}},
 *     {{venda.numeroParcelas}}, {{venda.numeroParcelasExtenso}},
 *     {{venda.taxaCorretagem}}, {{venda.taxaCorretagemExtenso}},
 *     {{venda.descontoPontualidadePct}}, {{venda.dataContrato}},
 *     {{venda.dataContratoExtenso}}
 */

export const TEMPLATE_PARQUE_TUCANO_NOME = 'Compromisso de Compra e Venda — Parque Tucano (Lei 6.766/79)';

export const TEMPLATE_PARQUE_TUCANO_HTML = `<h1>INSTRUMENTO PARTICULAR DE COMPROMISSO DE COMPRA E VENDA DE IMÓVEL</h1>

<h2>QUADRO RESUMO</h2>

<h3>A. AS PARTES</h3>

<p><strong>A.1 PROMITENTE VENDEDOR:</strong><br>
Razão Social: <strong>{{loteadora.razaoSocial}}</strong><br>
CNPJ: {{loteadora.cnpj}}<br>
Endereço: {{loteadora.endereco}}<br>
Endereço Eletrônico: {{loteadora.email}}<br>
Telefone: {{loteadora.telefone}},<br>
doravante denominado simplesmente <strong>VENDEDOR</strong>.</p>

<p><strong>A.2 COMPROMISSÁRIO COMPRADOR:</strong><br>
Nome: <strong>{{cliente.nome}}</strong><br>
CPF: {{cliente.cpfCnpj}}<br>
Nacionalidade: {{cliente.nacionalidade}}<br>
Estado Civil: {{cliente.estadoCivil}}<br>
Profissão: {{cliente.profissao}}<br>
Endereço: {{cliente.endereco}}<br>
CEP: {{cliente.cep}}<br>
Endereço Eletrônico: {{cliente.email}}<br>
Telefone: {{cliente.telefone}},<br>
doravante denominado simplesmente <strong>COMPRADOR</strong>.</p>

<p>Resolvem entre si realizar este contrato, regido pela Lei n. 6.766, de 1979 (dispõe sobre o parcelamento do solo urbano e dá outras providências), pela Lei n. 10.406, de 2002 (Código Civil), e pela Constituição da República do Brasil, de 1988, nos seguintes termos e condições.</p>

<h3>B. DESCRIÇÃO DO OBJETO DESTE CONTRATO</h3>

<p>Um lote de terreno urbano, situado no loteamento <strong>{{loteamento.nome}}</strong>, localizado em {{loteamento.endereco}}, {{loteamento.cidade}}/{{loteamento.estado}}.</p>

<p>O lote tem as seguintes medidas e confrontações — <strong>Quadra {{lote.quadra}} — Lote {{lote.numero}}</strong>: Um lote de terreno urbano, de configuração geométrica retangular, medindo {{lote.testada}} ({{lote.testadaExtenso}}) de frente por {{lote.fundo}} ({{lote.fundoExtenso}}) da frente aos fundos, totalizando uma área de {{lote.area}} ({{lote.areaExtenso}}). O referido encontra-se no lado {{lote.ladoVia}} da {{lote.viaFrente}}. Limites e Confrontações: <strong>Lado esquerdo</strong> com {{lote.confrontacaoEsquerdo}}; <strong>Lado direito</strong> com {{lote.confrontacaoDireito}}; <strong>Frente</strong> com {{lote.confrontacaoFrente}}; <strong>Fundos</strong> com {{lote.confrontacaoFundo}}. O Empreendimento é registrado sob o nº de matrícula {{lote.matricula}} no {{loteamento.cartorio}}.</p>

<h3>C. ENCARGOS MORATÓRIOS</h3>
<p>Em caso de atraso nos pagamentos incidirão multa moratória de 2% (dois por cento), atualizada pela variação acumulada do IGP-M e juros legais de 0,033% a.d.c. (zero vírgula zero trinta e três por cento ao dia corrido), limitados a 1% (um por cento) ao mês, nos termos do inciso V, art. 26, da Lei 6.766, de 1979.</p>

<h3>D. TRIBUTOS</h3>
<p>É de incumbência do COMPRADOR, a partir da assinatura deste instrumento, o pagamento dos impostos e taxas incidentes sobre o lote compromissado.</p>

<h3>E. RESTRIÇÕES URBANÍSTICAS</h3>
<p>As construções a serem realizadas no lote deverão respeitar as restrições urbanísticas, que compreendem disposições relativas às construções e aos usos, convencionadas neste instrumento e supletivamente na legislação pertinente.</p>

<h3>F. PREÇO E FORMA DE PAGAMENTO</h3>
<table>
  <tbody>
    <tr><th>F.1 Valor total deste contrato</th><td>R$ {{venda.valorTotal}} ({{venda.valorTotalExtenso}})</td></tr>
    <tr><th>F.2 Valor de entrada (Arras ou Sinal)</th><td>R$ {{venda.valorEntrada}} ({{venda.valorEntradaExtenso}})</td></tr>
    <tr><th>F.3 Valor da parcela mensal reajustável</th><td>R$ {{venda.valorParcela}} ({{venda.valorParcelaExtenso}})</td></tr>
    <tr><th>F.4 1º Vencimento</th><td>{{venda.primeiroVencimento}} ({{venda.primeiroVencimentoExtenso}})</td></tr>
    <tr><th>F.5 Vencimento todo dia</th><td>{{venda.diaVencimento}} ({{venda.diaVencimentoExtenso}})</td></tr>
    <tr><th>F.6 Número de parcelas</th><td>{{venda.numeroParcelas}} ({{venda.numeroParcelasExtenso}})</td></tr>
    <tr><th>F.7 Taxa de Corretagem já integrada ao preço do lote</th><td>R$ {{venda.taxaCorretagem}} ({{venda.taxaCorretagemExtenso}})</td></tr>
  </tbody>
</table>

<h3>G. ATUALIZAÇÃO MONETÁRIA DAS PARCELAS</h3>
<p>Todas as parcelas relativas a este contrato, previstas nesta cláusula ou em outras cláusulas deste instrumento, serão corrigidas anualmente, pelo IGP-M/FGV (Índice Geral de Preços — Mercado), somadas a 8% (oito por cento). As partes pactuam ainda que: 1) Os reajustes serão calculados levando-se em consideração a variação do indexador utilizando os últimos 12 meses, com início desde 2 (dois) meses anteriores ao da assinatura deste contrato até 2 (dois) meses anteriores ao do vencimento de cada parcela, permanecendo este regramento ano a ano, para as parcelas subsequentes; 2) Na hipótese de o índice escolhido pelas partes vir a ser extinto, deixar de ser publicado ou sofrer algum impedimento, aplicar-se-á automaticamente o INPC, e, na ausência deste, o IPC da FIPE/USP, ou ainda qualquer outro índice oficial vigente; 3) As partes reconhecem que a atualização monetária prevista nesta promessa não caracteriza qualquer pena ou remuneração, mas significa apenas o restabelecimento do poder de compra da moeda diante dos efeitos da inflação.</p>

<h3>H. LOCAL DE PAGAMENTO</h3>
<p>Emissão de boleto bancário. No caso de o COMPRADOR desejar efetuar o pagamento de modo diverso, estando o boleto emitido ainda válido, o VENDEDOR poderá cobrar os custos do boleto no pagamento.</p>

<h3>I. DESFAZIMENTO DO CONTRATO</h3>
<p>Ficam cientes as partes que as consequências do desfazimento do contrato, seja mediante distrato, seja por meio de resolução contratual motivada por inadimplemento de obrigação do VENDEDOR ou do COMPRADOR, constam nas <strong>CLÁUSULAS SÉTIMA, OITAVA E VIGÉSIMA SEGUNDA</strong> deste instrumento.</p>

<h3>J. DESISTÊNCIA CONTRATUAL</h3>
<p>O comprador pode desistir do contrato, no prazo de 7 (sete) dias corridos a contar de sua assinatura, devendo os valores eventualmente pagos serem devolvidos, com as deduções de corretagem e eventuais despesas realizadas para a operacionalização da venda.</p>

<p style="text-align:right;margin-top:24px;">{{loteamento.cidade}}/{{loteamento.estado}}, {{venda.dataContratoExtenso}}.</p>

<div class="destaque">
<p>O contrato continua nas cláusulas detalhadas a seguir.</p>
</div>

<h2>CLÁUSULAS GERAIS</h2>

<h3>CLÁUSULA PRIMEIRA — DA PROPRIEDADE</h3>
<p>O VENDEDOR é senhor e legítimo possuidor, inteiramente livre e desembaraçado de qualquer ônus, dívidas e impostos, pessoas e coisas, certidões e sem quaisquer outras restrições legais ou regulamentares decorrentes da legislação em vigor do imóvel acima descrito e caracterizado.</p>

<h3>CLÁUSULA SEGUNDA — PREÇO E FORMA DE PAGAMENTO</h3>
<p><strong>A. Preços e condições:</strong></p>
<p>A.1) Valor total deste contrato R$ {{venda.valorTotal}} ({{venda.valorTotalExtenso}});<br>
A.2) Valor de entrada (Arras ou Sinal) R$ {{venda.valorEntrada}} ({{venda.valorEntradaExtenso}});<br>
A.3) Valor da parcela mensal reajustável R$ {{venda.valorParcela}} ({{venda.valorParcelaExtenso}});<br>
A.4) 1º Vencimento para o dia: {{venda.primeiroVencimento}} ({{venda.primeiroVencimentoExtenso}});<br>
A.5) Vencimento todo dia: {{venda.diaVencimento}} ({{venda.diaVencimentoExtenso}});<br>
A.6) Número de parcelas: {{venda.numeroParcelas}} ({{venda.numeroParcelasExtenso}});<br>
A.7) Desconto para pagamento pontual das parcelas previstas no item A.3 supra: {{venda.descontoPontualidadePct}}% (descrição por cento);<br>
A.8) Local de pagamento: Preferencialmente por meio de boleto bancário;<br>
A.9) Taxa de Corretagem já integrada ao preço do lote: R$ {{venda.taxaCorretagem}} ({{venda.taxaCorretagemExtenso}}).</p>

<p><strong>B.</strong> Para pagamento pontual e sem atraso das parcelas, o VENDEDOR dará em favor do COMPRADOR um DESCONTO (PONTUALIDADE), conforme item A.7;</p>
<p><strong>C.</strong> Todas as parcelas serão corrigidas anualmente pelo IGP-M/FGV, somado a 8% (oito por cento), conforme regramento descrito no Quadro Resumo;</p>
<p><strong>D.</strong> A eficácia do presente contrato subordina-se ao pagamento integral do preço, tarifas, resíduos, multas, correção monetária e juros;</p>
<p><strong>E.</strong> Pagamento de qualquer prestação recebido de maneira diversa da estabelecida neste contrato, inclusive perante bancos e correspondentes bancários, não redundará em quitação caso seja feito a menor;</p>
<p><strong>F.</strong> A tolerância do VENDEDOR no recebimento de qualquer prestação ou encargo de maneira diversa não pode ser invocada como precedente ou novação;</p>
<p><strong>G.</strong> A não aplicação imediata das sanções não significará renúncia do VENDEDOR;</p>
<p><strong>H.</strong> A manutenção dos reajustes pactuados é condição essencial do negócio;</p>
<p><strong>I.</strong> Em caso de não pagamento de 3 (três) ou mais parcelas, consecutivas ou alternadas, incluindo IPTU, tornar-se-ão vencidas todas as demais prestações, ficando o saldo devedor corrigido imediatamente exigível.</p>

<h3>CLÁUSULA TERCEIRA — DA ENTREGA DA POSSE DO IMÓVEL EM CONDIÇÃO RESOLUTIVA E ALEATÓRIA DE ONEROSIDADE</h3>
<p>No ato da assinatura deste contrato, fica transferida ao COMPRADOR a posse direta do imóvel compromissado, inteiramente livre e desimpedida de pessoas e coisas.</p>
<p><strong>§ 1º</strong> O COMPRADOR deverá defender a posse direta recebida, de qualquer turbação ou esbulho.</p>
<p><strong>§ 2º</strong> O VENDEDOR ficará com a posse indireta do imóvel compromissado até a data do término do contrato, devidamente quitado. Estando o compromisso quitado, o COMPRADOR passará a ter o domínio do imóvel.</p>
<p><strong>§ 3º</strong> O COMPRADOR, na posse direta, recebe direito de exploração para fins comerciais e/ou residenciais, podendo sublocar a terceiros, enquanto adimplente.</p>
<p><strong>§ 4º</strong> Fica estipulado valor mensal equivalente a 0,75% do valor deste contrato, a título de fruição e ocupação.</p>
<p><strong>§ 5º</strong> A taxa de fruição será cedida a título de bônus enquanto o COMPRADOR estiver em dia.</p>
<p><strong>§ 6º</strong> A taxa será cobrada caso o contrato seja rescindido por dolo ou culpa do COMPRADOR.</p>
<p><strong>§ 7º</strong> Em caso de rescisão com restituição, o débito de fruição será compensado com o crédito da restituição.</p>
<p><strong>§ 8º</strong> Ainda em caso de restituição, serão descontadas as multas previstas em lei, arras e demais despesas.</p>
<p><strong>§ 9º</strong> É de incumbência do COMPRADOR, a partir da assinatura, o pagamento dos impostos e taxas incidentes sobre o lote.</p>

<h3>CLÁUSULA QUARTA — DA ESCRITURA E QUITAÇÃO</h3>
<p>O VENDEDOR compromete-se a dar quitação geral e outorgar a Escritura Pública definitiva ao COMPRADOR após o pagamento integral.</p>
<p><strong>§ 1º</strong> Todas as despesas (ITBI, abertura de matrícula, averbações, emolumentos) correrão por conta exclusiva do COMPRADOR.</p>
<p><strong>§ 2º</strong> O COMPRADOR deverá procurar o VENDEDOR para escriturar em até 60 (sessenta) dias após a quitação.</p>
<p><strong>§ 3º</strong> O COMPRADOR deverá registrar a escritura no cartório competente.</p>
<p><strong>§ 4º</strong> O COMPRADOR deverá realizar a averbação junto ao Município para mudança de titularidade e correto lançamento do IPTU.</p>
<p><strong>§ 5º</strong> O descumprimento dos §§ 2º, 3º e 4º implica "Tarifa de Mora de Escrituração" de 1% do valor deste contrato.</p>

<h3>CLÁUSULA QUINTA — DOS TRIBUTOS</h3>
<p>A partir da assinatura deste instrumento, o COMPRADOR é responsável por IPTU, ITBI, taxas de melhoria e demais encargos incidentes sobre o imóvel, ainda que lançados em nome do VENDEDOR.</p>
<p><strong>§ 1º</strong> Despesas pagas pelo VENDEDOR diretamente ao órgão competente serão reembolsadas pelo COMPRADOR, com despesas administrativas de 10%, em 72 (setenta e duas) horas da notificação.</p>

<h3>CLÁUSULA SEXTA — DO ATRASO NOS PAGAMENTOS</h3>
<p>Em caso de atraso nos pagamentos das parcelas ou de quaisquer obrigações deste instrumento, o COMPRADOR incorrerá nos acréscimos previstos no Quadro Resumo (item C).</p>

<h3>CLÁUSULA SÉTIMA — DA RESCISÃO POR CULPA DO COMPRADOR</h3>
<p>O descumprimento de quaisquer cláusulas deste contrato pelo COMPRADOR poderá dar ensejo à sua rescisão.</p>
<p><strong>§ 1º</strong> A inadimplência de 03 (três) parcelas, sucessivas ou alternadas, incluindo IPTU e tarifas, dará ensejo à rescisão contratual, nos termos do art. 26, V, da Lei 6.766/79.</p>
<p><strong>§ 2º</strong> A rescisão dar-se-á caso o COMPRADOR notificado para quitar a dívida não o faça em 30 (trinta) dias, nos termos do caput do art. 32 da Lei 6.766/79.</p>
<p><strong>§ 3º</strong> Pago o débito em 30 dias e regularizadas as cláusulas, o contrato será reestabelecido.</p>
<p><strong>§ 4º</strong> Intimações/notificações deverão ser feitas pessoalmente, ou pelos Cartórios de RTD da Comarca do imóvel ou do domicílio.</p>
<p><strong>§ 5º</strong> Recusa ou paradeiro desconhecido: notificação por edital, prazo conta a partir de 10 dias após publicação.</p>
<p><strong>§ 6º</strong> Em caso de resolução contratual por fato imputado ao COMPRADOR, serão restituídos os valores pagos, atualizados, podendo ser descontados: I — fruição (0,75% sobre valor atualizado, do recebimento até a restituição); II — cláusula penal e arras (limitado a 25% do valor atualizado); III — encargos moratórios; IV — IPTU/contribuições/tarifas; V — comissão de corretagem; VI — multa diária por permanência.</p>
<p><strong>§ 7º</strong> O pagamento da restituição ocorrerá em até 12 parcelas mensais, com carência de até 180 dias após conclusão das obras ou 12 meses após formalização da rescisão.</p>
<p><strong>§ 8º</strong> O desconto é consequência de pena prevista no art. 408 do Código Civil.</p>
<p><strong>§ 9º</strong> Em rescisão por culpa do COMPRADOR, o imóvel deve ser entregue desocupado em até 30 dias após notificação, sob pena de multa diária de 0,17% a.d.c., limitada a 1% ao mês.</p>

<h3>CLÁUSULA OITAVA — DA POSSE DE MÁ-FÉ</h3>
<p>O COMPRADOR será considerado possuidor de má-fé na hipótese de: A) não desocupar o imóvel nos prazos; B) permanecer após vencido prazo de notificação/edital; C) construir estando inadimplente; D) construir em desconformidade com lei/contrato; E) não solicitar autorização para água/luz; F) construir em imóvel errado; G) permanecer mais de 3 meses inadimplente; H) ligações irregulares de água/luz/esgoto.</p>

<h3>CLÁUSULA NONA — AUTORIZAÇÃO PARA EDIFICAÇÃO</h3>
<p>O COMPRADOR em dia que queira construir deverá requerer autorização formal ao VENDEDOR, sob pena de não-indenização da benfeitoria (art. 34, parágrafo único, Lei 6.766/79).</p>
<p><strong>§ 1º</strong> O requerimento deverá conter o valor orçado da obra.</p>
<p><strong>§ 2º</strong> O COMPRADOR deverá requerer autorização para ligação de água/luz.</p>
<p><strong>§ 3º</strong> As construções deverão obedecer às normas urbanísticas e Código Civil.</p>
<p><strong>§ 4º</strong> Só poderá iniciar obra após aprovação de projeto e alvará.</p>
<p><strong>§ 5º</strong> Ligação irregular acarretará rescisão (art. 155 CP).</p>
<p><strong>§ 6º</strong> Início sem projeto/alvará caracteriza benfeitoria não-indenizável.</p>
<p><strong>§ 7º</strong> Construção sem autorização sujeita o COMPRADOR a multa penal de 10% do valor deste contrato.</p>

<h3>CLÁUSULA DÉCIMA — DA INDENIZAÇÃO DAS BENFEITORIAS</h3>
<p>As benfeitorias necessárias ou úteis serão indenizadas nos termos do art. 34, caput, da Lei 6.766/79, salvo o disposto no § 1º a seguir.</p>
<p><strong>§ 1º</strong> Benfeitorias voluptuárias não serão indenizadas.</p>
<p><strong>§ 2º</strong> Benfeitorias em desconformidade com contrato ou lei não serão indenizadas (§ 1º, art. 34).</p>
<p><strong>§ 3º</strong> Indenização pelo valor investido com documentos fiscais, corrigido pelo INCC.</p>
<p><strong>§ 4º</strong> Valores sem documentação fiscal não serão indenizados.</p>
<p><strong>§ 5º</strong> Projetos e obra deverão possuir ART e/ou RRT.</p>

<h3>CLÁUSULA DÉCIMA PRIMEIRA — DA IRREVOGABILIDADE E DA EXTENSÃO</h3>
<p>Compromisso firmado em caráter irrevogável e irretratável, obrigando partes, herdeiros e sucessores.</p>

<h3>CLÁUSULA DÉCIMA SEGUNDA — DOS HONORÁRIOS</h3>
<p>Se qualquer das partes tiver que recorrer a serviços advocatícios, a parte infratora pagará honorários de 20% do valor atualizado, mais custas.</p>

<h3>CLÁUSULA DÉCIMA TERCEIRA — DO REGISTRO DO CONTRATO</h3>
<p>O COMPRADOR é responsável pelo registro deste contrato, devendo informar o VENDEDOR em 72 horas.</p>

<h3>CLÁUSULA DÉCIMA QUARTA — DA TRANSFERÊNCIA CONTRATUAL</h3>
<p>Transferência a terceiros depende de anuência do VENDEDOR, aprovação cadastral, quitação parcial e taxa de transferência. Transferência sem autorização: multa de 25%.</p>

<h3>CLÁUSULA DÉCIMA QUINTA — DA INCLUSÃO NOS SERVIÇOS DE PROTEÇÃO AO CRÉDITO E DO PROTESTO</h3>
<p>Em caso de inadimplência, o débito poderá ser encaminhado a SPC/Serasa e protesto. Custos por conta do COMPRADOR.</p>

<h3>CLÁUSULA DÉCIMA SEXTA — DA INFORMAÇÃO</h3>
<p>O COMPRADOR declara que a informação sobre o bem foi adequada e clara, e concorda em receber comunicações por e-mail, telefone e/ou correspondência. Mudança de endereço/telefone deve ser comunicada por escrito.</p>

<h3>CLÁUSULA DÉCIMA SÉTIMA — DO ALUGUEL, COMODATO OU EMPRÉSTIMO</h3>
<p>Qualquer cessão (gratuita ou onerosa) do imóvel requer anuência expressa do VENDEDOR.</p>

<h3>CLÁUSULA DÉCIMA OITAVA — DA LIMPEZA DA ÁREA</h3>
<p>Se o COMPRADOR não mantiver o imóvel limpo, o VENDEDOR poderá contratar terceiros e cobrar reembolso.</p>

<h3>CLÁUSULA DÉCIMA NONA — DA CLÁUSULA RESOLUTIVA</h3>
<p>Fica expressa a cláusula resolutiva, nos termos dos arts. 474 e 475 do Código Civil, podendo a parte lesada pedir a resolução ou exigir a execução.</p>

<h3>CLÁUSULA VIGÉSIMA — DAS ARRAS</h3>
<p>Não cumprida a obrigação pelo COMPRADOR, o VENDEDOR poderá ter o contrato por desfeito, retendo as arras (art. 418 do Código Civil).</p>

<h3>CLÁUSULA VIGÉSIMA PRIMEIRA — DA DEMOLIÇÃO</h3>
<p>Despesas com demolição de construção irregular correrão por conta do COMPRADOR, pagáveis em 72 horas após notificação.</p>

<h3>CLÁUSULA VIGÉSIMA SEGUNDA — REINTEGRAÇÃO DE POSSE</h3>
<p>Verificada a rescisão, o COMPRADOR devolverá imediatamente a posse, sob pena de esbulho.</p>
<p><strong>§ 1º</strong> Permanência após rescisão: multa diária de 0,17% do valor atualizado, compensável com haveres.</p>

<h3>CLÁUSULA VIGÉSIMA TERCEIRA — CLÁUSULAS GERAIS</h3>
<p>A) Área e medidas podem sofrer alteração de até 5% sem direito a ressarcimento;<br>
B) Não recebimento do boleto não exime o pagamento — disponível por outros canais;<br>
C) Contrato firmado em 3 vias, sendo uma para cada parte e a terceira para arquivo no registro imobiliário;<br>
D) Quando firmado por procurador, é obrigatório o arquivamento da procuração;<br>
E) Este compromisso vale como título para registro de propriedade, acompanhado de prova de quitação;<br>
F) Adquirentes inter-vivos ou causa-mortis sucedem em todos os direitos e obrigações;<br>
G) O COMPRADOR deverá utilizar o lote nos termos da legislação ambiental;<br>
H) Direito de arrependimento de 7 (sete) dias mediante carta registrada com AR.</p>

<h3>CLÁUSULA VIGÉSIMA QUARTA — DO FORO</h3>
<p>Nos termos do art. 48 da Lei 6.766/79, fica estabelecido o foro da Comarca de {{loteamento.cidade}}/{{loteamento.estado}} para dirimir todas as dúvidas ou litígios sobre o presente, renunciando a qualquer outro, por mais privilegiado que seja.</p>

<p>E por estarem assim justos e contratados, inteiramente de acordo com todos os termos deste instrumento, após leitura pausada, outorgam-se mútua e reciprocamente, assinando e rubricando em três vias de igual teor e forma juntamente com as testemunhas abaixo, obrigando-se por si, seus herdeiros e sucessores.</p>

<p style="margin-top:24px;">{{loteamento.cidade}}/{{loteamento.estado}}, {{venda.dataContratoExtenso}}.</p>

<div class="assinatura">
  <div>
    <div class="linha">
      <strong>{{loteadora.razaoSocial}}</strong><br>
      CNPJ: {{loteadora.cnpj}}<br>
      Representante: {{loteadora.representanteNome}}<br>
      CPF: {{loteadora.representanteCpf}}<br>
      <em>VENDEDOR</em>
    </div>
  </div>
  <div>
    <div class="linha">
      <strong>{{cliente.nome}}</strong><br>
      CPF: {{cliente.cpfCnpj}}<br>
      <em>COMPRADOR</em>
    </div>
  </div>
</div>

<h3 style="margin-top:32px;">Testemunhas</h3>
<table>
  <tbody>
    <tr><td>1. Nome: ________________________________________________<br>CPF: ____________________________</td></tr>
    <tr><td>2. Nome: ________________________________________________<br>CPF: ____________________________</td></tr>
  </tbody>
</table>
`;
