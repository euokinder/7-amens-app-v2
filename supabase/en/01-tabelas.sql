-- =====================================================================
-- App em inglês (7 Amens Before Dawn) - as tabelas do app dos EUA
-- =====================================================================
-- Tudo do app em inglês mora em objetos com o prefixo en_ (tabelas,
-- funções, visões, índices e travas), no MESMO banco do Brasil e da LATAM.
-- Estes arquivos SÓ CRIAM coisas en_: nenhuma tabela, visão, função ou
-- trava do Brasil nem da LATAM (latam_*) é criada, alterada ou apagada.
-- Pode rodar de novo sem estragar nada (tudo é "if not exists",
-- "create or replace" de nome en_ ou "on conflict do nothing").
--
-- É uma CÓPIA do app em espanhol (supabase/latam/), traduzida, sem as
-- peças de pagamento: o checkout dos EUA é montado por último.
-- ⏳ EUA: checkout — onde ele vai encaixar está marcado com essa frase.
--
-- ORDEM DE RODAR (um arquivo por vez, nesta ordem):
--   01-tabelas.sql                a cliente, o acesso, a jornada, as sessões
--   02-compras.sql                a visão en_pedidos_pagos (vazia até o checkout)
--   03-popups.sql                 os pop-ups de oferta (nascem DESLIGADOS)
--   04-admin.sql                  o painel (/en-admin)
--   05-extras.sql                 os Arcanjos e o Cântico dentro do app
--   09-resgate.sql                o resgate de quem não acha o e-mail
--   10-chat.sql                   a Lucy, o chat de suporte (nasce DESLIGADA)
--   11-reembolso.sql              o reembolso em um toque
--   13-digistore.sql              a venda pela Digistore24 (o checkout dos
--                                 EUA): avisos, números dos produtos e a
--                                 visão en_pedidos_pagos de verdade
-- Os números seguem os do espanhol, para comparar arquivo com arquivo.
-- Faltam de propósito: 06, 07 e 08 (pagamento no espanhol: KashPay e Whop)
-- e o 12 (no espanhol, uma correção do pop-up; aqui já entra pronta no 03).
--
-- POR QUE PREFIXO, E NÃO UM SCHEMA "en" SEPARADO
-- Um schema novo precisaria entrar na configuração da API do Supabase
-- (Data API -> Exposed schemas). Se essa configuração apontar para um
-- schema que não existe, a API INTEIRA para, com o mesmo erro do 28/10
-- (PGRST002), e o app brasileiro cai junto. Com o prefixo no schema
-- public, a configuração do Supabase não muda em nada.
--
-- ONDE RODAR
-- 1. Banco de TESTE (wyiqwsgfictcfkytldnu): o agente roda.
-- 2. PRODUÇÃO (lbaudlocfbjunnaoyrtz): o Arthur cola no SQL Editor, só
--    depois de tudo provado no teste, e nunca entre 3h e 8h de Brasília.
--
-- Plano completo: docs/app-en.md (e docs/app-es.md, o irmão mais velho).
-- =====================================================================


-- 1. A cliente. O e-mail é a identidade, como no Brasil: sem senha.
--    Uma pessoa que comprou no Brasil, na LATAM e nos EUA tem uma linha em
--    cada lado, e um lado nunca enxerga o outro.
create table if not exists public.en_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  country text,           -- país do cartão (US...). ⏳ EUA: checkout — quem preenche é a função de pagamento
  timezone text,          -- fuso do celular dela no primeiro acesso (America/New_York)
  first_access_on date,   -- dia do primeiro acesso, NO FUSO DELA: a âncora da trava
  created_at timestamptz not null default now(),
  constraint en_customers_email_check check (
    email = lower(btrim(email))
    and length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint en_customers_timezone_check check (
    timezone is null or timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$'
  )
);


-- 2. O acesso. Uma linha por cliente e produto:
--      'app'        o app (a jornada das 7 orações);
--      'arcangeles' e 'cantico'  os extras (05-extras.sql). No espanhol, a
--                   compra de um extra NÃO grava aqui: só o que o painel faz
--                   à mão (liberar ou retirar).
--    Pagou = active, por 12 meses a partir da compra (expires_at).
--    Reembolso e disputa NÃO tiram o acesso (a mesma regra do espanhol):
--    ficam só registrados. Tirar é à mão: status 'revoked'.
--    source (de onde veio o acesso):
--      'checkout'   a venda, liberada pela função de pagamento: desde
--                   14/11/2026, a en-digistore (13-digistore.sql). Quem
--                   cobrou fica em en_digistore_events. É o nome que o painel
--                   e a Lucy (en_chat_posicao, 10-chat.sql) já contam.
--      'import'     carga de quem comprou antes da função de pagamento
--      'manual'     liberado à mão no painel
--      'emergencia' a entrada de emergência do resgate (09-resgate.sql)
create table if not exists public.en_access (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  product text not null default 'app',
  status text not null default 'active',
  source text not null,
  expires_at timestamptz,   -- null = sem prazo (só quando liberado à mão)
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (customer_id, product),
  constraint en_access_product_check check (product in ('app','arcangeles','cantico')),
  constraint en_access_status_check check (status in ('active','revoked')),
  constraint en_access_source_check check (source in ('checkout','import','manual','emergencia'))
);


