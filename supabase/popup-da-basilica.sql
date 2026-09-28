-- POP-UP DA BASÍLICA — o que o banco precisa para contar os toques no
-- pop-up das contribuições da Terceira Madrugada. Escrito em 27/09/2026,
-- a pedido do Caio.
--
-- O que acontece na tela: ela toca num dos valores (R$ 950, R$ 300 ou
-- R$ 197), abre um pop-up de agradecimento e ali escolhe entre ajudar todo
-- mês (Pix Automático, na Cakto) ou só desta vez (Hubla). Dá para trocar o
-- valor dentro do pop-up. Cada toque vira uma linha aqui:
--   opened  = tocou num valor e o pop-up abriu (amount = o valor que tocou)
--   monthly = foi para o pagamento mensal       (amount = o valor escolhido)
--   once    = foi para o pagamento único        (amount = o valor escolhido)
--   closed  = fechou o pop-up sem escolher      (amount = o valor na tela)
--
-- Isto conta quem FOI para o pagamento, não quem PAGOU. Quem pagou está na
-- Cakto (mensal) e na Hubla (único).
--
-- ORDEM DE PUBLICAÇÃO (não inverter):
--   1. este arquivo, no banco (SQL Editor do Supabase);
--   2. a member-api, que passa a aceitar a ação "donation_event";
--   3. o site (o pop-up em js/doacao-dia-03.js).
-- Qualquer ordem é inofensiva para a cliente: a contagem é enviada sem
-- esperar resposta, e se a função ou a tabela ainda não existirem, o toque
-- simplesmente não é contado. O pagamento dela nunca depende disto.
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir".

begin;

create table if not exists public.member_donation_events (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  event text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  constraint member_donation_events_event_check check (event in ('opened', 'monthly', 'once', 'closed')),
  -- O valor não é uma lista fechada de propósito: testar um mensal mais
  -- barato no futuro não pode exigir mexer no banco.
  constraint member_donation_events_amount_check check (amount between 1 and 100000)
);

create index if not exists member_donation_events_customer_idx on public.member_donation_events (customer_id);

-- A mesma tranca de todas as outras tabelas: só o servidor (a member-api,
-- com service_role) lê e escreve. Sem estas três linhas a tabela nasceria
-- aberta.
alter table public.member_donation_events enable row level security;
revoke all on public.member_donation_events from anon, authenticated;
drop policy if exists backend_only on public.member_donation_events;
create policy backend_only on public.member_donation_events for all to service_role using (true) with check (true);

commit;

-- Conferência (deve mostrar rls = true e uma política backend_only):
-- select c.relrowsecurity as rls, p.polname
--   from pg_class c left join pg_policy p on p.polrelid = c.oid
--  where c.oid = 'public.member_donation_events'::regclass;

-- A CONTAGEM (é o que o agente roda quando o Caio pergunta "como está o
-- pop-up da basílica"). Pessoas = clientes diferentes; toques = linhas.
-- select event, amount, count(distinct customer_id) as pessoas, count(*) as toques
--   from public.member_donation_events
--  group by event, amount
--  order by event, amount desc;
