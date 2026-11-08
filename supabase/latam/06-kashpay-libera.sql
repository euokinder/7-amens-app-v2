-- =====================================================================
-- 06-kashpay-libera.sql — o aviso da KashPay passa a LIBERAR o app (08/11/2026)
-- =====================================================================
-- Por quê: a KashPay é o checkout, e quem processa o pagamento é a Whop OU a
-- Digistore24 (a venda fica dividida entre as duas, de propósito). Até aqui só
-- a Whop liberava o app sozinha (latam-whop). A venda processada pela
-- Digistore24 ficava do lado de fora. Decisão do Caio (08/11): toda liberação
-- passa a ser feita pelo aviso da KashPay, que está na frente de toda venda.
--
-- O que muda (só tabelas latam_; o Brasil não sente nada):
--   1. latam_kashpay_events ganha customer_id (o número da cliente, nunca o
--      e-mail). A latam-kashpay nova preenche nos pedidos pagos que libera.
--   2. latam_access aceita a origem 'kashpay' e guarda o pedido que liberou
--      (kashpay_transaction_id).
--   3. latam_pedidos_pagos: UMA visão com tudo o que ela pagou. Junta o
--      pagamento da Whop (com o pedido da KashPay, quando houver) e o pedido
--      da KashPay SEM pagamento da Whop (o da Digistore24). O pedido pago pela
--      Whop entra uma vez só, pelo lado da Whop.
--   4. As três funções que diziam "o que ela comprou" (latam_extras,
--      latam_claim_offer e latam_admin_customers) passam a ler a visão. Fora
--      a leitura das compras, o corpo delas é o mesmo de 05-extras.sql,
--      03-popups.sql e 04-admin.sql (conferido contra a produção em 08/11).
--      Para quem só tem compra pela Whop, a resposta é a mesma de antes.
--
-- ORDEM DE PUBLICAR: este SQL ANTES da latam-kashpay nova. Ao contrário, todo
-- pedido pago daria erro (a coluna customer_id e a origem 'kashpay' ainda
-- não existiriam), a KashPay repetiria 3 vezes e desistiria. Este SQL sozinho
-- é inofensivo: a latam-kashpay de antes não usa nada do que ele cria.
--
-- Pode rodar mais de uma vez. Não mexe em nenhuma linha que já existe.
-- =====================================================================

begin;

-- 1. O pedido da KashPay ganha a cliente.
alter table public.latam_kashpay_events
  add column if not exists customer_id uuid references public.latam_customers(id) on delete set null;
create index if not exists latam_kashpay_events_customer_id_idx
  on public.latam_kashpay_events (customer_id) where customer_id is not null;

-- 2. O acesso aceita a origem 'kashpay' e guarda o pedido que liberou.
alter table public.latam_access drop constraint if exists latam_access_source_check;
alter table public.latam_access add constraint latam_access_source_check
  check (source in ('whop','import','manual','kashpay'));
alter table public.latam_access add column if not exists kashpay_transaction_id text;

