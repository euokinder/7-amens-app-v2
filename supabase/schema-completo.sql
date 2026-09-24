-- =====================================================================
-- RECEITA COMPLETA DO BANCO — 7 Améns da Madrugada
-- =====================================================================
--
-- O QUE É ESTE ARQUIVO
-- Ele constrói o banco inteiro do zero: as 18 tabelas, as travas de
-- segurança, os índices, as 3 funções, as 3 visões do painel e a
-- configuração de produtos e campanhas. Rodando este arquivo num banco vazio, você tem um sistema
-- funcionando — só sem clientes.
--
-- POR QUE ELE EXISTE
-- Sete alterações do banco tinham sido feitas direto no painel do
-- Supabase, sem arquivo nenhum no projeto. Entre elas a mais importante:
-- a que cria as tabelas de clientes e de acessos. Na prática o projeto
-- não sabia se reconstruir, e por isso não dava para criar um banco de
-- teste. Este arquivo fecha esse buraco.
--
-- ⛔ NUNCA RODE ISTO NO BANCO DE PRODUÇÃO.
-- Ele é escrito para não estragar nada se rodar por acidente (todo
-- comando é "if not exists" ou "do nothing"), mas o lugar dele é um
-- banco NOVO e VAZIO. Produção já tem tudo isto de pé, com clientes
-- reais em cima.
--
-- COMO FOI FEITO
-- Lido do banco de produção em 2026-09-18, campo por campo. É o retrato
-- do que existe hoje, não uma proposta de mudança. Nenhuma linha daqui
-- foi executada contra a produção.
--
-- O QUE NÃO ESTÁ AQUI
-- Nenhum dado de cliente: sem nome, sem e-mail, sem telefone, sem
-- compra. Só a estrutura e a configuração do negócio.
--
-- ORDEM IMPORTA: as tabelas se referenciam. Rode de cima para baixo.
-- =====================================================================


-- =====================================================================
-- 1. PESSOAS E ACESSOS — o coração do sistema
-- =====================================================================

-- Uma linha por pessoa. O e-mail é a identidade: é por ele que a cliente
-- entra no app, sem senha. A trava do e-mail obriga minúsculas e sem
-- espaços, para a mesma pessoa nunca virar duas contas.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  created_at timestamptz not null default now(),
  hubla_user_id text,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  constraint customers_email_check check (
    email = lower(btrim(email))
    and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  )
);

-- O catálogo. 'unlocks_app' é a coluna que responde "comprar isto dá
-- acesso ao app?" — hoje só o produto principal diz que sim.
create table if not exists public.products (
  key text primary key,
  title text not null,
  description text not null default '',
  checkout_url text,
  content_url text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  type text not null default 'addon',
  billing_type text not null default 'one_time',
  unlocks_app boolean not null default false,
  constraint products_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint products_type_check check (type in ('main','addon')),
  constraint products_billing_type_check check (billing_type in ('one_time','subscription')),
  constraint products_checkout_url_check check (checkout_url is null or checkout_url ~ '^https://'),
  constraint products_content_url_check check (
    content_url is null or content_url ~ '^https://' or content_url ~ '^[a-z0-9-]+[.]html([?].*)?$'
  )
);

-- Quem tem direito a quê. Nunca existe um "tem_acesso = true" solto: o
-- acesso é sempre uma linha ligando pessoa e produto, com status e com a
-- origem (veio da Hubla, da importação da base antiga, ou foi manual).
create table if not exists public.entitlements (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_key text not null references public.products(key),
  status text not null default 'active',
  source text not null default 'manual',
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  hubla_subscription_id text,
  granted_at timestamptz,
  revoked_at timestamptz,
  last_subscription_version integer,
  last_modified_at timestamptz,
  primary key (customer_id, product_key),
  constraint entitlements_status_check check (status in ('active','refunded','revoked'))
);

-- Sessões de login. Guarda só a impressão digital do código (64 letras e
-- números), nunca o código em si: se este banco vazasse, ninguém
-- conseguiria entrar na conta de ninguém com o que está aqui.
create table if not exists public.member_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint member_sessions_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$')
);

-- Link de entrada (24/09/2026): para a cliente que não consegue digitar o
-- e-mail. O suporte copia o link no painel e manda no WhatsApp; ela toca e
-- entra. Aqui o código fica guardado COMO É, e não só a impressão digital:
-- o suporte precisa copiar o mesmo link de novo sem matar o que já mandou.
-- Não abre nada que o e-mail dela já não abrisse. Ver supabase/link-de-entrada.sql.
create table if not exists public.member_entry_links (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  token text not null,
  created_by uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  uses integer not null default 0,
  constraint member_entry_links_token_key unique (token),
  constraint member_entry_links_token_check check (token ~ '^[A-Za-z0-9]{16}$')
);

