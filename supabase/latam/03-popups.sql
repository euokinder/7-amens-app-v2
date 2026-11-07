-- =====================================================================
-- App em espanhol (7 Amenes de la Madrugada) - os pop-ups de oferta
-- =====================================================================
-- Pedido do Caio em 07/11/2026: "exatamente igual ao Brasil, só
-- traduzindo". É a mesma lógica do member_offer_campaigns /
-- claim_member_offer do app brasileiro, em tabelas latam_ (o Brasil não é
-- tocado):
--   - só vê quem tem o app e ainda não comprou o extra oferecido;
--   - no máximo um pop-up por dia (o "dia" é o do fuso dela);
--   - cada campanha aparece uma vez só (o banco guarda; outro celular não
--     repete);
--   - as campanhas vêm na ordem de sort_order.
--
-- As campanhas, como no Brasil:
--   sort  9  es_cantico_dia_4     Cántico Angelical (UP02), a partir do
--                                 4º dia de app ("cantico_dia_4" do Brasil)
--   ⚠️ O UP02 da LATAM é o Cántico, como no Brasil. Na KashPay o produto se
--   chama "Novena a la Virgen Desatanudos" por engano (Caio, 07/11), e é por
--   isso que o rastreio grava 'desatanudos' em latam_kashpay_events.produtos.
--   Aqui 'desatanudos' quer dizer o UP02, isto é, o Cántico.
--   sort 10  es_arcangeles_novas_1 Arcángeles (UP01), 1ª vez, quem entrou no
--   sort 11  es_arcangeles_novas_2 app depois dos pop-ups ("front_novas")
--   sort 12  es_arcangeles_antigas_1 Arcángeles, 1ª e 2ª vez, quem já estava
--   sort 13  es_arcangeles_antigas_2 rezando antes ("front_antigas")
--   No Brasil, "antigas" é a base importada; aqui é quem entrou no app antes
--   do dia em que este arquivo roda na produção (first_access_before).
--
-- QUEM COMPROU O QUÊ
-- A venda da KashPay chega na Whop SEM o produto. O produto está no aviso
-- da própria KashPay (latam_kashpay_events.produtos, de 02-kashpay.sql, na
-- branch latam-kashpay). As duas pontas se encontram pelo número do pedido:
-- latam_whop_events.payload -> data.metadata.kashpay_transaction_id =
-- latam_kashpay_events.transaction_id (191 de 191 cruzaram em 07/11).
-- Antes de 06/11, 22:54 a KashPay não avisava. Cada upsell é um pagamento
-- separado na Whop, então:
--   - pagamento sem pedido da KashPay = "não sei o que foi";
--   - se o único "não sei" é um e o app (principal) não apareceu em outro
--     pedido, esse "não sei" É o app: ela não comprou extra nenhum;
--   - qualquer outro "não sei", ou cliente da carga manual (source
--     'import'), fica SEM pop-up. Na dúvida, não se oferece o que ela pode
--     já ter comprado.
--
-- DEPENDE DE: 01-tabelas.sql e 02-kashpay.sql.
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Caio, no SQL Editor).
-- Pode rodar de novo: tudo é "if not exists", "create or replace" ou
-- "on conflict do nothing".
-- =====================================================================


-- 1. As campanhas. Mesmos campos do Brasil, menos o que a LATAM não usa.
create table if not exists public.latam_offer_campaigns (
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
  excluded_products text[] not null default '{}',  -- quem já comprou um destes não vê
  min_journey_day integer,                -- a partir de que dia de app (o 1º acesso é o dia 1)
  first_access_from date,                 -- só quem entrou no app a partir desta data
  first_access_before date,               -- só quem entrou no app antes desta data
  created_at timestamptz not null default now(),
  constraint latam_offer_campaigns_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint latam_offer_campaigns_url_check check (target_url is null or target_url ~ '^https://'),
  constraint latam_offer_campaigns_offered_check check (offered_product is null or offered_product in ('arcangeles','desatanudos')),
  constraint latam_offer_campaigns_excluded_check check (excluded_products <@ array['principal','arcangeles','desatanudos']::text[])
);


