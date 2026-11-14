-- =====================================================================
-- 10-chat.sql — a Lucy, o chat de suporte do app em inglês
-- =====================================================================
-- Cópia de supabase/latam/10-chat.sql (a Lucía do espanhol, 12/11/2026).
-- Por quê, no espanhol: na semana de 05 a 12/11, ~67 clientes escreveram ao
-- suporte com dúvida de verdade; metade não conseguia entrar. ~7 e-mails
-- chegaram VAZIOS: o botão de escrever abria o e-mail do celular e ela
-- enviava sem escrever. Decisão do Arthur (12/11): um chat que CONVERSA,
-- para tranquilizar a cliente. Só suporte: a Lucy nunca vende nada.
-- "Lucy" é nome provisório (docs/app-en.md, glossário).
--
-- Quem conversa é a função en-chat (supabase/functions/en-chat). Aqui
-- ficam só as conversas, o interruptor e a conta das primeiras compradoras.
--
-- O que cria (só objetos en_; o Brasil e a LATAM não sentem nada):
--   1. en_chat_config      o interruptor (nasce DESLIGADO), o modelo, o
--                          manual da Lucy e os freios
--   2. en_chat_conversas   uma linha por conversa, com o pedido à equipe
--   3. en_chat_mensagens   cada mensagem, dela e da Lucy
--   4. en_chat_posicao(id) a posição da compra dela entre as compradoras
--                          (os presentes físicos, se houver, são das primeiras)
--
-- ⚠️ O MANUAL DA LUCY NÃO MORA NESTE ARQUIVO. Este repositório é público, e
-- o manual tem o roteiro do suporte. Ele mora fora do repositório e entra
-- no banco por um SQL à parte, que também fica fora daqui. Sem manual, a
-- função não liga (a tela mostra só os contatos do suporte).
-- ⏳ EUA: o manual em inglês ainda não existe (o do espanhol mora em
-- 7 Améns LATAM\Chat\manual-lucia.md).
--
-- DEPENDE DE: 01-tabelas.sql e 04-admin.sql (en_admins). A en-chat também
-- usa en_permite (09-resgate.sql) e en_extras (05-extras.sql); sem elas, o
-- chat não trava ninguém e só não sabe dos extras.
--
-- ORDEM DE PUBLICAR: este SQL -> o manual -> a função en-chat (com o
-- segredo EN_ANTHROPIC_API_KEY, que ainda não existe) -> o site. Qualquer
-- outra ordem é inofensiva: o site sem a função mostra os contatos do suporte.
-- =====================================================================


-- 1. O interruptor e o que a equipe pode mudar sem publicar nada.
create table if not exists public.en_chat_config (
  id integer primary key default 1,
  ligado boolean not null default false,
  modelo text not null default 'claude-sonnet-5-5',
  manual text not null default '',
  mensagens_por_dia integer not null default 40,   -- por cliente (ou por conexão, sem login), a cada 24 h
  conversas_por_hora integer not null default 6,    -- conversas novas por conexão de internet
  -- Os presentes físicos (rosário, água, óleo) eram uma promessa da venda da
  -- LATAM (as 50 primeiras). ⏳ EUA: a venda americana não tem presente
  -- físico decidido, então nasce 0 = "sem presente": a Lucy não confirma nem
  -- nega nada e passa o caso à equipe. Se o Arthur decidir um número, é um
  -- update aqui, sem publicar nada.
  presentes_ate integer not null default 0,         -- as primeiras N compradoras ganham os presentes físicos (0 = não há)
  presentes_margem integer not null default 10,     -- quem está até N + margem vai para a equipe conferir
  updated_at timestamptz not null default now(),
  constraint en_chat_config_uma_linha check (id = 1),
  constraint en_chat_config_modelo check (modelo in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5')),
  constraint en_chat_config_freios check (mensagens_por_dia between 0 and 500 and conversas_por_hora between 0 and 100),
  constraint en_chat_config_presentes check (presentes_ate between 0 and 1000 and presentes_margem between 0 and 100)
);
insert into public.en_chat_config (id) values (1) on conflict (id) do nothing;


-- 2. As conversas. customer_id é nulo quando ela ainda não entrou no app
-- (a Lucy da /en-login).
create table if not exists public.en_chat_conversas (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.en_customers(id) on delete set null,
  pagina text not null default 'app',
  pais text not null default '',
  conexao text not null default '',             -- impressão digital do IP, só para o freio
  mensagens integer not null default 0,
  equipe text not null default 'nao',            -- nao | pendente | resolvido
  equipe_motivo text not null default '',        -- access | billing | refund | gifts | other
  equipe_resumo text not null default '',        -- o que a Lucy escreveu para a equipe (em inglês)
  equipe_contato text not null default '',       -- o e-mail (ou WhatsApp) que ela confirmou
  equipe_email text not null default '',         -- (sem uso: herança do espanhol, de quando havia serviço de e-mail)
  equipe_em timestamptz,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint en_chat_conversas_pagina check (pagina in ('app', 'entrar')),
  constraint en_chat_conversas_equipe check (equipe in ('nao', 'pendente', 'resolvido')),
  constraint en_chat_conversas_motivo check (equipe_motivo in ('', 'access', 'billing', 'refund', 'gifts', 'other')),
  constraint en_chat_conversas_email check (equipe_email in ('', 'enviado', 'falhou', 'sem_token'))
);
create index if not exists en_chat_conversas_cliente on public.en_chat_conversas (customer_id, created_at desc);
create index if not exists en_chat_conversas_equipe on public.en_chat_conversas (equipe, equipe_em desc) where equipe <> 'nao';
create index if not exists en_chat_conversas_data on public.en_chat_conversas (created_at desc);


-- 3. As mensagens.
create table if not exists public.en_chat_mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.en_chat_conversas(id) on delete cascade,
  papel text not null,                          -- cliente | assistente (a Lucy; nome neutro porque "Lucy" é provisório)
  texto text not null,
  modelo text not null default '',
  tokens_entrada integer not null default 0,
  tokens_cache integer not null default 0,
  tokens_saida integer not null default 0,
  created_at timestamptz not null default now(),
  constraint en_chat_mensagens_papel check (papel in ('cliente', 'assistente')),
  constraint en_chat_mensagens_texto check (length(texto) between 1 and 4000)
);
create index if not exists en_chat_mensagens_conversa on public.en_chat_mensagens (conversa_id, id);