-- Freio contra tentativa em massa de login.
create table if not exists public.member_login_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);


-- =====================================================================
-- 2. A JORNADA DELA DENTRO DO APP
-- =====================================================================

-- Quais orações ela já concluiu. Os dias do Cântico Angelical (cantico:0-7)
-- entraram em 24/09/2026 — na produção, só depois de rodar
-- supabase/cantico-angelical.sql.
create table if not exists public.prayer_progress (
  customer_id uuid not null references public.customers(id) on delete cascade,
  prayer_key text not null,
  completed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (customer_id, prayer_key),
  constraint prayer_progress_prayer_key_check check (prayer_key ~ '^(principal:[0-7]|desatadora:[1-9]|cantico:[0-7])$')
);

-- Em quantos DIAS diferentes ela apareceu. Conta dias, não visitas: abrir
-- o app cinco vezes na mesma madrugada continua sendo um dia só. O fuso é
-- o de São Paulo, senão quem reza às 2h da manhã contaria dois dias.
create table if not exists public.member_visit_days (
  customer_id uuid not null references public.customers(id) on delete cascade,
  visited_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (customer_id, visited_on)
);


-- =====================================================================
-- 3. PAINEL DE ADMIN
-- =====================================================================

-- Quem é operador do painel. Estar aqui não basta para entrar: a pessoa
-- também precisa existir em customers e ter acesso ativo ao app.
create table if not exists public.member_admins (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Histórico de tudo que um operador faz numa cliente. Com mais de um
-- operador mexendo em acesso, saber quem fez o quê deixa de ser luxo.
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_customer_id uuid not null references public.customers(id) on delete cascade,
  action text not null,
  target_customer_id uuid references public.customers(id) on delete set null,
  target_email text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- As três últimas são as trocas de banner da home (seção 6B). Sem
  -- elas na lista, trocar um banner pelo painel falha ao registrar quem
  -- trocou — e a troca inteira volta atrás.
  constraint admin_actions_action_check check (action in (
    'grant_access','revoke_access','update_email',
    'save_banner','delete_banner','move_banner'))
);


-- =====================================================================
-- 4. HUBLA — a entrada automática de vendas
-- =====================================================================

-- Todo evento que a Hubla manda fica gravado aqui, inclusive os que não
-- mudam acesso. 'idempotency_key' é único de propósito: se a Hubla mandar
-- o mesmo evento duas vezes, a segunda esbarra nesta trava e não duplica
-- nada. É o que impede uma venda de virar dois acessos.
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
  processing_status text not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint hubla_events_processing_status_check check (
    processing_status in ('received','processed','ignored','failed','needs_reconciliation')
  )
);

-- Tradutor entre o código de produto da Hubla e o nosso.
--
-- ⚠️ LIÇÃO CARA: o código que aparece no link hub.la/g/... quase nunca é
-- o mesmo que chega no evento. Dos nossos quatro produtos, DOIS tinham
-- código diferente do link. Por isso a tabela aceita mais de um código
-- por produto, e por isso cada linha diz como foi confirmada.
-- Nunca cadastre um código por analogia: confirme com evento real.
create table if not exists public.hubla_product_map (
  hubla_id text primary key,
  product_key text not null references public.products(key) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now()
);


-- =====================================================================
-- 5. POP-UPS DE OFERTA
-- =====================================================================

-- A configuração de cada pop-up: texto, botão, para quem aparece e para
-- quem NÃO aparece. 'required_principal_sources' é o que separa público
-- novo (comprou pela Hubla) de base antiga (veio na importação).
create table if not exists public.member_offer_campaigns (
  key text primary key,
  headline text not null,
  body text not null,
  cta_label text not null default 'Assistir agora',
  target_url text,
  required_product_keys text[] not null default '{}',
  excluded_product_keys text[] not null default '{}',
  enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trigger_type text not null default 'entry',
  source_campaign_key text references public.member_offer_campaigns(key) on delete set null,
  offer_type text not null default 'product',
  eyebrow text not null default 'Uma oportunidade para você',
  dismiss_label text not null default 'Agora não',
  required_principal_sources text[] not null default '{}',
  -- Qual produto esta campanha vende. Sem isto, o sistema vê "clicou no
  -- pop-up" e "comprou o UP01" como dois fatos soltos, e a coluna
  -- converted_at nunca sai do zero.
  offered_product_key text references public.products(key) on delete set null,
  constraint member_offer_campaigns_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint member_offer_campaigns_target_url_check check (target_url is null or target_url ~ '^https://'),
  constraint member_offer_campaigns_trigger_type_check check (trigger_type in ('entry','dismissal')),
  constraint member_offer_campaigns_offer_type_check check (offer_type in ('product','subscription','vip'))
);

