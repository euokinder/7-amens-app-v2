-- =====================================================================
-- App em inglês (7 Amens Before Dawn) - os pop-ups de oferta
-- =====================================================================
-- Cópia traduzida de supabase/latam/03-popups.sql, já com a correção do
-- 12-popup-extras-liberados.sql do espanhol. É a mesma lógica do
-- member_offer_campaigns / claim_member_offer do app brasileiro, em
-- tabelas en_ (o Brasil e a LATAM não são tocados):
--   - só vê quem tem o app e ainda não tem o extra oferecido;
--   - no máximo um pop-up por dia (o "dia" é o do fuso dela);
--   - cada campanha aparece uma vez só (o banco guarda; outro celular não
--     repete);
--   - as campanhas vêm na ordem de sort_order.
--
-- As campanhas, como no Brasil e no espanhol:
--   sort  9  en_cantico_dia_4         Angelic Canticle (UP02), a partir do
--                                      4º dia de app ("cantico_dia_4" do Brasil)
--   sort 10  en_arcangeles_novas_1    The Four Archangels (UP01), 1ª e 2ª vez,
--   sort 11  en_arcangeles_novas_2    quem entrou no app depois deste arquivo
--   sort 12  en_arcangeles_antigas_1  The Four Archangels, 1ª e 2ª vez, quem
--   sort 13  en_arcangeles_antigas_2  já estava rezando antes
--   "antigas" é quem entrou no app antes do dia em que este arquivo roda na
--   produção (first_access_before).
--
-- ⏳ EUA: checkout — AS CINCO NASCEM DESLIGADAS (enabled = false). Elas
-- levam às páginas de venda (/en-offer-canticle e /en-offer-archangels), e
-- essas páginas ainda não têm checkout. Ligar quando o checkout existir:
--   update public.en_offer_campaigns set enabled = true where key like 'en\_%';
--
-- QUEM TEM O QUÊ (o que ela já tem não é oferecido):
--   1. a compra: en_pedidos_pagos (02-compras.sql, vazia até o checkout);
--   2. a dúvida: compra sem produto registrado. Se a única "não sei" pode
--      ser o próprio app, ela não comprou extra nenhum; qualquer outra
--      dúvida, ou cliente da carga manual ('import'), fica SEM pop-up. Na
--      dúvida, não se oferece o que ela pode já ter comprado;
--   3. os extras liberados à mão no painel (en_access 'arcangeles' e
--      'cantico', ativos) também contam como dela. No espanhol isso veio
--      depois (12-popup-extras-liberados.sql), quando o pop-up ofereceu de
--      novo o extra a quem já tinha: aqui já nasce assim.
--
-- DEPENDE DE: 01-tabelas.sql e 02-compras.sql.
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Arthur, no SQL Editor).
-- Pode rodar de novo: tudo é "if not exists", "create or replace" ou
-- "on conflict do nothing".
-- =====================================================================


-- 1. As campanhas. Mesmos campos do Brasil, menos o que o app em inglês
--    não usa. Os produtos: 'principal' (o app), 'arcangeles' (UP01) e
--    'cantico' (UP02). No espanhol, o UP02 se chamava 'desatanudos' por um
--    engano de nome na KashPay; aqui não existe esse engano.
create table if not exists public.en_offer_campaigns (
  key text primary key,
  enabled boolean not null default false,
  sort_order integer not null default 100,
  offer_type text not null default 'product',
  eyebrow text not null default '',       -- duas linhas: a 1ª vira o alerta vermelho
  headline text not null,
  body text not null default '',          -- cada linha vira um parágrafo; a última, em destaque
  cta_label text not null,
  dismiss_label text not null,
  target_url text,                        -- endereço completo (https); sem ele, a campanha não sai
  offered_product text,                   -- o que o pop-up vende (só para a conta)
  excluded_products text[] not null default '{}',  -- quem já tem um destes não vê
  min_journey_day integer,                -- a partir de que dia de app (o 1º acesso é o dia 1)
  first_access_from date,                 -- só quem entrou no app a partir desta data
  first_access_before date,               -- só quem entrou no app antes desta data
  created_at timestamptz not null default now(),
  constraint en_offer_campaigns_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint en_offer_campaigns_url_check check (target_url is null or target_url ~ '^https://'),
  constraint en_offer_campaigns_offered_check check (offered_product is null or offered_product in ('arcangeles','cantico')),
  constraint en_offer_campaigns_excluded_check check (excluded_products <@ array['principal','arcangeles','cantico']::text[])
);


