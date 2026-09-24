-- LINK DE ENTRADA — o que o banco precisa para a cliente entrar sem digitar
-- o e-mail. Escrito em 24/09/2026, a pedido do Caio.
--
-- Para quem é: a cliente que não consegue digitar o e-mail, mesmo com o
-- suporte ajudando. O suporte abre a ficha dela no painel, copia o link e
-- manda no WhatsApp. Ela toca e já cai dentro do app, com o nome dela, o
-- progresso dela e só os acessos que ela tem. O login por e-mail continua
-- igual para todas as outras.
--
-- ORDEM DE PUBLICAÇÃO (não inverter):
--   1. este arquivo, no banco (SQL Editor do Supabase);
--   2. a member-api, que passa a aceitar a ação "entry" e a criar o link;
--   3. o site (entrar.html e o botão no painel).
-- Se a função subir antes deste arquivo, nada quebra para as clientes: a
-- ficha do painel abre sem o bloco do link, e só o link em si não funciona.
--
-- Pode rodar mais de uma vez: tudo aqui é "se não existir".

begin;

-- Um link por cliente. O código fica guardado COMO É, e não só a impressão
-- digital dele (como acontece com as sessões, em member_sessions), de
-- propósito: o suporte precisa poder copiar o MESMO link de novo, semanas
-- depois, sem invalidar o que já foi mandado para ela.
-- O risco é o mesmo que já foi aceito para o login: quem sabe o e-mail dela
-- já entra, e o e-mail também está guardado como é, em customers. Este
-- código não abre nada que o e-mail já não abrisse.
--
-- 16 letras e números sorteados: 62^16 combinações, impossível de adivinhar.
-- Só letras e números porque o WhatsApp transforma _sublinhado_ em itálico.
--
-- Quem criou (`created_by`) fica aqui, e não em admin_actions: criar o link
-- não muda acesso nenhum, e a trava de ações do painel é diferente no banco
-- de teste e na produção (ver CLAUDE.md), então mexer nela exigiria duas
-- versões deste arquivo.
create table if not exists public.member_entry_links (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  token text not null,
  created_by uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  uses integer not null default 0,
  constraint member_entry_links_token_key unique (token),
  constraint member_entry_links_token_check check (token ~ '^[A-Za-z0-9]{16}$')
);

-- A mesma tranca de todas as outras tabelas: só o servidor (a member-api,
-- com service_role) lê e escreve. Sem estas três linhas a tabela nasceria
-- aberta.
alter table public.member_entry_links enable row level security;
revoke all on public.member_entry_links from anon, authenticated;
drop policy if exists backend_only on public.member_entry_links;
create policy backend_only on public.member_entry_links for all to service_role using (true) with check (true);

commit;

-- Conferência (deve mostrar rls = true e uma política backend_only):
-- select c.relrowsecurity as rls, p.polname
--   from pg_class c left join pg_policy p on p.polrelid = c.oid
--  where c.oid = 'public.member_entry_links'::regclass;
