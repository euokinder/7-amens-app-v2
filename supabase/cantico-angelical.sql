-- CÂNTICO ANGELICAL (upsell_02) — o que o banco precisa para o "Concluí
-- este dia" funcionar. Escrito em 24/09/2026.
-- ⏳ AINDA NÃO APLICADO em banco nenhum: nem na produção, nem no teste.
--
-- ORDEM DE PUBLICAÇÃO (não inverter):
--   1. este arquivo, no banco (SQL Editor do Supabase);
--   2. a member-api, que passa a aceitar as chaves "cantico:0" a "cantico:7"
--      e avisa a tela pelo campo `jornadas`;
--   3. o site.
-- Se a função subir antes deste arquivo, o "Concluí este dia" do Cântico dá
-- erro na tela da cliente: a função aceita a chave e o banco recusa.
-- Já o site pode subir antes dos dois: sem o campo `jornadas`, o botão do
-- Cântico simplesmente não aparece (js/member.js).
--
-- Pode rodar mais de uma vez: cada parte desfaz e refaz a mesma coisa.

begin;

-- 1. A trava das chaves de progresso passa a aceitar os dias do Cântico.
--    O nome da trava é o que está NO BANCO, conferido na produção em
--    24/09/2026 (a lição de 21/09: nome errado aqui faz o drop não achar
--    nada, e a trava velha continua de pé ao lado da nova).
alter table public.prayer_progress drop constraint if exists prayer_progress_prayer_key_check;
alter table public.prayer_progress add constraint prayer_progress_prayer_key_check
  check (prayer_key ~ '^(principal:[0-7]|desatadora:[1-9]|cantico:[0-7])$');

-- 2. O número "Orações" do painel continua contando só ORAÇÕES: as 7
--    madrugadas e a Novena Desatadora. O "Concluí este dia" do Cântico existe
--    só para a cliente se achar na jornada (Caio, 24/09/2026: "ele não muda
--    nada pra gente aqui"). Sem este filtro, cada dia marcado no Cântico
--    inflaria o contador e os filtros de orações do painel.
--
--    A definição abaixo é a da produção, conferida com pg_get_viewdef em
--    24/09/2026. A ÚNICA mudança é a última condição do bloco `prayers`.
--
--    ⚠️ `with (security_invoker = true)` é obrigatório: é a opção que a
--    visão tem na produção, e um create or replace SEM ela apagaria a opção
--    em silêncio. (A receita schema-completo.sql tinha perdido essa opção —
--    corrigida no mesmo dia.)
--    ⚠️ Se a visão tiver mudado depois de 24/09, NÃO rode esta parte sem
--    refazer a conferência: create or replace por cima de uma versão mais
--    nova apagaria o que ela ganhou.
create or replace view public.admin_customer_overview with (security_invoker = true) as
 select customer.id,
    customer.name,
    customer.email,
    customer.created_at,
    coalesce(products.active_products, '{}'::text[]) as active_products,
        case
            when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'::text, 'upsell_02'::text, 'upsell_03'::text] then 'funil_completo'::text
            when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'::text, 'upsell_02'::text] then 'up01_e_up02'::text
            when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'::text] then 'somente_up01'::text
            when coalesce(products.active_products, '{}'::text[]) @> array['principal'::text] then 'somente_front'::text
            else 'sem_acesso_ativo'::text
        end as funnel_stage,
    coalesce(visits.distinct_visit_days, 0) as distinct_visit_days,
    visits.last_visit_on,
    coalesce(prayers.completed_prayers, 0) as completed_prayers,
    response.completed_at as profile_completed_at,
    response.motherhood_status,
    response.relationship_status,
    response.church_frequency,
    response.primary_prayer_recipient,
    response.primary_intention,
    response.favorite_devotion
   from public.customers customer
     left join lateral ( select array_agg(entitlement.product_key order by entitlement.product_key) as active_products
           from public.entitlements entitlement
          where entitlement.customer_id = customer.id and entitlement.status = 'active'::text) products on true
     left join lateral ( select count(*)::integer as distinct_visit_days,
            max(visit.visited_on) as last_visit_on
           from public.member_visit_days visit
          where visit.customer_id = customer.id) visits on true
     left join lateral ( select count(*)::integer as completed_prayers
           from public.prayer_progress progress
          where progress.customer_id = customer.id and progress.completed and progress.prayer_key !~ '^cantico:'::text) prayers on true
     left join public.member_survey_responses response on response.customer_id = customer.id and response.survey_key = 'member_profile_v1'::text;

commit;

-- CONFERÊNCIA depois de rodar (só leitura). As três respostas têm de vir
-- verdadeiras:
--
-- select
--   (select pg_get_constraintdef(oid) from pg_constraint where conname = 'prayer_progress_prayer_key_check') ~ 'cantico' as trava_aceita_cantico,
--   pg_get_viewdef('public.admin_customer_overview'::regclass, true) ~ 'cantico' as visao_ignora_cantico,
--   (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.admin_customer_overview'::regclass) as visao_segura;
