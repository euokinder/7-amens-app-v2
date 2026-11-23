-- =====================================================================
-- 18-tres-madrugadas.sql — "Three Mornings of Intercession" no app em
-- inglês (23/11/2026)
-- =====================================================================
-- CÓPIA do supabase/latam/16-tres-madrugadas.sql (o espanhol, 18/11), com
-- as tabelas en_. Pedido do Arthur: a mesma entrega do Brasil e do
-- espanhol, em inglês. Quem comprou vê o card na home /en e assiste às três
-- madrugadas; quem não comprou não vê nada. Pagamento único.
--
-- ONDE A VENDA ACONTECE: desde 18/11 o botão do fim do vídeo do Day 7 leva
-- à Hubla (Q4yKyAd7GkCQYAnHbZty, US$ 27). A Hubla é a MESMA conta do
-- Brasil, e o aviso chega no hubla-webhook do Brasil, que grava em
-- hubla_events e deixa a venda como "produto não mapeado" (sem dar nada).
-- De 18 a 22/11: 7 vendas reais (customer.member_added).
--
-- COMO O INGLÊS LIBERA SEM ENCOSTAR NO BRASIL: en_hubla_liberar() só LÊ
-- hubla_events (nada do Brasil é alterado), acha as vendas dos códigos de
-- en_hubla_products com produto 'tres_madrugadas' e libera em en_access:
--   - o app, por 12 meses a partir da venda ("ativo até a data mais longe");
--   - o extra 'tres_madrugadas' (source 'hubla').
-- Cada venda é tratada UMA vez (en_hubla_liberadas guarda o id do aviso):
-- retirar à mão no painel depois não é desfeito pela rodada seguinte.
-- Reembolso não tira nada (a regra do inglês, igual à do espanhol).
--
-- QUEM CHAMA: o pg_cron, a cada 5 minutos, olhando só os avisos dos
-- últimos 2 dias (índice de received_at: ~0,1 s, como o do espanhol). A
-- CARGA de quem comprou antes é a mesma função, chamada uma vez (seção 6).
--
-- O QUE MUDA (só coisas en_):
--   1. en_access aceita product 'tres_madrugadas' e source 'hubla';
--   2. en_hubla_products ganha o código da Hubla (a tabela já aceita o
--      produto 'tres_madrugadas', desde o 14-hubla.sql);
--   3. en_hubla_liberadas (cada venda da Hubla já tratada, sem e-mail);
--   4. en_extras devolve também 'tres_madrugadas';
--   5. en_hubla_liberar(desde) e o agendamento no pg_cron;
--   6. a carga.
--
-- ORDEM: este SQL (o Arthur, no SQL Editor) -> a en-api nova -> o site.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- 0. O agendador (já ligado na produção; este comando não muda nada).
create extension if not exists pg_cron;


-- 1. O acesso aceita o produto novo e a origem 'hubla'.
alter table public.en_access drop constraint if exists en_access_product_check;
alter table public.en_access add constraint en_access_product_check
  check (product in ('app','arcangeles','cantico','tres_madrugadas'));
alter table public.en_access drop constraint if exists en_access_source_check;
alter table public.en_access add constraint en_access_source_check
  check (source in ('checkout','import','manual','emergencia','hubla'));


-- 2. O tradutor: código da oferta na Hubla -> produto do inglês.
--    ⚠️ Oferta NOVA de Three Mornings na Hubla = uma linha aqui ANTES da
--    primeira venda (se esquecer, basta acrescentar e rodar a carga).
--    ⛔ Nunca no hubla_product_map do Brasil: liberaria o app BRASILEIRO.
insert into public.en_hubla_products (hubla_id, produto, nome) values
  ('Q4yKyAd7GkCQYAnHbZty', 'tres_madrugadas', 'Three Mornings of Intercession, US$ 27 (botão do Day 7 desde 18/11/2026)')
on conflict (hubla_id) do update set produto = excluded.produto, nome = excluded.nome;


-- 3. Cada venda da Hubla já tratada pelo inglês. Sem e-mail nem nome: só o
--    id do aviso (hubla_events.id) e a cliente.
create table if not exists public.en_hubla_liberadas (
  hubla_event_id uuid primary key,
  customer_id uuid references public.en_customers(id) on delete set null,
  produto text not null,
  status text not null check (status in ('liberado','sem_email')),
  detalhe text not null default '',
  venda_em timestamptz not null,
  tratado_em timestamptz not null default now()
);
alter table public.en_hubla_liberadas enable row level security;
revoke all on public.en_hubla_liberadas from anon, authenticated;
drop policy if exists backend_only on public.en_hubla_liberadas;
create policy backend_only on public.en_hubla_liberadas for all to service_role using (true) with check (true);


-- 4. en_extras: a mesma do 05-extras.sql (conferida igual à da produção em
--    23/11), com Three Mornings:
--    - 'compra' quando a cobrança tem 'tres_madrugadas' (Digistore ou a
--      en-hubla), ou quando a linha em en_access veio da Hubla;
--    - a DÚVIDA não libera Three Mornings;
--    - o painel manda por cima, como nos outros extras.
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
  if 'tres_madrugadas' = any(v_owned) then v_origem := v_origem || '{"tres_madrugadas":"compra"}'; end if;

  -- A dúvida: sobra uma cobrança sem produto que não é a compra do app.
  -- (Só os dois extras antigos; Three Mornings, nunca.)
  if v_unknown - (case when 'principal' = any(v_owned) then 0 else 1 end) >= 1 then
    if not v_origem ? 'arcangeles' then v_origem := v_origem || '{"arcangeles":"duvida"}'; end if;
    if not v_origem ? 'cantico' then v_origem := v_origem || '{"cantico":"duvida"}'; end if;
  end if;

  -- O que está em en_access (painel, Hubla) manda por cima.
  for r in
    select a.product, a.status, a.source from public.en_access a
    where a.customer_id = p_customer_id and a.product in ('arcangeles','cantico','tres_madrugadas')
  loop
    if r.status = 'active' then
      if not v_origem ? r.product then
        v_origem := v_origem || jsonb_build_object(r.product, case when r.source = 'hubla' then 'compra' else 'manual' end);
      end if;
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


