-- =====================================================================
-- App em espanhol (7 Amenes de la Madrugada) - o RASTREIO das vendas
-- pela KashPay: qual anúncio vendeu
-- =====================================================================
-- O aviso de pedido da KashPay (função latam-kashpay) traz o utm do
-- anúncio, que o aviso da Whop não traz. Este arquivo cria o lugar onde
-- ele fica guardado, para o Hub de Criativos LATAM ler.
--
-- ISTO NÃO LIBERA NADA. Quem libera o app em espanhol continua sendo a
-- latam-whop (01-tabelas.sql). Este arquivo SÓ CRIA coisas novas: nenhuma
-- tabela do Brasil nem nenhuma latam_ que já existe é alterada. Pode
-- rodar de novo sem estragar nada (tudo é "if not exists").
--
-- SEM DADO PESSOAL (decisão do Arthur, 06/11/2026). A KashPay manda
-- nome, e-mail e telefone de quem comprou, e o nome no cartão. Nada disso
-- é gravado: a função monta a linha só com os campos daqui de baixo, e o
-- corpo do aviso NÃO é guardado.
--
-- ORDEM
-- 1. Banco de TESTE (wyiqwsgfictcfkytldnu): o agente roda.
-- 2. PRODUÇÃO (lbaudlocfbjunnaoyrtz): o Caio cola no SQL Editor.
--
-- Passo a passo e decisões: docs/app-es.md, seção "Rastreio das vendas
-- pela KashPay".
-- =====================================================================


-- 1. Um aviso da KashPay por linha.
--    A chave é (evento, transação): a KashPay manda o mesmo aviso até 3
--    vezes (na hora, depois de 30 s e depois de 3 min) se não receber
--    resposta, e a repetição não duplica nada.
--    Um pedido pago e depois reembolsado tem DUAS linhas: order.paid e
--    order.refunded, com o mesmo transaction_id.
--
--    status:
--      recorded     = é do 7 Amenes e conta no Hub.
--      needs_review = não deu para ter certeza de que é do 7 Amenes (oferta
--                     com nome de preço, como "19 usd", ou aviso num formato
--                     inesperado). NÃO conta no Hub até alguém confirmar
--                     (ver "CONFIRMAR UMA OFERTA", no fim).
--    Aviso de OUTRA operação da conta da KashPay não vira linha nenhuma.
create table if not exists public.latam_kashpay_events (
  event text not null,                 -- order.paid, order.refunded, order.chargeback...
  transaction_id text not null,        -- data.id: o id do pedido na KashPay
  order_status text not null default '',   -- data.status: paid, refunded, abandoned...
  amount_cents integer,                -- data.amount, em centavos (2700 = US$ 27,00)
  net_amount_cents integer,            -- data.net_amount: o que sobra depois das taxas
  currency text not null default '',   -- data.currency: USD...
  payment_method text not null default '', -- card...
  -- Cada oferta do pedido: [{id, name, type, quantity, total, produto}].
  -- produto = principal | arcangeles | desatanudos (os do 7 Amenes) ou
  -- null (não identificado).
  offers jsonb not null default '[]'::jsonb,
  -- Os produtos do 7 Amenes no pedido. É por aqui que o Hub separa a
  -- venda da frente (principal) da venda de upsell.
  produtos text[] not null default '{}',
  order_created_at timestamptz,        -- data.created_at
  paid_at timestamptz,                 -- data.paid_at
  refunded_at timestamptz,             -- data.refunded_at
  chargeback_at timestamptz,           -- data.chargeback_at
  event_created_at timestamptz,        -- created_at do aviso
  -- data.tracking, como veio. Só duas limpezas: o que vem depois de "::"
  -- (no Brasil é o fbclid, o código do clique) e qualquer e-mail colado
  -- num link saem antes de gravar.
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,                    -- "AC07 H2|1202...": o anúncio. O Hub lê ESP AC07
  utm_term text,
  src text,
  ref text,
  sck text,
  vtid text,
  status text not null default 'recorded',
  detail text not null default '',
  received_at timestamptz not null default now(),
  primary key (event, transaction_id),
  constraint latam_kashpay_events_status_check check (status in ('recorded','needs_review')),
  constraint latam_kashpay_events_event_check check (length(event) between 1 and 60),
  constraint latam_kashpay_events_transaction_check check (length(transaction_id) between 1 and 100),
  constraint latam_kashpay_events_offers_check check (jsonb_typeof(offers) = 'array')
);
create index if not exists latam_kashpay_events_paid_at_idx on public.latam_kashpay_events (paid_at);
create index if not exists latam_kashpay_events_received_at_idx on public.latam_kashpay_events (received_at);


-- 2. As ofertas confirmadas pelo id, para as que o nome não basta.
--    A conta da KashPay tem produtos de outras operações (em inglês). A
--    função reconhece sozinha, pelo nome da oferta, o que tem "Amenes",
--    "Arcángel" ou "Desata" (palavras que as outras não usam).
--    Já oferta com nome de preço ("19 usd", "9 usd", "27 usd"...) pode
--    existir em outra operação também. Até o id dela entrar aqui, o pedido
--    só com ela fica 'needs_review' (não conta, mas não se perde).
--    produto 'fora' = oferta de outra operação: o aviso nem é gravado.
--    Nasce vazia de propósito: nenhum id foi confirmado ainda (06/11).
create table if not exists public.latam_kashpay_offers (
  offer_id text primary key,
  produto text not null,
  offer_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint latam_kashpay_offers_produto_check check (produto in ('principal','arcangeles','desatanudos','fora'))
);


