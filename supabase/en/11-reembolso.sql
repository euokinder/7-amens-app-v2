-- =====================================================================
-- 11-reembolso.sql — o reembolso em um toque
-- =====================================================================
-- Cópia de supabase/latam/11-reembolso.sql (13/11/2026). Por quê, no
-- espanhol: de 05 a 09/11/2026, 12 clientes foram ao banco ("não fui eu")
-- em vez de pedir o dinheiro para nós: 2 chargebacks e 14 alertas, 1,4% das
-- vendas, quase na linha de 1,5% das bandeiras. Onde o link de reembolso
-- estava no recibo, houve 0 chargeback. Decisão do Caio (13/11): pedir o
-- dinheiro de volta para nós tem de ser MAIS FÁCIL que pedir ao banco.
--
-- Como funciona (a página /en-refund + a função en-refund):
--   1. ela escreve o e-mail da compra (ou ele já vem do app);
--   2. a página mostra TODAS as compras dela, com o nome, o valor cobrado no
--      cartão (com imposto) e o dia; ela marca uma ou várias;
--   3. o pedido fica aqui (en_refund_requests, status 'pendente');
--   4. no chat do dia, o agente mostra a fila ao Arthur e, com o "sim" dele,
--      devolve no checkout e marca 'feito'. Nada é devolvido sozinho.
--      ⏳ EUA: checkout — onde e como se devolve depende do checkout.
--
-- As compras vêm de en_pedidos_pagos (02-compras.sql). ⏳ EUA: checkout —
-- vazia até o checkout existir: a página mostra "sem compra", e ela pode
-- pedir mesmo assim (sin_compra = true; a equipe procura a compra).
--
-- O que cria (só objetos en_; o Brasil e a LATAM não sentem nada):
--   1. en_refund_requests          os pedidos
--   2. en_reembolso_compras(email) as compras de um e-mail, para a página
--
-- Usa o freio en_permite, de 09-resgate.sql.
-- DEPENDE DE: 01-tabelas.sql e 02-compras.sql.
--
-- ORDEM DE PUBLICAR: este SQL -> função en-refund -> site. Sem este SQL, a
-- função responde erro e a página mostra o caminho do suporte. Nenhuma
-- ordem quebra o app.
-- =====================================================================

-- 1. Os pedidos. Os nomes das colunas e os códigos do motivo são os do
--    espanhol, de propósito: a página (/en-refund) manda os mesmos.
create table if not exists public.en_refund_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- O e-mail como ficou depois da correção dos erros comuns (gmial.com...).
  email text not null,
  customer_id uuid references public.en_customers(id) on delete set null,
  -- O que ela marcou: [{pedido, origem, produto, nombre, valor_cents, moneda, pagado_en}].
  -- pedido = o id da cobrança no checkout (en_pedidos_pagos.pedido).
  itens jsonb not null default '[]'::jsonb,
  total_cents integer not null default 0,
  moneda text not null default 'USD',
  -- true = a página não achou compra nenhuma e ela pediu mesmo assim.
  sin_compra boolean not null default false,
  -- no_pude_entrar = "I couldn't get into the app"; no_era_lo_que_esperaba =
  -- "It wasn't what I expected"; no_reconozco = "I don't recognize the
  -- charge"; cobro_de_mas = "I was charged too much"; otro = "Other reason".
  motivo text,
  motivo_en timestamptz,
  status text not null default 'pendente',
  resuelto_en timestamptz,
  nota text not null default '',
  pais text not null default '',
  constraint en_refund_requests_status_check check (status in ('pendente','feito','recusado')),
  constraint en_refund_requests_email_check check (email = lower(btrim(email)) and length(email) <= 254),
  constraint en_refund_requests_motivo_check check (motivo is null or motivo in
    ('no_pude_entrar','no_era_lo_que_esperaba','no_reconozco','cobro_de_mas','otro'))
);
create index if not exists en_refund_requests_status_idx on public.en_refund_requests (status, created_at);
create index if not exists en_refund_requests_email_idx on public.en_refund_requests (email);


-- 2. As compras de um e-mail, uma linha por cobrança no cartão, da mais nova
--    para a mais velha. O e-mail chega já limpo e em minúsculas.
--      nombre       o nome que ELA lê na página (em inglês)
--      valor_cents  o total COBRADO (com o imposto que alguns estados dos EUA
--                   somam: US$ 69 viram 75,21). É o que volta.
--      devuelto     já houve reembolso ou disputa dessa cobrança
--      pedido_abierto  já existe pedido pendente com essa cobrança
--    Acha pelo e-mail da compra e também pela cliente do app (quem corrigiu
--    o e-mail no resgate continua achando as compras).
create or replace function public.en_reembolso_compras(p_email text)
returns table(pedido text, origem text, produto text, nombre text, valor_cents integer,
              moneda text, pagado_en timestamptz, devuelto boolean, pedido_abierto boolean)
language sql stable set search_path to ''
as $function$
  with cliente as (
    select c.id from public.en_customers c where c.email = p_email
  ),
  todas as (
    select distinct on (p.pedido)
           p.pedido,
           coalesce(p.origem, '') as origem,
           coalesce(p.produtos[1], '') as produto,
           p.nome_produto,
           p.valor_cents,
           upper(coalesce(nullif(p.moneda, ''), 'USD')) as moneda,
           p.pagado_en,
           coalesce(p.devuelto, false) as devuelto
    from public.en_pedidos_pagos p
    where p.pedido is not null
      and (lower(p.email) = p_email or p.customer_id in (select id from cliente))
    order by p.pedido, p.pagado_en
  )
  select t.pedido,
         t.origem,
         t.produto,
         case t.produto
           when 'principal' then '7 Amens Before Dawn'
           when 'arcangeles' then 'The Four Archangels'
           when 'cantico' then 'Angelic Canticle'
           else coalesce(nullif(btrim(t.nome_produto), ''), 'Your purchase')
         end as nombre,
         coalesce(t.valor_cents, 0),
         t.moneda,
         t.pagado_en,
         t.devuelto,
         exists (
           select 1 from public.en_refund_requests q
           where q.status = 'pendente'
             and q.itens @> jsonb_build_array(jsonb_build_object('pedido', t.pedido))
         ) as pedido_abierto
  from todas t
  order by t.pagado_en desc nulls last
  limit 20;
$function$;


-- Ninguém de fora lê nada. Só o servidor (service_role), como nas outras
-- tabelas en_: RLS ligado e anon/authenticated sem permissão.
alter table public.en_refund_requests enable row level security;
revoke all on public.en_refund_requests from public, anon, authenticated;
drop policy if exists backend_only on public.en_refund_requests;
create policy backend_only on public.en_refund_requests for all to service_role using (true) with check (true);
grant select, insert, update on public.en_refund_requests to service_role;
revoke all on function public.en_reembolso_compras(text) from public, anon, authenticated;
grant execute on function public.en_reembolso_compras(text) to service_role;


-- =====================================================================
-- A FILA DO DIA (o agente roda no chat, com o Arthur; consulta leve):
--   select id, created_at, email, total_cents, moneda, sin_compra, motivo, itens
--   from public.en_refund_requests where status = 'pendente' order by created_at;
-- Depois de devolver no checkout (com o "sim" do Arthur):
--   update public.en_refund_requests set status = 'feito', resuelto_en = now(),
--     nota = '...' where id = '...';
-- =====================================================================

-- =====================================================================
-- DESFAZER (só se for preciso; apaga só o que este arquivo criou).
-- =====================================================================
-- drop function if exists public.en_reembolso_compras(text);
-- drop table if exists public.en_refund_requests;
