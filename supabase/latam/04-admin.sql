-- =====================================================================
-- App em espanhol (7 Amenes de la Madrugada) - o painel administrativo
-- =====================================================================
-- Pedido do Caio em 07/11/2026: um painel só da LATAM (/es-admin), com as
-- mesmas funções do painel do Brasil (admin.html), sem que um interfira no
-- outro. Este arquivo SÓ CRIA coisas latam_: nada do Brasil é alterado.
--
--   latam_admins          quem entra no painel (lista própria da LATAM)
--   latam_admin_actions   o histórico: quem liberou, revogou, corrigiu e-mail
--                         ou mexeu no link de entrada, e quando
--   latam_admin_customers() a lista de clientes com os números de cada uma
--   latam_admin_offers()    os pop-ups, com apareceu / tocou / fechou / comprou
--
-- QUEM É ADMINISTRADORA: as mesmas 4 do Brasil (Caio, 07/11). A carga lê a
-- member_admins do Brasil SÓ para saber os e-mails (nenhum e-mail fica escrito
-- aqui: o repositório é público) e grava em latam_admins. Daqui para frente as
-- duas listas são independentes: mexer numa não muda a outra.
--
-- DEPENDE DE: 01-tabelas.sql, 02-kashpay.sql e 03-popups.sql.
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Caio, no SQL Editor).
-- Pode rodar de novo sem estragar nada.
-- =====================================================================


-- 1. Quem entra no painel.
create table if not exists public.latam_admins (
  customer_id uuid primary key references public.latam_customers(id) on delete cascade,
  created_at timestamptz not null default now()
);


-- 2. O histórico de tudo o que o painel faz.
create table if not exists public.latam_admin_actions (
  id bigint generated always as identity primary key,
  admin_customer_id uuid not null references public.latam_customers(id),
  target_customer_id uuid references public.latam_customers(id) on delete set null,
  target_email text not null default '',
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint latam_admin_actions_action_check check (
    action in ('grant_access','revoke_access','update_email','entry_link','renew_entry_link')
  )
);
create index if not exists latam_admin_actions_target_idx on public.latam_admin_actions (target_customer_id, created_at desc);


-- 3. Ninguém de fora lê nada (como nas outras latam_).
do $trava$
declare t text;
begin
  foreach t in array array['latam_admins','latam_admin_actions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A lista de clientes, uma linha por cliente, com o que o painel mostra.
--    products: o que ela comprou, pelo pedido da KashPay ('principal',
--    'arcangeles', 'desatanudos' = o UP02, que é o Cántico Angelical).
--    unknown_payments: pagamentos sem pedido da KashPay (vendas de antes de
--    06/11, 22:54, quando a KashPay ainda não avisava).
create or replace function public.latam_admin_customers()
returns table(
  id uuid, email text, name text, country text, created_at timestamptz, first_access_on date,
  access_status text, access_source text, expires_at timestamptz,
  visit_days integer, last_visit_on date, days_prayed integer,
  products text[], payments integer, unknown_payments integer, is_admin boolean
)
language sql stable set search_path to ''
as $function$
  with pagos as (
    select w.webhook_id, w.customer_email, k.produtos
    from public.latam_whop_events w
    left join public.latam_kashpay_events k
      on k.event = 'order.paid'
     and k.transaction_id = w.payload #>> '{data,metadata,kashpay_transaction_id}'
    where w.event_type = 'payment.succeeded'
      and w.status = 'processed'
  ), por_email as (
    select pagos.customer_email,
           count(distinct pagos.webhook_id)::integer as payments,
           count(distinct pagos.webhook_id) filter (where pagos.produtos is null or cardinality(pagos.produtos) = 0)::integer as unknown_payments,
           coalesce(array_agg(distinct p) filter (where p is not null), '{}'::text[]) as products
    from pagos
    left join lateral unnest(pagos.produtos) p on true
    group by pagos.customer_email
  )
  select c.id, c.email, c.name, c.country, c.created_at, c.first_access_on,
         a.status, a.source, a.expires_at,
         coalesce(v.dias, 0), v.ultima, coalesce(pr.rezados, 0),
         coalesce(pe.products, '{}'::text[]), coalesce(pe.payments, 0), coalesce(pe.unknown_payments, 0),
         exists (select 1 from public.latam_admins ad where ad.customer_id = c.id)
  from public.latam_customers c
  left join public.latam_access a on a.customer_id = c.id and a.product = 'app'
  left join (
    select customer_id, count(*)::integer as dias, max(visited_on) as ultima
    from public.latam_visit_days group by customer_id
  ) v on v.customer_id = c.id
  left join (
    select customer_id, count(*)::integer as rezados
    from public.latam_progress where day >= 1 group by customer_id
  ) pr on pr.customer_id = c.id
  left join por_email pe on pe.customer_email = c.email
  order by c.created_at desc, c.id desc;
$function$;
revoke all on function public.latam_admin_customers() from public, anon, authenticated;
grant execute on function public.latam_admin_customers() to service_role;


-- 5. Os pop-ups. "Comprou" é o pedido da KashPay que chegou com a etiqueta
--    daquele pop-up (utm_source=app-es, utm_medium=popup e o mesmo
--    utm_campaign / utm_content do endereço da campanha).
create or replace function public.latam_admin_offers()
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
         (select count(distinct k.transaction_id)::integer
            from public.latam_kashpay_events k
           where k.event = 'order.paid'
             and k.utm_source = 'app-es'
             and k.utm_medium = 'popup'
             and k.utm_campaign = substring(c.target_url from 'utm_campaign=([^&]+)')
             and k.utm_content = substring(c.target_url from 'utm_content=([^&]+)'))
  from public.latam_offer_campaigns c
  left join public.latam_offer_events e on e.campaign_key = c.key
  group by c.key
  order by c.sort_order, c.key;
$function$;
revoke all on function public.latam_admin_offers() from public, anon, authenticated;
grant execute on function public.latam_admin_offers() to service_role;


-- 6. As administradoras: as mesmas do Brasil que têm cadastro na LATAM.
insert into public.latam_admins (customer_id)
select lc.id
from public.member_admins ma
join public.customers c on c.id = ma.customer_id
join public.latam_customers lc on lc.email = c.email
on conflict (customer_id) do nothing;


-- =====================================================================
-- CONFERÊNCIA (rodar depois): tem de voltar o número de administradoras
-- =====================================================================
-- select count(*) as administradoras from public.latam_admins;
--
-- NOVA ADMINISTRADORA (ela precisa ter cadastro no app em espanhol):
-- insert into public.latam_admins (customer_id)
-- select id from public.latam_customers where email = '<e-mail dela>'
-- on conflict do nothing;
--
-- DESFAZER (só se for preciso; nada do Brasil)
-- drop function if exists public.latam_admin_offers();
-- drop function if exists public.latam_admin_customers();
-- drop table if exists public.latam_admin_actions, public.latam_admins;
-- =====================================================================