-- 3. Ninguém de fora lê nada. Só o servidor (service_role), como em
--    01-tabelas.sql: RLS ligado e anon/authenticated sem permissão.
do $trava$
declare t text;
begin
  foreach t in array array['latam_kashpay_events','latam_kashpay_offers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- =====================================================================
-- CONFERÊNCIA (rodar depois; tem de voltar as 2 tabelas, com rls = true)
-- =====================================================================
-- select c.relname as tabela, c.relrowsecurity as rls
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'latam\_kashpay%'
--  order by 1;
--
-- =====================================================================
-- O QUE CHEGOU (leve: a tabela é pequena e só tem o que é do 7 Amenes)
-- =====================================================================
-- select received_at, event, status, amount_cents, currency, produtos,
--        utm_content, detail
--   from public.latam_kashpay_events
--  order by received_at desc limit 20;
--
-- =====================================================================
-- CONSULTA DO HUB: vendas por anúncio
-- =====================================================================
-- Uma linha por anúncio (o que vem antes do "|" no utm_content) e moeda.
-- Venda = pedido pago com o produto principal. fat_ups = pedidos pagos só
-- de upsell (Arcángeles, Desatanudos). Reembolso = reembolso ou
-- chargeback. Valores em centavos. Só conta o que está 'recorded'.
-- Datas no horário de Brasília, como o Hub do Brasil.
--
-- set statement_timeout = '5s';
-- with pedido as (
--   select transaction_id,
--          coalesce(max(nullif(split_part(utm_content, '|', 1), '')) filter (where event = 'order.paid'),
--                   max(nullif(split_part(utm_content, '|', 1), ''))) as anuncio,
--          max(currency) as moeda,
--          bool_or(event = 'order.paid') as pago,
--          bool_or(event in ('order.refunded', 'order.chargeback')) as devolvido,
--          bool_or('principal' = any(produtos)) as frente,
--          max(amount_cents) filter (where event = 'order.paid') as valor,
--          min(paid_at) as pago_em
--     from public.latam_kashpay_events
--    where status = 'recorded'
--    group by transaction_id
-- )
-- select coalesce(anuncio, '(sem utm)') as anuncio, moeda,
--        count(*) filter (where pago and frente) as vendas,
--        coalesce(sum(valor) filter (where pago and frente), 0) as fat_front_cents,
--        coalesce(sum(valor) filter (where pago and not frente), 0) as fat_ups_cents,
--        count(*) filter (where pago and devolvido) as reembolsos,
--        count(*) filter (where pago) as pedidos_pagos,
--        to_char(min(pago_em) at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as de,
--        to_char(max(pago_em) at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as ate
--   from pedido
--  group by 1, 2
--  order by vendas desc, anuncio;
--
-- A série por dia, para o gráfico (MMDD, Brasília):
-- select coalesce(nullif(split_part(utm_content, '|', 1), ''), '(sem utm)') as anuncio,
--        to_char(paid_at at time zone 'America/Sao_Paulo', 'MMDD') as dia,
--        count(distinct transaction_id) as vendas
--   from public.latam_kashpay_events
--  where status = 'recorded' and event = 'order.paid' and 'principal' = any(produtos)
--  group by 1, 2 order by 1, 2;
--
-- =====================================================================
-- CONFIRMAR UMA OFERTA (quando aparecer 'needs_review' por "19 usd" ou
-- "9 usd"): olhar o id da oferta no painel da KashPay (Produtos -> 7 Amenes
-- de la Madrugada -> Ofertas) e, só se for MESMO do 7 Amenes:
-- =====================================================================
-- insert into public.latam_kashpay_offers (offer_id, produto, offer_name, note)
-- values ('<id da oferta>', 'principal', '19 usd', 'conferido no painel em dd/mm')
-- on conflict (offer_id) do update set produto = excluded.produto, note = excluded.note;
--
-- -- e os avisos que já chegaram com ela passam a contar:
-- update public.latam_kashpay_events
--    set status = 'recorded',
--        produtos = array(select distinct unnest(produtos || array['principal'])),
--        detail = detail || ' Confirmado à mão: a oferta <id da oferta> é do 7 Amenes.'
--  where status = 'needs_review'
--    and offers @> '[{"id": "<id da oferta>"}]';
--
-- Oferta de OUTRA operação: o mesmo insert com produto 'fora'; e
-- delete from public.latam_kashpay_events where status = 'needs_review'
--   and offers @> '[{"id": "<id da oferta>"}]';
--
-- =====================================================================
-- DESFAZER (só se for preciso; apaga só o rastreio da KashPay)
-- =====================================================================
-- drop table if exists public.latam_kashpay_events, public.latam_kashpay_offers;
