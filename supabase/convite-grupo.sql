-- =====================================================================
-- CONVITE PARA O GRUPO NO WHATSAPP (pedido do Caio, 11/10/2026)
-- =====================================================================
-- O pop-up que chama a cliente para o grupo, falando dos benefícios de lá.
-- Usa o mesmo sistema do pop-up dos Arcanjos (member_offer_campaigns), com
-- um tipo novo, 'grupo', que o js/member.js desenha com o visual próprio
-- de js/convite-grupo.js.
--
-- Regras decididas pelo Caio em 11/10/2026:
--   - DEPOIS dos dois pop-ups dos Arcanjos (sort_order 15; os Arcanjos são
--     10 a 13). A cliente nova vê o convite no 3º dia de app; quem já
--     comprou um extra, ou já viu os dois, vê na próxima entrada.
--   - UMA VEZ SÓ por cliente (o sistema nunca repete uma campanha).
--   - Para TODAS as clientes com o principal, novas e antigas.
--   - Só na TELA INICIAL (isso mora no código, não aqui).
--
-- ⚠️ ORDEM DE PUBLICAR: banco → site → ligar.
--   1. Rodar a PARTE 1 (cria a campanha DESLIGADA). Ninguém vê nada.
--   2. Publicar o site com o js/convite-grupo.js e o js/member.js novos.
--   3. Rodar a PARTE 2 (liga).
-- Ligada antes do site novo, o site antigo mostraria o pop-up de oferta
-- COMUM, com o texto de baixo e o botão para o grupo. Não quebra nada, mas
-- não é o desenho aprovado.
--
-- ⚠️ ANTES DE LIGAR: um grupo de WhatsApp cabe 1.024 pessoas. Em 11/10
-- eram 4.806 clientes com o principal e 3.445 entraram no app em 30 dias.
-- No dia em que ligar, quase todas as que abrirem a tela inicial veem o
-- convite (as que já viram os dois dos Arcanjos não têm mais nada na
-- frente). O link precisa aguentar isso.
--
-- O TEXTO que a cliente vê está em js/convite-grupo.js. Os textos daqui só
-- aparecem no painel e na situação do aviso acima. O que vale DAQUI é o
-- link (target_url): trocar o link do grupo é só a PARTE 3, sem publicar.

-- ---------------------------------------------------------------------
-- PARTE 1 — o tipo 'grupo' e a campanha, DESLIGADA
-- ---------------------------------------------------------------------
begin;

alter table public.member_offer_campaigns
  drop constraint if exists member_offer_campaigns_offer_type_check;
alter table public.member_offer_campaigns
  add constraint member_offer_campaigns_offer_type_check
  check (offer_type in ('product','subscription','vip','grupo'));

insert into public.member_offer_campaigns(key, headline, body, cta_label, target_url, required_product_keys, excluded_product_keys, enabled, sort_order, trigger_type, offer_type, eyebrow, dismiss_label, required_principal_sources) values
 ('grupo_whatsapp_1', 'Você não precisa rezar sozinha',
  'Lá no grupo, você tem: lives e orações exclusivas, materiais bônus exclusivos, passagens e imagens de Jesus, orações e salmos diários, sorteios e prêmios.
É de graça. Você sai quando quiser.',
  'Quero entrar no grupo', 'https://chat.whatsapp.com/K603psXEfac6YCneu5TgaR',
  '{principal}', '{}', false, 15, 'entry', 'grupo',
  'Grupo exclusivo no WhatsApp', 'Agora não', '{}')
on conflict (key) do nothing;

commit;

-- Conferência da PARTE 1: deve voltar 1 linha, enabled = false.
select key, enabled, sort_order, offer_type, target_url
from public.member_offer_campaigns where key = 'grupo_whatsapp_1';

-- ---------------------------------------------------------------------
-- PARTE 2 — LIGAR (só depois de o site novo estar no ar)
-- ---------------------------------------------------------------------
-- update public.member_offer_campaigns
--    set enabled = true, updated_at = now()
--  where key = 'grupo_whatsapp_1';

-- ---------------------------------------------------------------------
-- PARTE 3 — TROCAR O LINK DO GRUPO (quando quiser, sem publicar o site)
-- ---------------------------------------------------------------------
-- O banco só aceita endereço que comece com https://.
-- update public.member_offer_campaigns
--    set target_url = 'https://chat.whatsapp.com/COLE-O-CODIGO-AQUI', updated_at = now()
--  where key = 'grupo_whatsapp_1';

-- ---------------------------------------------------------------------
-- DESLIGAR (se precisar parar na hora)
-- ---------------------------------------------------------------------
-- Quem já viu não vê de novo; quem não viu deixa de ver. Nada quebra.
-- update public.member_offer_campaigns
--    set enabled = false, updated_at = now()
--  where key = 'grupo_whatsapp_1';

-- ---------------------------------------------------------------------
-- COMO ESTÁ INDO — quantas viram, tocaram e dispensaram
-- ---------------------------------------------------------------------
-- "Tocaram" é quem tocou em "Quero entrar no grupo". O app não sabe quem
-- de fato entrou: isso só o próprio WhatsApp mostra.
-- select count(shown_at) as viram, count(clicked_at) as tocaram, count(dismissed_at) as dispensaram
-- from public.member_offer_events where campaign_key = 'grupo_whatsapp_1';
