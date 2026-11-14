-- =====================================================================
-- App em inglês (7 Amens Before Dawn) - os extras dentro do app
-- =====================================================================
-- Cópia de supabase/latam/05-extras.sql: o UP01 (The Four Archangels) e o
-- UP02 (Angelic Canticle) dentro do app, "seguindo o mesmo esquema do
-- Brasil":
--   - quem tem vê o card liberado e entra;
--   - quem não tem vê "🔒 EXTRA", que leva à página de venda;
--   - o Cântico é uma jornada de 7 dias, um por dia, com "I finished this day".
-- Este arquivo SÓ mexe em coisas en_: nada do Brasil nem da LATAM é alterado.
--
--   en_cantico_progress   os dias do Cântico que ela marcou
--   en_extras()           o que ela tem, para a en-api e o painel
--
-- (No espanhol, este arquivo também alterava as travas de latam_access e de
-- latam_admin_actions. Aqui elas já nascem com os extras: 01-tabelas.sql e
-- 04-admin.sql.)
--
-- QUEM TEM CADA EXTRA (en_extras), nesta ordem:
--   1. a compra: en_pedidos_pagos (02-compras.sql). ⏳ EUA: checkout — vazia
--      até o checkout existir; até lá, os extras só abrem pelo painel;
--   2. a dúvida: cobrança sem produto registrado que não é a própria compra
--      do app. Decisão do Caio no espanhol (07/11): LIBERA OS DOIS. Esconder
--      algo pago gera reclamação e disputa;
--   3. o painel manda por cima: liberado à mão soma; retirado à mão tira,
--      mesmo que ela tenha comprado.
-- A carga manual ('import') não tem compra registrada: os extras dela, se
-- houver, entram pelo painel.
--
-- Reembolso e disputa NÃO tiram o extra, como não tiram o app (a mesma regra
-- do espanhol). O extra não tem prazo próprio: vale enquanto o app valer.
--
-- DEPENDE DE: 01-tabelas.sql e 02-compras.sql.
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Arthur, no SQL Editor).
-- Pode rodar de novo sem estragar nada.
-- =====================================================================


-- 1. Os dias do Cântico que ela marcou (0 = introdução; 1 a 7 = os dias).
--    Tabela própria, para não mexer na chave de en_progress, que é a das
--    madrugadas.
create table if not exists public.en_cantico_progress (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  day smallint not null,
  completed_at timestamptz not null default now(),
  primary key (customer_id, day),
  constraint en_cantico_progress_day_check check (day between 0 and 7)
);
alter table public.en_cantico_progress enable row level security;
revoke all on public.en_cantico_progress from anon, authenticated;
drop policy if exists backend_only on public.en_cantico_progress;
create policy backend_only on public.en_cantico_progress for all to service_role using (true) with check (true);


-- 2. O que ela tem. Devolve:
--    {"extras": ["arcangeles","cantico"],
--     "origem": {"arcangeles": "compra", "cantico": "duvida"},
--     "cantico_hechos": [1, 2]}
--    origem: compra | duvida | manual | retirado. Sem cliente, null.
--    (Os nomes dos campos são os do espanhol, de propósito: a en-api e as
--    telas leem os mesmos.)
create or replace function public.en_extras(p_customer_id uuid)
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
  select c.email into v_email from public.en_customers c where c.id = p_customer_id;
  if v_email is null then return null; end if;

  -- O que ela comprou, cobrança por cobrança (02-compras.sql).
  with pagos as (
    select distinct on (p.pedido) p.produtos
    from public.en_pedidos_pagos p
    where p.customer_id = p_customer_id
       or (p.customer_id is null and lower(p.email) = v_email)
    order by p.pedido, (p.produtos is null)
  )
  select coalesce((select array_agg(distinct x) from pagos, unnest(pagos.produtos) x), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  if 'arcangeles' = any(v_owned) then v_origem := v_origem || '{"arcangeles":"compra"}'; end if;
  if 'cantico' = any(v_owned) then v_origem := v_origem || '{"cantico":"compra"}'; end if;

  -- A dúvida: sobra uma cobrança sem produto que não é a compra do app.
  if v_unknown - (case when 'principal' = any(v_owned) then 0 else 1 end) >= 1 then
    if not v_origem ? 'arcangeles' then v_origem := v_origem || '{"arcangeles":"duvida"}'; end if;
    if not v_origem ? 'cantico' then v_origem := v_origem || '{"cantico":"duvida"}'; end if;
  end if;

  -- O painel manda por cima.
  for r in
    select a.product, a.status from public.en_access a
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
    'cantico_hechos', coalesce((select jsonb_agg(p.day order by p.day) from public.en_cantico_progress p where p.customer_id = p_customer_id), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.en_extras(uuid) from public, anon, authenticated;
grant execute on function public.en_extras(uuid) to service_role;


-- =====================================================================
-- CONFERIR (só leitura)
-- =====================================================================
-- select relname, relrowsecurity from pg_class where relname = 'en_cantico_progress';
-- Quantas têm cada extra, e por quê (leve: as tabelas en_ são pequenas):
-- select o.key as extra, o.value as origem, count(*)
--   from public.en_customers c,
--        lateral jsonb_each_text(public.en_extras(c.id) -> 'origem') o
--  group by 1, 2 order by 1, 2;


-- =====================================================================
-- DESFAZER (só se precisar voltar atrás; nada do Brasil nem da LATAM)
-- =====================================================================
-- drop function if exists public.en_extras(uuid);
-- drop table if exists public.en_cantico_progress;
-- delete from public.en_access where product <> 'app';
