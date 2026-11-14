-- =====================================================================
-- 13-digistore.sql — a venda pela Digistore24 libera o app em inglês
-- (14/11/2026)
-- =====================================================================
-- O checkout dos EUA é a Digistore24, numa conta PRÓPRIA, separada da da
-- LATAM (Arthur, 14/11). O aviso dela (IPN) chega na função en-digistore,
-- que libera o app (e o extra, quando é Arcanjos ou Cântico) e grava o aviso
-- aqui. O número 13 é o mesmo do espanhol (supabase/latam/13-digistore.sql),
-- para comparar arquivo com arquivo.
--
-- O que cria ou troca (só objetos en_; o Brasil e a LATAM não sentem nada):
--   1. en_digistore_products   o que cada número de produto da Digistore é.
--                              Oferta nova = uma linha aqui, sem publicar a
--                              função de novo. Número que não está aqui fica
--                              'needs_review' e NÃO libera nada.
--   2. en_digistore_events     um aviso por linha, SEM dado de pessoa (nem
--                              e-mail, nem nome): só o customer_id.
--   3. en_pedidos_pagos        a visão de 02-compras.sql passa a ler os
--                              pagamentos da Digistore. Por ela, os extras,
--                              os pop-ups, o painel e o reembolso enxergam a
--                              compra. Mesmas colunas, mesma ordem.
--
-- A origem em en_access é 'checkout', que 01-tabelas.sql já aceita e que já
-- é "a venda" no painel e na Lucy (en_chat_posicao). Por isso a trava de
-- origem NÃO muda. Quem cobrou fica aqui, em en_digistore_events.
--
-- O que o aviso da Digistore NÃO traz (guia oficial, lido em 14/11):
--   - os 4 últimos números do cartão e o nome no cartão: final_cartao e
--     nome_cartao ficam vazios, e o resgate pelo cartão (09-resgate.sql) não
--     acha quem comprou pela Digistore (a tela segue para a emergência);
--   - se os utm_* vêm no aviso, o guia de 2018 não diz. A coluna "campos"
--     guarda os NOMES dos campos de cada aviso, para conferir no primeiro
--     aviso real. Sem utm, o painel conta 0 vendas por pop-up.
--
-- DEPENDE DE: 01-tabelas.sql e 02-compras.sql. Rodar DEPOIS de todos os
-- outros arquivos en_ (é o último da fila).
-- Pode rodar mais de uma vez. Nada é apagado.
-- ORDEM DE PUBLICAR: este SQL -> função en-digistore -> senha -> conexão na
-- Digistore. Cada passo é inofensivo sem o seguinte.
-- =====================================================================

begin;

