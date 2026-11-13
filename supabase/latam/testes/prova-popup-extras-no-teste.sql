-- =====================================================================
-- prova-popup-extras-no-teste.sql — SÓ NO BANCO DE TESTE (wyiqwsgfictcfkytldnu)
-- Prova do 12-popup-extras-liberados.sql: 4 clientes de mentira, sem
-- compra na Whop/KashPay, com extras liberados à mão (como faz a automação
-- da Digistore). Chama a fila de pop-ups e apaga tudo no fim.
--   T1: dia 1, Arcángeles liberado        → esperado: nenhum pop-up
--   T2: dia 5, os dois liberados          → esperado: nenhum
--   T3: dia 1, nada liberado              → esperado: um pop-up dos Arcángeles
--   T4: dia 5, só o Cántico liberado      → esperado: nenhum (a campanha dos
--       Arcángeles também exclui quem tem o Cántico, regra antiga)
--   T5: dia 5, Arcángeles retirado        → esperado: um pop-up (retirado não conta)
-- =====================================================================
create temp table if not exists prova_popup(caso text, esperado text, veio text);
truncate prova_popup;
do $$
declare
  casos text[][] := array[
    ['T1','0','arcangeles:active',''],
    ['T2','4','arcangeles:active','cantico:active'],
    ['T3','0','',''],
    ['T4','4','cantico:active',''],
    ['T5','4','arcangeles:revoked','']];
  esperado text[] := array['nenhum','nenhum','es_arcangeles','nenhum','algum'];
  i int; v_id uuid; v_key text; extra text; partes text[];
begin
  for i in 1..array_length(casos,1) loop
    insert into public.latam_customers(email, first_access_on, timezone)
    values ('prova-popup-'||lower(casos[i][1])||'@teste.invalid', current_date - casos[i][2]::int, 'America/Mexico_City')
    returning id into v_id;
    insert into public.latam_access(customer_id, product, status, source, expires_at, granted_at, updated_at)
    values (v_id, 'app', 'active', 'manual', now() + interval '1 year', now(), now());
    foreach extra in array array[casos[i][3], casos[i][4]] loop
      if extra <> '' then
        partes := string_to_array(extra, ':');
        insert into public.latam_access(customer_id, product, status, source, expires_at, granted_at, revoked_at, updated_at)
        values (v_id, partes[1], partes[2], 'manual', null, now(), case when partes[2]='revoked' then now() end, now());
      end if;
    end loop;
    select o.campaign_key into v_key from public.latam_claim_offer(v_id, 'America/Mexico_City') o limit 1;
    insert into prova_popup values (casos[i][1], esperado[i], coalesce(v_key, 'nenhum'));
    delete from public.latam_offer_events where customer_id = v_id;
    delete from public.latam_access where customer_id = v_id;
    delete from public.latam_customers where id = v_id;
  end loop;
end $$;
select caso, esperado, veio,
  case when esperado = 'nenhum' then veio = 'nenhum'
       when esperado = 'es_arcangeles' then veio like 'es_arcangeles%'
       else veio <> 'nenhum' end as ok
from prova_popup order by caso;
