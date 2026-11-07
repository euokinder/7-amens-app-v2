-- =====================================================================
-- App em espanhol (7 Amenes de la Madrugada) - os extras dentro do app
-- =====================================================================
-- Pedido do Caio em 07/11/2026: o UP01 (Arcángeles) e o UP02 (Cántico
-- Angelical) dentro do app em espanhol, "seguindo o mesmo esquema do Brasil":
--   - quem comprou vê o card "DISPONIBLE" e entra;
--   - quem não comprou vê "🔒 EXTRA" / "Adquirir", que leva à página de venda;
--   - o Cántico é uma jornada de 7 dias, um por dia, com "Terminé este día".
-- Este arquivo SÓ mexe em coisas latam_: nada do Brasil é alterado.
--
--   latam_access             passa a aceitar os extras ('arcangeles',
--                            'cantico'), mas SÓ para o que o painel faz à mão
--                            (liberar ou retirar). A compra não grava nada aqui.
--   latam_cantico_progress   os dias do Cántico que ela marcou
--   latam_admin_actions      aceita 'grant_extra' e 'revoke_extra'
--   latam_extras()           o que ela tem, para a latam-api e o painel
--
-- QUEM TEM CADA EXTRA (latam_extras), nesta ordem:
--   1. a compra: o pagamento da Whop cruzado com o pedido da KashPay (a mesma
--      conta dos pop-ups, em 03-popups.sql). 'desatanudos' é o UP02, isto é,
--      o Cántico (o nome antigo da oferta na KashPay);
--   2. a dúvida: pagamento sem pedido da KashPay que não é a própria compra
--      do app (vendas de antes de 06/11, 22:54). Decisão do Caio (07/11):
--      LIBERA OS DOIS. Esconder algo pago gera reclamação na Whop;
--   3. o painel manda por cima: liberado à mão soma; retirado à mão tira,
--      mesmo que ela tenha comprado.
-- A carga manual de antes do webhook ('import') não tem pagamento registrado:
-- os extras dela, se houver, entram pelo painel.
--
-- Reembolso e disputa NÃO tiram o extra, como não tiram o app (regra da
-- LATAM, 05/11). O extra não tem prazo próprio: vale enquanto o app valer.
--
-- DEPENDE DE: 01-tabelas.sql, 02-kashpay.sql, 03-popups.sql e 04-admin.sql.
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Caio, no SQL Editor).
-- Pode rodar de novo sem estragar nada.
-- =====================================================================


-- 1. latam_access aceita os extras (só para o que o painel faz à mão).
--    Toda leitura de latam_access que já existia filtra product = 'app'
--    (latam-api, latam-whop, latam_claim_offer, latam_admin_customers):
--    as linhas novas não mudam nada nelas.
alter table public.latam_access drop constraint if exists latam_access_product_check;
alter table public.latam_access add constraint latam_access_product_check
  check (product in ('app','arcangeles','cantico'));


-- 2. Os dias do Cántico que ela marcou (0 = introdução; 1 a 7 = os dias).
--    Tabela própria, para não mexer na chave de latam_progress, que está
--    em uso pelas madrugadas.
create table if not exists public.latam_cantico_progress (
  customer_id uuid not null references public.latam_customers(id) on delete cascade,
  day smallint not null,
  completed_at timestamptz not null default now(),
  primary key (customer_id, day),
  constraint latam_cantico_progress_day_check check (day between 0 and 7)
);
alter table public.latam_cantico_progress enable row level security;
revoke all on public.latam_cantico_progress from anon, authenticated;
drop policy if exists backend_only on public.latam_cantico_progress;
create policy backend_only on public.latam_cantico_progress for all to service_role using (true) with check (true);


-- 3. O histórico do painel aceita liberar e retirar um extra.
alter table public.latam_admin_actions drop constraint if exists latam_admin_actions_action_check;
alter table public.latam_admin_actions add constraint latam_admin_actions_action_check check (
  action in ('grant_access','revoke_access','update_email','entry_link','renew_entry_link','grant_extra','revoke_extra')
);


-- 4. O que ela tem. Devolve:
--    {"extras": ["arcangeles","cantico"],
--     "origem": {"arcangeles": "compra", "cantico": "duvida"},
--     "cantico_hechos": [1, 2]}
--    origem: compra | duvida | manual | retirado. Sem cliente, null.
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
    select distinct on (coalesce(w.payment_id, w.webhook_id)) k.produtos
    from public.latam_whop_events w
    left join public.latam_kashpay_events k
      on k.event = 'order.paid'
     and k.transaction_id = w.payload #>> '{data,metadata,kashpay_transaction_id}'
    where w.customer_email = v_email
      and w.event_type = 'payment.succeeded'
      and w.status = 'processed'
    order by coalesce(w.payment_id, w.webhook_id), (k.produtos is null)
  )
  select coalesce((select array_agg(distinct p) from pagos, unnest(pagos.produtos) p), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  if 'arcangeles' = any(v_owned) then v_origem := v_origem || '{"arcangeles":"compra"}'; end if;
  if 'desatanudos' = any(v_owned) or 'cantico' = any(v_owned) then v_origem := v_origem || '{"cantico":"compra"}'; end if;

  -- A dúvida: sobra um pagamento sem pedido que não é a compra do app.
  if v_unknown - (case when 'principal' = any(v_owned) then 0 else 1 end) >= 1 then
    if not v_origem ? 'arcangeles' then v_origem := v_origem || '{"arcangeles":"duvida"}'; end if;
    if not v_origem ? 'cantico' then v_origem := v_origem || '{"cantico":"duvida"}'; end if;
  end if;

  -- O painel manda por cima.
  for r in
    select a.product, a.status from public.latam_access a
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
    'cantico_hechos', coalesce((select jsonb_agg(p.day order by p.day) from public.latam_cantico_progress p where p.customer_id = p_customer_id), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.latam_extras(uuid) from public, anon, authenticated;
grant execute on function public.latam_extras(uuid) to service_role;


-- =====================================================================
-- CONFERIR (só leitura)
-- =====================================================================
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conname in ('latam_access_product_check','latam_admin_actions_action_check');
-- select relname, relrowsecurity from pg_class where relname = 'latam_cantico_progress';
-- Quantas têm cada extra, e por quê (leve: as tabelas latam_ são pequenas):
-- select o.key as extra, o.value as origem, count(*)
--   from public.latam_customers c,
--        lateral jsonb_each_text(public.latam_extras(c.id) -> 'origem') o
--  group by 1, 2 order by 1, 2;


-- =====================================================================
-- DESFAZER (só se precisar voltar atrás; nada do Brasil é tocado)
-- =====================================================================
-- drop function if exists public.latam_extras(uuid);
-- drop table if exists public.latam_cantico_progress;
-- delete from public.latam_access where product <> 'app';
-- alter table public.latam_access drop constraint if exists latam_access_product_check;
-- alter table public.latam_access add constraint latam_access_product_check check (product in ('app'));
-- delete from public.latam_admin_actions where action in ('grant_extra','revoke_extra');
-- alter table public.latam_admin_actions drop constraint if exists latam_admin_actions_action_check;
-- alter table public.latam_admin_actions add constraint latam_admin_actions_action_check check (
--   action in ('grant_access','revoke_access','update_email','entry_link','renew_entry_link'));
