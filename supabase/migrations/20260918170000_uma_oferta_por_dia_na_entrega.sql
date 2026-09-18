-- Defeito encontrado validando em producao, com as campanhas ja ligadas.
--
-- A regra de "uma oferta de entrada por dia" existia so na hora de RESERVAR a
-- campanha, nunca na hora de ENTREGAR. Duas consequencias:
--
--   1. Uma campanha reservada e nunca exibida nao bloqueava a reserva da
--      seguinte, porque a checagem olhava shown_at e nao a reserva. Deu para
--      ver na pratica: uma conta reservou as duas campanhas em 30 segundos.
--   2. Com as duas reservadas, a consulta de entrega devolvia a segunda no
--      mesmo dia em que a primeira foi exibida, porque ela nao checava o dia.
--
-- Juntas, as duas fariam a cliente levar os dois pop-ups na mesma visita.
-- Para mulheres 45+ isso nao e insistencia, e maltrato.
--
-- A checagem sobe para o inicio da funcao e vale para os dois momentos.
create or replace function public.claim_member_offer(p_customer_id uuid, p_trigger_type text default 'entry', p_source_campaign_key text default null)
returns table(campaign_key text, headline text, body text, cta_label text, target_url text, offer_type text, eyebrow text, dismiss_label text)
language plpgsql set search_path to ''
as $function$
declare active_products text[];
declare principal_source text;
declare exibiu_hoje boolean;
begin
 if p_trigger_type not in ('entry','dismissal') then
   return;
 end if;

 select coalesce(array_agg(entitlement.product_key), '{}'::text[])
 into active_products
 from public.entitlements entitlement
 where entitlement.customer_id = p_customer_id and entitlement.status = 'active';

 select entitlement.source into principal_source
 from public.entitlements entitlement
 where entitlement.customer_id = p_customer_id
   and entitlement.product_key = 'principal'
   and entitlement.status = 'active'
 limit 1;

 select exists (
   select 1
   from public.member_offer_events recent
   join public.member_offer_campaigns other on other.key = recent.campaign_key
   where recent.customer_id = p_customer_id
     and other.trigger_type = 'entry'
     and recent.shown_at is not null
     and (recent.shown_at at time zone 'America/Sao_Paulo')::date
         = (now() at time zone 'America/Sao_Paulo')::date
 ) into exibiu_hoje;

 if p_trigger_type = 'entry' and exibiu_hoje then
   return;
 end if;

 insert into public.member_offer_events(customer_id, campaign_key)
 select p_customer_id, campaign.key
 from public.member_offer_campaigns campaign
 where campaign.enabled
   and campaign.target_url is not null
   and campaign.trigger_type = p_trigger_type
   and (
     (p_source_campaign_key is null and campaign.source_campaign_key is null)
     or campaign.source_campaign_key = p_source_campaign_key
   )
   and campaign.required_product_keys <@ active_products
   and not (campaign.excluded_product_keys && active_products)
   and (
     cardinality(campaign.required_principal_sources) = 0
     or principal_source = any(campaign.required_principal_sources)
   )
   and not exists (
     select 1 from public.member_offer_events seen
     where seen.customer_id = p_customer_id and seen.campaign_key = campaign.key
   )
 order by campaign.sort_order, campaign.key
 limit 1
 on conflict do nothing;

 return query
 select campaign.key, campaign.headline, campaign.body, campaign.cta_label,
        campaign.target_url, campaign.offer_type, campaign.eyebrow, campaign.dismiss_label
 from public.member_offer_events event
 join public.member_offer_campaigns campaign on campaign.key = event.campaign_key
 where event.customer_id = p_customer_id
   and event.shown_at is null
   and event.converted_at is null
   and campaign.enabled
   and campaign.target_url is not null
   and campaign.trigger_type = p_trigger_type
   and (
     (p_source_campaign_key is null and campaign.source_campaign_key is null)
     or campaign.source_campaign_key = p_source_campaign_key
   )
   and campaign.required_product_keys <@ active_products
   and not (campaign.excluded_product_keys && active_products)
   and (
     cardinality(campaign.required_principal_sources) = 0
     or principal_source = any(campaign.required_principal_sources)
   )
 order by event.claimed_at, campaign.sort_order
 limit 1;
end;
$function$;

revoke all on function public.claim_member_offer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_member_offer(uuid, text, text) to service_role;

-- As quatro campanhas do pop-up entraram no ar em 2026-09-18, depois da
-- producao publicada e validada.
update public.member_offer_campaigns set enabled = true, updated_at = now()
 where key in ('front_novas_1','front_novas_2','front_antigas_1','front_antigas_2');