-- 2. O que aconteceu com cada pop-up, por cliente. Uma linha por cliente e
--    campanha: é o que impede de repetir, em qualquer celular.
create table if not exists public.latam_offer_events (
  customer_id uuid not null references public.latam_customers(id) on delete cascade,
  campaign_key text not null references public.latam_offer_campaigns(key) on delete cascade,
  claimed_at timestamptz not null default now(),   -- o banco separou para ela
  shown_at timestamptz,                            -- apareceu na tela
  clicked_at timestamptz,                          -- tocou no botão
  dismissed_at timestamptz,                        -- fechou
  primary key (customer_id, campaign_key)
);


-- 3. Achar os pagamentos dela pelo e-mail sem varrer a tabela inteira.
create index if not exists latam_whop_events_customer_email_idx on public.latam_whop_events (customer_email);


-- 4. Ninguém de fora lê nada (como nas outras latam_).
do $trava$
declare t text;
begin
  foreach t in array array['latam_offer_campaigns','latam_offer_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 5. A escolha do pop-up. Cópia do claim_member_offer do Brasil (gatilho
--    'entry'), lendo as tabelas latam_. p_zone é o fuso dela, já conferido
--    pela latam-api. Separa uma campanha nova (se houver) e devolve a mais
--    antiga que ainda não apareceu.
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
    select k.produtos
    from public.latam_whop_events w
    left join public.latam_kashpay_events k
      on k.event = 'order.paid'
     and k.transaction_id = w.payload #>> '{data,metadata,kashpay_transaction_id}'
    where w.customer_email = v_email
      and w.event_type = 'payment.succeeded'
      and w.status = 'processed'
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


-- 6. As cinco campanhas, traduzidas das do Brasil (07/11/2026). A data de
--    corte entre "novas" e "antigas" é o dia em que este arquivo roda.
--    Os endereços levam as mesmas etiquetas do Brasil (utm_content), com
--    utm_source=app-es: a KashPay guarda os utm no pedido.
--    A 1ª versão (rodada na produção em 07/11) chamava o UP02 de Novena
--    (es_novena_dia_4). Ela nunca apareceu para ninguém: sai aqui.
delete from public.latam_offer_campaigns where key = 'es_novena_dia_4';
insert into public.latam_offer_campaigns
  (key, enabled, sort_order, eyebrow, headline, body, cta_label, dismiss_label, target_url,
   offered_product, excluded_products, min_journey_day, first_access_from, first_access_before)