-- Uma linha por cliente por campanha. A chave primária dupla garante que
-- a mesma mulher nunca receba a mesma campanha duas vezes.
create table if not exists public.member_offer_events (
  customer_id uuid not null references public.customers(id) on delete cascade,
  campaign_key text not null references public.member_offer_campaigns(key) on delete cascade,
  claimed_at timestamptz not null default now(),
  shown_at timestamptz,
  clicked_at timestamptz,
  dismissed_at timestamptz,
  converted_at timestamptz,
  primary key (customer_id, campaign_key)
);


-- =====================================================================
-- 6. PESQUISA DE PERFIL
-- =====================================================================

create table if not exists public.member_survey_campaigns (
  key text primary key,
  survey_key text not null,
  target_path text not null,
  min_distinct_visit_days integer not null default 3,
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_survey_campaigns_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint member_survey_campaigns_survey_key_check check (survey_key ~ '^[a-z0-9_-]+$'),
  constraint member_survey_campaigns_target_path_check check (target_path ~ '^[a-z0-9-]+[.]html$'),
  constraint member_survey_campaigns_min_days_check check (min_distinct_visit_days between 1 and 365),
  constraint member_survey_campaigns_window_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.member_survey_events (
  customer_id uuid not null references public.customers(id) on delete cascade,
  campaign_key text not null references public.member_survey_campaigns(key) on delete cascade,
  claimed_at timestamptz not null default now(),
  shown_at timestamptz,
  started_at timestamptz,
  dismissed_at timestamptz,
  completed_at timestamptz,
  primary key (customer_id, campaign_key)
);

-- As respostas. Cada campo só aceita uma lista fechada de opções, para o
-- dado nascer limpo e dar para segmentar depois sem faxina.
create table if not exists public.member_survey_responses (
  customer_id uuid not null references public.customers(id) on delete cascade,
  survey_key text not null,
  survey_version integer not null default 1,
  motherhood_status text not null,
  relationship_status text not null,
  church_frequency text not null,
  primary_prayer_recipient text not null,
  primary_intention text not null,
  favorite_devotion text not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, survey_key),
  constraint member_survey_responses_survey_key_check check (survey_key ~ '^[a-z0-9_-]+$'),
  constraint member_survey_responses_survey_version_check check (survey_version > 0),
  constraint member_survey_responses_motherhood_check check (
    motherhood_status in ('mother','grandmother','mother_and_grandmother','neither',
                          'father','grandfather','father_and_grandfather')),
  constraint member_survey_responses_relationship_check check (
    relationship_status in ('married','relationship','single','widowed','prefer_not_to_say')),
  constraint member_survey_responses_church_check check (
    church_frequency in ('weekly','monthly','occasionally','not_attending_but_faithful','reconnecting')),
  constraint member_survey_responses_recipient_check check (
    primary_prayer_recipient in ('children','grandchildren','partner','whole_family','someone_in_difficulty','self')),
  constraint member_survey_responses_intention_check check (
    primary_intention in ('family_protection','children_or_grandchildren','health_and_healing',
                          'marriage_or_relationship','finances_and_work','peace_and_anxiety','difficult_cause')),
  constraint member_survey_responses_devotion_check check (
    favorite_devotion in ('saint_michael','saint_benedict','our_lady','saint_joseph','saint_rita',
                          'saint_jude','sacred_heart_or_divine_mercy','no_specific_devotion'))
);


-- =====================================================================
-- 6B. BANNERS DA HOME — a seção DESTAQUE, o carrossel do topo
-- =====================================================================
-- Numerada "6B" e não "7" de propósito: renumerar as seções seguintes
-- quebraria toda referência escrita a elas por aí.

-- Os banners que aparecem no alto da home, trocáveis pelo painel sem
-- deploy nenhum. `key` é só o nome interno; `title` não aparece na
-- tela da cliente — serve para o Caio se achar no painel e para o
-- leitor de tela de quem não enxerga a imagem.
--
-- `image_url` e `target_url` guardam o endereço COMPLETO com https://,
-- mesma regra do `member_offer_campaigns.target_url`. Quando o endereço
-- é uma página do próprio app, o js/banner.js troca o domínio pelo de
-- agora — sem isso, clicar num banner em localhost jogaria quem está
-- testando direto no site das clientes reais.
create table if not exists public.member_home_banners (
  key text primary key,
  title text not null default '',
  image_url text not null,
  target_url text not null,
  enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_home_banners_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint member_home_banners_image_url_check check (image_url ~ '^https://'),
  constraint member_home_banners_target_url_check check (target_url ~ '^https://')
);


