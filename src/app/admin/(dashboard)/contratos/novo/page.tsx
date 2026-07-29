import TemplateForm from '../TemplateForm';

export const metadata = { title: 'Novo modelo — Admin' };

const EXEMPLO = `<h1>CONTRATO DE COMPRA E VENDA — Lote {{lote.codigo}}</h1>

<p>Pelo presente instrumento particular, de um lado <strong>{{loteadora.razaoSocial}}</strong>,
inscrita no CNPJ sob nº {{loteadora.cnpj}}, com sede em {{loteadora.endereco}},
doravante denominada <strong>VENDEDORA</strong>;</p>

<p>E de outro lado <strong>{{cliente.nome}}</strong>, portador do documento {{cliente.cpfCnpj}},
residente em {{cliente.endereco}}, doravante denominado <strong>COMPRADOR</strong>;</p>

<p>Têm entre si justo e contratado o seguinte:</p>

<h2>CLÁUSULA 1ª — DO OBJETO</h2>
<p>A VENDEDORA vende ao COMPRADOR, que adquire, o lote nº {{lote.numero}}, quadra {{lote.quadra}},
do empreendimento <strong>{{loteamento.nome}}</strong>, situado em {{loteamento.cidade}} – {{loteamento.estado}},
medindo {{lote.area}} de área total.</p>

<h2>CLÁUSULA 2ª — DO VALOR E FORMA DE PAGAMENTO</h2>
<p>O valor total da venda é de {{venda.valorTotal}}, sendo {{venda.valorEntrada}} pagos a título
de entrada, e o saldo dividido em {{venda.numeroParcelas}} parcelas mensais de {{venda.valorParcela}},
com vencimento todo dia {{venda.diaVencimento}} de cada mês.</p>

<h2>CLÁUSULA 3ª — DA INADIMPLÊNCIA</h2>
<p>O atraso no pagamento implica multa de 2% (dois por cento) sobre o valor da parcela, mais
juros de 1% ao mês e correção monetária pelo IGP-M.</p>

<h2>CLÁUSULA 4ª — DO FORO</h2>
<p>Fica eleito o foro da Comarca de {{loteamento.cidade}}/{{loteamento.estado}} para dirimir
quaisquer dúvidas oriundas deste contrato.</p>

<p style="margin-top:24px">{{loteamento.cidade}}, {{venda.dataContrato}}.</p>

<div class="assinatura">
  <div><div class="linha">{{loteadora.razaoSocial}}<br>VENDEDORA</div></div>
  <div><div class="linha">{{cliente.nome}}<br>COMPRADOR</div></div>
</div>
`;

export default function NovoTemplatePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Novo modelo de contrato</h1>
      <TemplateForm initial={{ nome: '', conteudoHtml: EXEMPLO, ativo: true, default: false }} />
    </div>
  );
}