-- 3. Tudo o que ela pagou, numa visão só.
--    registro = uma linha de aviso (o painel conta "pagamentos" por aqui);
--    pedido   = um pedido (os extras olham por aqui);
--    produtos = principal | arcangeles | desatanudos (= o Cántico), ou nulo
--               quando o pagamento da Whop não tem pedido da KashPay (vendas
--               de antes de 06/11, 22:54).
-- O índice abaixo é o que deixa barato o "não tem pagamento da Whop".
create index if not exists latam_whop_events_kashpay_tx_idx
  on public.latam_whop_events ((payload #>> '{data,metadata,kashpay_transaction_id}'));

create or replace view public.latam_pedidos_pagos with (security_invoker = true) as
  select w.webhook_id as registro,
         coalesce(w.payment_id, w.webhook_id) as pedido,
         w.customer_email as email,
         k.produtos,
         'whop'::text as origem
  from public.latam_whop_events w
  left join public.latam_kashpay_events k
    on k.event = 'order.paid'
   and k.transaction_id = w.payload #>> '{data,metadata,kashpay_transaction_id}'
  where w.event_type = 'payment.succeeded'
    and w.status = 'processed'
  union all
  select 'kashpay:' || k.transaction_id,
         'kashpay:' || k.transaction_id,
         c.email,
         k.produtos,
         'kashpay'::text
  from public.latam_kashpay_events k
  join public.latam_customers c on c.id = k.customer_id
  where k.event = 'order.paid'
    and cardinality(k.produtos) > 0
    and not exists (
      select 1 from public.latam_whop_events w
      where w.event_type = 'payment.succeeded'
        and w.status = 'processed'
        and w.payload #>> '{data,metadata,kashpay_transaction_id}' = k.transaction_id
    );
revoke all on public.latam_pedidos_pagos from public, anon, authenticated;
grant select on public.latam_pedidos_pagos to service_role;


-- 4a. Os extras dentro do app (de 05-extras.sql; só a leitura das compras mudou).
create or replace function public.latam_extras(p_customer_id uuid)
returns jsonb
language plpgsql stable set search_path to ''
as $function$
declare
  v_email text;
  v_owned text[];
  v_unknown integer;
  v_origem jsonb := '{}'::jsonb;
  r record;
begin
  select c.email into v_email from public.latam_customers c where c.id = p_customer_id;
  if v_email is null then return null; end if;

  -- O que ela comprou, pedido por pedido (um por pagamento da Whop).
  with pagos as (
    select distinct on (p.pedido) p.produtos
    from public.latam_pedidos_pagos p
    where p.email = v_email
    order by p.pedido, (p.produtos is null)
  )
  select coalesce((select array_agg(distinct p) from pagos, unnest(pagos.produtos) p), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  if 'arcangeles' = any(v_owned) then v_origem := v_origem || '{"arcangeles":"compra"}'; end if;
  if 'desatanudos' = any(v_owned) or 'cantico' = any(v_owned) then v_origem := v_origem || '{"cantico":"compra"}'; end if;

  -- A dúvida: sobra um pagamento sem pedido que não é a compra do app.
  if v_unknown - (case when 'principal' = any(v_owned) then 0 else 1 end) >= 1 then
    if not v_origem ? 'arcangeles' then v_origem := v_origem || '{"arcangeles":"duvida"}'; end if;
    if not v_origem ? 'cantico' then v_origem := v_origem || '{"cantico":"duvida"}'; end if;
  end if;

  -- O painel manda por cima.
  for r in
    select a.product, a.status from public.latam_access a
    where a.customer_id = p_customer_id and a.product in ('arcangeles','cantico')
  loop
    if r.status = 'active' then
      if not v_origem ? r.product then v_origem := v_origem || jsonb_build_object(r.product, 'manual'); end if;
    else
      v_origem := v_origem || jsonb_build_object(r.product, 'retirado');
    end if;
  end loop;

  return jsonb_build_object(
    'extras', coalesce((select jsonb_agg(k order by k) from jsonb_each_text(v_origem) e(k, v) where v <> 'retirado'), '[]'::jsonb),
    'origem', v_origem,
    'cantico_hechos', coalesce((select jsonb_agg(p.day order by p.day) from public.latam_cantico_progress p where p.customer_id = p_customer_id), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.latam_extras(uuid) from public, anon, authenticated;
grant execute on function public.latam_extras(uuid) to service_role;


-- 4b. A fila de pop-ups (de 03-popups.sql; só a leitura das compras mudou).
create or replace function public.latam_claim_offer(p_customer_id uuid, p_zone text)
returns table(campaign_key text, eyebrow text, headline text, body text, cta_label text, dismiss_label text, target_url text, offer_type text)
language plpgsql set search_path to ''
as $function$
#variable_conflict use_column
declare
  v_email text;
  v_first date;
  v_today date;
  v_day integer;
  v_source text;
  v_owned text[];
  v_unknown integer;
begin
  select c.email, c.first_access_on into v_email, v_first
  from public.latam_customers c where c.id = p_customer_id;
  if v_email is null then return; end if;

  v_today := (now() at time zone p_zone)::date;
  -- Sem primeiro acesso gravado, hoje é o primeiro acesso (como a jornada).
  v_first := coalesce(v_first, v_today);
  v_day := (v_today - v_first) + 1;

  -- Carga manual de antes do webhook: não se sabe o que ela comprou.
  select a.source into v_source
  from public.latam_access a where a.customer_id = p_customer_id and a.product = 'app';
  if v_source = 'import' then return; end if;

  -- O que ela comprou, pedido por pedido.
  with pagos as (
    select p.produtos
    from public.latam_pedidos_pagos p
    where p.email = v_email
  )
  select coalesce((select array_agg(distinct p) from pagos, unnest(pagos.produtos) p), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  -- Na dúvida, nada (ver o cabeçalho).
  if not (v_unknown = 0 or (v_unknown = 1 and not ('principal' = any(v_owned)))) then
    return;
  end if;

  -- Já apareceu um pop-up hoje, no dia dela? Então hoje não aparece outro.
  if exists (
    select 1 from public.latam_offer_events e
    where e.customer_id = p_customer_id
      and e.shown_at is not null
      and (e.shown_at at time zone p_zone)::date = v_today
  ) then
    return;
  end if;

  insert into public.latam_offer_events(customer_id, campaign_key)
  select p_customer_id, c.key
  from public.latam_offer_campaigns c
  where c.enabled
    and c.target_url is not null
    and not (c.excluded_products && v_owned)
    and (c.min_journey_day is null or v_day >= c.min_journey_day)
    and (c.first_access_from is null or v_first >= c.first_access_from)
    and (c.first_access_before is null or v_first < c.first_access_before)
    and not exists (
      select 1 from public.latam_offer_events s
      where s.customer_id = p_customer_id and s.campaign_key = c.key
    )
  order by c.sort_order, c.key
  limit 1
  on conflict do nothing;

  return query
  select c.key, c.eyebrow, c.headline, c.body, c.cta_label, c.dismiss_label, c.target_url, c.offer_type
  from public.latam_offer_events e
  join public.latam_offer_campaigns c on c.key = e.campaign_key
  where e.customer_id = p_customer_id
    and e.shown_at is null
    and e.clicked_at is null
    and c.enabled
    and c.target_url is not null
    and not (c.excluded_products && v_owned)
    and (c.min_journey_day is null or v_day >= c.min_journey_day)
    and (c.first_access_from is null or v_first >= c.first_access_from)
    and (c.first_access_before is null or v_first < c.first_access_before)
  order by e.claimed_at, c.sort_order
  limit 1;
end;
$function$;
revoke all on function public.latam_claim_offer(uuid, text) from public, anon, authenticated;
grant execute on function public.latam_claim_offer(uuid, text) to service_role;


-- 4c. A lista de clientes do painel (de 04-admin.sql; só a leitura das compras mudou).
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
    select p.registro as webhook_id, p.email as customer_email, p.produtos
    from public.latam_pedidos_pagos p
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

commit;


-- =====================================================================
-- CONFERIR (só leitura, leve)
-- =====================================================================
-- A coluna, a origem e a visão:
--   select column_name from information_schema.columns
--    where table_name = 'latam_kashpay_events' and column_name = 'customer_id';
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'latam_access_source_check';
--   select origem, count(*) from public.latam_pedidos_pagos group by origem;
--     (logo depois de rodar: só 'whop'. 'kashpay' aparece com a primeira
--      venda da Digistore24 depois da latam-kashpay nova.)
--
-- Quem foi liberada pela KashPay:
--   select count(*) from public.latam_access where source = 'kashpay';
--
-- Pedido pago do 7 Amenes que não liberou (sem e-mail, por exemplo):
--   select transaction_id, produtos, paid_at, detail from public.latam_kashpay_events
--   where event = 'order.paid' and detail like '%NÃO foi liberado%'
--   order by received_at desc limit 20;


-- =====================================================================
-- DESFAZER (só se precisar; a ordem importa)
-- =====================================================================
-- 1. Voltar a latam-kashpay de antes (commit 4c5f710, ramo
--    claude/latam-kashpay-2fc07a) pelo painel do Supabase.
-- 2. Rodar de novo as três funções como estão em 05-extras.sql,
--    03-popups.sql e 04-admin.sql.
-- 3. drop view if exists public.latam_pedidos_pagos;
--    drop index if exists public.latam_whop_events_kashpay_tx_idx;
-- 4. A coluna customer_id, a coluna kashpay_transaction_id e a origem
--    'kashpay' podem ficar: nada de antes as usa. Para tirar a origem, antes
--    trocar a origem de quem foi liberada por ela:
--    update public.latam_access set source = 'whop' where source = 'kashpay';
