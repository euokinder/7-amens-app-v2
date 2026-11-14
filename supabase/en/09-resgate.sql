-- =====================================================================
-- 09-resgate.sql — o resgate de quem não acha o e-mail da compra
-- =====================================================================
-- Cópia de supabase/latam/09-resgate.sql (10/11/2026). Por quê, no
-- espanhol: ~350 de ~820 compradoras nunca tinham entrado no app; 20 delas
-- compraram com o domínio do e-mail digitado errado (gmsil.com,
-- hotmail.com.como, iclod.con...), e o e-mail CERTO não achava a conta.
-- Decisão do Caio (10/11): o público é idoso e vulnerável, e entrar vem
-- antes de proteger. Nenhuma pode ficar sem saída. Vale igual para os EUA.
--
-- A escada da /en-login (a conta mora na en-api; aqui ficam só a busca e o
-- registro):
--   1. o e-mail, com os erros comuns corrigidos sem ela ver, e a busca do
--      "gêmeo" (o mesmo e-mail com o domínio gravado errado) e do "parecido"
--      (uma letra de diferença, só em conta que nunca entrou);
--   2. o final do cartão (os 4 últimos números) + o nome no cartão, que vêm
--      da compra (en_pedidos_pagos, 02-compras.sql). ⏳ EUA: checkout — até
--      o checkout existir, este passo não acha ninguém e a tela segue para
--      o passo 3;
--   3. a entrada de emergência: nome + e-mail ou WhatsApp, e ela entra na
--      hora. A equipe confere depois, no painel (/en-admin).
--
-- O que cria (só objetos en_; o Brasil e a LATAM não sentem nada):
--   1. en_resgates          o registro de cada resgate, para o painel
--   2. en_resgate_config    o interruptor da emergência e o freio por dia
--   3. en_distancia(a, b)   quantas letras separam dois textos
--   4. en_permite(...)      freio genérico (usa en_login_limits)
--   5. en_resgate_candidatos(local, dominio)   o gêmeo e o parecido
--   6. en_resgate_cartao(final)                as compras com esse final
-- (A origem 'emergencia' em en_access, que no espanhol entrava aqui por um
-- alter, já nasce em 01-tabelas.sql.)
--
-- REGRAS que valem para todo resgate (na SQL e na en-api):
--   - conta de administradora NUNCA entra por resgate (só pelo e-mail exato);
--   - só acha conta com o acesso ao app ativo e dentro do prazo;
--   - os 4 números que ela digita não são gravados em lugar nenhum.
--
-- DEPENDE DE: 01-tabelas.sql, 02-compras.sql e 04-admin.sql (en_admins).
-- ORDEM DE PUBLICAR: este SQL -> en-api -> site. Qualquer outra ordem é
-- inofensiva: a en-api sem este SQL entra pelo e-mail como antes (o resgate
-- só não acha nada), e a /en-login sem a função manda escrever ao suporte.
--
-- Pode rodar mais de uma vez. Não mexe em nenhuma linha que já existe.
-- Nenhum dado de pessoa aqui: o repositório é público.
-- =====================================================================

begin;

-- 1. O registro de cada resgate. É o que o painel mostra à equipe.
--    metodo:
--      corrigido   ela digitou com um erro comum (gmial.com); o certo existia
--      gemeo       o e-mail GRAVADO tinha o erro (gmsil.com); foi corrigido
--      parecido    uma letra de diferença (conta que nunca tinha entrado)
--      cartao      achou a compra pelos 4 últimos números + o nome
--      emergencia  entrou sem achar a compra; a equipe confere depois
--    situacao: 'por_confirmar' (emergência nova) ou 'resolvido'.
--    Os 4 números do cartão NÃO têm coluna: não são guardados.
create table if not exists public.en_resgates (
  id bigint generated always as identity primary key,
  customer_id uuid references public.en_customers(id) on delete set null,
  metodo text not null,
  email_digitado text not null default '',   -- o(s) e-mail(s) que ela tentou na entrada
  email_anterior text not null default '',   -- o e-mail gravado antes de uma correção
  nome text not null default '',             -- o nome que ela escreveu (cartão, emergência)
  contato text not null default '',          -- o e-mail ou WhatsApp que ela deu (emergência)
  pais text not null default '',             -- o país da conexão (cf-ipcountry)
  situacao text not null default 'resolvido',
  resolvido_por uuid references public.en_customers(id) on delete set null,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  constraint en_resgates_metodo_check check (metodo in ('corrigido','gemeo','parecido','cartao','emergencia')),
  constraint en_resgates_situacao_check check (situacao in ('por_confirmar','resolvido'))
);
create index if not exists en_resgates_created_at_idx on public.en_resgates (created_at desc);
create index if not exists en_resgates_customer_idx on public.en_resgates (customer_id, created_at desc);


