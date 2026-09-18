# Carga inicial da base histórica da Hubla

_Executada em 2026-09-18. Registro do que entrou no banco e das decisões tomadas._

## Por que foi necessária

A Hubla **não faz backfill**: quem comprou antes de o webhook existir nunca gera `customer.member_added`. Sem esta carga, toda cliente anterior a 18/09 tentaria entrar e receberia *"não encontramos um acesso ativo para esse e-mail"*.

## Fonte

Export de faturas da Hubla, período nominal 18/06 a 18/09/2026 — mas os dados reais vão só de **15 a 17/09/2026**, quando o produto começou a vender.

- 201 linhas · 179 clientes únicos · todas com status `Paga` · nenhum reembolso
- Encoding `cp1252`, separador `;`
- Arquivo e derivados ficam em `migration/`, **fora do controle de versão** — contêm e-mail, nome e telefone de clientes reais

## O que entrou

| | |
|---|---|
| Clientes criadas | **178** |
| Acessos concedidos | **241** |
| Clientes sem acesso ao app | **0** |
| Fora da carga | 1 venda de R$ 10 na oferta "hggh", confirmada como teste do produtor |

Todos os acessos ficaram com `source = 'hubla_import'`, que é o que distingue esta base do que entra pelo webhook (`hubla`) e do que é liberado no painel (`manual`). **As campanhas segmentadas usam exatamente essa marca.**

## Descobertas que mudaram o desenho

**O slug da página não é o id do produto.** Dos quatro identificadores fornecidos a partir das URLs de venda, **dois estavam errados**. Só o payload real confirma. Foi por isso que o mapeamento virou tabela (`hubla_product_map`) e não coluna: vários ids da Hubla podem apontar para o mesmo produto nosso.

**A mesma oferta pode ter vários ids.** O front é vendido por `bniYICXEzykgw1PzEyme` (R$ 197) e por `EnCFJKb2OJLinZYUy1MC` (R$ 97, oferta "Cópia"). Os dois apontam para `principal`. 41 das 201 vendas vieram pelo segundo — se ele não estivesse mapeado, 20% das compradoras não teriam acesso.

## Correção posterior das datas

A carga inicial gravou `granted_at` como o momento da importação. Isso foi **corrigido no mesmo dia** a partir do CSV: cada acesso passou a ter a data real do pagamento, e `customers.created_at` virou a data da primeira compra da cliente.

Distribuição final: 15/09 → 4 · 16/09 → 95 · 17/09 → 101.

Se uma nova carga for feita algum dia, **gravar a data real desde o começo** — refazer depois custou uma rodada inteira de trabalho.

## Reembolsos — questão encerrada

O export só trouxe faturas pagas, o que levantou a dúvida de se o filtro teria escondido reembolsos. **Caio confirmou em 2026-09-18: ele filtrou por aprovadas e não houve nenhum reembolso no período.** Nenhuma cliente reembolsada recebeu acesso indevido.

Daqui em diante os reembolsos chegam pelo webhook, via `customer.member_removed`.