-- Ninguém de fora lê nada (como nas outras en_).
do $trava$
declare t text;
begin
  foreach t in array array['en_chat_config', 'en_chat_conversas', 'en_chat_mensagens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A posição da compra dela entre as compradoras do app em inglês, desde
-- o começo (os presentes físicos, se houver, são das primeiras; ver
-- presentes_ate). Contam só compras de verdade: a do checkout e a carga das
-- compradoras de antes dele, que são as mais antigas e vêm primeiro. Ficam
-- de fora as administradoras, o acesso de emergência e o liberado à mão.
-- ⏳ EUA: checkout — 'checkout' é a origem que a função de pagamento vai
-- gravar em en_access (01-tabelas.sql); se ela usar outro nome, trocar aqui.
-- Devolve null se ela não é compradora.
create or replace function public.en_chat_posicao(p_customer_id uuid)
returns integer
language sql stable set search_path to ''
as $function$
  select r.posicao::integer from (
    select c.id,
           row_number() over (order by (a.source = 'import') desc, c.created_at, c.id) as posicao
      from public.en_customers c
      join public.en_access a on a.customer_id = c.id and a.product = 'app'
     where a.source in ('checkout', 'import')
       and not exists (select 1 from public.en_admins ad where ad.customer_id = c.id)
  ) r
  where r.id = p_customer_id;
$function$;
revoke all on function public.en_chat_posicao(uuid) from public, anon, authenticated;
grant execute on function public.en_chat_posicao(uuid) to service_role;


-- =====================================================================
-- Consultas para a equipe (leves; rodar uma de cada vez)
-- =====================================================================
-- Ligar e desligar a Lucy (sem publicar nada):
--   update public.en_chat_config set ligado = true,  updated_at = now() where id = 1;
--   update public.en_chat_config set ligado = false, updated_at = now() where id = 1;
--
-- Trocar o modelo:
--   update public.en_chat_config set modelo = 'claude-haiku-5-5', updated_at = now() where id = 1;
--
-- Os casos que pediram a equipe e ainda não foram resolvidos:
--   select id, equipe_motivo, equipe_contato, equipe_resumo, equipe_em
--     from public.en_chat_conversas where equipe = 'pendente' order by equipe_em desc limit 50;
--
-- As conversas do dia (Brasília):
--   select count(*) as conversas, count(*) filter (where equipe <> 'nao') as para_a_equipe
--     from public.en_chat_conversas
--    where created_at >= (now() at time zone 'America/Sao_Paulo')::date at time zone 'America/Sao_Paulo';
--
-- O gasto aproximado do mês (US$), no Sonnet 5.5 (2 / 10 por milhão; cache 0,10):
--   select round(sum(tokens_entrada) * 2e-6 + sum(tokens_cache) * 1e-7 + sum(tokens_saida) * 1e-5, 2)
--     from public.en_chat_mensagens where created_at >= date_trunc('month', now());
--
-- =====================================================================
-- DESFAZER (só se precisar; apaga as conversas)
-- =====================================================================
-- drop function if exists public.en_chat_posicao(uuid);
-- drop table if exists public.en_chat_mensagens;
-- drop table if exists public.en_chat_conversas;
-- drop table if exists public.en_chat_config;
