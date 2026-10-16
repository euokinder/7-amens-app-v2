-- =====================================================================
-- WEBHOOK DA PAYT — a venda pela Payt libera o app sozinha (16/10/2026)
-- =====================================================================
-- Desde 16/10/2026 a operação também vende pela Payt (checkout + funil de
-- upsell UP01 / DOWN01 / UP02 / UP03 de 1 clique). Até aqui, só a Hubla
-- avisava o banco: quem comprava pela Payt não entrava no app.
--
-- A Payt ganha uma porta própria, SEPARADA da Hubla (pedido do Caio: "uma
-- coisa não pode quebrar a outra"): a função payt-webhook e as duas tabelas
-- abaixo. hubla_events, hubla_product_map e o hubla-webhook NÃO mudam.
--
-- Regras decididas pelo Caio em 16/10/2026:
--   * compra aprovada libera; reembolso e chargeback NÃO tiram (promessa da
--     VSL) — ficam só registrados em payt_events;
--   * tudo é pagamento único por enquanto;
--   * quem comprou pela Payt também recebe o pop-up dos Arcanjos (PARTE 2),
--     que leva à mesma página de venda das clientes da Hubla.
--
-- ORDEM DE PUBLICAR: este SQL -> a função payt-webhook (Verify JWT
-- DESLIGADO, segredo PAYT_INTEGRATION_KEY) -> o postback no painel da Payt.
-- O site não muda. Qualquer ordem é inofensiva: sem as tabelas a função
-- responde erro e a Payt avisa; sem a função, a Payt não tem para onde mandar.
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir".
-- ⛔ Na PRODUÇÃO, quem roda é o Caio, no SQL Editor do Supabase.

begin;

-- ---------------------------------------------------------------------
-- PARTE 1. As tabelas da Payt
-- ---------------------------------------------------------------------

-- Cada aviso que a Payt mandou, inteiro (menos a chave secreta, que a função
-- tira antes de gravar). A trava do idempotency_key (a impressão digital do
-- aviso) faz o mesmo aviso chegando duas vezes não duplicar nada.
create table if not exists public.payt_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_status text not null,
  payment_status text,
  sale_type text,
  transaction_id text,
  product_code text,
  customer_email text,
  sandbox boolean not null default false,
  payload jsonb not null,
  processing_status text not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payt_events_processing_status_check check (
    processing_status in ('received','processed','ignored','failed','needs_reconciliation')
  )
);
create index if not exists payt_events_transaction_idx on public.payt_events (transaction_id);
create index if not exists payt_events_email_idx on public.payt_events (customer_email);
create index if not exists payt_events_status_idx on public.payt_events (processing_status, received_at desc);

-- Tradutor entre o código da Payt e o nosso produto. Código que não está aqui
-- NUNCA libera nada: o aviso cai em needs_reconciliation e fica guardado.
-- ⚠️ Lição da Hubla: só o evento REAL confirma um código. Os de baixo vieram
-- do painel da Payt (o "Payt Object ID" das páginas do funil é
-- oferta-produto) e do Caio. Na primeira venda real, conferir que ela foi
-- 'processed'.
create table if not exists public.payt_product_map (
  payt_code text primary key,
  product_key text not null references public.products(key) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now()
);

