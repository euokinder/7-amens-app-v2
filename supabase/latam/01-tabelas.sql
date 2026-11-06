-- =====================================================================
-- App em espanhol (7 Amenes de la Madrugada) - as tabelas da LATAM
-- =====================================================================
-- Tudo da LATAM mora em tabelas com o prefixo latam_, separadas das do
-- Brasil. Este arquivo SÓ CRIA coisas novas: nenhuma tabela, visão,
-- função ou trava do app brasileiro é alterada. Pode rodar de novo sem
-- estragar nada (tudo é "if not exists" ou "create or replace" de nome
-- novo).
--
-- POR QUE PREFIXO, E NÃO UM SCHEMA "latam" SEPARADO
-- Um schema novo precisaria entrar na configuração da API do Supabase
-- (Data API -> Exposed schemas). Se essa configuração apontar para um
-- schema que não existe, a API INTEIRA para, com o mesmo erro do 28/10
-- (PGRST002), e o app brasileiro cai junto. Com o prefixo no schema
-- public, a configuração do Supabase não muda em nada.
--
-- ORDEM
-- 1. Banco de TESTE (wyiqwsgfictcfkytldnu): o agente roda.
-- 2. PRODUÇÃO (lbaudlocfbjunnaoyrtz): o Caio cola no SQL Editor, no
--    Bloco 5, e só depois de tudo provado no teste.
--
-- Plano completo: docs/app-es.md
-- =====================================================================


-- 1. A cliente. O e-mail é a identidade, como no Brasil: sem senha.
--    Uma pessoa que comprou no Brasil e na LATAM tem uma linha em cada
--    lado, e um lado nunca enxerga o outro.
create table if not exists public.latam_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  country text,           -- país do cartão, como a Whop mandou (MX, PA, US...)
  timezone text,          -- fuso do celular dela no primeiro acesso (America/Mexico_City)
  first_access_on date,   -- dia do primeiro acesso, NO FUSO DELA: a âncora da trava
  whop_user_id text,
  created_at timestamptz not null default now(),
  constraint latam_customers_email_check check (
    email = lower(btrim(email))
    and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint latam_customers_timezone_check check (
    timezone is null or timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$'
  )
);


-- 2. O acesso. Uma linha por cliente e produto (hoje só existe 'app').
--    Pagou = active, por 12 meses a partir da compra (expires_at).
--    Reembolso e disputa NÃO tiram o acesso (decisão de 05/11/2026, a
--    mesma da Payt): ficam só registrados em latam_whop_events. Tirar é
--    à mão: status 'revoked'.
create table if not exists public.latam_access (
  customer_id uuid not null references public.latam_customers(id) on delete cascade,
  product text not null default 'app',
  status text not null default 'active',
  source text not null,
  expires_at timestamptz,   -- null = sem prazo (só quando liberado à mão)
  whop_payment_id text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (customer_id, product),
  constraint latam_access_product_check check (product in ('app')),
  constraint latam_access_status_check check (status in ('active','revoked')),
  constraint latam_access_source_check check (source in ('whop','import','manual'))
);


-- 3. Onde ela parou: os dias que ela marcou como rezados.
--    0 = Comienza aquí; 1 a 7 = os sete Amenes.
create table if not exists public.latam_progress (
  customer_id uuid not null references public.latam_customers(id) on delete cascade,
  day smallint not null,
  completed_at timestamptz not null default now(),
  primary key (customer_id, day),
  constraint latam_progress_day_check check (day between 0 and 7)
);


-- 4. Sessões de login. Como no Brasil, só a impressão digital do código
--    fica guardada, nunca o código em si.
create table if not exists public.latam_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.latam_customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint latam_sessions_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists latam_sessions_customer_id_idx on public.latam_sessions (customer_id);
create index if not exists latam_sessions_expires_at_idx on public.latam_sessions (expires_at);


-- 5. Link de entrada, para quem não consegue digitar o e-mail. Como no
--    Brasil, o código fica guardado COMO É, de propósito: o suporte
--    copia o mesmo link de novo sem matar o que já mandou.
create table if not exists public.latam_entry_links (
  customer_id uuid primary key references public.latam_customers(id) on delete cascade,
  token text not null unique,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  uses integer not null default 0,
  constraint latam_entry_links_token_check check (token ~ '^[A-Za-z0-9]{16}$')
);


-- 6. Freio contra tentativa em massa de login (20 em 10 minutos).
create table if not exists public.latam_login_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);


-- 7. Em quantos dias diferentes ela apareceu, contados no fuso dela.
--    Conta dias, não visitas.
create table if not exists public.latam_visit_days (
  customer_id uuid not null references public.latam_customers(id) on delete cascade,
  visited_on date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (customer_id, visited_on)
);


-- 8. Cada aviso da Whop, inteiro. A chave é o webhook-id: a Whop repete
--    o mesmo id nas novas tentativas (até 12, em cerca de 3 dias), então
--    um aviso repetido não duplica nada.
--    status: received (chegou), processed (liberou), ignored (não era
--    para liberar: reembolso, outro produto, teste), failed (erro: refaz
--    no próximo reenvio), needs_review (faltou dado, por exemplo e-mail).
create table if not exists public.latam_whop_events (
  webhook_id text primary key,
  event_type text not null default '',
  payment_id text,
  customer_email text,
  status text not null default 'received',
  detail text not null default '',
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint latam_whop_events_status_check check (
    status in ('received','processed','ignored','failed','needs_review')
  )
);
create index if not exists latam_whop_events_payment_id_idx on public.latam_whop_events (payment_id);


-- 9. Ninguém de fora lê nada. Só o servidor (service_role), como no
--    Brasil: RLS ligado e anon/authenticated sem permissão nenhuma.
do $trava$
declare t text;
begin
  foreach t in array array[
    'latam_customers','latam_access','latam_progress','latam_sessions',
    'latam_entry_links','latam_login_limits','latam_visit_days','latam_whop_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 10. Freio de login da LATAM. Cópia do allow_member_login do Brasil,
--     apontando para as tabelas latam_. Aproveita a passagem para varrer
--     sessões vencidas.
create or replace function public.latam_allow_login(bucket_key text)
returns boolean language plpgsql set search_path to ''
as $function$
declare count_now integer;
begin
 delete from public.latam_login_limits where window_start < now() - interval '1 day';
 delete from public.latam_sessions where expires_at < now();
 insert into public.latam_login_limits as limits(key, window_start, attempts)
 values (bucket_key, now(), 1)
 on conflict (key) do update set
 attempts = case when limits.window_start < now() - interval '10 minutes' then 1 else limits.attempts + 1 end,
 window_start = case when limits.window_start < now() - interval '10 minutes' then now() else limits.window_start end
 returning attempts into count_now;
 return count_now <= 20;
end;
$function$;
revoke all on function public.latam_allow_login(text) from public, anon, authenticated;
grant execute on function public.latam_allow_login(text) to service_role;


-- =====================================================================
-- CONFERÊNCIA (rodar depois; tem de voltar 8 tabelas, todas com RLS)
-- =====================================================================
-- select c.relname as tabela, c.relrowsecurity as rls
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'latam\_%'
--  order by 1;
--
-- =====================================================================
-- DESFAZER (só se for preciso; apaga tudo da LATAM, nada do Brasil)
-- =====================================================================
-- drop function if exists public.latam_allow_login(text);
-- drop table if exists public.latam_whop_events, public.latam_visit_days,
--   public.latam_login_limits, public.latam_entry_links, public.latam_sessions,
--   public.latam_progress, public.latam_access, public.latam_customers;
