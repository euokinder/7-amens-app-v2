-- =====================================================================
-- AS 3 MADRUGADAS — o produto tres_madrugadas (18/10/2026)
-- =====================================================================
-- O que a cliente recebe: três vídeos, um por madrugada, nas páginas
-- tres-madrugadas.html e tres-madrugadas-video.html. É o produto vendido no
-- fim do vídeo do Dia 7 (a oferta emendada, no ar desde 13/10/2026, com o
-- checkout pay.hub.la/JwN1GmUvx8c3GUTCOaHU).
-- Decisões do Caio em 18/10/2026:
--   * só quem comprou vê o card (sem cadeado nem "Adquirir" para as outras);
--   * as três madrugadas ficam sempre abertas;
--   * pagamento ÚNICO: pagou, fica; só reembolso tira.
--
-- ORDEM DE PUBLICAR: qualquer uma. A member-api NÃO muda: ela já manda, em
-- `products`, todo produto ativo da cliente.
--   * Site antes do banco: ninguém tem o produto, o card fica escondido para
--     todas. Nada quebra.
--   * Banco antes do site: as compradoras param de ver o botão de compra no
--     Dia 7 (é o certo), mas só veem o card quando o site subir.
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir", e a parte 3 só
-- pega venda que ainda está esperando.
-- ⛔ Na PRODUÇÃO, quem roda é o Caio, no SQL Editor do Supabase.

-- 1. O produto no catálogo.
-- enabled = false DE PROPÓSITO, como os upsells e a live: ativado, o código
-- antigo do catálogo (a seção member-extras do js/member.js) criaria um
-- segundo card, genérico, no fim da home.
-- sort_order 50, DEPOIS dos upsells e da live: a escada dos extras do painel
-- lê o catálogo nessa ordem (ver js/admin.js).
insert into public.products(key, title, description, enabled, sort_order, type, billing_type, unlocks_app) values
 ('tres_madrugadas', 'As 3 Madrugadas', 'Três madrugadas de oração por uma pessoa, em vídeo. Vendido no fim do vídeo do Dia 7, fora da esteira de upsells.', false, 50, 'addon', 'one_time', false)
on conflict (key) do nothing;

-- 2. O tradutor da Hubla: o código que chega nas vendas.
-- É o código do checkout do Dia 7 e é também o que chega no evento: 33
-- compras reais com ele entre 13/10 e 18/10/2026 (todas caíram em
-- 'needs_reconciliation' com "Produto não mapeado"). Pela lição de 20/09, só
-- o evento real confirma um código, e aqui ele já confirmou.
insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('JwN1GmUvx8c3GUTCOaHU', 'tres_madrugadas', 'As 3 Madrugadas, oferta do fim do video do Dia 7 (pay.hub.la/JwN1GmUvx8c3GUTCOaHU). CONFIRMADO por 33 eventos reais de 13/10 a 18/10/2026.')
on conflict (hubla_id) do nothing;

-- 3. As vendas que chegaram ANTES do produto existir.
-- A Hubla não reenvia, mas cada venda ficou guardada em hubla_events. Aqui
-- ela vira o acesso que o webhook teria dado, com duas diferenças:
--   * acha a cliente pelo e-mail e, se não achar, pela conta da Hubla
--     (hubla_user_id). Em 18/10 uma compradora tinha e-mail diferente do
--     cadastro do app: pelo e-mail, o webhook criaria uma segunda cliente,
--     sem o principal, e ela continuaria sem conseguir abrir;
--   * grava source = 'hubla_import', como a carga da Live, para dar para
--     separar depois quem veio desta carga (o painel mostra "pela Hubla").
-- Quem teve reembolso, estorno ou retirada depois da compra NÃO entra (em
-- 18/10 não havia nenhum caso).
-- A venda liberada passa a 'processed'. Venda sem cliente encontrada fica
-- como está, em 'needs_reconciliation', e aparece na conferência abaixo.
-- ⚠️ Uma das 33 de 18/10 é o evento de TESTE de 13/10 (acesso gratuito dado
-- na Hubla, assinatura do tipo 'free'). Entra também, como o webhook faria.
with compras as (
  select e.id as event_id,
         e.received_at,
         e.hubla_user_id,
         lower(trim(e.payload->'event'->'user'->>'email')) as email,
         nullif(e.payload->'event'->'subscription'->>'id', '') as assinatura
  from public.hubla_events e
  where e.hubla_product_id = 'JwN1GmUvx8c3GUTCOaHU'
    and e.event_type = 'customer.member_added'
    and e.sandbox = false
    and e.processing_status = 'needs_reconciliation'
    and not exists (
      select 1 from public.hubla_events d
      where d.hubla_product_id = e.hubla_product_id
        and d.sandbox = false
        and d.hubla_user_id = e.hubla_user_id
        and (d.event_type = 'customer.member_removed'
             or (d.event_type = 'invoice.status_updated'
                 and d.payload->'event'->'invoice'->>'status' in ('refunded', 'chargeback'))))
),
alvo as (
  select compras.*,
         coalesce(
           (select c.id from public.customers c where c.email = compras.email),
           (select c.id from public.customers c where c.hubla_user_id = compras.hubla_user_id)
         ) as customer_id
  from compras
),
liberadas as (
  insert into public.entitlements(customer_id, product_key, status, source, external_reference, hubla_subscription_id, granted_at, last_modified_at, updated_at)
  select distinct on (customer_id) customer_id, 'tres_madrugadas', 'active', 'hubla_import', assinatura, assinatura, received_at, received_at, now()
  from alvo
  where customer_id is not null
  order by customer_id, received_at
  on conflict (customer_id, product_key) do nothing
  returning customer_id
)
update public.hubla_events e
set processing_status = 'processed', processed_at = now(), error = null
from alvo
where e.id = alvo.event_id and alvo.customer_id is not null;

-- 4. Conferência.
-- (a) o produto e o código:
select key, title, enabled, sort_order, type, billing_type from public.products where key = 'tres_madrugadas';
select hubla_id, product_key from public.hubla_product_map where product_key = 'tres_madrugadas';
-- (b) quantas têm o acesso, por origem (em 18/10: 33, todas 'hubla_import'):
select source, status, count(*) from public.entitlements where product_key = 'tres_madrugadas' group by 1, 2 order by 1, 2;
-- (c) vendas que continuam esperando (em 18/10, o certo era ZERO linhas).
-- Linha que aparecer aqui é reembolso (fica de fora de propósito) ou
-- compradora que não existe no app nem pelo e-mail nem pela conta da Hubla:
-- o suporte acha o e-mail certo dela e libera pelo painel.
-- Provado no banco de TESTE em 18/10/2026 com seis casos (compra normal,
-- compra repetida, e-mail diferente do cadastro, reembolso, compradora
-- desconhecida e evento de sandbox), rodando duas vezes.
select received_at, processing_status, error
from public.hubla_events
where hubla_product_id = 'JwN1GmUvx8c3GUTCOaHU' and event_type = 'customer.member_added' and sandbox = false
  and processing_status <> 'processed'
order by received_at;
