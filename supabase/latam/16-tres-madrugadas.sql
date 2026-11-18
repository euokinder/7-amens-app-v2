-- =====================================================================
-- 16-tres-madrugadas.sql — "Las 3 Madrugadas de Intercesión" no app em
-- espanhol (18/11/2026)
-- =====================================================================
-- Pedido do Arthur: a mesma entrega do Brasil (As 3 Madrugadas), em espanhol.
-- Quem comprou vê o card na home /es e assiste às três madrugadas; quem não
-- comprou não vê nada (sem cadeado, sem "Adquirir"). Pagamento único.
--
-- ONDE A VENDA ACONTECE: desde 13/11 o botão do fim do vídeo do Día 7 leva
-- à Hubla (oferta 3aTSzyE7DJSHQHe7bv0i, US$ 37). A Hubla é a MESMA conta do
-- Brasil, e o aviso chega no hubla-webhook do Brasil, que grava em
-- hubla_events e deixa a venda como "produto não mapeado" (sem dar nada).
-- De 13 a 18/11: 12 vendas reais, nenhum reembolso.
--
-- COMO A LATAM LIBERA SEM ENCOSTAR NO BRASIL: a função
-- latam_hubla_liberar() só LÊ hubla_events (nada do Brasil é alterado:
-- nem tabela, nem função, nem o webhook), acha as vendas dos códigos de
-- latam_hubla_produtos e libera em latam_access:
--   - o app, por 12 meses a partir da venda (a regra da LATAM: qualquer
--     compra paga do 7 Amenes libera o app; quem pagou com outro e-mail
--     entra com o e-mail da Hubla);
--   - o extra 'tres_madrugadas' (source 'hubla').
-- Cada venda é tratada UMA vez (latam_hubla_liberadas guarda o id do aviso):
-- retirar à mão no painel depois não é desfeito pela rodada seguinte.
-- Reembolso não tira nada (regra da LATAM, 05/11).
--
-- QUEM CHAMA: o pg_cron, a cada 5 minutos, olhando só os avisos dos
-- últimos 2 dias (usa o índice de received_at: ~0,1 s). A CARGA de quem
-- comprou antes é a mesma função, chamada uma vez desde 12/11 (seção 6).
-- Se o pg_cron parar mais de 2 dias, rodar a carga de novo (não duplica).
--
-- As outras portas:
--   - KashPay (+ Whop): o pedido com "Intercesión" já é gravado como
--     'tres_madrugadas' pela latam-kashpay desde 08/11; latam_extras passa a
--     ler isso (nenhuma venda assim até 18/11).
--   - Whop direta (prod_5j3iKMwnWInbK) e Digistore24: não há venda nem
--     produto das 3 Madrugadas (conferido em 18/11). Nada muda nelas.
--   - O painel /es-admin: "Liberar"/"Retirar" (source 'manual').
--
-- O QUE MUDA (só coisas latam_):
--   1. latam_access aceita product 'tres_madrugadas' e source 'hubla';
--   2. latam_hubla_produtos (o tradutor código da Hubla -> produto);
--   3. latam_hubla_liberadas (cada venda da Hubla já tratada, sem e-mail);
--   4. latam_extras devolve também 'tres_madrugadas';
--   5. latam_hubla_liberar(desde) e o agendamento no pg_cron;
--   6. a carga.
--
-- DEPENDE DE: 01 a 15. ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o
-- Arthur, no SQL Editor). Pode rodar de novo sem estragar nada.
-- ⚠️ Rodar ANTES da latam-api nova (a ordem de sempre: banco -> função -> site).
-- =====================================================================

-- 0. O agendador. No Supabase, é a extensão pg_cron (grátis, já vem
--    disponível; este comando só a liga).
create extension if not exists pg_cron;


-- 1. O acesso aceita o produto novo e a origem 'hubla'.
alter table public.latam_access drop constraint if exists latam_access_product_check;
alter table public.latam_access add constraint latam_access_product_check
  check (product in ('app','arcangeles','cantico','tres_madrugadas'));
alter table public.latam_access drop constraint if exists latam_access_source_check;
alter table public.latam_access add constraint latam_access_source_check
  check (source = any (array['whop','import','manual','kashpay','emergencia','digistore','hubla']));


