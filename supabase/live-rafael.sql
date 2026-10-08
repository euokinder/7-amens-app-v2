-- =====================================================================
-- LIVE DO ARCANJO SÃO RAFAEL — o produto live_rafael (07/10/2026)
-- =====================================================================
-- O que a cliente recebe: o entregável PÓS-LIVE (não a live em si), o
-- vídeo "A Oração de Cura de São Rafael Arcanjo", na página
-- live-rafael.html. O card da home só aparece para quem comprou.
-- Decisões do Caio em 07/10/2026:
--   * só quem comprou vê o card (sem cadeado nem "Adquirir" para as outras);
--   * pagamento ÚNICO: pagou, fica; só reembolso tira.
--
-- ORDEM DE PUBLICAR: banco -> site. A member-api NÃO muda: ela já manda,
-- em `products`, todo produto ativo da cliente, e a live não precisa da
-- regra "cancelou continua" (não é assinatura).
--   * Site antes do banco: ninguém tem o produto, o card fica escondido
--     para todas. Nada quebra.
--   * Banco antes do site: dá para liberar pelo painel, mas a cliente só
--     vê o card quando o site subir.
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir".
-- ⛔ Na PRODUÇÃO, quem roda é o Caio, no SQL Editor do Supabase.

-- 1. O produto no catálogo.
-- enabled = false DE PROPÓSITO, como os upsells: ativado, o código antigo do
-- catálogo (a seção member-extras do js/member.js) criaria um segundo card,
-- genérico, no fim da home.
-- sort_order 40, DEPOIS dos upsells: a escada dos extras do painel lê o
-- catálogo nessa ordem, e a live não pode cair no meio dela (ver js/admin.js).
insert into public.products(key, title, description, enabled, sort_order, type, billing_type, unlocks_app) values
 ('live_rafael', 'Live do Arcanjo São Rafael', 'Entregável pós-live do Arcanjo São Rafael: o vídeo A Oração de Cura de São Rafael Arcanjo. Vendido fora da esteira de upsells.', false, 40, 'addon', 'one_time', false)
on conflict (key) do nothing;

-- 2. O tradutor da Hubla: quais códigos de produto da Hubla são a live.
-- Na Hubla o produto se chama "Oração sagrada do arcanjo rafael", e tem
-- TRÊS ofertas, cada uma com código próprio (697, 597 e 97 reais). Os três
-- saíram do export de faturas que o Caio mandou em 08/10/2026 (coluna "ID do
-- produto"). ⚠️ Lição de 20/09: a Hubla manda formatos diferentes de ID em
-- situações diferentes, e só o evento REAL confirma. Na primeira venda que
-- chegar pelo webhook, conferir que ela foi 'processed', e não
-- 'needs_reconciliation'.
-- As 13 vendas feitas ANTES da regra do webhook incluir a live (30/09 a
-- 07/10) foram liberadas por uma carga à parte, rodada pelo Caio no SQL
-- Editor (source = 'hubla_import'). Ela não fica no repositório: o
-- repositório é público e a carga tem os códigos das clientes.
insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('CmL4fCj0VqS5rSwPq4Wo', 'live_rafael', 'Oracao sagrada do arcanjo rafael, oferta de R$ 697. Export de faturas de 08/10/2026 (11 vendas). E tambem o codigo do link pay.hub.la da pagina da live.'),
 ('gGRTrFRMperRP23fXTFJ', 'live_rafael', 'Oracao sagrada do arcanjo rafael, oferta (Copia) de R$ 597. Export de faturas de 08/10/2026 (1 venda).'),
 ('HGtQvmVF8zGobBfx2Kcd', 'live_rafael', 'Oracao sagrada do arcanjo rafael, oferta (Copia) (Copia) (Copia) de R$ 97. Export de faturas de 08/10/2026 (1 venda).')
on conflict (hubla_id) do nothing;

-- 3. Conferência.
select key, title, enabled, sort_order, type, billing_type from public.products where key = 'live_rafael';
select hubla_id, product_key from public.hubla_product_map where product_key = 'live_rafael';
