-- =====================================================================
-- App em inglês (7 Amens Before Dawn) - o painel administrativo
-- =====================================================================
-- Cópia de supabase/latam/04-admin.sql: um painel só do app em inglês
-- (/en-admin), com as mesmas funções do painel do Brasil (admin.html), sem
-- que um interfira no outro. Este arquivo SÓ CRIA coisas en_: nada do
-- Brasil nem da LATAM é alterado.
--
--   en_admins            quem entra no painel (lista própria do app em inglês)
--   en_admin_actions     o histórico: quem liberou, revogou, corrigiu e-mail,
--                        mexeu no link de entrada ou num extra, e quando
--   en_admin_customers() a lista de clientes com os números de cada uma
--   en_admin_offers()    os pop-ups, com apareceu / tocou / fechou / comprou
--
-- QUEM É ADMINISTRADORA: ⏳ EUA — decisão do Arthur. No espanhol, foram as
-- mesmas 4 do Brasil (Caio, 07/11), com a conta criada nas tabelas latam_ a
-- partir dos e-mails da member_admins do Brasil (lidos, nunca escritos aqui:
-- o repositório é público). A carga pronta para o inglês está no fim deste
-- arquivo, comentada: só LÊ tabelas do Brasil e só GRAVA em en_.
--
-- DEPENDE DE: 01-tabelas.sql, 02-compras.sql e 03-popups.sql.
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Arthur, no SQL Editor).
-- Pode rodar de novo sem estragar nada.
-- =====================================================================


-- 1. Quem entra no painel.
create table if not exists public.en_admins (
  customer_id uuid primary key references public.en_customers(id) on delete cascade,
  created_at timestamptz not null default now()
);


-- 2. O histórico de tudo o que o painel faz. As ações dos extras
--    (grant_extra e revoke_extra), que no espanhol entraram depois por um
--    alter em 05-extras.sql, aqui já nascem na trava.
create table if not exists public.en_admin_actions (
  id bigint generated always as identity primary key,
  admin_customer_id uuid not null references public.en_customers(id),
  target_customer_id uuid references public.en_customers(id) on delete set null,
  target_email text not null default '',
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint en_admin_actions_action_check check (
    action in ('grant_access','revoke_access','update_email','entry_link','renew_entry_link','grant_extra','revoke_extra')
  )
);
create index if not exists en_admin_actions_target_idx on public.en_admin_actions (target_customer_id, created_at desc);


