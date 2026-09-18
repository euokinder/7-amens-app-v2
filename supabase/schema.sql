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
do $$
declare t text;
begin
 foreach t in array array['customers','products','entitlements','prayer_progress','member_sessions','member_login_limits'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('revoke all on table public.%I from anon, authenticated', t);
 execute format('grant all on table public.%I to service_role', t);
 execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
 end loop;
end;
$$;
insert into public.products(key,title,description)
values ('principal','7 Améns da Madrugada','Todo o conteúdo atual: 7 Orações Sagradas, Pai Nosso, Mensagem do Dia e Novena Desatadora dos Nós.');
comment on table public.customers is 'Identificação por e-mail informado, sem comprovação de propriedade, conforme fluxo da V2 de validação.';
comment on table public.entitlements is 'Principal ativo permite entrada. Extras têm liberação independente. Reembolso: mudar status para refunded.';
comment on table public.member_sessions is 'Sessões opacas de 90 dias. Apenas hashes são armazenados; acessos são revalidados a cada consulta.';