-- 2. O tradutor: código da oferta na Hubla -> produto da LATAM.
--    ⚠️ Oferta NOVA das 3 Madrugadas na Hubla = uma linha aqui ANTES da
--    primeira venda (se esquecer, basta acrescentar e rodar a carga).
create table if not exists public.latam_hubla_produtos (
  hubla_product_id text primary key,
  produto text not null check (produto in ('tres_madrugadas')),
  nota text not null default '',
  created_at timestamptz not null default now()
);
alter table public.latam_hubla_produtos enable row level security;
revoke all on public.latam_hubla_produtos from anon, authenticated;
drop policy if exists backend_only on public.latam_hubla_produtos;
create policy backend_only on public.latam_hubla_produtos for all to service_role using (true) with check (true);

insert into public.latam_hubla_produtos (hubla_product_id, produto, nota) values
  ('3aTSzyE7DJSHQHe7bv0i', 'tres_madrugadas', 'Las 3 Madrugadas de Intercesión, US$ 37 (botão do Día 7 desde 13/11/2026; 12 vendas reais até 18/11)')
on conflict (hubla_product_id) do nothing;


-- 3. Cada venda da Hubla já tratada pela LATAM. Sem e-mail nem nome: só o
--    id do aviso (hubla_events.id) e a cliente.
create table if not exists public.latam_hubla_liberadas (
  hubla_event_id uuid primary key,
  customer_id uuid references public.latam_customers(id) on delete set null,
  produto text not null,
  status text not null check (status in ('liberado','sem_email')),
  detalhe text not null default '',
  venda_em timestamptz not null,
  tratado_em timestamptz not null default now()
);
alter table public.latam_hubla_liberadas enable row level security;
revoke all on public.latam_hubla_liberadas from anon, authenticated;
drop policy if exists backend_only on public.latam_hubla_liberadas;
create policy backend_only on public.latam_hubla_liberadas for all to service_role using (true) with check (true);


