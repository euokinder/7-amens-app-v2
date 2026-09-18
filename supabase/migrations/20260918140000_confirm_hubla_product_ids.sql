-- Corrige e confirma o mapeamento de produtos da Hubla com base em eventos reais
-- recebidos em 2026-09-18 (sandbox e vendas de produção).
--
-- Descoberta importante: o slug da página hub.la/g NÃO é necessariamente o
-- event.product.id. Para a Oração Celestial dos Quatro Arcanjos ele era outro.
-- Por isso o mapeamento é uma tabela, e não uma coluna: vários identificadores
-- da Hubla podem apontar para o mesmo produto nosso.

insert into public.hubla_product_map(hubla_id, product_key, note) values
 ('ODOZxlF1tfhee2TkZikI', 'upsell_01',
  'CONFIRMADO em 2026-09-18 pelo sandbox: este e o event.product.id real de Oracao Celestial dos Quatro Arcanjos.')
on conflict (hubla_id) do update
 set product_key = excluded.product_key, note = excluded.note;

update public.hubla_product_map
 set note = 'CONFIRMADO em 2026-09-18 pelo sandbox: event.product.id veio exatamente igual a este valor.'
 where hubla_id = 'bniYICXEzykgw1PzEyme';

update public.hubla_product_map
 set note = 'CONFIRMADO em 2026-09-18 por evento real de Comunidade da Fe - Padre Thiago.'
 where hubla_id = 'nMyLP4oFcIWiJ77UIbsu';

update public.hubla_product_map
 set note = 'Slug de hub.la/g para Arcanjos. NAO e o product.id real (ODOZxlF1tfhee2TkZikI e). Mantido por so poder significar este produto.'
 where hubla_id = '5pUr8toveL5R5zR3zyaT';

update public.hubla_product_map
 set note = 'PENDENTE DE CONFIRMACAO. Slug de hub.la/g de Musicas dos Anjos; nenhum evento chegou com este produto ate agora.'
 where hubla_id = 'gTLhMYXqRjFeNlyc7FlH';