-- 5. A liberação. Lê as vendas da Hubla desde p_desde (só os códigos de
--    Three Mornings em en_hubla_products, só customer.member_added, sem
--    sandbox) que o inglês ainda não tratou. hubla_events é SÓ lida.
create or replace function public.en_hubla_liberar(p_desde timestamptz)
returns table(liberadas integer, sem_email integer)
language plpgsql set search_path to ''
as $function$
declare
  v record;
  v_email text;
  v_customer uuid;
  v_ate timestamptz;
  v_liberadas integer := 0;
  v_sem integer := 0;
begin
  for v in
    select h.id, h.received_at, m.produto,
           lower(btrim(coalesce(h.payload #>> '{event,user,email}', ''))) as email,
           btrim(concat_ws(' ', h.payload #>> '{event,user,firstName}', h.payload #>> '{event,user,lastName}')) as nome
    from public.hubla_events h
    join public.en_hubla_products m on m.hubla_id = h.hubla_product_id and m.produto = 'tres_madrugadas'
    where h.received_at >= p_desde
      and h.event_type = 'customer.member_added'
      and not h.sandbox
      and not exists (select 1 from public.en_hubla_liberadas l where l.hubla_event_id = h.id)
    order by h.received_at
  loop
    v_email := v.email;
    if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      insert into public.en_hubla_liberadas (hubla_event_id, produto, status, detalhe, venda_em)
      values (v.id, v.produto, 'sem_email', 'Venda sem e-mail utilizável: liberar à mão no /en-admin.', v.received_at)
      on conflict do nothing;
      v_sem := v_sem + 1;
      continue;
    end if;

    -- A cliente: a que já existe com esse e-mail, ou uma nova (com o nome
    -- da Hubla, se houver; o nome nunca é um e-mail).
    insert into public.en_customers (email, name)
    values (v_email, case when v.nome like '%@%' then '' else left(v.nome, 120) end)
    on conflict (email) do nothing;
    select c.id into v_customer from public.en_customers c where c.email = v_email;

    -- O app: ativo até a data mais longe (12 meses da venda). Compra nova
    -- reativa quem foi retirada à mão.
    v_ate := v.received_at + interval '365 days';
    insert into public.en_access (customer_id, product, status, source, expires_at, granted_at, updated_at, note)
    values (v_customer, 'app', 'active', 'hubla', v_ate, now(), now(), 'Hubla: ' || v.produto)
    on conflict (customer_id, product) do update set
      status = 'active',
      expires_at = case
        when en_access.expires_at is null and en_access.status = 'active' then null
        when en_access.expires_at is not null and en_access.expires_at > excluded.expires_at then en_access.expires_at
        else excluded.expires_at end,
      revoked_at = null,
      updated_at = now();

    -- O extra (sem prazo próprio: vale enquanto o app valer).
    insert into public.en_access (customer_id, product, status, source, expires_at, granted_at, updated_at)
    values (v_customer, v.produto, 'active', 'hubla', null, now(), now())
    on conflict (customer_id, product) do update set
      status = 'active', source = 'hubla', revoked_at = null, updated_at = now();

    insert into public.en_hubla_liberadas (hubla_event_id, customer_id, produto, status, venda_em)
    values (v.id, v_customer, v.produto, 'liberado', v.received_at)
    on conflict do nothing;
    v_liberadas := v_liberadas + 1;
  end loop;

  return query select v_liberadas, v_sem;
end;
$function$;
revoke all on function public.en_hubla_liberar(timestamptz) from public, anon, authenticated;
grant execute on function public.en_hubla_liberar(timestamptz) to service_role;

-- O agendamento: a cada 5 minutos, olhando 2 dias para trás, com freio de
-- 10 s (a consulta leva ~0,1 s). Rodar de novo só troca o agendamento.
select cron.schedule(
  'en-hubla-liberar',
  '*/5 * * * *',
  $cron$set statement_timeout = '10s'; select public.en_hubla_liberar(now() - interval '2 days');$cron$
);


-- 6. A CARGA: quem comprou desde 18/11 (o botão foi para a Hubla nesse dia).
select * from public.en_hubla_liberar('2026-11-18');


-- =====================================================================
-- CONFERIR (só leitura; tudo leve)
-- =====================================================================
-- select a.source, a.status, count(*) from public.en_access a
--  where a.product = 'tres_madrugadas' group by 1, 2;
-- select status, count(*), max(venda_em) from public.en_hubla_liberadas group by 1;
-- select jobname, schedule, active from cron.job where jobname = 'en-hubla-liberar';

-- =====================================================================
-- DESFAZER (só se precisar voltar atrás; nada do Brasil é tocado)
-- =====================================================================
-- select cron.unschedule('en-hubla-liberar');
-- drop function if exists public.en_hubla_liberar(timestamptz);
-- en_extras de antes: rodar de novo a seção dela no 05-extras.sql.
-- drop table if exists public.en_hubla_liberadas;
-- delete from public.en_hubla_products where produto = 'tres_madrugadas';
-- delete from public.en_access where product = 'tres_madrugadas';
