-- =====================================================================
-- APONTAR OS POP-UPS PARA A PÁGINA DE OFERTA DENTRO DO APP
--
-- Antes: o botão do pop-up levava a cliente para fora do app, para
--        https://thedailyinsightreport.com/uppp
-- Depois: leva para uma página do próprio app, oferta-arcanjos.html
--
-- O rótulo ?src= de cada campanha é mantido igual ao que já estava, para
-- não perder a conta de qual das quatro versões do pop-up traz venda:
--   v1-a = público novo, primeira exibição
--   v1-b = público novo, segunda exibição
--   v2-a = base antiga, primeira exibição
--   v2-b = base antiga, segunda exibição
--
-- ⚠️ NÃO RODAR SEM O CAIO MANDAR. Isto muda o comportamento do app que
--    as clientes estão usando agora, na hora, sem precisar de deploy.
--
-- ⚠️ A ORDEM IMPORTA: a página oferta-arcanjos.html precisa estar NO AR
--    em setemadrugadas.com.br ANTES de rodar isto. Se rodar antes, todo
--    mundo que clicar no pop-up cai numa página que não existe.
--
-- O endereço abaixo é o de produção mesmo, escrito por extenso, porque o
-- banco só aceita https. Quem estiver testando no computador não é
-- mandado para produção: o js/member.js reconhece que o endereço é uma
-- página do próprio app e troca o domínio pelo de onde ela está.
-- =====================================================================

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v1-a'
 where key = 'front_novas_1';

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v1-b'
 where key = 'front_novas_2';

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v2-a'
 where key = 'front_antigas_1';

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v2-b'
 where key = 'front_antigas_2';


-- Confirme o resultado. As quatro linhas têm que aparecer com o endereço
-- novo, e cada uma com o seu próprio rótulo no fim.
select key, enabled, target_url
  from public.member_offer_campaigns
 where key in ('front_novas_1','front_novas_2','front_antigas_1','front_antigas_2')
 order by sort_order;


-- =====================================================================
-- COMO VOLTAR ATRÁS, se precisar
-- =====================================================================
-- update public.member_offer_campaigns
--    set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1-a'
--  where key = 'front_novas_1';
--
-- update public.member_offer_campaigns
--    set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v1-b'
--  where key = 'front_novas_2';
--
-- update public.member_offer_campaigns
--    set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2-a'
--  where key = 'front_antigas_1';
--
-- update public.member_offer_campaigns
--    set target_url = 'https://thedailyinsightreport.com/uppp?src=rec-app-up01-v2-b'
--  where key = 'front_antigas_2';
