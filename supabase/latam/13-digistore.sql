-- =====================================================================
-- 13-digistore.sql — o aviso próprio da Digistore24 (latam-digistore)
-- (13/11/2026)
-- =====================================================================
-- Por quê: desde 13/11 a LATAM vende só pela Digistore24, direto no checkout
-- dela. Quem libera o app e os extras hoje é a automação do Pedro (Make +
-- Brevo), fora deste repositório, e ela já falhou (1 de 14 compras de
-- extras conferidas em 13/11 ficou sem conta). A latam-digistore é a rede
-- de segurança: recebe o IPN da própria Digistore e libera junto. Liberar
-- duas vezes não faz mal (a conta é "ativo até a data mais longe").
--
-- O que muda:
--   1. latam_access aceita a origem 'digistore' (antes: whop, import,
--      manual, kashpay, emergencia). Nada mais muda na tabela.
--   2. A tabela nova latam_digistore_events: um aviso por linha, SEM dado de
--      pessoa (nem e-mail, nem nome): só o customer_id, como na KashPay.
--
-- Nada é apagado. Pode rodar mais de uma vez.
-- Desfazer: drop table public.latam_digistore_events; e voltar a trava de
-- origem para a lista antiga (só se nenhuma linha usar 'digistore').
-- =====================================================================

begin;

-- 1. A origem 'digistore' no acesso.
alter table public.latam_access drop constraint if exists latam_access_source_check;
alter table public.latam_access add constraint latam_access_source_check
  check (source = any (array['whop','import','manual','kashpay','emergencia','digistore']));

-- 2. Os avisos da Digistore24.
create table if not exists public.latam_digistore_events (
  event text not null,                 -- on_payment, on_refund, on_chargeback, ...
  transaction_id text not null,        -- único por pagamento, reembolso ou estorno
  order_id text,
  product_id text,
  produto text,                        -- principal | arcangeles | cantico | null
  api_mode text,                       -- live | test
  amount numeric(12,2),
  currency text,
  pay_method text,
  country text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campos text not null default '',     -- os NOMES dos campos do aviso (nunca os valores)
  customer_id uuid references public.latam_customers(id) on delete set null,
  status text not null default 'recorded',
  detail text not null default '',
  received_at timestamptz not null default now(),
  primary key (event, transaction_id),
  constraint latam_digistore_events_produto_check check (produto is null or produto in ('principal','arcangeles','cantico')),
  constraint latam_digistore_events_status_check check (status in ('recorded','needs_review','ignored'))
);
create index if not exists latam_digistore_events_received_idx on public.latam_digistore_events (received_at desc);
create index if not exists latam_digistore_events_customer_idx on public.latam_digistore_events (customer_id);

-- 3. Ninguém de fora lê nada. Só o servidor (service_role), como nas outras.
alter table public.latam_digistore_events enable row level security;
revoke all on public.latam_digistore_events from anon, authenticated;
drop policy if exists backend_only on public.latam_digistore_events;
create policy backend_only on public.latam_digistore_events for all to service_role using (true) with check (true);

commit;

-- CONFERIR (só leitura), logo depois de rodar:
--   select pg_get_constraintdef(oid) like '%digistore%' as origem_nova
--     from pg_constraint where conname = 'latam_access_source_check';
--   select relrowsecurity as rls from pg_class where oid = 'public.latam_digistore_events'::regclass;
