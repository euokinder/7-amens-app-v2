-- =====================================================================
-- 07-ofertas-digistore.sql — os códigos das ofertas "D" da KashPay (08/11/2026)
-- =====================================================================
-- ✅ JÁ RODOU NA PRODUÇÃO em 08/11, ~19:20, mas NÃO este arquivo: a parte
-- dos códigos (insert) entrou num SQL do Caio fora do repositório, que tinha
-- e-mail de cliente. Esse SQL também ligou as compradoras aos pedidos e
-- deixou de fora os 2 pedidos de teste da equipe. NÃO RODAR o update daqui
-- de novo: ele marcaria esses 2 testes como venda do principal.
-- =====================================================================
-- Por quê: a latam-kashpay reconhece o produto pelo NOME da oferta
-- ("Amenes", "Arcángel", "Cántico"). Oferta com nome de preço ("27", "19 usd")
-- só é reconhecida pelo código, cadastrado aqui. Sem ele, o pedido fica
-- 'needs_review' e NÃO libera o app.
--
-- Aconteceu em 08/11, às 16:56: a oferta "27" do produto "7 Amenes de la
-- Madrugada D" (Digistore24, US$ 27) chegou sem liberar. A compradora foi
-- liberada à mão no /es-admin. A KashPay não tem botão para reenviar o
-- aviso, então o pedido é corrigido aqui, sem cliente ligada.
--
-- Cadastra as 4 ofertas dos produtos "D", inclusive as que já são
-- reconhecidas pelo nome: se alguém renomear uma delas, o código continua
-- valendo. Os códigos foram lidos na aba "Ofertas" de cada produto, no
-- painel da KashPay, em 08/11.
--
-- REGRA DAQUI PARA FRENTE: oferta nova do 7 Amenes na KashPay, com nome que
-- não diga "Amenes", "Arcángel" ou "Cántico", precisa do código cadastrado
-- aqui ANTES da primeira venda.
--
-- Pode rodar mais de uma vez.
-- =====================================================================

begin;

insert into public.latam_kashpay_offers (offer_id, produto, offer_name, note) values
  ('45df143d-e03c-4e7d-972f-315f5271d5ba', 'principal',   '7 Amenes de la Madrugada', 'Produto "7 Amenes de la Madrugada D", Digistore24, US$ 37 (08/11/2026).'),
  ('aa0f4ef9-fa12-4128-b52c-7a7fbede5cd1', 'principal',   '27',                       'Produto "7 Amenes de la Madrugada D", Digistore24, US$ 27. Nome de preço: só o código reconhece (08/11/2026).'),
  ('98d00531-4084-48b4-9f88-993ffd6d17c2', 'arcangeles',  'Oraciones a los Santos Arcángeles', 'Produto "Oraciones a los Santos Arcángeles D", Digistore24, US$ 27 (08/11/2026).'),
  ('d93c226a-fb86-42bb-8320-239b747574f9', 'desatanudos', 'Cántico Angelical',        'Produto "Cántico Angelical D", Digistore24, US$ 27. desatanudos = o Cántico (08/11/2026).')
on conflict (offer_id) do update
  set produto = excluded.produto, offer_name = excluded.offer_name, note = excluded.note;

-- O pedido da oferta "27" que ficou needs_review: passa a contar como venda
-- do principal (para o Hub e a contagem). Fica sem customer_id, porque o
-- e-mail não é guardado no pedido; o acesso dela foi liberado à mão.
update public.latam_kashpay_events
   set status = 'recorded',
       produtos = '{principal}',
       offers = (select jsonb_agg(case when o->>'id' = 'aa0f4ef9-fa12-4128-b52c-7a7fbede5cd1'
                                       then jsonb_set(o, '{produto}', '"principal"') else o end)
                 from jsonb_array_elements(offers) o),
       detail = 'Gravado: principal. Oferta "27" (Digistore24) reconhecida pelo código depois (07-ofertas-digistore.sql); o app foi liberado à mão no /es-admin em 08/11.'
 where event = 'order.paid'
   and status = 'needs_review'
   and received_at > '2026-11-08 18:00+00'
   and offers @> '[{"id":"aa0f4ef9-fa12-4128-b52c-7a7fbede5cd1"}]';

commit;

-- CONFERIR (só leitura):
--   select offer_id, produto, offer_name from public.latam_kashpay_offers order by created_at desc limit 10;
--   select count(*) from public.latam_kashpay_events where event = 'order.paid' and status = 'needs_review'
--    and received_at > '2026-11-08 18:00+00';   -- tem de dar 0
