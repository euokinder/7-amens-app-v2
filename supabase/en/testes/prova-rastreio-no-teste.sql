-- =====================================================================
-- Prova do rastreamento do app em inglês — SÓ NO BANCO DE TESTE
-- (wyiqwsgfictcfkytldnu). Irmão de prova-rastreio-no-teste.mjs.
-- =====================================================================
-- ⛔ NUNCA rodar na produção: cria clientes de mentira e uma venda de mentira.
-- Cada bloco começa com uma trava que recusa um banco com mais de 50 clientes.
-- Ordem: PREPARAR -> o script .mjs -> (esperar 1 minuto) -> CONFERIR -> LIMPAR.
-- =====================================================================


-- =====================================================================
-- 1. PREPARAR
-- =====================================================================
do $trava$ begin
  if (select count(*) from public.en_customers) > 50 then raise exception 'Só no banco de TESTE.'; end if;
end $trava$;

-- Seis clientes de mentira, com o app ativo, no fuso de Chicago, que
-- entraram no app há 3 dias.
insert into public.en_customers (email, name, timezone, first_access_on)
select 'prova.rastreio.' || n || '@exemplo.com', 'Prova Rastreio ' || n, 'America/Chicago',
       (now() at time zone 'America/Chicago')::date - 3
  from generate_series(1, 6) n
on conflict (email) do nothing;

insert into public.en_access (customer_id, product, status, source, expires_at, note)
select c.id, 'app', 'active', 'manual', now() + interval '30 days', 'prova do rastreamento'
  from public.en_customers c where c.email like 'prova.rastreio.%@exemplo.com'
on conflict (customer_id, product) do nothing;

-- A cliente 6 TEM os dois extras (liberados à mão): fica fora do teste que
-- é só para quem não tem o Cântico.
insert into public.en_access (customer_id, product, status, source, note)
select c.id, p, 'active', 'manual', 'prova do rastreamento'
  from public.en_customers c cross join (values ('arcangeles'), ('cantico')) x(p)
 where c.email = 'prova.rastreio.6@exemplo.com'
on conflict (customer_id, product) do nothing;

-- Três testes: um ligado para todas, um ligado só para quem não tem o
-- Cântico, e um DESLIGADO (não pode aparecer no retrato).
insert into public.en_experiments (chave, ligado, versoes, publico, nota) values
  ('prova_rastreio', true, '[{"v":"a","peso":1},{"v":"b","peso":1}]', '{}', 'prova do rastreamento'),
  ('prova_rastreio_publico', true, '[{"v":"a","peso":1},{"v":"b","peso":3}]', '{"nao_tem":["cantico"]}', 'prova do rastreamento'),
  ('prova_rastreio_desligado', false, '[{"v":"a"},{"v":"b"}]', '{}', 'prova do rastreamento')
on conflict (chave) do nothing;

-- O que a trava dos testes recusa (tem de dar erro em cada uma; rodar à parte):
--   insert into public.en_experiments (chave, versoes) values ('prova_ruim_1', '[]');
--   insert into public.en_experiments (chave, versoes) values ('prova_ruim_2', '[{"v":"a"},{"v":"a"}]');
--   insert into public.en_experiments (chave, versoes) values ('prova_ruim_3', '[{"v":"a","peso":0}]');
--   insert into public.en_experiments (chave, versoes, publico) values ('prova_ruim_4', '[{"v":"a"}]', '{"desde":"amanha"}');
--   insert into public.en_experiments (chave, versoes, publico) values ('prova_ruim_5', '[{"v":"a"}]', '{"pais":"US"}');


