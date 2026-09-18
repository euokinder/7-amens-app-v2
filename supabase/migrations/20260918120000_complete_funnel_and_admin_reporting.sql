alter table public.member_offer_campaigns
 add column trigger_type text not null default 'entry' check (trigger_type in ('entry','dismissal')),
 add column source_campaign_key text references public.member_offer_campaigns(key) on delete set null,
 add column offer_type text not null default 'product' check (offer_type in ('product','subscription','vip')),
 add column eyebrow text not null default 'Uma oportunidade para você',
 add column dismiss_label text not null default 'Agora não';

create index member_offer_campaigns_source_idx on public.member_offer_campaigns(source_campaign_key);

drop function public.claim_member_offer(uuid);
create function public.claim_member_offer(
 p_customer_id uuid,
 p_trigger_type text default 'entry',
 p_source_campaign_key text default null
)
returns table(
 campaign_key text,
 headline text,
 body text,
 cta_label text,
 target_url text,
 offer_type text,
 eyebrow text,
 dismiss_label text
)
language plpgsql security invoker set search_path = ''
as $$
declare active_products text[];
begin
 if p_trigger_type not in ('entry','dismissal') then
   return;
 end if;

 select coalesce(array_agg(entitlement.product_key), '{}'::text[])
 into active_products
 from public.entitlements entitlement
 where entitlement.customer_id = p_customer_id and entitlement.status = 'active';

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
 order by event.claimed_at, campaign.sort_order
 limit 1;
end;
$$;

revoke all on function public.claim_member_offer(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_member_offer(uuid,text,text) to service_role;

update public.member_offer_campaigns
set trigger_type = 'entry', offer_type = 'product',
    eyebrow = 'Uma oportunidade para sua caminhada', dismiss_label = 'Agora não'
where key = 'front_only_to_upsell_01';

insert into public.member_offer_campaigns(
 key, headline, body, cta_label, target_url,
 required_product_keys, excluded_product_keys, enabled, sort_order,
 trigger_type, source_campaign_key, offer_type, eyebrow, dismiss_label
) values
 (
   'upsell_01_to_upsell_02',
   'Uma condição especial para continuar sua jornada',
   'Preparamos uma oferta especial do próximo conteúdo para você avançar ainda mais em sua caminhada.',
   'Conhecer a oferta do Up 02', null,
   array['principal','upsell_01'], array['upsell_02','upsell_03'], false, 20,
   'entry', null, 'product', 'Oferta exclusiva para você', 'Agora não'
 ),
 (
   'upsell_02_dismissal_to_bundle',
   'Antes de ir, queremos fazer uma última condição',
   'Você poderá receber o Up 02 junto com o Up 03 em uma condição especial preparada para este momento.',
   'Ver minha condição especial', null,
   array['principal','upsell_01'], array['upsell_02','upsell_03'], false, 25,
   'dismissal', 'upsell_01_to_upsell_02', 'product', 'Uma última oportunidade', 'Não quero aproveitar'
 ),
 (
   'upsell_01_02_to_upsell_03_subscription',
   'Seu próximo passo pode acompanhar você todos os meses',
   'Como você já avançou em nossa jornada, preparamos uma assinatura mensal acessível e exclusiva para você.',
   'Conhecer minha assinatura', null,
   array['principal','upsell_01','upsell_02'], array['upsell_03'], false, 30,
   'entry', null, 'subscription', 'Condição exclusiva', 'Agora não'
 ),
 (
   'full_funnel_to_vip_whatsapp',
   'Você faz parte das nossas clientes mais especiais',
   'Queremos convidar você para um grupo VIP, onde compartilharemos novidades e condições reservadas.',
   'Entrar no grupo VIP', null,
   array['principal','upsell_01','upsell_02','upsell_03'], '{}'::text[], false, 40,
   'entry', null, 'vip', 'Convite especial', 'Talvez depois'
 );

create table public.member_admins (
 customer_id uuid primary key references public.customers(id) on delete cascade,
 created_at timestamptz not null default now()
);

alter table public.member_admins enable row level security;
revoke all on table public.member_admins from anon, authenticated;
grant all on table public.member_admins to service_role;
create policy backend_only on public.member_admins for all to service_role using (true) with check (true);

create view public.admin_customer_overview
with (security_invoker = true)
as
select
 customer.id,
 customer.name,
 customer.email,
 customer.created_at,
 coalesce(products.active_products, '{}'::text[]) as active_products,
 case
   when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01','upsell_02','upsell_03'] then 'funil_completo'
   when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01','upsell_02'] then 'up01_e_up02'
   when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'] then 'somente_up01'
   when coalesce(products.active_products, '{}'::text[]) @> array['principal'] then 'somente_front'
   else 'sem_acesso_ativo'
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
left join lateral (
 select array_agg(entitlement.product_key order by entitlement.product_key) as active_products
 from public.entitlements entitlement
 where entitlement.customer_id = customer.id and entitlement.status = 'active'
) products on true
left join lateral (
 select count(*)::integer as distinct_visit_days, max(visit.visited_on) as last_visit_on
 from public.member_visit_days visit where visit.customer_id = customer.id
) visits on true
left join lateral (
 select count(*)::integer as completed_prayers
 from public.prayer_progress progress
 where progress.customer_id = customer.id and progress.completed
) prayers on true
left join public.member_survey_responses response
  on response.customer_id = customer.id and response.survey_key = 'member_profile_v1';

create view public.admin_offer_overview
with (security_invoker = true)
as
select
 campaign.key,
 campaign.headline,
 campaign.trigger_type,
 campaign.offer_type,
 campaign.enabled,
 campaign.sort_order,
 count(event.customer_id)::integer as claimed,
 count(event.shown_at)::integer as shown,
 count(event.clicked_at)::integer as clicked,
 count(event.dismissed_at)::integer as dismissed,
 count(event.converted_at)::integer as converted
from public.member_offer_campaigns campaign
left join public.member_offer_events event on event.campaign_key = campaign.key
group by campaign.key, campaign.headline, campaign.trigger_type, campaign.offer_type, campaign.enabled, campaign.sort_order;

revoke all on public.admin_customer_overview from public, anon, authenticated;
revoke all on public.admin_offer_overview from public, anon, authenticated;
grant select on public.admin_customer_overview to service_role;
grant select on public.admin_offer_overview to service_role;

comment on table public.member_admins is 'Lista de clientes autorizados a consultar o painel administrativo de leitura.';
comment on view public.admin_customer_overview is 'Resumo de clientes, acessos, progresso e perfil para o painel administrativo.';
comment on view public.admin_offer_overview is 'Métricas agregadas das campanhas do funil.';