-- 4. latam_extras: a mesma do 06-kashpay-libera.sql (conferida igual à da
--    produção em 18/11), com as 3 Madrugadas:
--    - 'compra' quando o pedido da KashPay tem 'tres_madrugadas', ou quando
--      a linha em latam_access veio da Hubla;
--    - a DÚVIDA não libera as 3 Madrugadas (a oferta nasceu em 08/11, depois
--      da época sem registro do produto);
--    - o painel manda por cima, como nos outros extras.
create or replace function public.latam_extras(p_customer_id uuid)
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
  select c.email into v_email from public.latam_customers c where c.id = p_customer_id;
  if v_email is null then return null; end if;

  -- O que ela comprou, pedido por pedido (um por pagamento da Whop).
  with pagos as (
    select distinct on (p.pedido) p.produtos
    from public.latam_pedidos_pagos p
    where p.email = v_email
    order by p.pedido, (p.produtos is null)
  )
  select coalesce((select array_agg(distinct p) from pagos, unnest(pagos.produtos) p), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  if 'arcangeles' = any(v_owned) then v_origem := v_origem || '{"arcangeles":"compra"}'; end if;
  if 'desatanudos' = any(v_owned) or 'cantico' = any(v_owned) then v_origem := v_origem || '{"cantico":"compra"}'; end if;
  if 'tres_madrugadas' = any(v_owned) then v_origem := v_origem || '{"tres_madrugadas":"compra"}'; end if;

  -- A dúvida: sobra um pagamento sem pedido que não é a compra do app.
  -- (Só os dois extras antigos; as 3 Madrugadas, nunca.)
  if v_unknown - (case when 'principal' = any(v_owned) then 0 else 1 end) >= 1 then
    if not v_origem ? 'arcangeles' then v_origem := v_origem || '{"arcangeles":"duvida"}'; end if;
    if not v_origem ? 'cantico' then v_origem := v_origem || '{"cantico":"duvida"}'; end if;
  end if;

  -- O que está em latam_access (painel, automação, Hubla) manda por cima.
  for r in
    select a.product, a.status, a.source from public.latam_access a
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
    'cantico_hechos', coalesce((select jsonb_agg(p.day order by p.day) from public.latam_cantico_progress p where p.customer_id = p_customer_id), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.latam_extras(uuid) from public, anon, authenticated;
grant execute on function public.latam_extras(uuid) to service_role;


-- 5. A liberação. Lê as vendas da Hubla desde p_desde (só os códigos de
--    latam_hubla_produtos, só customer.member_added, sem sandbox) que a
--    LATAM ainda não tratou. Devolve quantas liberou e quantas ficaram
--    sem e-mail. hubla_events é SÓ lida.
create or replace function public.latam_hubla_liberar(p_desde timestamptz)
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
    join public.latam_hubla_produtos m on m.hubla_product_id = h.hubla_product_id
    where h.received_at >= p_desde
      and h.event_type = 'customer.member_added'
      and not h.sandbox
      and not exists (select 1 from public.latam_hubla_liberadas l where l.hubla_event_id = h.id)
    order by h.received_at
  loop
    v_email := v.email;
    if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      insert into public.latam_hubla_liberadas (hubla_event_id, produto, status, detalhe, venda_em)
      values (v.id, v.produto, 'sem_email', 'Venda sem e-mail utilizável: liberar à mão no /es-admin.', v.received_at)
      on conflict do nothing;
      v_sem := v_sem + 1;
      continue;
    end if;

    -- A cliente: a que já existe com esse e-mail, ou uma nova (com o nome
    -- da Hubla, se houver; o nome nunca é um e-mail).
    insert into public.latam_customers (email, name)
    values (v_email, case when v.nome like '%@%' then '' else left(v.nome, 120) end)
    on conflict (email) do nothing;
    select c.id into v_customer from public.latam_customers c where c.email = v_email;

    -- O app: ativo até a data mais longe (12 meses da venda). Compra nova
    -- reativa quem foi retirada à mão, como na latam-kashpay.
    v_ate := v.received_at + interval '365 days';
    insert into public.latam_access (customer_id, product, status, source, expires_at, granted_at, updated_at, note)
    values (v_customer, 'app', 'active', 'hubla', v_ate, now(), now(), 'Hubla: ' || v.produto)
    on conflict (customer_id, product) do update set
      status = 'active',
      expires_at = case
        when latam_access.expires_at is null and latam_access.status = 'active' then null
        when latam_access.expires_at is not null and latam_access.expires_at > excluded.expires_at then latam_access.expires_at
        else excluded.expires_at end,
      revoked_at = null,
      updated_at = now();

    -- O extra (sem prazo próprio: vale enquanto o app valer).
    insert into public.latam_access (customer_id, product, status, source, expires_at, granted_at, updated_at)
    values (v_customer, v.produto, 'active', 'hubla', null, now(), now())
    on conflict (customer_id, product) do update set
      status = 'active', source = 'hubla', revoked_at = null, updated_at = now();

    insert into public.latam_hubla_liberadas (hubla_event_id, customer_id, produto, status, venda_em)
    values (v.id, v_customer, v.produto, 'liberado', v.received_at)
    on conflict do nothing;
    v_liberadas := v_liberadas + 1;
  end loop;

  return query select v_liberadas, v_sem;
end;
$function$;
revoke all on function public.latam_hubla_liberar(timestamptz) from public, anon, authenticated;
grant execute on function public.latam_hubla_liberar(timestamptz) to service_role;

-- O agendamento: a cada 5 minutos, olhando 2 dias para trás, com freio de
-- 10 s (a consulta leva ~0,1 s). Rodar de novo só troca o agendamento.
select cron.schedule(
  'latam-hubla-liberar',
  '*/5 * * * *',
  $cron$set statement_timeout = '10s'; select public.latam_hubla_liberar(now() - interval '2 days');$cron$
);


-- 6. A CARGA: quem comprou desde 13/11 (o botão foi para a Hubla nesse dia).
select * from public.latam_hubla_liberar('2026-11-12');


-- =====================================================================
-- CONFERIR (só leitura; tudo leve)
-- =====================================================================
-- Quantas têm as 3 Madrugadas, e por quê:
-- select a.source, a.status, count(*) from public.latam_access a
--  where a.product = 'tres_madrugadas' group by 1, 2;
-- As vendas da Hubla tratadas (sem e-mail = liberar à mão):
-- select status, count(*), max(venda_em) from public.latam_hubla_liberadas group by 1;
-- O agendamento e as últimas rodadas:
-- select jobname, schedule, active from cron.job where jobname = 'latam-hubla-liberar';
-- select status, start_time, return_message from cron.job_run_details
--  where jobid = (select jobid from cron.job where jobname = 'latam-hubla-liberar')
--  order by start_time desc limit 5;


-- =====================================================================
-- DESFAZER (só se precisar voltar atrás; nada do Brasil é tocado)
-- =====================================================================
-- select cron.unschedule('latam-hubla-liberar');
-- drop function if exists public.latam_hubla_liberar(timestamptz);
-- latam_extras de antes: rodar de novo a seção dela no 06-kashpay-libera.sql.
-- drop table if exists public.latam_hubla_liberadas;
-- drop table if exists public.latam_hubla_produtos;
-- delete from public.latam_access where product = 'tres_madrugadas';
-- (as clientes e os acessos ao app criados pela Hubla ficam: elas pagaram.)
-- O pg_cron pode ficar ligado: sem agendamento, não faz nada.