-- =====================================================================
-- 2. CONFERIR (depois do script .mjs; o funil pede 1 minuto de espera)
-- =====================================================================
-- 2a. O que ficou gravado, por passo (só das clientes da prova).
--     Esperado: 35 passos ao todo: 32 da tela e 3 do servidor (rezou 1,
--     popup_visto 1, popup_toque 1).
--     Nenhum passo "rezou"/"popup_*" com fonte 'tela'. dia e hora no fuso de
--     Chicago. Toda linha com a versão do teste em `variantes`.
-- select e.fonte, e.nome, count(*) as passos, count(distinct e.customer_id) as clientes,
--        bool_and(e.variantes ? 'prova_rastreio') as todas_com_versao,
--        bool_and(e.dia_local = (e.ocorrido_em at time zone 'America/Chicago')::date
--                 and e.hora_local = extract(hour from e.ocorrido_em at time zone 'America/Chicago')) as fuso_certo
--   from public.en_events e join public.en_customers c on c.id = e.customer_id
--  where c.email like 'prova.rastreio.%@exemplo.com'
--  group by 1, 2 order by 1, 2;
--
-- 2b. O pacote sujo: nenhum e-mail, nenhuma página com ? ou #, e o "há 300
--     segundos" virou hora do servidor (o passo mais antigo é ~5 min antes).
-- select count(*) filter (where e.props::text like '%@%') as com_arroba,
--        count(*) filter (where e.pagina ~ '[?#]') as pagina_com_codigo,
--        count(*) filter (where e.props ? 'lista' or e.props ? 'dentro') as aninhado,
--        round(extract(epoch from max(e.recebido_em - e.ocorrido_em))) as maior_atraso_s
--   from public.en_events e join public.en_customers c on c.id = e.customer_id
--  where c.email like 'prova.rastreio.%@exemplo.com';
--
-- 2c. A versão de cada uma (a mesma do retrato; a 6 fora do teste do público).
-- select c.email, a.chave, a.versao
--   from public.en_experiment_assignments a join public.en_customers c on c.id = a.customer_id
--  where c.email like 'prova.rastreio.%@exemplo.com' order by 2, 1;
--
-- 2d. Uma venda de mentira dos Arcanjos para a cliente 1 (para o funil cruzar
--     com a compra), e a rodada do resumo:
-- insert into public.en_hubla_events (idempotency_key, event_type, invoice_id, produtos, product_name, amount_cents, currency, customer_id, status)
-- select 'prova-rastreio-venda', 'invoice.payment_succeeded', 'prova-rastreio-inv', '{arcangeles}', 'prova', 9800, 'USD', c.id, 'recorded'
--   from public.en_customers c where c.email = 'prova.rastreio.1@exemplo.com'
-- on conflict (idempotency_key) do nothing;
-- set statement_timeout = '10s'; select public.en_rastro_rodar();
--
-- 2e. O funil dos Arcanjos. Esperado: clientes 5 (a 6 tem o extra: fora),
--     card_visto 5, card_toque 3, popup_visto 1, popup_toque 1, pagina 3,
--     play 2, pitch 1, checkout 1, compras 1.
-- select * from public.en_painel_funil where oferta = 'arcangeles' order by coorte desc limit 5;
-- select * from public.en_painel_funil_teste where teste = 'prova_rastreio' and oferta = 'arcangeles' order by versao;
-- select * from public.en_painel_testes where teste like 'prova_rastreio%' order by 1, 4;
--
-- 2f. O resumo do dia e as visões de uso.
-- select nome, recorte, valor, teste, versao, clientes, total from public.en_events_daily
--  where dia = (now() at time zone 'America/Chicago')::date and teste = ''
--    and recorte in ('', 'card', '_props', '_origem', '_aparelho') order by 1, 2, 3;
-- select * from public.en_painel_uso order by dia desc limit 3;
-- select * from public.en_painel_hora order by dia desc, hora limit 10;
-- select * from public.en_painel_ativas order by dia desc limit 5;
-- select * from public.en_painel_volta order by turma desc limit 5;
--
-- 2g. Rodar o resumo de novo dá o MESMO resultado (não duplica):
-- select count(*), sum(total) from public.en_events_daily where dia = (now() at time zone 'America/Chicago')::date;
-- set statement_timeout = '10s'; select public.en_rastro_rodar();
-- select count(*), sum(total) from public.en_events_daily where dia = (now() at time zone 'America/Chicago')::date;


-- =====================================================================
-- 3. LIMPAR (apaga tudo o que a prova criou; os passos, as versões e o funil
--    das clientes de mentira vão junto, pelo "on delete cascade")
-- =====================================================================
-- do $trava$ begin
--   if (select count(*) from public.en_customers) > 50 then raise exception 'Só no banco de TESTE.'; end if;
-- end $trava$;
-- delete from public.en_hubla_events where idempotency_key = 'prova-rastreio-venda';
-- delete from public.en_customers where email like 'prova.rastreio.%@exemplo.com';
-- delete from public.en_experiments where chave like 'prova\_rastreio%';
-- set statement_timeout = '10s'; select public.en_rastro_rodar();   -- o resumo do dia volta a não contar a prova