-- =====================================================================
-- 7. ÍNDICES — as consultas que o app faz o tempo todo
-- =====================================================================

create unique index if not exists customers_hubla_user_id_unique on public.customers (hubla_user_id) where hubla_user_id is not null;
create unique index if not exists products_title_unique on public.products (title);
create index if not exists entitlements_product_key_idx on public.entitlements (product_key);
create index if not exists member_sessions_customer_id_idx on public.member_sessions (customer_id);
create index if not exists member_sessions_expires_at_idx on public.member_sessions (expires_at);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on public.admin_actions (target_customer_id);
create index if not exists hubla_events_received_idx on public.hubla_events (received_at desc);
create index if not exists hubla_events_status_idx on public.hubla_events (processing_status);
create index if not exists hubla_events_type_idx on public.hubla_events (event_type);
create index if not exists hubla_events_user_idx on public.hubla_events (hubla_user_id);
create index if not exists hubla_product_map_product_key_idx on public.hubla_product_map (product_key);
create index if not exists member_offer_campaigns_source_idx on public.member_offer_campaigns (source_campaign_key);
create index if not exists member_home_banners_ordem_idx on public.member_home_banners (enabled, sort_order);
create index if not exists member_offer_events_campaign_idx on public.member_offer_events (campaign_key);
create index if not exists member_survey_events_campaign_idx on public.member_survey_events (campaign_key);


-- =====================================================================
-- 8. TRAVA DE SEGURANÇA — ninguém fala com o banco direto
-- =====================================================================
--
-- Toda tabela fica trancada e libera só para o 'service_role', que é a
-- chave secreta que mora no servidor. O navegador da cliente NUNCA tem
-- essa chave. Na prática: mesmo sabendo o endereço do banco, ninguém de
-- fora lê a lista de clientes nem concede acesso a si mesmo.
--
-- Se um dia alguém precisar criar uma tabela nova, ela precisa desta
-- mesma dupla de comandos — senão nasce aberta.