-- 1. Os produtos da conta da Digistore dos EUA.
--    produto:
--      'principal'        o app (o front de US$ 37 e o downsell de US$ 27)
--      'arcangeles'       The Four Archangels (o app + o extra)
--      'cantico'          Angelic Canticle (o app + o extra)
--      'aporte'           as contribuições do Dia 3 (Basilica of the Seven
--                         Prayers): renovam o app, não abrem extra
--      'tres_madrugadas'  Three Mornings of Intercession (Dia 7): renova o
--                         app; a entrega é fora do app
--    Todo produto daqui libera o app por 12 meses ("ativo até a data mais
--    longe": comprar de novo nunca encurta).
create table if not exists public.en_digistore_products (
  product_id text primary key,
  produto text not null,
  nome text not null default '',      -- só para a equipe se achar (o nome na Digistore)
  created_at timestamptz not null default now(),
  constraint en_digistore_products_id_check check (product_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  constraint en_digistore_products_produto_check
    check (produto in ('principal','arcangeles','cantico','aporte','tres_madrugadas'))
);

-- Os números da conta dos EUA (print do Arthur, 14/11/2026). Rodar de novo
-- não duplica (on conflict).
insert into public.en_digistore_products (product_id, produto, nome) values
  ('741394', 'principal',  'The 7 Amens of the Early Morning (front)'),
  ('741402', 'principal',  'The 7 Amens of the Early Morning 27 (front com outro preço)'),
  ('741399', 'arcangeles', 'Protection of the Four Archangels (Up 01)'),
  ('741401', 'cantico',    'Angelic Canticle (Up 02)')
on conflict (product_id) do update set produto = excluded.produto, nome = excluded.nome;

-- ⏳ EUA: ainda sem produto na Digistore (14/11): as três contribuições do
-- Dia 3 ('aporte') e Three Mornings of Intercession ('tres_madrugadas').
-- Quando existirem, cadastrar ANTES da primeira venda, no mesmo molde:
-- insert into public.en_digistore_products (product_id, produto, nome) values
--   ('000000', 'aporte',          'A section of the floor'),
--   ('000000', 'aporte',          'A pew'),
--   ('000000', 'aporte',          'A stone for the altar'),
--   ('000000', 'tres_madrugadas', 'Three Mornings of Intercession (US$ 27)')
-- on conflict (product_id) do update set produto = excluded.produto, nome = excluded.nome;


-- 2. Os avisos da Digistore24. Uma linha por aviso; a chave é a do guia
--    oficial (evento + transação). Cada item de um pedido (a compra e cada
--    upsell) é uma transação e um aviso: o upsell tem o MESMO order_id da
--    compra principal e transaction_id próprio.
create table if not exists public.en_digistore_events (
  event text not null,                 -- on_payment, on_refund, on_chargeback, ...
  transaction_id text not null,        -- único por pagamento, reembolso ou disputa
  order_id text,                       -- o pedido (o mesmo na compra e nos upsells)
  product_id text,                     -- o primeiro produto do aviso
  product_ids text,                    -- todos os produtos do aviso, separados por vírgula
  product_name text,                   -- o nome na Digistore (o reembolso mostra se não souber o produto)
  produtos text[],                     -- o que eles são (en_digistore_products); null = nenhum conhecido
  api_mode text,                       -- live | test
  amount numeric(12,2),                -- o total cobrado (amount_brutto, com o imposto)
  currency text,
  pay_method text,
  country text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campos text not null default '',     -- os NOMES dos campos do aviso (nunca os valores)
  customer_id uuid references public.en_customers(id) on delete set null,
  status text not null default 'recorded',
  detail text not null default '',
  received_at timestamptz not null default now(),
  primary key (event, transaction_id),
  constraint en_digistore_events_status_check check (status in ('recorded','needs_review','ignored'))
);
create index if not exists en_digistore_events_received_idx on public.en_digistore_events (received_at desc);
create index if not exists en_digistore_events_customer_idx on public.en_digistore_events (customer_id);
create index if not exists en_digistore_events_order_idx on public.en_digistore_events (order_id);


-- 3. Ninguém de fora lê nada. Só o servidor (service_role), como nas outras.
do $trava$
declare t text;
begin
  foreach t in array array['en_digistore_products','en_digistore_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A visão das compras (02-compras.sql) passa a ler a Digistore.
--    Uma linha por pagamento (transação) que liberou alguém. Fica de fora:
--    o pagamento de teste na produção ('ignored') e o de produto que ninguém
--    conhece (sem cliente). O reembolso e a disputa NÃO tiram a linha: viram
--    devuelto = true (reembolso não tira acesso nem extra).
--    MESMAS colunas, MESMOS nomes, MESMOS tipos e MESMA ordem de 02-compras.sql.
create or replace view public.en_pedidos_pagos with (security_invoker = true) as
  select
    e.transaction_id::text                       as pedido,
    'digistore'::text                            as origem,
    e.customer_id                                as customer_id,
    c.email::text                                as email,
    e.produtos                                   as produtos,
    e.product_name::text                         as nome_produto,
    round(e.amount * 100)::integer               as valor_cents,
    upper(coalesce(nullif(e.currency, ''), 'USD'))::text as moneda,
    e.received_at                                as pagado_en,
    exists (
      select 1 from public.en_digistore_events r
       where r.event in ('on_refund', 'on_chargeback')
         and r.order_id = e.order_id
         and (r.product_id = e.product_id or r.product_id is null)
    )                                            as devuelto,
    null::text                                   as final_cartao,  -- a Digistore não manda
    null::text                                   as nome_cartao,   -- a Digistore não manda
    e.utm_source                                 as utm_source,
    e.utm_medium                                 as utm_medium,
    e.utm_campaign                               as utm_campaign,
    e.utm_content                                as utm_content
  from public.en_digistore_events e
  left join public.en_customers c on c.id = e.customer_id
  where e.event = 'on_payment'
    and e.status <> 'ignored'
    and e.customer_id is not null;

revoke all on public.en_pedidos_pagos from public, anon, authenticated;
grant select on public.en_pedidos_pagos to service_role;

commit;


-- =====================================================================
-- CONFERIR (só leitura, leve), logo depois de rodar
-- =====================================================================
-- As duas tabelas, com RLS:
--   select relname, relrowsecurity from pg_class
--    where relname in ('en_digistore_products','en_digistore_events');
-- A visão continua com security_invoker:
--   select relname, reloptions from pg_class where relname = 'en_pedidos_pagos';
-- Os produtos cadastrados:
--   select product_id, produto, nome from public.en_digistore_products order by produto, product_id;
--
-- NO DIA A DIA (leve: a tabela é pequena e tem índice)
-- Os últimos avisos:
--   select received_at, event, transaction_id, order_id, product_ids, produtos, status, detail
--     from public.en_digistore_events order by received_at desc limit 20;
-- Os que precisam de alguém (produto não cadastrado, sem e-mail):
--   select received_at, event, product_ids, product_name, detail
--     from public.en_digistore_events where status = 'needs_review' order by received_at desc limit 20;
-- Produto novo apareceu como needs_review: cadastrar o número (bloco 1) e
-- liberar a compradora à mão no /en-admin (a Digistore não reenvia um aviso
-- que já recebeu "OK").
--
-- =====================================================================
-- DESFAZER (só se for preciso; nada do Brasil nem da LATAM)
-- =====================================================================
-- 1. A visão volta a ser a vazia: rodar de novo o 02-compras.sql.
-- 2. drop table if exists public.en_digistore_events, public.en_digistore_products;
-- O acesso de quem já foi liberado fica (en_access, origem 'checkout').
