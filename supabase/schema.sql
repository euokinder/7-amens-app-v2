create table public.customers (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 name text not null default '',
 created_at timestamptz not null default now()
);
create table public.products (
 key text primary key check (key ~ '^[a-z0-9_-]+$'),
 title text not null,
 description text not null default '',
 checkout_url text check (checkout_url is null or checkout_url ~ '^https://'),
 content_url text check (content_url is null or content_url ~ '^https://' or content_url ~ '^[a-z0-9-]+[.]html([?].*)?$'),
 enabled boolean not null default true,
 sort_order integer not null default 0
);
create unique index products_title_unique on public.products(title);
create table public.entitlements (
 customer_id uuid not null references public.customers(id) on delete cascade,
 product_key text not null references public.products(key),
 status text not null default 'active' check (status in ('active', 'refunded', 'revoked')),
 source text not null default 'manual',
 external_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (customer_id, product_key)
);
create index entitlements_product_key_idx on public.entitlements(product_key);
create table public.prayer_progress (
 customer_id uuid not null references public.customers(id) on delete cascade,
 prayer_key text not null check (prayer_key ~ '^(principal:[0-7]|desatadora:[1-9])$'),
 completed boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key (customer_id, prayer_key)
);
create table public.member_sessions (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 customer_id uuid not null references public.customers(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index member_sessions_customer_id_idx on public.member_sessions(customer_id);
create index member_sessions_expires_at_idx on public.member_sessions(expires_at);
create table public.member_login_limits (
 key text primary key,
 window_start timestamptz not null default now(),
 attempts integer not null default 1
);
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
create function public.allow_member_login(bucket_key text) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare count_now integer;
begin
 delete from public.member_login_limits where window_start < now() - interval '1 day';
 delete from public.member_sessions where expires_at < now();
 insert into public.member_login_limits as limits(key, window_start, attempts)
 values (bucket_key, now(), 1)
 on conflict (key) do update set
 attempts = case when limits.window_start < now() - interval '10 minutes' then 1 else limits.attempts + 1 end,
 window_start = case when limits.window_start < now() - interval '10 minutes' then now() else limits.window_start end
 returning attempts into count_now;
 return count_now <= 20;
end;
$$;
revoke all on function public.allow_member_login(text) from public, anon, authenticated;
grant execute on function public.allow_member_login(text) to service_role;
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
revoke all on function public.claim_member_offer(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_offer(uuid) to service_role;
do $$
declare t text;
begin
 foreach t in array array['customers','products','entitlements','prayer_progress','member_sessions','member_login_limits','member_offer_campaigns','member_offer_events'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('revoke all on table public.%I from anon, authenticated', t);
 execute format('grant all on table public.%I to service_role', t);
 execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
 end loop;
end;
$$;
insert into public.products(key,title,description)
values ('principal','7 Améns da Madrugada','Todo o conteúdo atual: 7 Orações Sagradas, Pai Nosso, Mensagem do Dia e Novena Desatadora dos Nós.');
insert into public.products(key,title,description,enabled,sort_order)
values
 ('upsell_01','Upsell 01','Oferta seguinte ao produto principal.',false,10),
 ('upsell_02','Upsell 02','Segunda oferta do funil.',false,20),
 ('upsell_03','Upsell 03','Terceira oferta do funil.',false,30);
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
comment on table public.customers is 'Identificação por e-mail informado, sem comprovação de propriedade, conforme fluxo da V2 de validação.';
comment on table public.entitlements is 'Principal ativo permite entrada. Extras têm liberação independente. Reembolso: mudar status para refunded.';
comment on table public.member_sessions is 'Sessões opacas de 90 dias. Apenas hashes são armazenados; acessos são revalidados a cada consulta.';
comment on table public.member_offer_campaigns is 'Campanhas internas do app. Só ficam elegíveis quando habilitadas e com URL HTTPS configurada.';
comment on table public.member_offer_events is 'Registro servidor de exibição e clique para não repetir ofertas em outro navegador ou aparelho.';

