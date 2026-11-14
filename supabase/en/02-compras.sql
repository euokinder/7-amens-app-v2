-- =====================================================================
-- 02-compras.sql — o que cada cliente pagou: a visão en_pedidos_pagos
-- =====================================================================
-- ⏳ EUA: checkout — ESTE É O ENCAIXE DO CHECKOUT.
--
-- No espanhol, "o que ela comprou" vinha de duas tabelas de avisos de
-- pagamento (latam_whop_events e latam_kashpay_events), juntadas numa visão
-- (latam_pedidos_pagos, de 06-kashpay-libera.sql). O checkout dos EUA ainda
-- não existe (decisão do Arthur, 13/11: ele vem por último). Para o resto
-- do app já nascer pronto, TODA leitura de compra passa por esta visão:
--   en_claim_offer        (03) não oferece o que ela já comprou
--   en_admin_customers    (04) o painel: compras e produtos de cada cliente
--   en_admin_offers       (04) o painel: quantas compraram pelo pop-up
--   en_extras             (05) os extras dela (Arcanjos e Cântico)
--   en_resgate_cartao     (09) o resgate pelos 4 últimos números do cartão
--   en_reembolso_compras  (11) a lista do reembolso em um toque
--   en-api                     a ficha da cliente no painel
--
-- HOJE ELA VEM VAZIA (where false). Com ela vazia, o app funciona inteiro:
-- ninguém tem compra registrada, então os pop-ups oferecem tudo (mas nascem
-- desligados), os extras só abrem pelo painel (liberar à mão), o resgate
-- pelo cartão não acha ninguém (a tela segue para a emergência) e o
-- reembolso mostra "sem compra" (o pedido é gravado e a equipe procura).
--
-- QUANDO O CHECKOUT CHEGAR, o arquivo dele cria a tabela de avisos e roda
-- de novo o "create or replace view" abaixo, com o select de verdade. Regras:
--   - MESMAS colunas, MESMOS nomes, MESMOS tipos e MESMA ordem (o Postgres
--     só deixa acrescentar coluna no fim; para mudar, drop view + create);
--   - repetir "with (security_invoker = true)" (sem ele, a opção some em
--     silêncio: lição registrada no CLAUDE.md do Brasil);
--   - uma linha por cobrança no cartão (pedido único), mesmo devolvida
--     (devuelto = true): reembolso não tira acesso nem extra;
--   - índices na tabela de avisos para o que as funções procuram:
--     customer_id, lower(email), final_cartao e o pedido.
--
-- Pode rodar mais de uma vez. Só cria a visão en_pedidos_pagos.
-- =====================================================================

create or replace view public.en_pedidos_pagos with (security_invoker = true) as
  select
    null::text        as pedido,        -- o id da cobrança no checkout (único). Ex.: pay_...
    null::text        as origem,        -- qual checkout ou processadora cobrou
    null::uuid        as customer_id,   -- a cliente do app que a compra liberou (en_customers.id)
    null::text        as email,         -- o e-mail da compra, em minúsculas
    null::text[]      as produtos,      -- 'principal' | 'arcangeles' | 'cantico'; vazio ou nulo = não se sabe
    null::text        as nome_produto,  -- o nome do produto no checkout (o reembolso mostra se não souber o produto)
    null::integer     as valor_cents,   -- o total COBRADO no cartão, com o imposto que alguns estados somam
    null::text        as moneda,        -- 'USD'
    null::timestamptz as pagado_en,     -- quando foi pago
    null::boolean     as devuelto,      -- já houve reembolso ou disputa dessa cobrança
    null::text        as final_cartao,  -- os 4 últimos números do cartão (o resgate)
    null::text        as nome_cartao,   -- o nome no cartão (o resgate)
    null::text        as utm_source,    -- as etiquetas da venda (o pop-up leva utm_source=app-en)
    null::text        as utm_medium,
    null::text        as utm_campaign,
    null::text        as utm_content
  where false;  -- ⏳ EUA: checkout — trocar pelo select da tabela de avisos do checkout

revoke all on public.en_pedidos_pagos from public, anon, authenticated;
grant select on public.en_pedidos_pagos to service_role;


-- =====================================================================
-- CONFERIR (só leitura)
-- =====================================================================
-- A opção security_invoker tem de aparecer:
--   select relname, reloptions from pg_class where relname = 'en_pedidos_pagos';
-- Hoje, vazia:
--   select count(*) from public.en_pedidos_pagos;   -- 0
--
-- =====================================================================
-- DESFAZER (só se for preciso; antes, o DESFAZER de 03, 04, 05, 09 e 11,
-- cujas funções leem esta visão)
-- =====================================================================
-- drop view if exists public.en_pedidos_pagos;
