-- =====================================================================
-- 12-popup-extras-liberados.sql — o pop-up não oferece o extra que ela já tem
-- (13/11/2026)
-- =====================================================================
-- O problema: a fila de pop-ups (latam_claim_offer) só sabia o que ela
-- comprou pela Whop/KashPay (latam_pedidos_pagos). Quem compra pela
-- Digistore é liberada pela automação do Pedro, que grava o extra em
-- latam_access (source 'manual'), cerca de 10 s depois da venda. Para essa
-- cliente, o pop-up dos Arcángeles e o do Cántico continuavam aparecendo:
-- de 10 a 13/11, 91 e 19 vezes para quem já tinha o extra. Risco de
-- cobrança em dobro.
--
-- O que muda: SÓ a função latam_claim_offer. Depois da regra da dúvida
-- (que não muda), os extras ativos em latam_access entram na lista do que
-- ela tem. Nenhuma tabela muda, nada é apagado.
--
-- Pode rodar mais de uma vez. Desfazer: rodar de novo a seção 4b do
-- 06-kashpay-libera.sql.
-- =====================================================================

create or replace function public.latam_claim_offer(p_customer_id uuid, p_zone text)
returns table(campaign_key text, eyebrow text, headline text, body text, cta_label text, dismiss_label text, target_url text, offer_type text)
language plpgsql set search_path to ''
as $function$
#variable_conflict use_column
declare
  v_email text;
  v_first date;
  v_today date;
  v_day integer;
  v_source text;
  v_owned text[];
  v_unknown integer;
begin
  select c.email, c.first_access_on into v_email, v_first
  from public.latam_customers c where c.id = p_customer_id;
  if v_email is null then return; end if;

  v_today := (now() at time zone p_zone)::date;
  -- Sem primeiro acesso gravado, hoje é o primeiro acesso (como a jornada).
  v_first := coalesce(v_first, v_today);
  v_day := (v_today - v_first) + 1;

  -- Carga manual de antes do webhook: não se sabe o que ela comprou.
  select a.source into v_source
  from public.latam_access a where a.customer_id = p_customer_id and a.product = 'app';
  if v_source = 'import' then return; end if;

  -- O que ela comprou, pedido por pedido.
  with pagos as (
    select p.produtos
    from public.latam_pedidos_pagos p
    where p.email = v_email
  )
  select coalesce((select array_agg(distinct p) from pagos, unnest(pagos.produtos) p), '{}'::text[]),
         (select count(*) from pagos where produtos is null or cardinality(produtos) = 0)
  into v_owned, v_unknown;

  -- Na dúvida, nada (ver o cabeçalho).
  if not (v_unknown = 0 or (v_unknown = 1 and not ('principal' = any(v_owned)))) then
    return;
  end if;

  -- Os extras liberados FORA da Whop/KashPay também contam como dela: a
  -- automação da Digistore (do Pedro) e o painel gravam em latam_access, e
  -- antes desta versão o pop-up oferecia de novo o que ela já tinha (13/11:
  -- 91 vezes os Arcángeles e 19 o Cántico, em 3 dias). Extra retirado no
  -- painel não conta. No banco, o Cántico das campanhas se chama
  -- 'desatanudos'; em latam_access, 'cantico'.
  select v_owned || coalesce(array_agg(case a.product when 'cantico' then 'desatanudos' else a.product end), '{}'::text[])
  into v_owned
  from public.latam_access a
  where a.customer_id = p_customer_id
    and a.product in ('arcangeles', 'cantico')
    and a.status = 'active';

  -- Já apareceu um pop-up hoje, no dia dela? Então hoje não aparece outro.
  if exists (
    select 1 from public.latam_offer_events e
    where e.customer_id = p_customer_id
      and e.shown_at is not null
      and (e.shown_at at time zone p_zone)::date = v_today
  ) then
    return;
  end if;

  insert into public.latam_offer_events(customer_id, campaign_key)
  select p_customer_id, c.key
  from public.latam_offer_campaigns c
  where c.enabled
    and c.target_url is not null
    and not (c.excluded_products && v_owned)
    and (c.min_journey_day is null or v_day >= c.min_journey_day)
    and (c.first_access_from is null or v_first >= c.first_access_from)
    and (c.first_access_before is null or v_first < c.first_access_before)
    and not exists (
      select 1 from public.latam_offer_events s
      where s.customer_id = p_customer_id and s.campaign_key = c.key
    )
  order by c.sort_order, c.key
  limit 1
  on conflict do nothing;

  return query
  select c.key, c.eyebrow, c.headline, c.body, c.cta_label, c.dismiss_label, c.target_url, c.offer_type
  from public.latam_offer_events e
  join public.latam_offer_campaigns c on c.key = e.campaign_key
  where e.customer_id = p_customer_id
    and e.shown_at is null
    and e.clicked_at is null
    and c.enabled
    and c.target_url is not null
    and not (c.excluded_products && v_owned)
    and (c.min_journey_day is null or v_day >= c.min_journey_day)
    and (c.first_access_from is null or v_first >= c.first_access_from)
    and (c.first_access_before is null or v_first < c.first_access_before)
  order by e.claimed_at, c.sort_order
  limit 1;
end;
$function$;
revoke all on function public.latam_claim_offer(uuid, text) from public, anon, authenticated;
grant execute on function public.latam_claim_offer(uuid, text) to service_role;


-- CONFERIR (só leitura), logo depois de rodar:
--   select position('Os extras liberados FORA' in pg_get_functiondef('public.latam_claim_offer(uuid,text)'::regprocedure)) > 0 as versao_nova;
