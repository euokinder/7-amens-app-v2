-- =====================================================================
-- 14-hubla.sql — a venda pela HUBLA libera o app em inglês (19/11/2026)
-- =====================================================================
-- Em 19/11/2026 a página de venda dos Arcanjos dentro do app em inglês
-- (/en-offer-archangels) passou a vender pela Hubla, em dólar, em 3 ofertas
-- do produto "Protection of the Four Archangels". O aviso da Hubla chega na
-- função en-hubla, que libera o app (12 meses) e o extra dos Arcanjos para o
-- e-mail da compra, com as mesmas regras da Digistore (13-digistore.sql).
--
-- SEPARADO DO BRASIL DE PROPÓSITO: a en-hubla tem a SUA integração de
-- webhook na Hubla (outro token, outra URL, só os produtos do inglês). A
-- função hubla-webhook do Brasil, a hubla_events e o hubla_product_map NÃO
-- mudam. ⛔ Nunca cadastrar estes códigos no hubla_product_map do Brasil:
-- a venda americana liberaria o app BRASILEIRO.
--
-- O que cria ou troca (só objetos en_):
--   1. en_hubla_products   o que cada código da Hubla é. Oferta nova = uma
--                          linha aqui, sem publicar a função de novo. Código
--                          que não está aqui fica 'needs_review' e NÃO libera.
--   2. en_hubla_events     um aviso por linha, SEM dado de pessoa (nem e-mail,
--                          nem nome): só o customer_id.
--   3. en_pedidos_pagos    a visão passa a ler a Digistore E a Hubla. A parte
--                          da Digistore é a MESMA do 13-digistore.sql.
--
-- ⚠️ ORDEM DOS ARQUIVOS: este vem DEPOIS do 13. Rodar o 13 (ou o 02) de novo
-- depois deste volta a visão para "só Digistore" (ou vazia): as compras da
-- Hubla somem do painel e do reembolso (o acesso fica). Se rodar, rodar este
-- em seguida.
--
-- Formato do aviso: a documentação oficial (hubla.gitbook.io/docs/webhooks,
-- lida em 19/11/2026) e dois avisos reais deste produto (19/11, assinatura
-- grátis de um administrador, no hubla_events do Brasil):
--   - event.product.id = o produto (iUKyTVZAZdUij7F61dFt);
--   - event.products[].offers[].id = a oferta comprada (9TXh… em The Shield
--     of Michael);
--   - event.user.email = quem comprou (o login dela);
--   - event.invoice.amount.totalCents, event.invoice.currency, event.invoice.id,
--     event.invoice.subscriptionId; event.subscription.id.
--
-- Pode rodar mais de uma vez. Nada é apagado.
-- ORDEM DE PUBLICAR: este SQL -> função en-hubla -> segredo -> integração
-- na Hubla. Cada passo é inofensivo sem o seguinte.
-- =====================================================================

begin;

-- 1. Os códigos da Hubla do app em inglês. Todos os códigos de um produto
--    (o do produto e os das ofertas) entram: o aviso traz os dois.
--    produto: os mesmos da Digistore ('principal', 'arcangeles', 'cantico',
--    'aporte', 'tres_madrugadas'). Todo produto daqui libera o app por 12
--    meses; 'arcangeles' e 'cantico' também liberam o extra.
create table if not exists public.en_hubla_products (
  hubla_id text primary key,
  produto text not null,
  nome text not null default '',      -- só para a equipe se achar (o nome na Hubla)
  created_at timestamptz not null default now(),
  constraint en_hubla_products_id_check check (hubla_id ~ '^[A-Za-z0-9_-]{1,60}$'),
  constraint en_hubla_products_produto_check
    check (produto in ('principal','arcangeles','cantico','aporte','tres_madrugadas'))
);

-- Criados pela API da Hubla em 19/11/2026, pagamento único em USD. As três
-- ofertas liberam a MESMA coisa (a Central dos Arcanjos inteira): o app não
-- separa por nível.
insert into public.en_hubla_products (hubla_id, produto, nome) values
  ('iUKyTVZAZdUij7F61dFt', 'arcangeles', 'Protection of the Four Archangels (produto e oferta principal, The Complete Shield, $98)'),
  ('9TXhK3aXGlTym1dxWgXm', 'arcangeles', 'The Shield of Michael ($49)'),
  ('rKFwFW1A2b7KkM4R0Po3', 'arcangeles', 'The Family Fortress ($147)'),
  -- O "legacyId" do mesmo produto (API da Hubla). Na regra em "Integração
  -- recomendada" é ele que vem em event.products[].id (teste de 19/11/2026).
  ('NyXrQ34Eb4MnImLNnIr8', 'arcangeles', 'Protection of the Four Archangels (legacyId do produto)')
on conflict (hubla_id) do update set produto = excluded.produto, nome = excluded.nome;


