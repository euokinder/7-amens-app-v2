-- =====================================================================
-- DADOS DE MENTIRA PARA O BANCO DE TESTE — 7 Améns da Madrugada
-- =====================================================================
--
-- PARA QUE SERVE
-- O banco de teste nasce vazio. Um painel sem dados não prova nada: os
-- números aparecem todos zerados e não dá para saber se a conta está
-- certa ou se simplesmente não há o que contar. Este arquivo enche o
-- banco de teste com 12 clientes inventadas, com vendas, visitas,
-- pop-ups e faturas, em proporções escolhidas para que CADA número do
-- painel dê um resultado diferente e conferível na mão.
--
-- ⛔ NUNCA RODE ISTO NA PRODUÇÃO.
-- Ele cria clientes falsas. Na produção isso sujaria a base real e
-- estragaria todos os números do negócio.
-- O lugar dele é o projeto de TESTE (ref wyiqwsgfictcfkytldnu).
--
-- É SEGURO RODAR DUAS VEZES: tudo é "se não existir".
--
-- COMO ENTRAR DEPOIS DE RODAR
-- Abra http://localhost:3000 e entre com  admin.teste@exemplo.com
-- Esse e-mail é administrador e tem acesso ao app, que é o que a
-- member-api exige antes de abrir o painel.
--
-- O QUE O PAINEL MOSTRA — conferido na tela em 19/09/2026
--   Clientes com acesso ........... 15
--   Entraram no app ............... 10 de 15
--   Levaram algum extra ............ 3 de 15
--   A ESCADA:
--     Das 15 com o principal ...... 3 também têm UP01
--     Das 3 com UP01 .............. 2 também têm UP02
--     Das 2 com UP02 .............. 1 também tem UP03
--   Pagamento: cartão 3 de 4 · Pix 0 de 8
--
-- As bases de propósito pequenas exercitam a trava de segurança: com base
-- menor que 30 a porcentagem sai do destaque, e abaixo de 10 ela não aparece
-- de jeito nenhum. Se o painel imprimir "66,7%" em destaque num degrau de 3
-- pessoas, a trava quebrou.
--
-- Os totais são 15 e não 13 porque o banco de teste já tinha duas
-- cobaias de antes (teste.novas@ e teste.antigas@). "Entraram no app"
-- sobe sozinho a cada login: entrar com o admin faz virar 10 de 15.
-- Isso não é defeito — é o número medindo o que deve medir.
-- =====================================================================


-- ------------------------------------------------ as clientes inventadas
insert into public.customers (email, name, first_name, last_name, hubla_user_id)
select format('teste.%s@exemplo.com', to_char(n, 'FM00')),
       format('Cliente Teste %s', n), 'Cliente', format('Teste %s', n),
       format('u-teste-%s', n)
  from generate_series(1, 12) as n
on conflict (email) do nothing;

-- A operadora do painel. Também é cliente: a member-api exige acesso
-- ativo ao app antes de deixar qualquer pessoa abrir o admin.
insert into public.customers (email, name, first_name, last_name, hubla_user_id)
values ('admin.teste@exemplo.com', 'Admin de Teste', 'Admin', 'de Teste', 'u-teste-admin')
on conflict (email) do nothing;


-- ------------------------------------------------ todas compraram o front
insert into public.entitlements (customer_id, product_key, status, source, granted_at)
select customer.id, 'principal', 'active', 'hubla', now() - interval '2 days'
  from public.customers as customer
 where customer.email like 'teste.%@exemplo.com'
    or customer.email = 'admin.teste@exemplo.com'
on conflict (customer_id, product_key) do nothing;

-- Três levaram o upsell. Uma delas (a 01) veio do pop-up; as outras duas
-- vieram do funil do anúncio — é essa diferença que o painel precisa
-- saber separar.
insert into public.entitlements (customer_id, product_key, status, source, granted_at)
select customer.id, 'upsell_01', 'active', 'hubla', now() - interval '2 days'
  from public.customers as customer
 where customer.email in ('teste.01@exemplo.com', 'teste.02@exemplo.com', 'teste.03@exemplo.com')
on conflict (customer_id, product_key) do nothing;

-- A escada precisa de degraus para ser testada: das 3 com UP01, duas levam o
-- UP02; dessas duas, uma leva o UP03. Cada degrau dá um número diferente.
insert into public.entitlements (customer_id, product_key, status, source, granted_at)
select customer.id, 'upsell_02', 'active', 'hubla', now() - interval '2 days'
  from public.customers as customer
 where customer.email in ('teste.01@exemplo.com', 'teste.02@exemplo.com')
