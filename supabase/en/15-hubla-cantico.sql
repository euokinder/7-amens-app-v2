-- =====================================================================
-- 15-hubla-cantico.sql — a venda do Angelic Canticle pela HUBLA (19/11/2026)
-- =====================================================================
-- Em 19/11/2026 a página de venda do Cântico dentro do app em inglês
-- (/en-offer-canticle) passou a vender pela Hubla, como a dos Arcanjos:
-- produto "Angelic Canticle", uma oferta, US$ 47, pagamento único.
-- A função en-hubla já sabe liberar o 'cantico' (o app por 12 meses e o
-- extra do Cântico): só falta ela reconhecer o código. Não muda a função.
--
-- ⛔ Nunca cadastrar estes códigos no hubla_product_map do Brasil: a venda
-- americana liberaria o app BRASILEIRO.
--
-- Precisa do 14-hubla.sql antes (a tabela en_hubla_products).
-- Pode rodar mais de uma vez. Nada é apagado.
-- ORDEM DE PUBLICAR: este SQL -> o produto na regra "App EN" da Hubla ->
-- o site (a página com o link novo).
-- =====================================================================

-- Criados pela API da Hubla em 19/11/2026, pagamento único em USD.
-- Como nos Arcanjos, entram o código do produto (que é também o da oferta
-- principal) e o legacyId do produto (o que vem em event.products[].id).
insert into public.en_hubla_products (hubla_id, produto, nome) values
  ('jXYM7bYWFscWbDIhrTWC', 'cantico', 'Angelic Canticle (produto e oferta principal, $47)'),
  ('ZHFtB3h77n7zAjgwgam2', 'cantico', 'Angelic Canticle (legacyId do produto)')
on conflict (hubla_id) do update set produto = excluded.produto, nome = excluded.nome;


-- =====================================================================
-- CONFERIR (só leitura, leve), logo depois de rodar
-- =====================================================================
--   select hubla_id, produto, nome from public.en_hubla_products order by produto, hubla_id;
--
-- DESFAZER (só se for preciso)
--   delete from public.en_hubla_products where produto = 'cantico';
-- O acesso de quem já foi liberado fica (en_access, origem 'checkout').
