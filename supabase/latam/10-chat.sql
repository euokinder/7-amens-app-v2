-- =====================================================================
-- 10-chat.sql — a Lucía, o chat de suporte do app em espanhol (12/11/2026)
-- =====================================================================
-- Por quê: na semana de 05 a 12/11, ~67 clientes escreveram ao soporte com
-- dúvida de verdade; metade não conseguia entrar. ~7 e-mails chegaram VAZIOS:
-- o botão "Escríbenos" abria o e-mail do celular e ela enviava sem escrever.
-- Decisão do Arthur (12/11): um chat que CONVERSA, para tranquilizar a
-- cliente. Só suporte: a Lucía nunca vende nada.
--
-- Quem conversa é a função latam-chat (supabase/functions/latam-chat). Aqui
-- ficam só as conversas, o interruptor e a conta das 50 primeiras.
--
-- O que cria (só objetos latam_; o Brasil não sente nada):
--   1. latam_chat_config      o interruptor (nasce DESLIGADO), o modelo, o
--                             manual da Lucía e os freios
--   2. latam_chat_conversas   uma linha por conversa, com o pedido à equipe
--   3. latam_chat_mensagens   cada mensagem, dela e da Lucía
--   4. latam_chat_posicao(id) a posição da compra dela entre as compradoras
--                             (os presentes físicos são das 50 primeiras)
--
-- ⚠️ O MANUAL DA LUCÍA NÃO MORA NESTE ARQUIVO. Este repositório é público, e
-- o manual tem o roteiro do suporte. Ele mora fora do repositório
-- (7 Améns LATAM\Chat\) e entra no banco por um SQL à parte, que também
-- fica fora daqui. Sem manual, a função não liga (responde só o WhatsApp).
--
-- ORDEM DE PUBLICAR: este SQL -> o manual -> a função latam-chat (com o
-- segredo ANTHROPIC_API_KEY) -> o site. Qualquer outra ordem é inofensiva:
-- o site sem a função mostra o WhatsApp e o e-mail, como hoje.
-- =====================================================================


-- 1. O interruptor e o que a equipe pode mudar sem publicar nada.
create table if not exists public.latam_chat_config (
  id integer primary key default 1,
  ligado boolean not null default false,
  modelo text not null default 'claude-sonnet-5-5',
  manual text not null default '',
  mensagens_por_dia integer not null default 40,   -- por cliente (ou por conexão, sem login), a cada 24 h
  conversas_por_hora integer not null default 6,    -- conversas novas por conexão de internet
  presentes_ate integer not null default 50,        -- as primeiras N compradoras ganham os presentes físicos
  presentes_margem integer not null default 10,     -- quem está até N + margem vai para a equipe conferir
  updated_at timestamptz not null default now(),
  constraint latam_chat_config_uma_linha check (id = 1),
  constraint latam_chat_config_modelo check (modelo in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5')),
  constraint latam_chat_config_freios check (mensagens_por_dia between 0 and 500 and conversas_por_hora between 0 and 100),
  constraint latam_chat_config_presentes check (presentes_ate between 0 and 1000 and presentes_margem between 0 and 100)
);
insert into public.latam_chat_config (id) values (1) on conflict (id) do nothing;


-- 2. As conversas. customer_id é nulo quando ela ainda não entrou no app
-- (a Lucía da /es-entrar).
create table if not exists public.latam_chat_conversas (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.latam_customers(id) on delete set null,
  pagina text not null default 'app',
  pais text not null default '',
  conexao text not null default '',             -- impressão digital do IP, só para o freio
  mensagens integer not null default 0,
  equipe text not null default 'nao',            -- nao | pendente | resolvido
  equipe_motivo text not null default '',        -- acceso | cobro | reembolso | regalos | otro
  equipe_resumo text not null default '',        -- o que a Lucía escreveu para a equipe
  equipe_contato text not null default '',       -- o e-mail (ou WhatsApp) que ela confirmou
  equipe_email text not null default '',         -- enviado | falhou | sem_token
  equipe_em timestamptz,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint latam_chat_conversas_pagina check (pagina in ('app', 'entrar')),
  constraint latam_chat_conversas_equipe check (equipe in ('nao', 'pendente', 'resolvido')),
  constraint latam_chat_conversas_motivo check (equipe_motivo in ('', 'acceso', 'cobro', 'reembolso', 'regalos', 'otro')),
  constraint latam_chat_conversas_email check (equipe_email in ('', 'enviado', 'falhou', 'sem_token'))
);
create index if not exists latam_chat_conversas_cliente on public.latam_chat_conversas (customer_id, created_at desc);
create index if not exists latam_chat_conversas_equipe on public.latam_chat_conversas (equipe, equipe_em desc) where equipe <> 'nao';
create index if not exists latam_chat_conversas_data on public.latam_chat_conversas (created_at desc);


-- 3. As mensagens.
create table if not exists public.latam_chat_mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.latam_chat_conversas(id) on delete cascade,
  papel text not null,
  texto text not null,
  modelo text not null default '',
  tokens_entrada integer not null default 0,
  tokens_cache integer not null default 0,
  tokens_saida integer not null default 0,
  created_at timestamptz not null default now(),
  constraint latam_chat_mensagens_papel check (papel in ('cliente', 'lucia')),
  constraint latam_chat_mensagens_texto check (length(texto) between 1 and 4000)
);
create index if not exists latam_chat_mensagens_conversa on public.latam_chat_mensagens (conversa_id, id);