do $trava$
declare t text;
begin
  foreach t in array array[
    'customers','products','entitlements','member_sessions','member_entry_links','member_login_limits',
    'prayer_progress','member_visit_days','member_admins','admin_actions',
    'hubla_events','hubla_product_map','member_offer_campaigns','member_offer_events',
    'member_survey_campaigns','member_survey_events','member_survey_responses',
    'member_home_banners'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- =====================================================================
-- 9. FUNÇÕES
-- =====================================================================

-- Freio de login: conta tentativas por pessoa dentro de 10 minutos e
-- libera até 20. A conta é por e-mail dentro do endereço de internet, e
-- não só por endereço: operadora de celular põe muita gente atrás do
-- mesmo IP, e uma vizinha nunca pode travar a outra.
-- Aproveita a passagem para varrer sessões vencidas.
create or replace function public.allow_member_login(bucket_key text)
returns boolean language plpgsql set search_path to ''
as $function$
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
$function$;

-- Escolhe qual pop-up mostrar.
--
-- ⚠️ DEFEITO JÁ CORRIGIDO AQUI: a regra de "uma oferta de entrada por
-- dia" existia só na hora de RESERVAR, não na hora de ENTREGAR. Com isso
-- a mesma mulher podia levar dois pop-ups na mesma visita. Para o público
-- 45+ isso não é insistência, é maltrato. A checagem agora é a primeira
-- coisa que a função faz.
create or replace function public.claim_member_offer(p_customer_id uuid, p_trigger_type text default 'entry', p_source_campaign_key text default null)
returns table(campaign_key text, headline text, body text, cta_label text, target_url text, offer_type text, eyebrow text, dismiss_label text)
language plpgsql set search_path to ''
as $function$
declare active_products text[];
declare principal_source text;
declare exibiu_hoje boolean;
begin
 if p_trigger_type not in ('entry','dismissal') then
   return;
 end if;

 select coalesce(array_agg(entitlement.product_key), '{}'::text[])
 into active_products
 from public.entitlements entitlement
 where entitlement.customer_id = p_customer_id and entitlement.status = 'active';

 select entitlement.source into principal_source
 from public.entitlements entitlement
 where entitlement.customer_id = p_customer_id
   and entitlement.product_key = 'principal'
   and entitlement.status = 'active'
 limit 1;

 select exists (
   select 1
   from public.member_offer_events recent
   join public.member_offer_campaigns other on other.key = recent.campaign_key
   where recent.customer_id = p_customer_id
     and other.trigger_type = 'entry'
     and recent.shown_at is not null
     and (recent.shown_at at time zone 'America/Sao_Paulo')::date
         = (now() at time zone 'America/Sao_Paulo')::date
 ) into exibiu_hoje;

 if p_trigger_type = 'entry' and exibiu_hoje then
   return;
 end if;

 insert into public.member_offer_events(customer_id, campaign_key)
 select p_customer_id, campaign.key
 from public.member_offer_campaigns campaign
 where campaign.enabled
   and campaign.target_url is not null
   and campaign.trigger_type = p_trigger_type
   and (
     (p_source_campaign_key is null and campaign.source_campaign_key is null)
     or campaign.source_campaign_key = p_source_campaign_key
   )
   and campaign.required_product_keys <@ active_products
   and not (campaign.excluded_product_keys && active_products)
   and (
     cardinality(campaign.required_principal_sources) = 0
     or principal_source = any(campaign.required_principal_sources)
   )
   and not exists (
     select 1 from public.member_offer_events seen
     where seen.customer_id = p_customer_id and seen.campaign_key = campaign.key
   )
 order by campaign.sort_order, campaign.key
 limit 1
 on conflict do nothing;

 return query
 select campaign.key, campaign.headline, campaign.body, campaign.cta_label,
        campaign.target_url, campaign.offer_type, campaign.eyebrow, campaign.dismiss_label
 from public.member_offer_events event
 join public.member_offer_campaigns campaign on campaign.key = event.campaign_key
 where event.customer_id = p_customer_id
   and event.shown_at is null
   and event.converted_at is null
   and campaign.enabled
   and campaign.target_url is not null
   and campaign.trigger_type = p_trigger_type
   and (
     (p_source_campaign_key is null and campaign.source_campaign_key is null)
     or campaign.source_campaign_key = p_source_campaign_key
   )
   and campaign.required_product_keys <@ active_products
   and not (campaign.excluded_product_keys && active_products)
   and (
     cardinality(campaign.required_principal_sources) = 0
     or principal_source = any(campaign.required_principal_sources)
   )
 order by event.claimed_at, campaign.sort_order
 limit 1;
end;
$function$;

-- Escolhe se é hora de pedir a pesquisa de perfil. Só convida quem já
-- apareceu em dias diferentes o bastante — quem acabou de comprar não é
-- abordada com formulário.
create or replace function public.claim_member_survey(p_customer_id uuid)
returns table(campaign_key text, survey_key text, target_path text)
language plpgsql set search_path to ''
as $function$
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

 -- Entregar e registrar são a MESMA operação: este update marca shown_at no
 -- instante em que devolve a campanha. Antes isto era um select e quem marcava
 -- era o navegador — numa rede ruim o aviso se perdia e o formulário voltava a
 -- aparecer para quem já tinha visto. O "shown_at is null" aqui dentro também
 -- resolve a corrida de duas abas abertas ao mesmo tempo: só uma recebe.
 return query
 with marcada as (
   update public.member_survey_events event
      set shown_at = now()
    where event.customer_id = p_customer_id
      and event.shown_at is null
      and event.completed_at is null
      and event.campaign_key = (
        select elegivel.campaign_key
        from public.member_survey_events elegivel
        join public.member_survey_campaigns campaign on campaign.key = elegivel.campaign_key
        where elegivel.customer_id = p_customer_id
          and elegivel.shown_at is null
          and elegivel.completed_at is null
          and campaign.enabled
          and (campaign.starts_at is null or campaign.starts_at <= now())
          and (campaign.ends_at is null or campaign.ends_at > now())
        order by elegivel.claimed_at, campaign.sort_order
        limit 1
      )
   returning event.campaign_key
 )
 select campaign.key, campaign.survey_key, campaign.target_path
 from marcada
 join public.member_survey_campaigns campaign on campaign.key = marcada.campaign_key;
end;
$function$;

-- As três funções só podem ser chamadas pelo servidor, nunca pelo
-- navegador da cliente.
revoke all on function public.allow_member_login(text) from public, anon, authenticated;
grant execute on function public.allow_member_login(text) to service_role;
revoke all on function public.claim_member_offer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_member_offer(uuid, text, text) to service_role;
revoke all on function public.claim_member_survey(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_survey(uuid) to service_role;


-- =====================================================================
-- 9b. VISÕES DO PAINEL DE ADMIN
-- =====================================================================
--
-- Visão é uma consulta pronta com nome. Ela não guarda dado nenhum: toda
-- vez que o painel pergunta, ela monta a resposta na hora a partir das
-- tabelas. Por isso nunca fica desatualizada.
--
-- Estas duas são o painel inteiro. A member-api chama as duas em três
-- pontos — sem elas o admin não abre.

-- A ficha completa de cada cliente numa linha só: o que ela comprou, em
-- que ponto do funil está, quantos DIAS diferentes apareceu, quantas
-- orações concluiu e o que respondeu na pesquisa de perfil.
--
-- ⚠️ `security_invoker = true` é como a visão está na produção (conferido em
-- 24/09/2026). Esta receita tinha perdido a opção, nesta e na seguinte.
-- As "orações" não contam os dias do Cântico Angelical: o "Concluí" dele é
-- só para a cliente se achar (ver supabase/cantico-angelical.sql).
create or replace view public.admin_customer_overview with (security_invoker = true) as
 select customer.id,
    customer.name,
    customer.email,
    customer.created_at,
    coalesce(products.active_products, '{}'::text[]) as active_products,
        case
            when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'::text, 'upsell_02'::text, 'upsell_03'::text] then 'funil_completo'::text
            when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'::text, 'upsell_02'::text] then 'up01_e_up02'::text
            when coalesce(products.active_products, '{}'::text[]) @> array['upsell_01'::text] then 'somente_up01'::text
            when coalesce(products.active_products, '{}'::text[]) @> array['principal'::text] then 'somente_front'::text
            else 'sem_acesso_ativo'::text
        end as funnel_stage,
    coalesce(visits.distinct_visit_days, 0) as distinct_visit_days,
    visits.last_visit_on,
    coalesce(prayers.completed_prayers, 0) as completed_prayers,
    response.completed_at as profile_completed_at,
    response.motherhood_status,
    response.relationship_status,
    response.church_frequency,
    response.primary_prayer_recipient,
    response.primary_intention,
    response.favorite_devotion
   from public.customers customer
     left join lateral ( select array_agg(entitlement.product_key order by entitlement.product_key) as active_products
           from public.entitlements entitlement
          where entitlement.customer_id = customer.id and entitlement.status = 'active'::text) products on true
     left join lateral ( select count(*)::integer as distinct_visit_days,
            max(visit.visited_on) as last_visit_on
           from public.member_visit_days visit
          where visit.customer_id = customer.id) visits on true
     left join lateral ( select count(*)::integer as completed_prayers
           from public.prayer_progress progress
          where progress.customer_id = customer.id and progress.completed and progress.prayer_key !~ '^cantico:'::text) prayers on true
     left join public.member_survey_responses response on response.customer_id = customer.id and response.survey_key = 'member_profile_v1'::text;

-- O placar de cada campanha de pop-up: quantas foram reservadas, quantas
-- apareceram de fato, quantas levaram a clique e quantas viraram compra.
create or replace view public.admin_offer_overview with (security_invoker = true) as
 select campaign.key,
    campaign.headline,
    campaign.trigger_type,
    campaign.offer_type,
    campaign.enabled,
    campaign.sort_order,
    count(event.customer_id)::integer as claimed,
    count(event.shown_at)::integer as shown,
    count(event.clicked_at)::integer as clicked,
    count(event.dismissed_at)::integer as dismissed,
    count(event.converted_at)::integer as converted
   from public.member_offer_campaigns campaign
     left join public.member_offer_events event on event.campaign_key = campaign.key
  group by campaign.key, campaign.headline, campaign.trigger_type, campaign.offer_type, campaign.enabled, campaign.sort_order;


-- Conversão do upsell separada por forma de pagamento do front.
--
-- A forma de pagamento NÃO vem no evento que libera o acesso: ela chega no
-- evento da fatura, que o sistema guarda inteiro. Como o texto completo de
-- todos os eventos fica no banco, dá para extrair sem pedir nada novo à
-- Hubla — e funciona para o passado também.
--
-- ⚠️ Só enxerga vendas que passaram pelo webhook. Base histórica importada
-- e liberações manuais não têm fatura, logo não têm forma de pagamento.
create or replace view public.admin_payment_overview as
with fatura_do_front as (
  select distinct on (event.payload->'event'->'user'->>'id')
         event.payload->'event'->'user'->>'id' as hubla_user_id,
         event.payload->'event'->'invoice'->>'paymentMethod' as payment_method
    from public.hubla_events as event
    join public.hubla_product_map as map
      on map.hubla_id = event.payload->'event'->'product'->>'id'
   where event.event_type = 'invoice.status_updated'
     and event.payload->'event'->'invoice'->>'status' = 'paid'
     and map.product_key = 'principal'
     and event.sandbox = false
   order by event.payload->'event'->'user'->>'id', event.received_at
),
comprou_o_upsell as (
  select distinct customer.hubla_user_id
    from public.entitlements as entitlement
    join public.customers as customer on customer.id = entitlement.customer_id
   where entitlement.product_key = 'upsell_01'
     and customer.hubla_user_id is not null
)
select fatura.payment_method,
       count(*)::integer as front_buyers,
       count(upsell.hubla_user_id)::integer as upsell_buyers
  from fatura_do_front as fatura
  left join comprou_o_upsell as upsell
    on upsell.hubla_user_id = fatura.hubla_user_id
 where fatura.payment_method is not null
 group by fatura.payment_method;


-- =====================================================================
-- 10. CONFIGURAÇÃO DO NEGÓCIO
-- =====================================================================
-- Daqui para baixo não é estrutura, é conteúdo: os quatro produtos, o
-- tradutor de códigos da Hubla e os pop-ups. Nenhum dado de cliente.

insert into public.products(key, title, description, enabled, sort_order, type, billing_type, unlocks_app) values
 ('principal', 'Os 7 Améns da Madrugada', 'Todo o conteúdo atual: 7 Orações Sagradas, Pai Nosso, Mensagem do Dia e Novena Desatadora dos Nós.', true, 0, 'main', 'one_time', true),
 ('upsell_01', 'Oração Celestial dos Quatro Arcanjos', 'Oferta seguinte ao produto principal.', false, 10, 'addon', 'subscription', false),
 ('upsell_02', 'Músicas dos Anjos', 'Segunda oferta do funil.', false, 20, 'addon', 'subscription', false),
 ('upsell_03', 'Comunidade da Fé', 'Terceira oferta do funil.', false, 30, 'addon', 'subscription', false)
on conflict (key) do nothing;

-- Placar final da investigação dos códigos: dos três links hub.la/g,
-- DOIS estavam errados. Só Comunidade da Fé coincidia.
insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('bniYICXEzykgw1PzEyme', 'principal', 'CONFIRMADO em 2026-09-18 pelo sandbox: event.product.id veio exatamente igual a este valor.'),
 ('EnCFJKb2OJLinZYUy1MC', 'principal', 'Oferta "Os 7 Amens da madrugada (Copia)", R$ 97. E o proprio produto principal a preco promocional, confirmado pelo Caio em 2026-09-18.'),
 ('ODOZxlF1tfhee2TkZikI', 'upsell_01', 'CONFIRMADO em 2026-09-18 pelo sandbox: este e o event.product.id real de Oracao Celestial dos Quatro Arcanjos.'),
 ('5pUr8toveL5R5zR3zyaT', 'upsell_01', 'Slug de hub.la/g para Arcanjos. NAO e o product.id real (ODOZxlF1tfhee2TkZikI e). Mantido por so poder significar este produto.'),
 ('vRuLDZ1avAMG2LllTWAu', 'upsell_02', 'CONFIRMADO em 2026-09-18 pelo sandbox: este e o event.product.id real de Musicas dos Anjos.'),
 ('gTLhMYXqRjFeNlyc7FlH', 'upsell_02', 'Slug de hub.la/g de Musicas dos Anjos. NAO e o product.id real (vRuLDZ1avAMG2LllTWAu e). Mantido por so poder significar este produto.'),
 ('nMyLP4oFcIWiJ77UIbsu', 'upsell_03', 'CONFIRMADO em 2026-09-18 por evento real de Comunidade da Fe - Padre Thiago.')
on conflict (hubla_id) do nothing;

-- Os quatro pop-ups no ar. v1 fala com quem acabou de comprar ("antes de
-- começar"); v2 fala com a base antiga, que já está rezando ("antes de
-- finalizar"). O -a é a primeira exibição, o -b é a segunda.
insert into public.member_offer_campaigns(key, headline, body, cta_label, target_url, required_product_keys, excluded_product_keys, enabled, sort_order, trigger_type, offer_type, eyebrow, dismiss_label, required_principal_sources) values
 ('front_novas_1', 'O inimigo não precisa impedir sua oração.',
  'Às vezes, basta esperar você receber aquilo que pediu… e encontrar sua vida desprotegida depois.
Existe uma orientação que você precisa ouvir antes das 7 Madrugadas.',
  'Entender antes de começar', 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1-a',
  '{principal}', '{upsell_01,upsell_02,upsell_03}', true, 10, 'entry', 'product',
  '🚨 Leia com atenção!
Antes da primeira madrugada', 'Prefiro me arriscar sozinha', '{hubla,manual}'),
 ('front_novas_2', 'O inimigo não precisa impedir sua oração.',
  'Às vezes, basta esperar você receber aquilo que pediu… e encontrar sua vida desprotegida depois.
Existe uma orientação que você precisa ouvir antes das 7 Madrugadas.',
  'Entender antes de começar', 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1-b',
  '{principal}', '{upsell_01,upsell_02,upsell_03}', true, 11, 'entry', 'product',
  '🚨 Leia com atenção!
Antes da primeira madrugada', 'Prefiro me arriscar sozinha', '{hubla,manual}'),
 ('front_antigas_1', 'O inimigo não precisa impedir sua oração.',
  'Às vezes, basta esperar você receber aquilo que pediu… e encontrar sua vida desprotegida depois.
Existe uma orientação que você precisa ouvir antes de finalizar as 7 Madrugadas.',
  'Entender instruções', 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2-a',
  '{principal}', '{upsell_01,upsell_02,upsell_03}', true, 12, 'entry', 'product',
  '🚨 Leia com atenção!
Antes de finalizar as 7 madrugadas', 'Prefiro me arriscar sozinha', '{hubla_import}'),
 ('front_antigas_2', 'O inimigo não precisa impedir sua oração.',
  'Às vezes, basta esperar você receber aquilo que pediu… e encontrar sua vida desprotegida depois.
Existe uma orientação que você precisa ouvir antes de finalizar as 7 Madrugadas.',
  'Entender instruções', 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2-b',
  '{principal}', '{upsell_01,upsell_02,upsell_03}', true, 13, 'entry', 'product',
  '🚨 Leia com atenção!
Antes de finalizar as 7 madrugadas', 'Prefiro me arriscar sozinha', '{hubla_import}')
on conflict (key) do nothing;

-- Campanhas do funil futuro: já existem, mas DESLIGADAS e sem link. Só
-- passam a valer quando o link de checkout for preenchido e enabled virar
-- true. Estão aqui para o desenho do funil não se perder.
insert into public.member_offer_campaigns(key, headline, body, cta_label, required_product_keys, excluded_product_keys, enabled, sort_order, trigger_type, source_campaign_key, offer_type, eyebrow, dismiss_label) values
 ('upsell_01_to_upsell_02', 'Uma condição especial para continuar sua jornada', 'Preparamos uma oferta especial do próximo conteúdo para você avançar ainda mais em sua caminhada.', 'Conhecer a oferta do Up 02', '{principal,upsell_01}', '{upsell_02,upsell_03}', false, 20, 'entry', null, 'product', 'Oferta exclusiva para você', 'Agora não'),
 ('upsell_02_dismissal_to_bundle', 'Antes de ir, queremos fazer uma última condição', 'Você poderá receber o Up 02 junto com o Up 03 em uma condição especial preparada para este momento.', 'Ver minha condição especial', '{principal,upsell_01}', '{upsell_02,upsell_03}', false, 25, 'dismissal', 'upsell_01_to_upsell_02', 'product', 'Uma última oportunidade', 'Não quero aproveitar'),
 ('upsell_01_02_to_upsell_03_subscription', 'Seu próximo passo pode acompanhar você todos os meses', 'Como você já avançou em nossa jornada, preparamos uma assinatura mensal acessível e exclusiva para você.', 'Conhecer minha assinatura', '{principal,upsell_01,upsell_02}', '{upsell_03}', false, 30, 'entry', null, 'subscription', 'Condição exclusiva', 'Agora não'),
 ('full_funnel_to_vip_whatsapp', 'Você faz parte das nossas clientes mais especiais', 'Queremos convidar você para um grupo VIP, onde compartilharemos novidades e condições reservadas.', 'Entrar no grupo VIP', '{principal,upsell_01,upsell_02,upsell_03}', '{}', false, 40, 'entry', null, 'vip', 'Convite especial', 'Talvez depois')
on conflict (key) do nothing;

-- As quatro campanhas ligadas vendem a mesma coisa: a Oração Celestial dos
-- Quatro Arcanjos. Elas se diferenciam pelo público (cliente nova x base
-- antiga) e pela vez (primeira x segunda exibição), não pelo produto.
-- As campanhas desligadas ficam sem produto de propósito: duas delas vendem
-- combinação de produtos, e chutar o mapeamento faria o painel atribuir
-- venda errada.
update public.member_offer_campaigns
   set offered_product_key = 'upsell_01'
 where key in ('front_novas_1', 'front_novas_2', 'front_antigas_1', 'front_antigas_2')
   and offered_product_key is null;

insert into public.member_survey_campaigns(key, survey_key, target_path, min_distinct_visit_days, enabled, sort_order) values
 ('profile_after_third_visit_day', 'member_profile_v1', 'perfil.html', 3, true, 10)
on conflict (key) do nothing;

-- =====================================================================
-- FIM. Num banco vazio, isto acima é o sistema inteiro de pé.
-- =====================================================================
