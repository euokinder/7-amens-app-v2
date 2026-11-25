-- =====================================================================
-- NOVENA DOS 5 NOMES — a entrega dentro do app (pedido do Arthur, 25/11/2026)
-- =====================================================================
-- O produto novena_5_nomes já existe desde 22/11/2026 (o pop-up de venda,
-- supabase/popup-novena-5-nomes.sql), mas não abria nada no app. Agora abre:
-- nove vídeos, um por madrugada, e a Central dos Quatro Arcanjos junto.
--
-- O QUE ESTE ARQUIVO FAZ: cria UMA tabela nova, pequena, e mais nada. Não
-- mexe em tabela, visão, função ou trava que já existe. Por isso não há o
-- que conferir contra o banco vivo antes de rodar.
--
-- O QUE A TABELA GUARDA, uma linha por cliente que abriu a Novena:
--   started_on      o dia (de Brasília) em que ela abriu a Novena pela
--                   primeira vez. É a âncora: a 1ª madrugada é nesse dia, a
--                   2ª abre na meia-noite seguinte, até a 9ª.
--                   ⚠️ A âncora é a primeira ABERTURA DA NOVENA, e não a
--                   primeira entrada no app (como nas 7 madrugadas e no
--                   Cântico): quem compra a Novena com semanas de app
--                   encontraria as nove abertas de uma vez.
--   wrote_names     se ela escreveu algum nome na tela "Por quem vamos
--                   rezar?". ⚠️ OS NOMES NÃO SÃO GUARDADOS AQUI nem em lugar
--                   nenhum do servidor (decisão do Arthur, 25/11): ficam só
--                   no celular dela, para aparecer em cada madrugada.
--   completed_days  as madrugadas que ela marcou como concluídas (1 a 9).
--                   Fica aqui, e não em prayer_progress, de propósito: assim
--                   o número "Orações" do painel não muda, e a trava
--                   prayer_progress_prayer_key_check não precisa ser mexida.
--
-- ORDEM DE PUBLICAÇÃO (não inverter):
--   1. este arquivo, no banco (SQL Editor do Supabase);
--   2. a member-api (campo `novena5` e as ações novena_start e
--      novena_progress; novena_5_nomes entra no FICA_DEPOIS_DE_CANCELAR);
--   3. o site.
-- Se a função subir antes deste arquivo, nada quebra: ela não acha a tabela,
-- não manda o campo `novena5`, e a tela abre as nove madrugadas sem trava e
-- sem o botão "Concluí" (a rede de segurança do js/novena-5-nomes.js).
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir".

begin;

create table if not exists public.member_novena_5_nomes (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  started_on date not null,
  wrote_names boolean not null default false,
  completed_days smallint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_novena_5_nomes_days_check
    check (completed_days <@ array[1,2,3,4,5,6,7,8,9]::smallint[])
);

-- A mesma tranca de todas as outras tabelas: só o servidor (a member-api,
-- com service_role) lê e escreve. Sem estas linhas a tabela nasceria aberta.
alter table public.member_novena_5_nomes enable row level security;
revoke all on public.member_novena_5_nomes from anon, authenticated;
drop policy if exists backend_only on public.member_novena_5_nomes;
create policy backend_only on public.member_novena_5_nomes for all to service_role using (true) with check (true);

-- A descrição do produto dizia "Ainda sem tela no app". Só o painel lê.
update public.products
   set description = 'Novena de 9 madrugadas a Maria por 5 nomes, com a Central dos Quatro Arcanjos. No app desde 25/11/2026: novena-5-nomes.html. Na Hubla: Novena dos 05 Nomes (funil) e Novena dos 05 Nomes APP (pop-up e card do app).'
 where key = 'novena_5_nomes';

commit;

-- CONFERÊNCIA depois de rodar (só leitura). O certo: rls = true, a política
-- backend_only, e nenhuma linha ainda.
-- select c.relrowsecurity as rls, p.polname,
--        (select count(*) from public.member_novena_5_nomes) as linhas
--   from pg_class c left join pg_policy p on p.polrelid = c.oid
--  where c.oid = 'public.member_novena_5_nomes'::regclass;

-- ---------------------------------------------------------------------
-- COMO ESTÁ INDO (leve: a tabela só tem quem abriu a Novena)
-- ---------------------------------------------------------------------
-- Quantas abriram, quantas escreveram nomes, e até onde chegaram.
-- select count(*) as abriram,
--        count(*) filter (where wrote_names) as escreveram_nomes,
--        count(*) filter (where cardinality(completed_days) >= 1) as concluiram_a_1a,
--        count(*) filter (where cardinality(completed_days) >= 9) as concluiram_as_9
--   from public.member_novena_5_nomes;
--
-- Quem tem a Novena no acesso (ativa) e ainda não abriu:
-- select count(*) from public.entitlements e
--  where e.product_key = 'novena_5_nomes' and e.status = 'active'
--    and not exists (select 1 from public.member_novena_5_nomes n where n.customer_id = e.customer_id);

-- ---------------------------------------------------------------------
-- VOLTAR ATRÁS
-- ---------------------------------------------------------------------
-- Primeiro a função anterior e o site anterior; a tabela pode ficar, parada.
-- Apagar de vez (perde a âncora e as madrugadas concluídas de cada uma):
-- drop table if exists public.member_novena_5_nomes;
