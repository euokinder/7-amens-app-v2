-- =====================================================================
-- 11-reembolso.sql — o reembolso em um toque (13/11/2026)
-- =====================================================================
-- Por quê: de 05 a 09/11/2026, 12 clientes da Whop foram ao banco ("não fui
-- eu") em vez de pedir o dinheiro para nós: 2 chargebacks e 14 alertas, 1,4%
-- das vendas, quase na linha de 1,5% da Whop e das bandeiras. 10 delas
-- tinham aberto o e-mail de entrega. Na Digistore, onde o link de reembolso
-- está no recibo, houve 0 chargeback. Decisão do Caio (13/11): pedir o
-- dinheiro de volta para nós tem de ser MAIS FÁCIL que pedir ao banco.
--
-- Como funciona (a página /es-reembolso + a função latam-reembolso):
--   1. ela escreve o e-mail da compra (ou ele já vem do app);
--   2. a página mostra TODAS as compras dela, com o nome, o valor cobrado no
--      cartão (com imposto) e o dia; ela marca uma ou várias;
--   3. o pedido fica aqui (latam_refund_requests, status 'pendente');
--   4. no chat do dia, o agente mostra a fila ao Caio, e com o "sim" dele
--      devolve na Whop e marca 'feito'. Nada é devolvido sozinho.
--
-- O que cria (só objetos latam_; o Brasil não sente nada):
--   1. latam_refund_requests          os pedidos
--   2. latam_reembolso_compras(email) as compras de um e-mail, para a página
--   3. um índice do e-mail em latam_whop_events
--
-- Usa o freio latam_permite, de 09-resgate.sql (já no ar desde 10/11).
--
-- ORDEM DE PUBLICAR: este SQL -> função latam-reembolso -> site. Sem este
-- SQL, a função responde erro e a página mostra o caminho do suporte
-- (WhatsApp e e-mail). Nenhuma ordem quebra o app.
-- =====================================================================

-- 1. Os pedidos.
create table if not exists public.latam_refund_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- O e-mail como ficou depois da correção dos erros comuns (gmial.com...).
  email text not null,
  customer_id uuid references public.latam_customers(id) on delete set null,
  -- O que ela marcou: [{pedido, origem, produto, nombre, valor_cents, moneda, pagado_en}].
  -- pedido = id do pagamento na Whop (pay_...) ou 'kashpay:<transação>'
  -- (venda que não passou pela Whop: em geral, Digistore pela KashPay).
  itens jsonb not null default '[]'::jsonb,
  total_cents integer not null default 0,
  moneda text not null default 'USD',
  -- true = a página não achou compra nenhuma e ela pediu mesmo assim.
  sin_compra boolean not null default false,
  motivo text,
  motivo_en timestamptz,
  status text not null default 'pendente',
  resuelto_en timestamptz,
  nota text not null default '',
  pais text not null default '',
  constraint latam_refund_requests_status_check check (status in ('pendente','feito','recusado')),
  constraint latam_refund_requests_email_check check (email = lower(btrim(email)) and length(email) <= 254),
  constraint latam_refund_requests_motivo_check check (motivo is null or motivo in
    ('no_pude_entrar','no_era_lo_que_esperaba','no_reconozco','cobro_de_mas','otro'))
);
create index if not exists latam_refund_requests_status_idx on public.latam_refund_requests (status, created_at);
create index if not exists latam_refund_requests_email_idx on public.latam_refund_requests (email);

-- 3. O e-mail das vendas da Whop (a busca da página).
create index if not exists latam_whop_events_email_idx
  on public.latam_whop_events (lower(customer_email))
  where event_type = 'payment.succeeded';


-- 2. As compras de um e-mail, uma linha por cobrança no cartão, da mais nova
--    para a mais velha. O e-mail chega já limpo e em minúsculas.
--      valor_cents  o total COBRADO (na Whop, com o imposto que alguns estados
--                   dos EUA somam: US$ 69 viram 75,21). É o que volta.
--      devuelto     já houve reembolso ou disputa dessa cobrança
--      pedido_abierto  já existe pedido pendente com essa cobrança
--    Acha pelo e-mail da venda na Whop e também pela cliente do app (quem
--    corrigiu o e-mail no resgate continua achando as compras).
create or replace function public.latam_reembolso_compras(p_email text)
returns table(pedido text, origem text, produto text, nombre text, valor_cents integer,
              moneda text, pagado_en timestamptz, devuelto boolean, pedido_abierto boolean)