values
 ('es_cantico_dia_4', true, 9,
  'Cántico Angelical',
  'Entrégale a Dios lo que más pesa en tu corazón',
  'El Cántico Angelical es una jornada de 7 días: un cántico por día, para rezar escuchando y calmar el corazón.
Preparamos un video que explica cómo funciona.
Míralo con calma y descubre si es para ti.',
  'Ver el video', 'Ahora no',
  'https://setemadrugadas.com.br/es-oferta-cantico?utm_source=app-es&utm_medium=popup&utm_campaign=cantico&utm_content=dia-4',
  'desatanudos', '{desatanudos}', 4, null, null),

 ('es_arcangeles_novas_1', true, 10,
  '🚨 ¡Lee con atención!
Antes de la primera madrugada',
  'El enemigo no necesita impedir tu oración.',
  'A veces, le basta con esperar a que recibas lo que pediste… y encontrar tu vida desprotegida después.
Hay una orientación que necesitas escuchar antes de las 7 Madrugadas.',
  'Entender antes de empezar', 'Prefiero arriesgarme sola',
  'https://setemadrugadas.com.br/es-oferta-arcangeles?utm_source=app-es&utm_medium=popup&utm_campaign=arcangeles&utm_content=novas-1a-exibicao',
  'arcangeles', '{arcangeles,desatanudos}', null, (now() at time zone 'America/Sao_Paulo')::date, null),

 ('es_arcangeles_novas_2', true, 11,
  '🚨 ¡Lee con atención!
Antes de la primera madrugada',
  'El enemigo no necesita impedir tu oración.',
  'A veces, le basta con esperar a que recibas lo que pediste… y encontrar tu vida desprotegida después.
Hay una orientación que necesitas escuchar antes de las 7 Madrugadas.',
  'Entender antes de empezar', 'Prefiero arriesgarme sola',
  'https://setemadrugadas.com.br/es-oferta-arcangeles?utm_source=app-es&utm_medium=popup&utm_campaign=arcangeles&utm_content=novas-2a-exibicao',
  'arcangeles', '{arcangeles,desatanudos}', null, (now() at time zone 'America/Sao_Paulo')::date, null),

 ('es_arcangeles_antigas_1', true, 12,
  '🚨 ¡Lee con atención!
Antes de terminar las 7 madrugadas',
  'El enemigo no necesita impedir tu oración.',
  'A veces, le basta con esperar a que recibas lo que pediste… y encontrar tu vida desprotegida después.
Hay una orientación que necesitas escuchar antes de terminar las 7 Madrugadas.',
  'Entender las instrucciones', 'Prefiero arriesgarme sola',
  'https://setemadrugadas.com.br/es-oferta-arcangeles?utm_source=app-es&utm_medium=popup&utm_campaign=arcangeles&utm_content=antigas-1a-exibicao',
  'arcangeles', '{arcangeles,desatanudos}', null, null, (now() at time zone 'America/Sao_Paulo')::date),

 ('es_arcangeles_antigas_2', true, 13,
  '🚨 ¡Lee con atención!
Antes de terminar las 7 madrugadas',
  'El enemigo no necesita impedir tu oración.',
  'A veces, le basta con esperar a que recibas lo que pediste… y encontrar tu vida desprotegida después.
Hay una orientación que necesitas escuchar antes de terminar las 7 Madrugadas.',
  'Entender las instrucciones', 'Prefiero arriesgarme sola',
  'https://setemadrugadas.com.br/es-oferta-arcangeles?utm_source=app-es&utm_medium=popup&utm_campaign=arcangeles&utm_content=antigas-2a-exibicao',
  'arcangeles', '{arcangeles,desatanudos}', null, null, (now() at time zone 'America/Sao_Paulo')::date)
on conflict (key) do nothing;


-- =====================================================================
-- CONFERÊNCIA (rodar depois)
-- =====================================================================
-- select key, enabled, sort_order, min_journey_day, first_access_from, first_access_before
--   from public.latam_offer_campaigns order by sort_order;
--
-- O RESULTADO (leve: as duas tabelas são pequenas)
-- select c.key,
--        count(e.*) filter (where e.shown_at is not null)     as apareceu,
--        count(e.*) filter (where e.clicked_at is not null)   as tocou,
--        count(e.*) filter (where e.dismissed_at is not null) as fechou
--   from public.latam_offer_campaigns c
--   left join public.latam_offer_events e on e.campaign_key = c.key
--  group by c.key, c.sort_order order by c.sort_order;
-- A venda que veio do pop-up está em latam_kashpay_events, com
-- utm_source = 'app-es' e utm_medium = 'popup'.
--
-- DESLIGAR UM POP-UP (sem apagar nada)
-- update public.latam_offer_campaigns set enabled = false where key = 'es_cantico_dia_4';
--
-- DESFAZER TUDO (só se for preciso; nada do Brasil)
-- drop function if exists public.latam_claim_offer(uuid, text);
-- drop table if exists public.latam_offer_events, public.latam_offer_campaigns;
-- drop index if exists public.latam_whop_events_customer_email_idx;
-- =====================================================================
