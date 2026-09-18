-- Identifica a origem do clique no destino, para saber qual versao converte.
--   rec-app-up01-v1 -> publico novo, ainda nao comecou a jornada
--   rec-app-up01-v2 -> base historica, ja esta rezando
update public.member_offer_campaigns
 set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1', updated_at = now()
 where key in ('front_novas_1', 'front_novas_2');

update public.member_offer_campaigns
 set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2', updated_at = now()
 where key in ('front_antigas_1', 'front_antigas_2');