-- 2. O interruptor da entrada de emergência (uma linha só).
--    Desligar: update public.en_resgate_config set emergencia_ligada = false, updated_at = now();
create table if not exists public.en_resgate_config (
  id integer primary key default 1,
  emergencia_ligada boolean not null default true,
  emergencias_por_dia integer not null default 2,   -- por conexão de internet, a cada 24 h
  updated_at timestamptz not null default now(),
  constraint en_resgate_config_uma_linha check (id = 1),
  constraint en_resgate_config_por_dia check (emergencias_por_dia between 0 and 50)
);
insert into public.en_resgate_config (id) values (1) on conflict (id) do nothing;


-- Ninguém de fora lê nada (como nas outras en_).
do $trava$
declare t text;
begin
  foreach t in array array['en_resgates','en_resgate_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 3. Quantas letras separam dois textos: trocar, faltar, sobrar ou inverter
--    duas vizinhas conta 1 cada. 'gmial' e 'gmail' = 1.
create or replace function public.en_distancia(a text, b text)
returns integer
language plpgsql immutable strict set search_path to ''
as $function$
declare
  la integer := length(a);
  lb integer := length(b);
  w integer := length(b) + 1;
  d integer[];
  i integer;
  j integer;
  custo integer;
begin
  if a = b then return 0; end if;
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  d := array_fill(0, array[(la + 1) * w]);
  for i in 0..la loop d[i * w + 1] := i; end loop;
  for j in 0..lb loop d[j + 1] := j; end loop;
  for i in 1..la loop
    for j in 1..lb loop
      custo := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      d[i * w + j + 1] := least(d[(i - 1) * w + j + 1] + 1, d[i * w + j] + 1, d[(i - 1) * w + j] + custo);
      if i > 1 and j > 1 and substr(a, i, 1) = substr(b, j - 1, 1) and substr(a, i - 1, 1) = substr(b, j, 1) then
        d[i * w + j + 1] := least(d[i * w + j + 1], d[(i - 2) * w + j - 1] + 1);
      end if;
    end loop;
  end loop;
  return d[la * w + lb + 1];
end;
$function$;
revoke all on function public.en_distancia(text, text) from public, anon, authenticated;
grant execute on function public.en_distancia(text, text) to service_role;


-- 4. Freio genérico: no máximo p_maximo vezes a cada p_minutos, por chave.
--    A en-api manda a chave já embaralhada (impressão digital do IP).
--    Usa a mesma tabela do freio de login, que se limpa sozinha (1 dia).
create or replace function public.en_permite(p_chave text, p_maximo integer, p_minutos integer)
returns boolean
language plpgsql set search_path to ''
as $function$
declare v integer;
begin
  insert into public.en_login_limits as l (key, window_start, attempts)
  values (p_chave, now(), 1)
  on conflict (key) do update set
    attempts = case when l.window_start < now() - make_interval(mins => p_minutos) then 1 else l.attempts + 1 end,
    window_start = case when l.window_start < now() - make_interval(mins => p_minutos) then now() else l.window_start end
  returning attempts into v;
  return v <= p_maximo;
end;
$function$;
revoke all on function public.en_permite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.en_permite(text, integer, integer) to service_role;


-- 5. Os candidatos para o e-mail que ela digitou (já com os erros comuns
--    corrigidos pela en-api), separado em local@dominio:
--      'gemeo'     o mesmo antes do @, com outro domínio. A en-api só aceita
--                  se o domínio gravado, corrigido, der o que ela digitou
--                  (gmsil.com -> gmail.com). Domínio de verdade diferente
--                  (hotmail.com x gmail.com) nunca vale.
--      'parecido'  o mesmo domínio, uma letra de diferença antes do @, com 6
--                  letras ou mais. A en-api só aceita conta que nunca
--                  entrou (`entrou` = false) e uma só.
--    Só contas com o app ativo e dentro do prazo; nunca administradora.
--    Roda só quando o e-mail digitado não achou ninguém.
create or replace function public.en_resgate_candidatos(p_local text, p_dominio text)
returns table (customer_id uuid, email text, tipo text, entrou boolean)
language sql stable set search_path to ''
as $function$
  with ativas as (
    select c.id, c.email,
           split_part(c.email, '@', 1) as loc,
           split_part(c.email, '@', 2) as dom
    from public.en_customers c
    join public.en_access a
      on a.customer_id = c.id and a.product = 'app' and a.status = 'active'
     and (a.expires_at is null or a.expires_at > now())
    where not exists (select 1 from public.en_admins ad where ad.customer_id = c.id)
  )
  select x.id, x.email, x.tipo,
         exists (select 1 from public.en_sessions s where s.customer_id = x.id) as entrou
  from (
    select id, email, 'gemeo'::text as tipo
    from ativas
    where loc = p_local and dom <> p_dominio
    union all
    select id, email, 'parecido'::text
    from ativas
    where dom = p_dominio and loc <> p_local
      and length(p_local) >= 6
      and abs(length(loc) - length(p_local)) <= 1
      and (left(loc, 1) = left(p_local, 1) or right(loc, 1) = right(p_local, 1))
      and public.en_distancia(loc, p_local) = 1
  ) x
  limit 20;
$function$;
revoke all on function public.en_resgate_candidatos(text, text) from public, anon, authenticated;
grant execute on function public.en_resgate_candidatos(text, text) to service_role;


-- 6. As compras pagas com um cartão que termina em p_final, com o nome no
--    cartão e o nome da cliente. A en-api confere o nome que ela escreveu
--    e só deixa entrar se sobrar UMA cliente.
--    Só contas com o app ativo e dentro do prazo; nunca administradora.
--    O final digitado só passa por aqui; não é gravado.
--    ⏳ EUA: checkout — lê en_pedidos_pagos (final_cartao e nome_cartao).
--    Vazia até o checkout existir; o índice do final do cartão (no espanhol,
--    em latam_whop_events) vai na tabela de avisos do checkout.
create or replace function public.en_resgate_cartao(p_final text)
returns table (customer_id uuid, email text, nome_cliente text, nome_cartao text)
language sql stable set search_path to ''
as $function$
  select distinct c.id, c.email, c.name, coalesce(p.nome_cartao, '')
  from public.en_pedidos_pagos p
  join public.en_customers c
    on c.id = p.customer_id
    or (p.customer_id is null and c.email = lower(p.email))
  join public.en_access a
    on a.customer_id = c.id and a.product = 'app' and a.status = 'active'
   and (a.expires_at is null or a.expires_at > now())
  where p_final ~ '^[0-9]{4}$'
    and p.final_cartao = p_final
    and not exists (select 1 from public.en_admins ad where ad.customer_id = c.id)
  limit 40;
$function$;
revoke all on function public.en_resgate_cartao(text) from public, anon, authenticated;
grant execute on function public.en_resgate_cartao(text) to service_role;

commit;


-- =====================================================================
-- CONFERÊNCIA (rodar depois; tudo leve)
-- =====================================================================
-- select public.en_distancia('gmial', 'gmail');          -- 1
-- select public.en_distancia('gmli', 'gmail');           -- 2
-- select * from public.en_resgate_config;                -- 1 linha, ligada, 2 por dia
-- select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relname in ('en_resgates','en_resgate_config');   -- RLS true
--
-- Os resgates do dia (o painel mostra os mesmos):
-- select metodo, situacao, count(*) from public.en_resgates
--  where created_at > now() - interval '1 day' group by 1, 2 order by 1, 2;
--
-- =====================================================================
-- DESLIGAR SÓ A EMERGÊNCIA (a busca pelo e-mail e pelo cartão continuam):
-- =====================================================================
-- update public.en_resgate_config set emergencia_ligada = false, updated_at = now();
--
-- =====================================================================
-- DESFAZER (só se for preciso; apaga só o que este arquivo criou). Antes,
-- conferir se há acesso de emergência (ele continua valendo; a origem
-- 'emergencia' é de 01-tabelas.sql).
-- =====================================================================
-- drop function if exists public.en_resgate_cartao(text);
-- drop function if exists public.en_resgate_candidatos(text, text);
-- drop function if exists public.en_permite(text, integer, integer);
-- drop function if exists public.en_distancia(text, text);
-- drop table if exists public.en_resgates, public.en_resgate_config;
