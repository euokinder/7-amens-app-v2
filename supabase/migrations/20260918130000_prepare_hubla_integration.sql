-- Prepara o banco para a integração com a Hubla.
-- Mantém os nomes de tabela já existentes (customers, prayer_progress, products.key)
-- e adota a lógica da especificação em docs/hubla-integracao-spec.md.
--
-- Acesso continua derivado de entitlements: nunca um booleano separado.
--
-- Atenção: só o produto principal é pagamento único e vitalício.
-- Os três addons são assinatura e o acesso pode ser perdido e recuperado.

-- 1. Catálogo: tipo de acesso e forma de cobrança ------------------------------

alter table public.products
 add column if not exists type text not null default 'addon',
 add column if not exists billing_type text not null default 'one_time';

alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check
 check (type in ('main', 'addon'));

alter table public.products drop constraint if exists products_billing_type_check;
alter table public.products add constraint products_billing_type_check
 check (billing_type in ('one_time', 'subscription'));

-- Nomes comerciais reais, substituindo os títulos de rascunho.
update public.products set title = 'Os 7 Améns da Madrugada', type = 'main', billing_type = 'one_time'
 where key = 'principal';
update public.products set title = 'Oração Celestial dos Quatro Arcanjos', type = 'addon', billing_type = 'subscription'
 where key = 'upsell_01';
update public.products set title = 'Músicas dos Anjos', type = 'addon', billing_type = 'subscription'
 where key = 'upsell_02';
update public.products set title = 'Comunidade da Fé', type = 'addon', billing_type = 'subscription'
 where key = 'upsell_03';

-- 2. Mapeamento Hubla -> produto ------------------------------------------------
-- Tabela separada de propósito: a Hubla usa identificadores diferentes para
-- produto, oferta e checkout, e vários deles podem apontar para o mesmo produto
-- nosso. ID desconhecido nunca libera acesso; fica registrado para conferência.

create table if not exists public.hubla_product_map (
 hubla_id text primary key,
 product_key text not null references public.products(key) on delete cascade,
 note text not null default '',
 created_at timestamptz not null default now()
);

create index if not exists hubla_product_map_product_key_idx
 on public.hubla_product_map(product_key);

insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('bniYICXEzykgw1PzEyme', 'principal',  'slug do checkout pay.hub.la — confirmar com o primeiro evento real'),
 ('5pUr8toveL5R5zR3zyaT', 'upsell_01',  'slug de hub.la/g — confirmar com o primeiro evento real'),
 ('gTLhMYXqRjFeNlyc7FlH', 'upsell_02',  'slug de hub.la/g — confirmar com o primeiro evento real'),
 ('nMyLP4oFcIWiJ77UIbsu', 'upsell_03',  'slug de hub.la/g — confirmar com o primeiro evento real')
on conflict (hubla_id) do nothing;

-- 3. Cliente: identidade externa estável vinda da Hubla ------------------------

alter table public.customers
 add column if not exists hubla_user_id text,
 add column if not exists first_name text not null default '',
 add column if not exists last_name text not null default '',
 add column if not exists phone text not null default '';

create unique index if not exists customers_hubla_user_id_unique
 on public.customers(hubla_user_id)
 where hubla_user_id is not null;

-- 4. Entitlements: origem e proteção contra evento atrasado --------------------

alter table public.entitlements
 add column if not exists hubla_subscription_id text,
 add column if not exists granted_at timestamptz,
 add column if not exists revoked_at timestamptz,
 add column if not exists last_subscription_version integer,
 add column if not exists last_modified_at timestamptz;

update public.entitlements
 set granted_at = coalesce(granted_at, created_at)
 where status = 'active' and granted_at is null;

-- 5. Histórico bruto dos eventos recebidos da Hubla ----------------------------

create table if not exists public.hubla_events (
 id uuid primary key default gen_random_uuid(),
 idempotency_key text not null unique,
 event_type text not null,
 payload_version text,
 sandbox boolean not null default false,
 hubla_user_id text,
 hubla_product_id text,
 subscription_id text,
 invoice_id text,
 entity_version integer,
 payload jsonb not null,
 processing_status text not null default 'received'
   check (processing_status in ('received', 'processed', 'ignored', 'failed', 'needs_reconciliation')),
 error text,
 received_at timestamptz not null default now(),
 processed_at timestamptz
);

create index if not exists hubla_events_type_idx on public.hubla_events(event_type);
create index if not exists hubla_events_user_idx on public.hubla_events(hubla_user_id);
create index if not exists hubla_events_status_idx on public.hubla_events(processing_status);
create index if not exists hubla_events_received_idx on public.hubla_events(received_at desc);

-- 6. RLS no mesmo padrão do resto do banco: só service_role ---------------------

do $$
declare t text;
begin
 foreach t in array array['hubla_events','hubla_product_map'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('revoke all on table public.%I from anon, authenticated', t);
 execute format('grant all on table public.%I to service_role', t);
 execute format('drop policy if exists backend_only on public.%I', t);
 execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
 end loop;
end;
$$;

-- 7. Documentação no próprio banco ---------------------------------------------

comment on column public.products.type is 'main libera o aplicativo inteiro; addon libera apenas o próprio conteúdo.';
comment on column public.products.billing_type is 'one_time é vitalício enquanto não houver revogação; subscription pode ser perdido quando a assinatura encerra.';
comment on table public.hubla_product_map is 'Traduz identificadores da Hubla (produto, oferta ou checkout) para products.key. ID desconhecido nunca libera acesso.';
comment on column public.customers.hubla_user_id is 'Identificador estável do comprador na Hubla. O e-mail continua sendo o login da cliente.';
comment on column public.entitlements.last_subscription_version is 'Versão da assinatura no último evento aplicado. Evita que evento atrasado sobrescreva estado mais novo.';
comment on table public.hubla_events is 'Histórico bruto dos webhooks da Hubla. idempotency_key vem do header x-hubla-idempotency e impede processar o mesmo evento duas vezes.';
