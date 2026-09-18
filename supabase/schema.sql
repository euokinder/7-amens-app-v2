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
create index member_offer_events_campaign_idx on public.member_offer_events(campaign_key);
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

create table public.member_visit_days (
 customer_id uuid not null references public.customers(id) on delete cascade,
 visited_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key (customer_id, visited_on)
);
create table public.member_survey_campaigns (
 key text primary key check (key ~ '^[a-z0-9_-]+$'),
 survey_key text not null check (survey_key ~ '^[a-z0-9_-]+$'),
 target_path text not null check (target_path ~ '^[a-z0-9-]+[.]html$'),
 min_distinct_visit_days integer not null default 3 check (min_distinct_visit_days between 1 and 365),
 enabled boolean not null default false,
 starts_at timestamptz,
 ends_at timestamptz,
 sort_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table public.member_survey_events (
 customer_id uuid not null references public.customers(id) on delete cascade,
 campaign_key text not null references public.member_survey_campaigns(key) on delete cascade,
 claimed_at timestamptz not null default now(),
 shown_at timestamptz,
 started_at timestamptz,
 dismissed_at timestamptz,
 completed_at timestamptz,
 primary key (customer_id, campaign_key)
);
create index member_survey_events_campaign_idx on public.member_survey_events(campaign_key);
create table public.member_survey_responses (
 customer_id uuid not null references public.customers(id) on delete cascade,
 survey_key text not null check (survey_key ~ '^[a-z0-9_-]+$'),
 survey_version integer not null default 1 check (survey_version > 0),
 motherhood_status text not null check (motherhood_status in ('mother','grandmother','mother_and_grandmother','neither')),
 relationship_status text not null check (relationship_status in ('married','relationship','single','widowed','prefer_not_to_say')),
 church_frequency text not null check (church_frequency in ('weekly','monthly','occasionally','not_attending_but_faithful','reconnecting')),
 primary_prayer_recipient text not null check (primary_prayer_recipient in ('children','grandchildren','partner','whole_family','someone_in_difficulty','self')),
 primary_intention text not null check (primary_intention in ('family_protection','children_or_grandchildren','health_and_healing','marriage_or_relationship','finances_and_work','peace_and_anxiety','difficult_cause')),
 favorite_devotion text not null check (favorite_devotion in ('saint_michael','saint_benedict','our_lady','saint_joseph','saint_rita','saint_jude','sacred_heart_or_divine_mercy','no_specific_devotion')),
 completed_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (customer_id, survey_key)
);
create function public.claim_member_survey(p_customer_id uuid)
returns table(campaign_key text, survey_key text, target_path text)
language plpgsql security invoker set search_path = ''
as $$
declare distinct_days integer;
begin
 insert into public.member_visit_days(customer_id, visited_on)
 values (p_customer_id, (now() at time zone 'America/Sao_Paulo')::date)
 on conflict (customer_id, visited_on) do update set last_seen_at = now();
 select count(*) into distinct_days from public.member_visit_days visits where visits.customer_id = p_customer_id;
 insert into public.member_survey_events(customer_id, campaign_key)
 select p_customer_id, campaign.key
 from public.member_survey_campaigns campaign
 where campaign.enabled
   and campaign.min_distinct_visit_days <= distinct_days
   and (campaign.starts_at is null or campaign.starts_at <= now())
   and (campaign.ends_at is null or campaign.ends_at > now())
   and not exists (select 1 from public.member_survey_events event where event.customer_id = p_customer_id and event.campaign_key = campaign.key)
   and not exists (select 1 from public.member_survey_responses response where response.customer_id = p_customer_id and response.survey_key = campaign.survey_key)
 order by campaign.sort_order, campaign.key limit 1
 on conflict do nothing;
 return query
 select campaign.key, campaign.survey_key, campaign.target_path
 from public.member_survey_events event
 join public.member_survey_campaigns campaign on campaign.key = event.campaign_key
 where event.customer_id = p_customer_id and event.shown_at is null and event.completed_at is null and campaign.enabled
   and (campaign.starts_at is null or campaign.starts_at <= now()) and (campaign.ends_at is null or campaign.ends_at > now())
 order by event.claimed_at, campaign.sort_order limit 1;
end;
$$;
revoke all on function public.claim_member_survey(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_survey(uuid) to service_role;
do $$
declare t text;
begin
 foreach t in array array['member_visit_days','member_survey_campaigns','member_survey_events','member_survey_responses'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('revoke all on table public.%I from anon, authenticated', t);
 execute format('grant all on table public.%I to service_role', t);
 execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
 end loop;
end;
$$;
insert into public.member_survey_campaigns(key,survey_key,target_path,min_distinct_visit_days,enabled,sort_order)
values ('profile_after_third_visit_day','member_profile_v1','perfil.html',3,true,10);
comment on table public.member_visit_days is 'Um registro por cliente e dia de acesso, considerando o fuso America/Sao_Paulo.';
comment on table public.member_survey_campaigns is 'Configura quando e para onde cada pesquisa deve ser disparada.';
comment on table public.member_survey_events is 'Histórico individual de elegibilidade, exibição, início, dispensa e conclusão das pesquisas.';
comment on table public.member_survey_responses is 'Respostas estruturadas do perfil, vinculadas ao cliente sem duplicar e-mail ou nome.';

alter table public.member_offer_campaigns
 add column trigger_type text not null default 'entry' check (trigger_type in ('entry','dismissal')),
 add column source_campaign_key text references public.member_offer_campaigns(key) on delete set null,
 add column offer_type text not null default 'product' check (offer_type in ('product','subscription','vip')),
 add column eyebrow text not null default 'Uma oportunidade para você',
 add column dismiss_label text not null default 'Agora não';
create index member_offer_campaigns_source_idx on public.member_offer_campaigns(source_campaign_key);
drop function public.claim_member_offer(uuid);
create function public.claim_member_offer(p_customer_id uuid,p_trigger_type text default 'entry',p_source_campaign_key text default null)
returns table(campaign_key text,headline text,body text,cta_label text,target_url text,offer_type text,eyebrow text,dismiss_label text)
language plpgsql security invoker set search_path = ''
as $$
declare active_products text[];
begin
 if p_trigger_type not in ('entry','dismissal') then return; end if;
 select coalesce(array_agg(e.product_key), '{}'::text[]) into active_products from public.entitlements e where e.customer_id=p_customer_id and e.status='active';
 insert into public.member_offer_events(customer_id,campaign_key)
 select p_customer_id,c.key from public.member_offer_campaigns c
 where c.enabled and c.target_url is not null and c.trigger_type=p_trigger_type
   and ((p_source_campaign_key is null and c.source_campaign_key is null) or c.source_campaign_key=p_source_campaign_key)
   and c.required_product_keys <@ active_products and not (c.excluded_product_keys && active_products)
   and not exists(select 1 from public.member_offer_events seen where seen.customer_id=p_customer_id and seen.campaign_key=c.key)
 order by c.sort_order,c.key limit 1 on conflict do nothing;
 return query select c.key,c.headline,c.body,c.cta_label,c.target_url,c.offer_type,c.eyebrow,c.dismiss_label
 from public.member_offer_events e join public.member_offer_campaigns c on c.key=e.campaign_key
 where e.customer_id=p_customer_id and e.shown_at is null and e.converted_at is null and c.enabled and c.target_url is not null
   and c.trigger_type=p_trigger_type and ((p_source_campaign_key is null and c.source_campaign_key is null) or c.source_campaign_key=p_source_campaign_key)
   and c.required_product_keys <@ active_products and not(c.excluded_product_keys && active_products)
 order by e.claimed_at,c.sort_order limit 1;
end;
$$;
revoke all on function public.claim_member_offer(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_member_offer(uuid,text,text) to service_role;
update public.member_offer_campaigns set trigger_type='entry',offer_type='product',eyebrow='Uma oportunidade para sua caminhada',dismiss_label='Agora não' where key='front_only_to_upsell_01';
insert into public.member_offer_campaigns(key,headline,body,cta_label,target_url,required_product_keys,excluded_product_keys,enabled,sort_order,trigger_type,source_campaign_key,offer_type,eyebrow,dismiss_label)
values
('upsell_01_to_upsell_02','Uma condição especial para continuar sua jornada','Preparamos uma oferta especial do próximo conteúdo para você avançar ainda mais em sua caminhada.','Conhecer a oferta do Up 02',null,array['principal','upsell_01'],array['upsell_02','upsell_03'],false,20,'entry',null,'product','Oferta exclusiva para você','Agora não'),
('upsell_02_dismissal_to_bundle','Antes de ir, queremos fazer uma última condição','Você poderá receber o Up 02 junto com o Up 03 em uma condição especial preparada para este momento.','Ver minha condição especial',null,array['principal','upsell_01'],array['upsell_02','upsell_03'],false,25,'dismissal','upsell_01_to_upsell_02','product','Uma última oportunidade','Não quero aproveitar'),
('upsell_01_02_to_upsell_03_subscription','Seu próximo passo pode acompanhar você todos os meses','Como você já avançou em nossa jornada, preparamos uma assinatura mensal acessível e exclusiva para você.','Conhecer minha assinatura',null,array['principal','upsell_01','upsell_02'],array['upsell_03'],false,30,'entry',null,'subscription','Condição exclusiva','Agora não'),
('full_funnel_to_vip_whatsapp','Você faz parte das nossas clientes mais especiais','Queremos convidar você para um grupo VIP, onde compartilharemos novidades e condições reservadas.','Entrar no grupo VIP',null,array['principal','upsell_01','upsell_02','upsell_03'],'{}'::text[],false,40,'entry',null,'vip','Convite especial','Talvez depois');
create table public.member_admins(customer_id uuid primary key references public.customers(id) on delete cascade,created_at timestamptz not null default now());
alter table public.member_admins enable row level security;
revoke all on table public.member_admins from anon,authenticated;
grant all on table public.member_admins to service_role;
create policy backend_only on public.member_admins for all to service_role using(true) with check(true);
create view public.admin_customer_overview with(security_invoker=true) as
select customer.id,customer.name,customer.email,customer.created_at,coalesce(products.active_products,'{}'::text[]) active_products,
case when coalesce(products.active_products,'{}'::text[]) @> array['upsell_01','upsell_02','upsell_03'] then 'funil_completo' when coalesce(products.active_products,'{}'::text[]) @> array['upsell_01','upsell_02'] then 'up01_e_up02' when coalesce(products.active_products,'{}'::text[]) @> array['upsell_01'] then 'somente_up01' when coalesce(products.active_products,'{}'::text[]) @> array['principal'] then 'somente_front' else 'sem_acesso_ativo' end funnel_stage,
coalesce(visits.distinct_visit_days,0) distinct_visit_days,visits.last_visit_on,coalesce(prayers.completed_prayers,0) completed_prayers,response.completed_at profile_completed_at,response.motherhood_status,response.relationship_status,response.church_frequency,response.primary_prayer_recipient,response.primary_intention,response.favorite_devotion
from public.customers customer
left join lateral(select array_agg(e.product_key order by e.product_key) active_products from public.entitlements e where e.customer_id=customer.id and e.status='active') products on true
left join lateral(select count(*)::integer distinct_visit_days,max(v.visited_on) last_visit_on from public.member_visit_days v where v.customer_id=customer.id) visits on true
left join lateral(select count(*)::integer completed_prayers from public.prayer_progress p where p.customer_id=customer.id and p.completed) prayers on true
left join public.member_survey_responses response on response.customer_id=customer.id and response.survey_key='member_profile_v1';
create view public.admin_offer_overview with(security_invoker=true) as select c.key,c.headline,c.trigger_type,c.offer_type,c.enabled,c.sort_order,count(e.customer_id)::integer claimed,count(e.shown_at)::integer shown,count(e.clicked_at)::integer clicked,count(e.dismissed_at)::integer dismissed,count(e.converted_at)::integer converted from public.member_offer_campaigns c left join public.member_offer_events e on e.campaign_key=c.key group by c.key,c.headline,c.trigger_type,c.offer_type,c.enabled,c.sort_order;
revoke all on public.admin_customer_overview from public,anon,authenticated;
revoke all on public.admin_offer_overview from public,anon,authenticated;
grant select on public.admin_customer_overview to service_role;
grant select on public.admin_offer_overview to service_role;
comment on table public.member_admins is 'Lista de clientes autorizados a consultar o painel administrativo de leitura.';
comment on view public.admin_customer_overview is 'Resumo de clientes, acessos, progresso e perfil para o painel administrativo.';
comment on view public.admin_offer_overview is 'Métricas agregadas das campanhas do funil.';
