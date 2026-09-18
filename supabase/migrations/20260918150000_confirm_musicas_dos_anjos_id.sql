-- Fecha o mapeamento: o id real de Musicas dos Anjos tambem era diferente do
-- slug da pagina hub.la/g.
--
-- Placar final dos quatro produtos: dois dos tres slugs de hub.la/g estavam
-- errados. So Comunidade da Fe coincidia. Confirmacao por payload real e
-- obrigatoria, nunca por analogia.

insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('vRuLDZ1avAMG2LllTWAu', 'upsell_02',
  'CONFIRMADO em 2026-09-18 pelo sandbox: este e o event.product.id real de Musicas dos Anjos.')
on conflict (hubla_id) do update
 set product_key = excluded.product_key, note = excluded.note;

update public.hubla_product_map
 set note = 'Slug de hub.la/g de Musicas dos Anjos. NAO e o product.id real (vRuLDZ1avAMG2LllTWAu e). Mantido por so poder significar este produto.'
 where hubla_id = 'gTLhMYXqRjFeNlyc7FlH';