-- Ninguém de fora lê nada (como nas outras latam_).
do $trava$
declare t text;
begin
  foreach t in array array['latam_chat_config', 'latam_chat_conversas', 'latam_chat_mensagens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- 4. A posição da compra dela entre as compradoras da LATAM, desde o começo.
-- Os presentes físicos (rosário, água, óleo) foram para as 50 primeiras
-- (Arthur, 12/11). Contam só compras de verdade (Whop, KashPay e a carga das
-- compradoras de antes do webhook, que são as mais antigas e vêm primeiro);
-- ficam de fora as administradoras, o acesso de emergência e o liberado à mão.
-- Devolve null se ela não é compradora.
create or replace function public.latam_chat_posicao(p_customer_id uuid)
returns integer
language sql stable set search_path to ''
as $function$
  select r.posicao::integer from (
    select c.id,
           row_number() over (order by (a.source = 'import') desc, c.created_at, c.id) as posicao
      from public.latam_customers c
      join public.latam_access a on a.customer_id = c.id and a.product = 'app'
     where a.source in ('whop', 'import', 'kashpay')
       and not exists (select 1 from public.latam_admins ad where ad.customer_id = c.id)
  ) r
  where r.id = p_customer_id;
$function$;
revoke all on function public.latam_chat_posicao(uuid) from public, anon, authenticated;
grant execute on function public.latam_chat_posicao(uuid) to service_role;


-- =====================================================================
-- Consultas para a equipe (leves; rodar uma de cada vez)
-- =====================================================================
-- Ligar e desligar a Lucía (sem publicar nada):
--   update public.latam_chat_config set ligado = true,  updated_at = now() where id = 1;
--   update public.latam_chat_config set ligado = false, updated_at = now() where id = 1;
--
-- Trocar o modelo:
--   update public.latam_chat_config set modelo = 'claude-haiku-5-5', updated_at = now() where id = 1;
--
-- Os casos que pediram a equipe e ainda não foram resolvidos:
--   select id, equipe_motivo, equipe_contato, equipe_resumo, equipe_em
--     from public.latam_chat_conversas where equipe = 'pendente' order by equipe_em desc limit 50;
--
-- As conversas do dia (Brasília):
--   select count(*) as conversas, count(*) filter (where equipe <> 'nao') as para_a_equipe
--     from public.latam_chat_conversas
--    where created_at >= (now() at time zone 'America/Sao_Paulo')::date at time zone 'America/Sao_Paulo';
--
-- O gasto aproximado do mês (US$), no Sonnet 5.5 (2 / 10 por milhão; cache 0,10):
--   select round(sum(tokens_entrada) * 2e-6 + sum(tokens_cache) * 1e-7 + sum(tokens_saida) * 1e-5, 2)
--     from public.latam_chat_mensagens where created_at >= date_trunc('month', now());
--
-- =====================================================================
-- DESFAZER (só se precisar; apaga as conversas)
-- =====================================================================
-- drop function if exists public.latam_chat_posicao(uuid);
-- drop table if exists public.latam_chat_mensagens;
-- drop table if exists public.latam_chat_conversas;
-- drop table if exists public.latam_chat_config;
