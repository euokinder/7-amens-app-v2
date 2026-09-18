create table public.member_offer_campaigns (
 key text primary key check (key ~ '^[a-z0-9_-]+$'),
 headline text not null,
 body text not null,
 cta_label text not null default 'Assistir agora',
 target_url text check (target_url is null or target_url ~ '^https://'),
 required_product_keys text[] not null default '{}',
 excluded_product_keys text[] not null default '{}',
 enabled boolean not null default false,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.member_offer_events (
 customer_id uuid not null references public.customers(id) on delete cascade,
 campaign_key text not null references public.member_offer_campaigns(key) on delete cascade,
 claimed_at timestamptz not null default now(),
 shown_at timestamptz,
 clicked_at timestamptz,
 dismissed_at timestamptz,
 converted_at timestamptz,
 primary key (customer_id, campaign_key)
);

create index member_offer_events_campaign_idx on public.member_offer_events(campaign_key);

create function public.claim_member_offer(p_customer_id uuid)
returns table(campaign_key text, headline text, body text, cta_label text, target_url text)
language plpgsql security invoker set search_path = ''
as $$
declare active_products text[];
begin
 select coalesce(array_agg(e.product_key), '{}'::text[])
 into active_products
 from public.entitlements e
 where e.customer_id = p_customer_id and e.status = 'active';

 insert into public.member_offer_events(customer_id, campaign_key)
 select p_customer_id, c.key
 from public.member_offer_campaigns c
 where c.enabled
   and c.target_url is not null
   and c.required_product_keys <@ active_products
   and not (c.excluded_product_keys && active_products)
   and not exists (
     select 1 from public.member_offer_events seen
     where seen.customer_id = p_customer_id and seen.campaign_key = c.key
   )
 order by c.sort_order, c.key
 limit 1
 on conflict do nothing;

 return query
 select c.key, c.headline, c.body, c.cta_label, c.target_url
 from public.member_offer_events event
 join public.member_offer_campaigns c on c.key = event.campaign_key
 where event.customer_id = p_customer_id
   and event.shown_at is null
   and event.converted_at is null
   and c.enabled
   and c.target_url is not null
   and c.required_product_keys <@ active_products
   and not (c.excluded_product_keys && active_products)
 order by event.claimed_at, c.sort_order
 limit 1;
end;
$$;

alter table public.member_offer_campaigns enable row level security;
alter table public.member_offer_events enable row level security;
revoke all on table public.member_offer_campaigns from anon, authenticated;
revoke all on table public.member_offer_events from anon, authenticated;
grant all on table public.member_offer_campaigns to service_role;
grant all on table public.member_offer_events to service_role;
create policy backend_only on public.member_offer_campaigns for all to service_role using (true) with check (true);
create policy backend_only on public.member_offer_events for all to service_role using (true) with check (true);
revoke all on function public.claim_member_offer(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_offer(uuid) to service_role;

insert into public.products(key,title,description,enabled,sort_order)
values
 ('upsell_01','Upsell 01','Oferta seguinte ao produto principal.',false,10),
 ('upsell_02','Upsell 02','Segunda oferta do funil.',false,20),
 ('upsell_03','Upsell 03','Terceira oferta do funil.',false,30)
on conflict (key) do nothing;

insert into public.member_offer_campaigns(key,headline,body,cta_label,required_product_keys,excluded_product_keys,enabled,sort_order)
values (
 'front_only_to_upsell_01',
 'Você ainda não viu esta oportunidade',
 'Assista à apresentação que preparamos para complementar sua jornada.',
 'Assistir ao Up 01',
 array['principal'],
 array['upsell_01','upsell_02','upsell_03'],
 false,
 10
);

comment on table public.member_offer_campaigns is 'Campanhas internas do app. Só ficam elegíveis quando habilitadas e com URL HTTPS configurada.';
comment on table public.member_offer_events is 'Registro servidor de exibição e clique para não repetir ofertas em outro navegador ou aparelho.';

