-- Identifica no destino qual campanha trouxe o clique.
--   v1 -> publico novo, ainda nao comecou a jornada
--   v2 -> base historica, ja esta rezando
--   -a -> primeira exibicao      -b -> segunda exibicao
update public.member_offer_campaigns set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1-a', updated_at = now() where key = 'front_novas_1';
update public.member_offer_campaigns set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1-b', updated_at = now() where key = 'front_novas_2';
update public.member_offer_campaigns set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2-a', updated_at = now() where key = 'front_antigas_1';
update public.member_offer_campaigns set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2-b', updated_at = now() where key = 'front_antigas_2';