-- 3. Onde ela parou: os dias que ela marcou como rezados.
--    0 = Start Here; 1 a 7 = os sete Amens.
create table if not exists public.en_progress (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  day smallint not null,
  completed_at timestamptz not null default now(),
  primary key (customer_id, day),
  constraint en_progress_day_check check (day between 0 and 7)
);


-- 4. Sessões de login. Como no Brasil, só a impressão digital do código
--    fica guardada, nunca o código em si.
create table if not exists public.en_sessions (
  token_hash text primary key,
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint en_sessions_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists en_sessions_customer_id_idx on public.en_sessions (customer_id);
create index if not exists en_sessions_expires_at_idx on public.en_sessions (expires_at);


-- 5. Link de entrada, para quem não consegue digitar o e-mail. Como no
--    Brasil, o código fica guardado COMO É, de propósito: o suporte
--    copia o mesmo link de novo sem matar o que já mandou.
create table if not exists public.en_entry_links (
  customer_id uuid primary key references public.en_customers(id) on delete cascade,
  token text not null unique,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  uses integer not null default 0,
  constraint en_entry_links_token_check check (token ~ '^[A-Za-z0-9]{16}$')
);


-- 6. Freio contra tentativa em massa de login (20 em 10 minutos). O freio
--    genérico en_permite (09-resgate.sql) usa a mesma tabela.
create table if not exists public.en_login_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);


-- 7. Em quantos dias diferentes ela apareceu, contados no fuso dela.
--    Conta dias, não visitas.
create table if not exists public.en_visit_days (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  visited_on date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (customer_id, visited_on)
);


-- 8. ⏳ EUA: checkout — no espanhol, aqui ficava latam_whop_events (cada aviso
--    da Whop). Os avisos do checkout dos EUA vão ganhar tabela própria
--    (en_<checkout>_events), no arquivo do checkout, com a chave do aviso
--    como primary key e a gravação com on_conflict (lição de 16/10: sem o
--    ?on_conflict=<coluna>, o aviso repetido vira erro 409).


-- 9. Ninguém de fora lê nada. Só o servidor (service_role), como no
--    Brasil: RLS ligado e anon/authenticated sem permissão nenhuma.
do $trava$
declare t text;
begin
  foreach t in array array[
    'en_customers','en_access','en_progress','en_sessions',
    'en_entry_links','en_login_limits','en_visit_days'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 10. Freio de login do app em inglês. Cópia do allow_member_login do
--     Brasil, apontando para as tabelas en_. Aproveita a passagem para
--     varrer sessões vencidas.
create or replace function public.en_allow_login(bucket_key text)
returns boolean language plpgsql set search_path to ''
as $function$
declare count_now integer;
begin
 delete from public.en_login_limits where window_start < now() - interval '1 day';
 delete from public.en_sessions where expires_at < now();
 insert into public.en_login_limits as limits(key, window_start, attempts)
 values (bucket_key, now(), 1)
 on conflict (key) do update set
 attempts = case when limits.window_start < now() - interval '10 minutes' then 1 else limits.attempts + 1 end,
 window_start = case when limits.window_start < now() - interval '10 minutes' then now() else limits.window_start end
 returning attempts into count_now;
 return count_now <= 20;
end;
$function$;
revoke all on function public.en_allow_login(text) from public, anon, authenticated;
grant execute on function public.en_allow_login(text) to service_role;


-- =====================================================================
-- CONFERÊNCIA (rodar depois de TODOS os arquivos; leve)
-- Tem de voltar 18 tabelas en_, todas com RLS:
--   01: en_customers, en_access, en_progress, en_sessions, en_entry_links,
--       en_login_limits, en_visit_days
--   03: en_offer_campaigns, en_offer_events   04: en_admins, en_admin_actions
--   05: en_cantico_progress                   09: en_resgates, en_resgate_config
--   10: en_chat_config, en_chat_conversas, en_chat_mensagens
--   11: en_refund_requests
-- =====================================================================
-- select c.relname as tabela, c.relrowsecurity as rls
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'en\_%'
--  order by 1;
--
-- =====================================================================
-- DESFAZER (só se for preciso; apaga só o que este arquivo criou, nada do
-- Brasil nem da LATAM). Antes, rodar o DESFAZER dos outros arquivos en_,
-- do último para o primeiro.
-- =====================================================================
-- drop function if exists public.en_allow_login(text);
-- drop table if exists public.en_visit_days, public.en_login_limits,
--   public.en_entry_links, public.en_sessions, public.en_progress,
--   public.en_access, public.en_customers;