language sql stable set search_path to ''
as $function$
  with cliente as (
    select c.id from public.latam_customers c where c.email = p_email
  ),
  whop as (
    select distinct on (w.payment_id)
           w.payment_id as pedido,
           'whop'::text as origem,
           coalesce(k.produtos[1], '') as produto,
           k.offers,
           round((w.payload #>> '{data,total,amount}')::numeric * 100)::integer as valor_cents,
           upper(coalesce(w.payload #>> '{data,currency}', 'usd')) as moneda,
           coalesce((w.payload #>> '{data,paid_at}')::timestamptz, w.received_at) as pagado_en
    from public.latam_whop_events w
    left join public.latam_kashpay_events k
      on k.event = 'order.paid'
     and k.transaction_id = w.payload #>> '{data,metadata,kashpay_transaction_id}'
    where w.event_type = 'payment.succeeded'
      and w.status = 'processed'
      and w.payment_id is not null
      and (lower(w.customer_email) = p_email or k.customer_id in (select id from cliente))
    order by w.payment_id, w.received_at
  ),
  kash as (
    select distinct on (k.transaction_id)
           'kashpay:' || k.transaction_id as pedido,
           'kashpay'::text as origem,
           coalesce(k.produtos[1], '') as produto,
           k.offers,
           k.amount_cents as valor_cents,
           upper(coalesce(nullif(k.currency, ''), 'USD')) as moneda,
           coalesce(k.paid_at, k.event_created_at) as pagado_en
    from public.latam_kashpay_events k
    where k.event = 'order.paid'
      and k.customer_id in (select id from cliente)
      and cardinality(k.produtos) > 0
      and not exists (
        select 1 from public.latam_whop_events w
        where w.event_type = 'payment.succeeded'
          and w.payload #>> '{data,metadata,kashpay_transaction_id}' = k.transaction_id
      )
    order by k.transaction_id, k.event_created_at
  ),
  todas as (select * from whop union all select * from kash)
  select t.pedido,
         t.origem,
         t.produto,
         case t.produto
           when 'principal' then '7 Amenes de la Madrugada'
           when 'arcangeles' then 'Oraciones a los Santos Arcángeles'
           when 'desatanudos' then 'Cántico Angelical'
           else coalesce(nullif(regexp_replace(t.offers -> 0 ->> 'name', '\s*·\s*App$', ''), ''), 'Tu compra')
         end as nombre,
         coalesce(t.valor_cents, 0),
         t.moneda,
         t.pagado_en,
         case when t.origem = 'whop' then exists (
                select 1 from public.latam_whop_events r
                where r.payment_id = t.pedido
                  and r.event_type in ('refund.created','refund.updated','dispute.created','dispute.updated')
                  and coalesce(r.payload #>> '{data,status}', '') <> 'failed')
              else exists (
                select 1 from public.latam_kashpay_events r
                where r.transaction_id = substr(t.pedido, 9)
                  and r.event in ('order.refunded','order.chargeback'))
         end as devuelto,
         exists (
           select 1 from public.latam_refund_requests q
           where q.status = 'pendente'
             and q.itens @> jsonb_build_array(jsonb_build_object('pedido', t.pedido))
         ) as pedido_abierto
  from todas t
  order by t.pagado_en desc
  limit 20;
$function$;


-- Ninguém de fora lê nada. Só o servidor (service_role), como nas outras
-- tabelas latam_: RLS ligado e anon/authenticated sem permissão.
alter table public.latam_refund_requests enable row level security;
revoke all on public.latam_refund_requests from public, anon, authenticated;
grant select, insert, update on public.latam_refund_requests to service_role;
revoke all on function public.latam_reembolso_compras(text) from public, anon, authenticated;
grant execute on function public.latam_reembolso_compras(text) to service_role;


-- =====================================================================
-- A FILA DO DIA (o agente roda no chat, com o Caio; consulta leve):
--   select id, created_at, email, total_cents, moneda, sin_compra, motivo, itens
--   from public.latam_refund_requests where status = 'pendente' order by created_at;
-- Depois de devolver na Whop (com o "sim" do Caio):
--   update public.latam_refund_requests set status = 'feito', resuelto_en = now(),
--     nota = '...' where id = '...';
-- =====================================================================

-- =====================================================================
-- DESFAZER (só se for preciso; apaga só o que este arquivo criou).
-- =====================================================================
-- drop function if exists public.latam_reembolso_compras(text);
-- drop index if exists public.latam_whop_events_email_idx;
-- drop table if exists public.latam_refund_requests;