-- 3. Ninguém de fora lê nada (como nas outras en_).
do $trava$
declare t text;
begin
  foreach t in array array['en_admins','en_admin_actions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A lista de clientes, uma linha por cliente, com o que o painel mostra.
--    products: o que ela comprou ('principal', 'arcangeles', 'cantico'),
--    pela visão en_pedidos_pagos (02-compras.sql; ⏳ EUA: checkout — vazia
--    até o checkout existir).
--    payments: quantas cobranças; unknown_payments: cobranças sem produto
--    registrado.
create or replace function public.en_admin_customers()
returns table(
  id uuid, email text, name text, country text, created_at timestamptz, first_access_on date,
  access_status text, access_source text, expires_at timestamptz,
  visit_days integer, last_visit_on date, days_prayed integer,
  products text[], payments integer, unknown_payments integer, is_admin boolean
)
language sql stable set search_path to ''
as $function$
  with pagos as (
    select c.id as customer_id, p.pedido, p.produtos
    from public.en_pedidos_pagos p
    join public.en_customers c
      on c.id = p.customer_id
      or (p.customer_id is null and c.email = lower(p.email))
  ), por_cliente as (
    select pagos.customer_id,
           count(distinct pagos.pedido)::integer as payments,
           count(distinct pagos.pedido) filter (where pagos.produtos is null or cardinality(pagos.produtos) = 0)::integer as unknown_payments,
           coalesce(array_agg(distinct x) filter (where x is not null), '{}'::text[]) as products
    from pagos
    left join lateral unnest(pagos.produtos) x on true
    group by pagos.customer_id
  )
  select c.id, c.email, c.name, c.country, c.created_at, c.first_access_on,
         a.status, a.source, a.expires_at,
         coalesce(v.dias, 0), v.ultima, coalesce(pr.rezados, 0),
         coalesce(pe.products, '{}'::text[]), coalesce(pe.payments, 0), coalesce(pe.unknown_payments, 0),
         exists (select 1 from public.en_admins ad where ad.customer_id = c.id)
  from public.en_customers c
  left join public.en_access a on a.customer_id = c.id and a.product = 'app'
  left join (
    select customer_id, count(*)::integer as dias, max(visited_on) as ultima
    from public.en_visit_days group by customer_id
  ) v on v.customer_id = c.id
  left join (
    select customer_id, count(*)::integer as rezados
    from public.en_progress where day >= 1 group by customer_id
  ) pr on pr.customer_id = c.id
  left join por_cliente pe on pe.customer_id = c.id
  order by c.created_at desc, c.id desc;
$function$;
revoke all on function public.en_admin_customers() from public, anon, authenticated;
grant execute on function public.en_admin_customers() to service_role;


-- 5. Os pop-ups. "Comprou" é a cobrança que chegou com a etiqueta daquele
--    pop-up (utm_source=app-en, utm_medium=popup e o mesmo utm_campaign /
--    utm_content do endereço da campanha). ⏳ EUA: checkout — fica 0 até o
--    checkout guardar os utm em en_pedidos_pagos.
create or replace function public.en_admin_offers()
returns table(
  key text, enabled boolean, sort_order integer, eyebrow text, headline text,
  min_journey_day integer, offered_product text,
  claimed integer, shown integer, clicked integer, dismissed integer, purchases integer
)
language sql stable set search_path to ''
as $function$
  select c.key, c.enabled, c.sort_order, c.eyebrow, c.headline, c.min_journey_day, c.offered_product,
         count(e.customer_id)::integer,
         count(e.shown_at)::integer,
         count(e.clicked_at)::integer,
         count(e.dismissed_at)::integer,
         (select count(distinct p.pedido)::integer
            from public.en_pedidos_pagos p
           where p.utm_source = 'app-en'
             and p.utm_medium = 'popup'
             and p.utm_campaign = substring(c.target_url from 'utm_campaign=([^&]+)')
             and p.utm_content = substring(c.target_url from 'utm_content=([^&]+)'))
  from public.en_offer_campaigns c
  left join public.en_offer_events e on e.campaign_key = c.key
  group by c.key
  order by c.sort_order, c.key;
$function$;
revoke all on function public.en_admin_offers() from public, anon, authenticated;
grant execute on function public.en_admin_offers() to service_role;


-- =====================================================================
-- CONFERÊNCIA (rodar depois): o número de administradoras
-- =====================================================================
-- select count(*) as administradoras from public.en_admins;
--
-- =====================================================================
-- ⏳ EUA: A CARGA DAS ADMINISTRADORAS (rodar só com o "sim" do Arthur, que
-- decide quem são). Como no espanhol: as administradoras do Brasil ganham
-- conta no app em inglês, acesso sem prazo (liberado à mão) e o painel.
-- Só LÊ member_admins e customers do Brasil; só GRAVA em en_. Nenhum e-mail
-- fica escrito no repositório. Admin nova no Brasil = rodar de novo.
-- =====================================================================
-- insert into public.en_customers (email, name)
-- select c.email, coalesce(c.name, '')
--   from public.member_admins ma join public.customers c on c.id = ma.customer_id
-- on conflict (email) do nothing;
--
-- insert into public.en_access (customer_id, product, status, source, expires_at, note)
-- select ec.id, 'app', 'active', 'manual', null, 'Administradora (carga do painel)'
--   from public.member_admins ma
--   join public.customers c on c.id = ma.customer_id
--   join public.en_customers ec on ec.email = c.email
-- on conflict (customer_id, product) do nothing;
--
-- insert into public.en_admins (customer_id)
-- select ec.id
--   from public.member_admins ma
--   join public.customers c on c.id = ma.customer_id
--   join public.en_customers ec on ec.email = c.email
-- on conflict (customer_id) do nothing;
--
-- NOVA ADMINISTRADORA (ela precisa ter conta no app em inglês):
-- insert into public.en_admins (customer_id)
-- select id from public.en_customers where email = '<e-mail dela>'
-- on conflict do nothing;
--
-- DESFAZER (só se for preciso; nada do Brasil nem da LATAM)
-- drop function if exists public.en_admin_offers();
-- drop function if exists public.en_admin_customers();
-- drop table if exists public.en_admin_actions, public.en_admins;
-- =====================================================================
