-- =====================================================================
-- 15-reembolso-pela-api.sql — devolver pela API, do painel (18/11/2026)
-- =====================================================================
-- Pedido do time (18/11): o suporte devolve o dinheiro pelo próprio painel
-- (/es-reembolsos), sem entrar em conta nenhuma. A função latam-reembolso
-- procura a compra pelo e-mail da cliente na Whop nova e nas 2 contas da
-- Digistore e, com a senha do painel, devolve pela API de quem cobrou.
--
-- As chaves e a senha moram nos SEGREDOS do Supabase, nunca aqui (o
-- repositório é público): WHOP_NOVA_API_KEY, DIGISTORE_LATAM_API_KEY,
-- DIGISTORE_EN_API_KEY e PAINEL_REEMBOLSO_SENHA.
--
-- O que cria (só objetos latam_; o Brasil não sente nada):
--   1. latam_refund_api_log   cada tentativa de devolver, deu certo ou não
--   2. latam_admin_actions aceita 'refund_api'
--
-- DEPENDE DE: 14-painel-reembolsos.sql (já na produção).
-- ORDEM DE PUBLICAR: este SQL -> função latam-reembolso -> site.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- 1. Cada tentativa de devolver pela API. Sem chave estrangeira para o
--    pedido de propósito: excluir o pedido não apaga o registro do dinheiro.
create table if not exists public.latam_refund_api_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  request_id uuid,
  admin_customer_id uuid references public.latam_customers(id) on delete set null,
  plataforma text not null,          -- whop | digistore
  conta text not null,               -- whop_nova | digistore_latam | digistore_en
  ref text not null,                 -- pay_... (Whop) ou o número da compra (Digistore)
  valor_cents integer not null default 0,
  moeda text not null default 'USD',
  ok boolean not null default false,
  resposta text not null default '', -- o resumo do que a plataforma respondeu (sem dado de cartão)
  constraint latam_refund_api_log_plataforma_check check (plataforma in ('whop','digistore'))
);
create index if not exists latam_refund_api_log_request_idx on public.latam_refund_api_log (request_id, created_at desc);
create index if not exists latam_refund_api_log_ref_idx on public.latam_refund_api_log (ref);

alter table public.latam_refund_api_log enable row level security;
revoke all on public.latam_refund_api_log from public, anon, authenticated;
drop policy if exists backend_only on public.latam_refund_api_log;
create policy backend_only on public.latam_refund_api_log for all to service_role using (true) with check (true);
grant select, insert on public.latam_refund_api_log to service_role;


-- 2. O histórico aceita a devolução pela API.
alter table public.latam_admin_actions drop constraint if exists latam_admin_actions_action_check;
alter table public.latam_admin_actions add constraint latam_admin_actions_action_check check (
  action in ('grant_access','revoke_access','update_email','entry_link','renew_entry_link',
             'grant_extra','revoke_extra',
             'refund_create','refund_update','refund_delete','refund_api')
);


-- =====================================================================
-- CONSULTA: as devoluções pela API dos últimos 7 dias (leve).
--   select created_at, conta, ref, valor_cents, ok, resposta
--   from public.latam_refund_api_log
--   where created_at > now() - interval '7 days' order by created_at desc;
-- =====================================================================

-- =====================================================================
-- DESFAZER (só se for preciso).
-- =====================================================================
-- drop table if exists public.latam_refund_api_log;
-- (a trava do histórico pode ficar: aceitar uma ação a mais não quebra nada)
