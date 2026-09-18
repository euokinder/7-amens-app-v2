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

 select count(*) into distinct_days
 from public.member_visit_days visits
 where visits.customer_id = p_customer_id;

 insert into public.member_survey_events(customer_id, campaign_key)
 select p_customer_id, campaign.key
 from public.member_survey_campaigns campaign
 where campaign.enabled
   and campaign.min_distinct_visit_days <= distinct_days
   and (campaign.starts_at is null or campaign.starts_at <= now())
   and (campaign.ends_at is null or campaign.ends_at > now())
   and not exists (
     select 1 from public.member_survey_events event
     where event.customer_id = p_customer_id and event.campaign_key = campaign.key
   )
   and not exists (
     select 1 from public.member_survey_responses response
     where response.customer_id = p_customer_id and response.survey_key = campaign.survey_key
   )
 order by campaign.sort_order, campaign.key
 limit 1
 on conflict do nothing;

 return query
 select campaign.key, campaign.survey_key, campaign.target_path
 from public.member_survey_events event
 join public.member_survey_campaigns campaign on campaign.key = event.campaign_key
 where event.customer_id = p_customer_id
   and event.shown_at is null
   and event.completed_at is null
   and campaign.enabled
   and (campaign.starts_at is null or campaign.starts_at <= now())
   and (campaign.ends_at is null or campaign.ends_at > now())
 order by event.claimed_at, campaign.sort_order
 limit 1;
end;
$$;

do $$
declare table_name text;
begin
 foreach table_name in array array['member_visit_days','member_survey_campaigns','member_survey_events','member_survey_responses'] loop
   execute format('alter table public.%I enable row level security', table_name);
   execute format('revoke all on table public.%I from anon, authenticated', table_name);
   execute format('grant all on table public.%I to service_role', table_name);
   execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', table_name);
 end loop;
end;
$$;

revoke all on function public.claim_member_survey(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_survey(uuid) to service_role;

insert into public.member_survey_campaigns(
 key, survey_key, target_path, min_distinct_visit_days, enabled, sort_order
) values (
 'profile_after_third_visit_day', 'member_profile_v1', 'perfil.html', 3, true, 10
);

comment on table public.member_visit_days is 'Um registro por cliente e dia de acesso, considerando o fuso America/Sao_Paulo.';
comment on table public.member_survey_campaigns is 'Configura quando e para onde cada pesquisa deve ser disparada.';
comment on table public.member_survey_events is 'Histórico individual de elegibilidade, exibição, início, dispensa e conclusão das pesquisas.';
comment on table public.member_survey_responses is 'Respostas estruturadas do perfil, vinculadas ao cliente sem duplicar e-mail ou nome.';
