-- Prova do 16-tres-madrugadas.sql, SÓ no banco de TESTE (wyiqwsgfictcfkytldnu).
-- ⛔ Nunca na produção: escreve avisos de mentira em hubla_events.
-- Cria 5 avisos de mentira da Hubla, roda a liberação duas vezes, confere e
-- apaga tudo o que criou. Devolve uma linha por conferência (ok = true).
-- A cliente "popup.nova@exemplo.com" é cobaia antiga do teste (app à mão até
-- 2027-11-07): a venda estica o prazo dela, e a faxina devolve o prazo antigo.
do $prova$
declare
  v_nova uuid; v_antiga uuid; v_prazo timestamptz; v_r record; v_r2 record; v_x jsonb;
begin
  -- A cobaia só existe no banco de teste: sem ela, para aqui.
  select customer_id, expires_at into v_antiga, v_prazo from public.latam_access
   where customer_id = (select id from public.latam_customers where email = 'popup.nova@exemplo.com') and product = 'app';
  if v_antiga is null then raise exception 'Cobaia do teste não encontrada: isto não é o banco de TESTE. Parei.'; end if;

  create temp table if not exists prova(o text, ok boolean, detalhe text) on commit preserve rows;
  delete from prova;

  insert into public.hubla_events (idempotency_key, event_type, hubla_product_id, sandbox, payload, received_at) values
    ('prova-3m-1', 'customer.member_added', '3aTSzyE7DJSHQHe7bv0i', false,
     '{"event":{"user":{"email":" Tres.Nueva@Exemplo.com ","firstName":"Prueba","lastName":"Tres"}}}', now() - interval '1 hour'),
    ('prova-3m-2', 'customer.member_added', '3aTSzyE7DJSHQHe7bv0i', false,
     '{"event":{"user":{"email":"popup.nova@exemplo.com"}}}', now() - interval '1 hour'),
    ('prova-3m-3', 'customer.member_added', '3aTSzyE7DJSHQHe7bv0i', true,
     '{"event":{"user":{"email":"tres.sandbox@exemplo.com"}}}', now() - interval '1 hour'),
    ('prova-3m-4', 'customer.member_added', '3aTSzyE7DJSHQHe7bv0i', false,
     '{"event":{"user":{"email":"sem-arroba"}}}', now() - interval '1 hour'),
    ('prova-3m-5', 'customer.member_added', 'OUTRO_PRODUTO_DO_BRASIL', false,
     '{"event":{"user":{"email":"tres.outro@exemplo.com"}}}', now() - interval '1 hour'),
    ('prova-3m-6', 'customer.member_removed', '3aTSzyE7DJSHQHe7bv0i', false,
     '{"event":{"user":{"email":"popup.nova@exemplo.com"}}}', now() - interval '30 minutes');

  select * into v_r from public.latam_hubla_liberar(now() - interval '2 days');
  insert into prova values ('1ª rodada: 2 liberadas, 1 sem e-mail', v_r.liberadas = 2 and v_r.sem_email = 1, v_r::text);

  select id into v_nova from public.latam_customers where email = 'tres.nueva@exemplo.com';
  insert into prova values ('cliente nova criada com e-mail limpo e nome', exists (select 1 from public.latam_customers where id = v_nova and name = 'Prueba Tres'), coalesce(v_nova::text, 'não criou'));
  insert into prova values ('nova: app ativo por ~12 meses (hubla)',
    exists (select 1 from public.latam_access where customer_id = v_nova and product = 'app' and status = 'active' and source = 'hubla' and expires_at > now() + interval '360 days'), '');
  insert into prova values ('antiga: app esticado para 12 meses da venda, origem mantida',
    exists (select 1 from public.latam_access where customer_id = v_antiga and product = 'app' and status = 'active' and source = 'manual' and expires_at > v_prazo and expires_at >= now() + interval '364 days'), '');
  v_x := public.latam_extras(v_nova);
  insert into prova values ('latam_extras da nova: tres_madrugadas = compra', v_x -> 'extras' ? 'tres_madrugadas' and v_x #>> '{origem,tres_madrugadas}' = 'compra', v_x::text);
  insert into prova values ('sandbox e outro produto: ninguém criado', not exists (select 1 from public.latam_customers where email in ('tres.sandbox@exemplo.com','tres.outro@exemplo.com')), '');

  -- Retirar à mão e rodar de novo: nada muda (cada venda é tratada uma vez).
  update public.latam_access set status = 'revoked', source = 'manual', revoked_at = now() where customer_id = v_nova and product = 'tres_madrugadas';
  select * into v_r2 from public.latam_hubla_liberar(now() - interval '2 days');
  insert into prova values ('2ª rodada: nada novo', v_r2.liberadas = 0 and v_r2.sem_email = 0, v_r2::text);
  v_x := public.latam_extras(v_nova);
  insert into prova values ('retirado à mão continua retirado', not (v_x -> 'extras' ? 'tres_madrugadas') and v_x #>> '{origem,tres_madrugadas}' = 'retirado', v_x::text);

  -- Faxina.
  delete from public.latam_hubla_liberadas where hubla_event_id in (select id from public.hubla_events where idempotency_key like 'prova-3m-%');
  delete from public.hubla_events where idempotency_key like 'prova-3m-%';
  delete from public.latam_access where customer_id = v_antiga and product = 'tres_madrugadas';
  update public.latam_access set expires_at = v_prazo where customer_id = v_antiga and product = 'app';
  delete from public.latam_customers where id = v_nova;
end;
$prova$;
select * from prova;