on conflict (customer_id, product_key) do nothing;

insert into public.entitlements (customer_id, product_key, status, source, granted_at)
select customer.id, 'upsell_03', 'active', 'hubla', now() - interval '2 days'
  from public.customers as customer
 where customer.email = 'teste.01@exemplo.com'
on conflict (customer_id, product_key) do nothing;


-- ------------------------------------------------ quem abriu o app
-- Sete clientes apareceram; as outras pagaram e nunca entraram.
insert into public.member_visit_days (customer_id, visited_on)
select customer.id, (now() at time zone 'America/Sao_Paulo')::date - (n % 3)
  from public.customers as customer,
       lateral (select substring(customer.email from 'teste[.](\d+)@')::int as n) as ordem
 where customer.email like 'teste.%@exemplo.com' and ordem.n <= 7
on conflict (customer_id, visited_on) do nothing;

insert into public.member_admins (customer_id)
select id from public.customers where email = 'admin.teste@exemplo.com'
on conflict (customer_id) do nothing;


-- ------------------------------------------------ o pop-up: viu, clicou, comprou
-- Oito viram o pop-up, seis clicaram, uma comprou por ele.
insert into public.member_offer_events (customer_id, campaign_key, claimed_at, shown_at, clicked_at, converted_at)
select customer.id, 'front_novas_1',
       now() - interval '1 day',
       now() - interval '1 day',
       case when ordem.n <= 6 then now() - interval '1 day' end,
       case when ordem.n = 1 then now() - interval '20 hours' end
  from public.customers as customer,
       lateral (select substring(customer.email from 'teste[.](\d+)@')::int as n) as ordem
 where customer.email like 'teste.%@exemplo.com' and ordem.n <= 8
on conflict (customer_id, campaign_key) do nothing;


-- ------------------------------------------------ as faturas, para separar Pix de cartão
-- Quatro pagaram no cartão (as 01 a 04) e oito no Pix (05 a 12). Entre as
-- de cartão, duas levaram o upsell; entre as de Pix, uma. É a mesma forma
-- da produção — cartão convertendo muito mais — em escala de brinquedo.
insert into public.hubla_events
  (idempotency_key, event_type, payload_version, sandbox, hubla_user_id, hubla_product_id, invoice_id, payload, processing_status)
select format('teste-fatura-%s', n), 'invoice.status_updated', '2.0.0', false,
       format('u-teste-%s', n), 'bniYICXEzykgw1PzEyme', format('inv-teste-%s', n),
       jsonb_build_object(
         'type', 'invoice.status_updated',
         'event', jsonb_build_object(
           'user', jsonb_build_object('id', format('u-teste-%s', n), 'email', format('teste.%s@exemplo.com', to_char(n, 'FM00'))),
           'product', jsonb_build_object('id', 'bniYICXEzykgw1PzEyme', 'name', 'Os 7 Améns da madrugada'),
           'invoice', jsonb_build_object(
             'id', format('inv-teste-%s', n),
             'status', 'paid',
             -- A Hubla manda o valor como OBJETO, não como número solto.
             -- Conferido no payload real em 19/09: quem tratar isso como
             -- número leva erro de tipo no Postgres.
             'amount', jsonb_build_object('totalCents', 19700, 'subtotalCents', 19700,
                                          'discountCents', 0, 'prorataCents', 0,
                                          'installmentFeeCents', 0),
             'paymentMethod', case when n <= 4 then 'credit_card' else 'pix' end
           )
         )
       ),
       'ignored'
  from generate_series(1, 12) as n
on conflict (idempotency_key) do nothing;


-- =====================================================================
-- CONFERÊNCIA
-- =====================================================================
-- select * from public.admin_payment_overview;
-- select key, shown, clicked, converted from public.admin_offer_overview where enabled;
-- select count(*) from public.customers where email like '%@exemplo.com';

-- ------------------------------------------------ PARA APAGAR TUDO DEPOIS
-- delete from public.hubla_events where idempotency_key like 'teste-fatura-%';
-- delete from public.customers where email like 'teste.%@exemplo.com'
--    or email = 'admin.teste@exemplo.com';
--   (as demais tabelas somem junto, por cascata)