-- 2. Os avisos da Hubla. A chave é o x-hubla-idempotency (um por aviso; a
--    Hubla repete o mesmo nas novas tentativas e no reenvio pelo histórico).
create table if not exists public.en_hubla_events (
  idempotency_key text primary key,
  event_type text not null,            -- customer.member_added, invoice.payment_succeeded, ...
  sandbox boolean not null default false,
  invoice_id text,                     -- event.invoice.id (a cobrança)
  subscription_id text,                -- event.subscription.id ou event.invoice.subscriptionId
  invoice_status text,                 -- event.invoice.status (paid, refunded, chargeback, ...)
  subscription_type text,              -- one_time | recurring | free
  product_ids text,                    -- todos os códigos do aviso, separados por vírgula
  product_name text,                   -- os nomes na Hubla (produto + oferta)
  produtos text[],                     -- o que eles são (en_hubla_products); null = nenhum conhecido
  amount_cents integer,                -- event.invoice.amount.totalCents
  currency text,                       -- event.invoice.currency
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  customer_id uuid references public.en_customers(id) on delete set null,
  status text not null default 'recorded',
  detail text not null default '',
  received_at timestamptz not null default now(),
  constraint en_hubla_events_status_check check (status in ('recorded','needs_review','ignored'))
);
create index if not exists en_hubla_events_received_idx on public.en_hubla_events (received_at desc);
create index if not exists en_hubla_events_customer_idx on public.en_hubla_events (customer_id);
create index if not exists en_hubla_events_invoice_idx on public.en_hubla_events (invoice_id);
create index if not exists en_hubla_events_subscription_idx on public.en_hubla_events (subscription_id);


-- 3. Ninguém de fora lê nada. Só o servidor (service_role), como nas outras.
do $trava$
declare t text;
begin
  foreach t in array array['en_hubla_products','en_hubla_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A visão das compras: Digistore (igual ao 13-digistore.sql) + Hubla.
--    Hubla: uma linha por FATURA paga (invoice.payment_succeeded) que liberou
--    alguém. A assinatura grátis (sem fatura) libera, mas não é compra: não
--    aparece aqui. Reembolso e disputa NÃO tiram a linha: viram devuelto.
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
    and e.customer_id is not null

  union all

  select
    ('hubla:' || coalesce(h.invoice_id, h.idempotency_key))::text as pedido,
    'hubla'::text                                as origem,
    h.customer_id                                as customer_id,
    c.email::text                                as email,
    h.produtos                                   as produtos,
    h.product_name::text                         as nome_produto,
    h.amount_cents                               as valor_cents,
    upper(coalesce(nullif(h.currency, ''), 'USD'))::text as moneda,
    h.received_at                                as pagado_en,
    exists (
      select 1 from public.en_hubla_events r
       where (h.invoice_id is not null and r.invoice_id = h.invoice_id
              and (r.event_type = 'invoice.refunded'
                   or (r.event_type = 'invoice.status_updated'
                       and r.invoice_status in ('refunded','partially_refunded','chargeback','disputed'))))
          or (h.subscription_id is not null and r.subscription_id = h.subscription_id
              and r.event_type = 'customer.member_removed')
    )                                            as devuelto,
    null::text                                   as final_cartao,  -- não lido do aviso da Hubla
    null::text                                   as nome_cartao,
    h.utm_source                                 as utm_source,
    h.utm_medium                                 as utm_medium,
    h.utm_campaign                               as utm_campaign,
    h.utm_content                                as utm_content
  from public.en_hubla_events h
  left join public.en_customers c on c.id = h.customer_id
  where h.event_type = 'invoice.payment_succeeded'
    and h.status <> 'ignored'
    and h.customer_id is not null;

revoke all on public.en_pedidos_pagos from public, anon, authenticated;
grant select on public.en_pedidos_pagos to service_role;

commit;


-- =====================================================================
-- CONFERIR (só leitura, leve), logo depois de rodar
-- =====================================================================
--   select relname, relrowsecurity from pg_class
--    where relname in ('en_hubla_products','en_hubla_events');
--   select relname, reloptions from pg_class where relname = 'en_pedidos_pagos';  -- security_invoker=true
--   select hubla_id, produto, nome from public.en_hubla_products order by hubla_id;
--
-- NO DIA A DIA (leve: a tabela é pequena e tem índice)
--   select received_at, event_type, sandbox, product_ids, produtos, status, detail
--     from public.en_hubla_events order by received_at desc limit 20;
--   select received_at, event_type, product_ids, product_name, detail
--     from public.en_hubla_events where status = 'needs_review' order by received_at desc limit 20;
-- Código novo apareceu como needs_review: cadastrar no bloco 1 e REENVIAR o
-- aviso pelo histórico da Hubla (a função libera no reenvio).
--
-- =====================================================================
-- DESFAZER (só se for preciso; nada do Brasil nem da LATAM)
-- =====================================================================
-- 1. A visão volta a ser só a da Digistore: rodar de novo o 13-digistore.sql.
-- 2. drop table if exists public.en_hubla_events, public.en_hubla_products;
-- O acesso de quem já foi liberado fica (en_access, origem 'checkout').
