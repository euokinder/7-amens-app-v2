-- =====================================================================
-- MÉTRICAS DO FUNIL NO PAINEL — 7 Améns da Madrugada
-- =====================================================================
--
-- O QUE ESTE ARQUIVO RESOLVE
-- O painel já mostra quantas clientes viram o pop-up, quantas clicaram e
-- quantas compraram. A última coluna sempre leu ZERO — não porque
-- ninguém comprou, mas porque nada no sistema escrevia nela. O campo
-- `converted_at` foi criado e nunca ligado.
--
-- Em 19/09/2026 o painel mostrava 250 cliques e 0 compras. A conta real,
-- medida pela etiqueta que o pop-up carrega até o checkout: 176 cliques
-- desde que o rastreamento subiu, e 2 vendas. Pouco — mas não zero, e a
-- diferença entre "pouco" e "nada" muda o que se decide fazer.
--
-- O QUE ELE FAZ, EM TRÊS PARTES
--   1. Ensina a campanha a dizer QUAL produto ela vende. Sem isso o
--      sistema não tem como saber que uma compra veio daquele pop-up.
--   2. Recupera o que já aconteceu: marca como convertida a venda que
--      chegou com a ETIQUETA do pop-up. Não basta ter clicado — ver o
--      porquê na Parte 2.
--   3. Cria a visão que separa Pix de cartão. Ela lê os eventos da Hubla
--      que já estão guardados, então funciona para trás também.
--
-- ⚠️ ONDE RODAR
-- Este arquivo MUDA A ESTRUTURA do banco. Ele é seguro (todo comando é
-- "se não existir" ou "atualiza o que já está lá") e não apaga nada, mas
-- precisa da autorização do Caio antes de tocar na produção.
-- Ordem recomendada: rodar no banco de TESTE, conferir, depois produção.
--
-- ⚠️ A FUNÇÃO hubla-webhook DEPENDE DA PARTE 1.
-- Se o código novo subir antes deste arquivo rodar, nada quebra: a
-- marcação de conversão é protegida e falha em silêncio, sem afetar a
-- liberação de acesso de ninguém. Só a coluna continua zerada.
-- =====================================================================


-- =====================================================================
-- PARTE 1 — a campanha passa a dizer qual produto ela vende
-- =====================================================================

-- Sem esta coluna, o sistema vê "a cliente clicou num pop-up" e "a
-- cliente comprou o UP01" como dois fatos soltos, sem ligação. Ela é o
-- fio que costura um no outro.
alter table public.member_offer_campaigns
  add column if not exists offered_product_key text
  references public.products(key) on delete set null;

comment on column public.member_offer_campaigns.offered_product_key is
  'Qual produto esta campanha vende. É o que permite marcar converted_at quando a compra acontece.';

-- Hoje as quatro campanhas ligadas vendem a mesma coisa: a Oração
-- Celestial dos Quatro Arcanjos. Elas se diferenciam pelo público
-- (cliente nova x base antiga) e pela vez (primeira x segunda exibição),
-- não pelo produto.
update public.member_offer_campaigns
   set offered_product_key = 'upsell_01'
 where key in ('front_novas_1', 'front_novas_2', 'front_antigas_1', 'front_antigas_2')
   and offered_product_key is distinct from 'upsell_01';


-- =====================================================================
-- PARTE 2 — recuperar as conversões que já aconteceram
-- =====================================================================

