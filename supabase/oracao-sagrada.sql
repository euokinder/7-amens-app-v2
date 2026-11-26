-- =====================================================================
-- ORAÇÃO SAGRADA (26/11/2026)
-- A página de venda oracao-sagrada.html leva a um checkout novo da Hubla,
-- "Oração Sagrada" (R$ 119). Quem compra por ele recebe o app: a venda
-- tem de liberar o produto principal. Este arquivo ensina o webhook a
-- reconhecer os códigos do checkout novo.
--
-- Quem roda: o Arthur, no SQL Editor da produção, ANTES de a página ir
-- ao ar. Sem isto, a cliente paga e o app não libera (o aviso da venda
-- fica guardado como "needs_reconciliation").
--
-- É leve: duas linhas numa tabela pequena. Rodar duas vezes não estraga.
--
-- ⚠️ Os dois códigos vieram da API da Hubla, não de uma venda de verdade.
-- Na primeira venda real, conferir em hubla_events que o aviso ficou
-- "processed" (consulta 3). Se chegar um código diferente, cadastrar
-- também.
--
-- ⚠️ O produto novo só manda aviso se estiver na regra da Hubla
-- (Integrações → Automações → Webhook). Isso é no painel dela, não aqui.
-- =====================================================================

-- 1. Os códigos do checkout novo → produto principal.
insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('L98emCjgTiqbL1Fr0QdT', 'principal', 'Oracao Sagrada, R$ 119 (pagina oracao-sagrada.html). Codigo do produto e do link pay.hub.la. Criado pela API em 26/11/2026; ainda nao confirmado por venda real.'),
 ('gtAFsZN3q4x8227MQwVS', 'principal', 'Oracao Sagrada, R$ 119: segundo codigo que a Hubla da ao mesmo produto. Visto pela API em 26/11/2026; ainda nao confirmado por venda real.')
on conflict (hubla_id) do nothing;

-- 2. Conferência: tem de voltar as duas linhas.
select hubla_id, product_key, created_at
from public.hubla_product_map
where hubla_id in ('L98emCjgTiqbL1Fr0QdT', 'gtAFsZN3q4x8227MQwVS');

-- 3. Depois da primeira venda real (não rodar antes). Olha só o último dia,
--    pela coluna de data, que tem índice; não abre o JSON dos avisos.
--    hubla_product_id mostra o código que chegou de verdade.
-- select received_at, event_type, hubla_product_id, processing_status, error
-- from public.hubla_events
-- where received_at > now() - interval '1 day'
--   and (hubla_product_id in ('L98emCjgTiqbL1Fr0QdT', 'gtAFsZN3q4x8227MQwVS')
--        or processing_status = 'needs_reconciliation')
-- order by received_at desc
-- limit 10;
