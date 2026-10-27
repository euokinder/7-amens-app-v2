-- PEDIDOS DE ORAÇÃO — onde ficam os pedidos do formulário aberto de
-- sao-judas.html (a live de São Judas, quarta-feira 28/10/2026, às 20h).
-- Escrito em 26/10/2026.
--
-- A pessoa escreve o primeiro nome e a causa, em poucas palavras. Não
-- precisa de login: a página é aberta a quem tiver o link, cliente ou não,
-- e por isso aqui NÃO existe customer_id.
--
-- ORDEM DE PUBLICAÇÃO (não inverter):
--   1. este arquivo, no banco (SQL Editor do Supabase);
--   2. a member-api, que passa a aceitar a ação "prayer_request";
--   3. o site (sao-judas.html).
-- Qualquer ordem é inofensiva para a cliente: a página sempre diz "Recebi o
-- seu pedido". Mas o pedido só fica GUARDADO depois dos passos 1 e 2. O que
-- chegar antes disso se perde em silêncio, então a mensagem do WhatsApp só
-- sai depois dos três.
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir".

begin;

create table if not exists public.prayer_requests (
  id bigint generated always as identity primary key,
  -- Qual live ou campanha: 'sao_judas_2026'. Vem do data-campanha da página.
  campaign text not null,
  name text not null,
  intention text not null,
  created_at timestamptz not null default now(),
  constraint prayer_requests_campaign_check check (campaign ~ '^[a-z0-9_-]{1,40}$'),
  -- Os mesmos limites da página e da member-api.
  constraint prayer_requests_name_check check (char_length(name) between 1 and 60),
  constraint prayer_requests_intention_check check (char_length(intention) between 1 and 300)
);

create index if not exists prayer_requests_campaign_idx on public.prayer_requests (campaign, created_at);

-- A mesma tranca de todas as outras tabelas: só o servidor (a member-api,
-- com service_role) lê e escreve. Sem estas três linhas a tabela nasceria
-- aberta.
alter table public.prayer_requests enable row level security;
revoke all on public.prayer_requests from anon, authenticated;
drop policy if exists backend_only on public.prayer_requests;
create policy backend_only on public.prayer_requests for all to service_role using (true) with check (true);

commit;

-- Conferência (deve mostrar rls = true e uma política backend_only):
-- select c.relrowsecurity as rls, p.polname
--   from pg_class c left join pg_policy p on p.polrelid = c.oid
--  where c.oid = 'public.prayer_requests'::regclass;

-- A LISTA PARA O PADRE, na hora de Brasília. É o que se roda na quarta, às
-- 18h. (Também dá para baixar em planilha: Table Editor → prayer_requests →
-- Export → CSV.)
-- select to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') as quando,
--        name as nome, intention as pedido
--   from public.prayer_requests
--  where campaign = 'sao_judas_2026'
--  order by created_at;

-- QUANTOS PEDIDOS, por dia:
-- select (created_at at time zone 'America/Sao_Paulo')::date as dia, count(*) as pedidos
--   from public.prayer_requests
--  where campaign = 'sao_judas_2026'
--  group by 1 order by 1;