-- ⚠️ POR QUE "CLICOU E HOJE TEM O PRODUTO" NÃO SERVE COMO PROVA
--
-- Os Quatro Arcanjos são vendidos em DOIS lugares que caem no MESMO
-- checkout: o upsell do funil do anúncio (minutos depois da compra
-- principal) e este pop-up dentro do app. A cliente que comprou o front,
-- abriu o app, clicou no pop-up e só depois fechou a compra pelo funil
-- pareceria conversão do pop-up sem ter sido.
--
-- Conferido nos eventos reais em 19/09: o critério "clicou e hoje tem"
-- daria 10 conversões. As vendas com etiqueta de pop-up eram 2.
-- Cinco vezes mais do que a realidade.
--
-- A prova de verdade é a etiqueta que viaja do pop-up até o checkout e
-- volta dentro do evento da Hubla (utm.medium = 'popup'), publicada em
-- 19/09 às 00:59. Vendas anteriores a isso não têm como ser atribuídas a
-- lugar nenhum, e ficam de fora de propósito.
with venda_pelo_popup as (
  select lower(event.payload->'event'->'user'->>'email') as email,
         event.payload->'event'->'subscription'->'firstPaymentSession'->'utm'->>'content' as etiqueta,
         map.product_key,
         event.received_at
    from public.hubla_events as event
    join public.hubla_product_map as map
      on map.hubla_id = event.payload->'event'->'product'->>'id'
   where event.event_type = 'customer.member_added'
     and event.sandbox = false
     and event.payload->'event'->'subscription'->'firstPaymentSession'->'utm'->>'medium' = 'popup'
     and event.payload->'event'->'subscription'->'firstPaymentSession'->'utm'->>'content' is not null
)
update public.member_offer_events as event
   set converted_at = venda.received_at
  from public.member_offer_campaigns as campaign,
       public.customers as customer,
       venda_pelo_popup as venda
 where event.campaign_key = campaign.key
   and customer.id = event.customer_id
   and customer.email = venda.email
   and campaign.offered_product_key = venda.product_key
   -- A etiqueta diz QUAL pop-up vendeu, não só que foi um pop-up: sem isto,
   -- quem viu a 1ª e a 2ª exibição ganharia conversão nas duas.
   and campaign.target_url like '%utm_content=' || venda.etiqueta || '%'
   and event.clicked_at is not null
   and event.converted_at is null;


-- =====================================================================
-- PARTE 3 — a visão que separa Pix de cartão
-- =====================================================================

-- POR QUE ISTO É UMA VISÃO E NÃO UMA COLUNA NOVA
-- A forma de pagamento não chega no evento que libera o acesso
-- (customer.member_added). Ela vem no evento da fatura
-- (invoice.status_updated), que o sistema guarda inteiro para auditoria.
-- Como o texto completo de todos os eventos está no banco, dá para
-- extrair a informação sem pedir nada novo à Hubla e sem perder o
-- passado. No volume atual (~1.100 eventos) isso é instantâneo.
--
-- ⚠️ LIMITE HONESTO: só enxerga vendas que passaram pelo webhook. A base
-- histórica importada e as liberações feitas na mão não têm evento, logo
-- não têm forma de pagamento. O painel precisa dizer isso na tela.
create or replace view public.admin_payment_overview as
with fatura_do_front as (
  -- A primeira fatura PAGA do produto principal de cada pessoa. O
  -- "distinct on" existe porque a Hubla manda várias atualizações da
  -- mesma fatura (não paga → paga) e todas ficam guardadas.
  select distinct on (event.payload->'event'->'user'->>'id')
         event.payload->'event'->'user'->>'id' as hubla_user_id,
         event.payload->'event'->'invoice'->>'paymentMethod' as payment_method
    from public.hubla_events as event
    join public.hubla_product_map as map
      on map.hubla_id = event.payload->'event'->'product'->>'id'
   where event.event_type = 'invoice.status_updated'
     and event.payload->'event'->'invoice'->>'status' = 'paid'
     and map.product_key = 'principal'
     and event.sandbox = false
   order by event.payload->'event'->'user'->>'id', event.received_at
),
comprou_o_upsell as (
  select distinct customer.hubla_user_id
    from public.entitlements as entitlement
    join public.customers as customer on customer.id = entitlement.customer_id
   where entitlement.product_key = 'upsell_01'
     and customer.hubla_user_id is not null
)
select fatura.payment_method,
       count(*)::integer as front_buyers,
       count(upsell.hubla_user_id)::integer as upsell_buyers
  from fatura_do_front as fatura
  left join comprou_o_upsell as upsell
    on upsell.hubla_user_id = fatura.hubla_user_id
 where fatura.payment_method is not null
 group by fatura.payment_method;

comment on view public.admin_payment_overview is
  'Conversão do upsell separada por forma de pagamento do front. Só cobre vendas que passaram pelo webhook.';

-- A visão é lida pela member-api com a chave de serviço, igual às outras
-- duas do painel. Nenhum acesso novo é concedido a anon/authenticated.
revoke all on public.admin_payment_overview from anon, authenticated;


-- =====================================================================
-- CONFERÊNCIA — rode depois para ver se ficou de pé
-- =====================================================================
-- select key, offered_product_key from public.member_offer_campaigns order by sort_order;
-- select campaign_key, count(*) filter (where clicked_at is not null) as clicaram,
--        count(*) filter (where converted_at is not null) as compraram
--   from public.member_offer_events group by campaign_key order by 1;
-- select * from public.admin_payment_overview;