-- 2. O que aconteceu com cada pop-up, por cliente. Uma linha por cliente e
--    campanha: é o que impede de repetir, em qualquer celular.
create table if not exists public.en_offer_events (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  campaign_key text not null references public.en_offer_campaigns(key) on delete cascade,
  claimed_at timestamptz not null default now(),   -- o banco separou para ela
  shown_at timestamptz,                            -- apareceu na tela
  clicked_at timestamptz,                          -- tocou no botão
  dismissed_at timestamptz,                        -- fechou
  primary key (customer_id, campaign_key)
);


-- 3. Ninguém de fora lê nada (como nas outras en_).
do $trava$
declare t text;
begin
  foreach t in array array['en_offer_campaigns','en_offer_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A escolha do pop-up. Cópia do claim_member_offer do Brasil (gatilho
--    'entry'), lendo as tabelas en_. p_zone é o fuso dela, já conferido
--    pela en-api. Separa uma campanha nova (se houver) e devolve a mais
--    antiga que ainda não apareceu.
create or replace function public.en_claim_offer(p_customer_id uuid, p_zone text)
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
  from public.en_customers c where c.id = p_customer_id;
  if v_email is null then return; end if;

  v_today := (now() at time zone p_zone)::date;
  -- Sem primeiro acesso gravado, hoje é o primeiro acesso (como a jornada).
  v_first := coalesce(v_first, v_today);
  v_day := (v_today - v_first) + 1;

  -- Carga manual de antes da função de pagamento: não se sabe o que ela comprou.
  select a.source into v_source
  from public.en_access a where a.customer_id = p_customer_id and a.product = 'app';
  if v_source = 'import' then return; end if;

  -- O que ela comprou, pedido por pedido (02-compras.sql).
  with pagos as (
    select distinct on (p.pedido) p.produtos
    from public.en_pedidos_pagos p
    where p.customer_id = p_customer_id
       or (p.customer_id is null and lower(p.email) = v_email)
    order by p.pedido
  )
  select coalesce((select array_agg(distinct x) from pagos, unnest(pagos.produtos) x), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  -- Na dúvida, nada (ver o cabeçalho).
  if not (v_unknown = 0 or (v_unknown = 1 and not ('principal' = any(v_owned)))) then
    return;
  end if;

  -- Os extras liberados à mão no painel também contam como dela. Extra
  -- retirado no painel não conta.
  select v_owned || coalesce(array_agg(a.product), '{}'::text[])
  into v_owned
  from public.en_access a
  where a.customer_id = p_customer_id
    and a.product in ('arcangeles', 'cantico')
    and a.status = 'active';

  -- Já apareceu um pop-up hoje, no dia dela? Então hoje não aparece outro.
  if exists (
    select 1 from public.en_offer_events e
    where e.customer_id = p_customer_id
      and e.shown_at is not null
      and (e.shown_at at time zone p_zone)::date = v_today
  ) then
    return;
  end if;

  insert into public.en_offer_events(customer_id, campaign_key)
  select p_customer_id, c.key
  from public.en_offer_campaigns c
  where c.enabled
    and c.target_url is not null
    and not (c.excluded_products && v_owned)
    and (c.min_journey_day is null or v_day >= c.min_journey_day)
    and (c.first_access_from is null or v_first >= c.first_access_from)
    and (c.first_access_before is null or v_first < c.first_access_before)
    and not exists (
      select 1 from public.en_offer_events s
      where s.customer_id = p_customer_id and s.campaign_key = c.key
    )
  order by c.sort_order, c.key
  limit 1
  on conflict do nothing;

  return query
  select c.key, c.eyebrow, c.headline, c.body, c.cta_label, c.dismiss_label, c.target_url, c.offer_type
  from public.en_offer_events e
  join public.en_offer_campaigns c on c.key = e.campaign_key
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
revoke all on function public.en_claim_offer(uuid, text) from public, anon, authenticated;
grant execute on function public.en_claim_offer(uuid, text) to service_role;


-- 5. As cinco campanhas, traduzidas das do espanhol (que são as do Brasil).
--    A data de corte entre "novas" e "antigas" é o dia em que este arquivo
--    roda (no fuso de Nova York, o padrão do app).
--    Os endereços levam as mesmas etiquetas do Brasil e do espanhol
--    (utm_campaign e utm_content), com utm_source=app-en.
--    ⏳ EUA: checkout — nascem DESLIGADAS (enabled = false): ver o cabeçalho.
insert into public.en_offer_campaigns
  (key, enabled, sort_order, eyebrow, headline, body, cta_label, dismiss_label, target_url,
   offered_product, excluded_products, min_journey_day, first_access_from, first_access_before)
values
 ('en_cantico_dia_4', false, 9,
  'Angelic Canticle',
  'Give God what weighs most on your heart',
  'The Angelic Canticle is a 7-day journey: one canticle a day, to pray as you listen and bring peace to your heart.
We prepared a short video that explains how it works.
Watch it calmly and see if it is right for you.',
  'Watch the video', 'Not now',
  'https://setemadrugadas.com.br/en-offer-canticle?utm_source=app-en&utm_medium=popup&utm_campaign=cantico&utm_content=dia-4',
  'cantico', '{cantico}', 4, null, null),

 ('en_arcangeles_novas_1', false, 10,
  '🚨 Please read carefully!
Before your first early morning',
  'The enemy does not need to stop your prayer.',
  'Sometimes he only has to wait until you receive what you asked for… and then find your life unprotected.
There is guidance you need to hear before the seven early mornings.',
  'Understand before I begin', 'I''d rather take the risk alone',
  'https://setemadrugadas.com.br/en-offer-archangels?utm_source=app-en&utm_medium=popup&utm_campaign=arcangeles&utm_content=novas-1a-exibicao',
  'arcangeles', '{arcangeles,cantico}', null, (now() at time zone 'America/New_York')::date, null),

 ('en_arcangeles_novas_2', false, 11,
  '🚨 Please read carefully!
Before your first early morning',
  'The enemy does not need to stop your prayer.',
  'Sometimes he only has to wait until you receive what you asked for… and then find your life unprotected.
There is guidance you need to hear before the seven early mornings.',
  'Understand before I begin', 'I''d rather take the risk alone',
  'https://setemadrugadas.com.br/en-offer-archangels?utm_source=app-en&utm_medium=popup&utm_campaign=arcangeles&utm_content=novas-2a-exibicao',
  'arcangeles', '{arcangeles,cantico}', null, (now() at time zone 'America/New_York')::date, null),

 ('en_arcangeles_antigas_1', false, 12,
  '🚨 Please read carefully!
Before you finish the seven early mornings',
  'The enemy does not need to stop your prayer.',
  'Sometimes he only has to wait until you receive what you asked for… and then find your life unprotected.
There is guidance you need to hear before you finish the seven early mornings.',
  'See the instructions', 'I''d rather take the risk alone',
  'https://setemadrugadas.com.br/en-offer-archangels?utm_source=app-en&utm_medium=popup&utm_campaign=arcangeles&utm_content=antigas-1a-exibicao',
  'arcangeles', '{arcangeles,cantico}', null, null, (now() at time zone 'America/New_York')::date),

 ('en_arcangeles_antigas_2', false, 13,
  '🚨 Please read carefully!
Before you finish the seven early mornings',
  'The enemy does not need to stop your prayer.',
  'Sometimes he only has to wait until you receive what you asked for… and then find your life unprotected.
There is guidance you need to hear before you finish the seven early mornings.',
  'See the instructions', 'I''d rather take the risk alone',
  'https://setemadrugadas.com.br/en-offer-archangels?utm_source=app-en&utm_medium=popup&utm_campaign=arcangeles&utm_content=antigas-2a-exibicao',
  'arcangeles', '{arcangeles,cantico}', null, null, (now() at time zone 'America/New_York')::date)
on conflict (key) do nothing;


-- =====================================================================
-- CONFERÊNCIA (rodar depois)
-- =====================================================================
-- select key, enabled, sort_order, min_journey_day, first_access_from, first_access_before
--   from public.en_offer_campaigns order by sort_order;
--
-- O RESULTADO (leve: as duas tabelas são pequenas)
-- select c.key,
--        count(e.*) filter (where e.shown_at is not null)     as apareceu,
--        count(e.*) filter (where e.clicked_at is not null)   as tocou,
--        count(e.*) filter (where e.dismissed_at is not null) as fechou
--   from public.en_offer_campaigns c
--   left join public.en_offer_events e on e.campaign_key = c.key
--  group by c.key, c.sort_order order by c.sort_order;
-- A venda que veio do pop-up: en_pedidos_pagos (02-compras.sql), com
-- utm_source = 'app-en' e utm_medium = 'popup' (o painel já conta, em
-- en_admin_offers). ⏳ EUA: checkout — só depois que o checkout guardar os utm.
--
-- LIGAR OS POP-UPS (quando o checkout existir; sem build, sem mexer na função)
-- update public.en_offer_campaigns set enabled = true where key like 'en\_%';
--
-- DESLIGAR UM POP-UP (sem apagar nada)
-- update public.en_offer_campaigns set enabled = false where key = 'en_cantico_dia_4';
--
-- DESFAZER TUDO (só se for preciso; nada do Brasil nem da LATAM)
-- drop function if exists public.en_claim_offer(uuid, text);
-- drop table if exists public.en_offer_events, public.en_offer_campaigns;
-- =====================================================================