insert into public.payt_product_map(payt_code, product_key, note) values
 ('4Z3WGM', 'principal', 'Produto principal na Payt, informado pelo Caio em 2026-10-16.'),
 ('RKBQN6', 'upsell_01', 'Produto dos Arcanjos na Payt: a parte depois do traco do Payt Object ID do UP01 (R6VDGP-RKBQN6) e do DOWN01 (R2687O-RKBQN6). funil/mapa.js, 2026-10-16.'),
 ('R6VDGP', 'upsell_01', 'Oferta UP01 dos Arcanjos, R$ 137 (Payt Object ID R6VDGP-RKBQN6). 2026-10-16.'),
 ('R2687O', 'upsell_01', 'Oferta DOWN01 dos Arcanjos, R$ 97 (Payt Object ID R2687O-RKBQN6). 2026-10-16.'),
 ('LP39N8', 'upsell_02', 'Produto Musicas dos Anjos na Payt (Payt Object ID LGE836-LP39N8). 2026-10-16.'),
 ('LGE836', 'upsell_02', 'Oferta UP02 Musicas dos Anjos, R$ 69,90. 2026-10-16.'),
 ('L9EXDN', 'upsell_03', 'Produto Comunidade da Fe na Payt (Payt Object ID 455P2J-L9EXDN). 2026-10-16.'),
 ('455P2J', 'upsell_03', 'Oferta UP03 Comunidade da Fe, R$ 49,90. 2026-10-16.')
on conflict (payt_code) do nothing;

-- A mesma tranca de todas as outras tabelas: só o servidor (service_role)
-- lê e escreve. Sem estas linhas as tabelas nasceriam abertas.
alter table public.payt_events enable row level security;
revoke all on public.payt_events from anon, authenticated;
drop policy if exists backend_only on public.payt_events;
create policy backend_only on public.payt_events for all to service_role using (true) with check (true);

alter table public.payt_product_map enable row level security;
revoke all on public.payt_product_map from anon, authenticated;
drop policy if exists backend_only on public.payt_product_map;
create policy backend_only on public.payt_product_map for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------
-- PARTE 2. O pop-up dos Arcanjos também para quem comprou pela Payt
-- ---------------------------------------------------------------------
-- Os pop-ups do público novo (front_novas_1 e _2) só aparecem para quem tem
-- o principal com origem 'hubla' ou 'manual'. A compra pela Payt grava
-- 'payt', e sem isto ela nunca veria o pop-up. A página de destino é a mesma
-- (oferta-arcanjos.html, que vende pela Hubla), como o Caio pediu. Quem tem
-- qualquer um dos três extras continua sem ver, igual à cliente da Hubla.
update public.member_offer_campaigns
   set required_principal_sources = array_append(required_principal_sources, 'payt')
 where key in ('front_novas_1', 'front_novas_2')
   and not ('payt' = any(required_principal_sources));

commit;

-- ---------------------------------------------------------------------
-- Conferência (depois de rodar)
-- ---------------------------------------------------------------------
-- Tranca: deve voltar 2 linhas, rls = true e backend_only.
select c.relname, c.relrowsecurity as rls, p.polname
  from pg_class c left join pg_policy p on p.polrelid = c.oid
 where c.oid in ('public.payt_events'::regclass, 'public.payt_product_map'::regclass);

-- Códigos: devem voltar 8.
select payt_code, product_key from public.payt_product_map order by product_key, payt_code;

-- Pop-up: as duas devem terminar em payt.
select key, required_principal_sources from public.member_offer_campaigns where key like 'front_novas_%';

-- ---------------------------------------------------------------------
-- No dia a dia: o que chegou da Payt e o que ficou para conferir
-- ---------------------------------------------------------------------
-- O certo é 'processed' nas vendas. 'needs_reconciliation' com "Produto não
-- mapeado: X" quer dizer que o código X precisa entrar no payt_product_map
-- (e a venda liberada no painel); 'failed' é erro de servidor, e a Payt avisa.
-- select received_at, event_status, payment_status, sale_type, product_code,
--        processing_status, error
--   from public.payt_events order by received_at desc limit 30;
--
-- Quem pagou um extra pela Payt e ficou sem o principal (não entra no app):
-- select e.customer_email, e.product_code, e.received_at
--   from public.payt_events e
--   join public.customers c on c.email = e.customer_email
--  where e.processing_status = 'processed'
--    and not exists (select 1 from public.entitlements x
--                     where x.customer_id = c.id and x.product_key = 'principal' and x.status = 'active');
