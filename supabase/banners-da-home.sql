-- =====================================================================
-- BANNERS DA HOME — a seção DESTAQUE, o carrossel do topo
-- =====================================================================
--
-- O que este arquivo faz: cria a tabela onde moram os banners que
-- aparecem no alto da home, e põe três dentro dela para a tela não
-- nascer vazia.
--
-- ONDE RODAR: no SQL Editor do Supabase. Primeiro no projeto de TESTE
-- (`wyiqwsgfictcfkytldnu`), e só depois na produção.
--
-- O QUE ELE NÃO FAZ: não toca em cliente, acesso, progresso nem venda.
-- Ele só cria uma tabela nova, que hoje não existe. Rodar duas vezes
-- não estraga nada — é todo "se não existir".
--
-- ⚠️ ENQUANTO ESTA TABELA NÃO EXISTIR, NADA QUEBRA. A member-api
-- pergunta por ela com uma rede embaixo: se a tabela não estiver lá,
-- ela devolve lista vazia e o app usa os três banners escritos dentro
-- do js/banner.js. Ou seja, publicar o código antes de rodar este SQL
-- é seguro — a ordem inversa também.
--
-- COMO DESFAZER: no fim do arquivo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A tabela
-- ---------------------------------------------------------------------
-- `key` é o nome curto do banner, só para o sistema se achar. Quem lê
-- na tela é `title`, e mesmo ele NÃO aparece para a cliente: serve para
-- o Caio saber qual é qual no painel e para o leitor de tela anunciar
-- o destino de quem não enxerga a imagem.
--
-- `image_url` e `target_url` guardam o endereço COMPLETO, com https://,
-- que é a mesma regra do `member_offer_campaigns.target_url`. Quando o
-- endereço é uma página do próprio app, o js/banner.js troca o domínio
-- pelo de agora — sem isso, clicar num banner em localhost jogaria quem
-- está testando direto no site das clientes reais.
create table if not exists public.member_home_banners (
  key text primary key,
  title text not null default '',
  image_url text not null,
  target_url text not null,
  enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_home_banners_key_check check (key ~ '^[a-z0-9_-]+$'),
  constraint member_home_banners_image_url_check check (image_url ~ '^https://'),
  constraint member_home_banners_target_url_check check (target_url ~ '^https://')
);

-- A consulta que a home faz a cada verificação de sessão: os ativos, na
-- ordem. É a única consulta quente desta tabela.
create index if not exists member_home_banners_ordem_idx
  on public.member_home_banners (enabled, sort_order);


-- ---------------------------------------------------------------------
-- A trava de segurança — igual à de todas as outras tabelas
-- ---------------------------------------------------------------------
-- Sem estas três linhas a tabela nasce ABERTA: qualquer pessoa que
-- descubra o endereço do banco poderia trocar os banners da home.
alter table public.member_home_banners enable row level security;
drop policy if exists backend_only on public.member_home_banners;
create policy backend_only on public.member_home_banners
  for all to service_role using (true) with check (true);


-- ---------------------------------------------------------------------
-- Abrir a auditoria para as ações de banner
-- ---------------------------------------------------------------------
-- A `admin_actions` é a tabela que responde "quem fez isso". Ela só
-- aceitava três tipos de ação, e gravar uma quarta dava erro. Sem esta
-- parte, trocar um banner pelo painel falharia na hora de registrar
-- quem trocou — e a troca inteira voltaria atrás.
--
-- A lista nova CONTÉM a antiga: nenhum registro existente deixa de ser
-- válido, então a troca da trava passa sem conferir linha por linha.
alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (
  action in ('grant_access','revoke_access','update_email','save_banner','delete_banner','move_banner')
);


-- ---------------------------------------------------------------------
-- Os três primeiros banners
-- ---------------------------------------------------------------------
-- São os mesmos três que estão escritos dentro do js/banner.js como
-- rede de segurança. Assim a tela não muda no dia em que a tabela
-- entra: ela só passa a ser trocável pelo painel.
--
-- O domínio aqui é o de produção de propósito. Em localhost o
-- js/banner.js reescreve para o endereço local sozinho.
insert into public.member_home_banners (key, title, image_url, target_url, enabled, sort_order)
values
  ('banner_1', '7 Orações Sagradas',
   'https://setemadrugadas.com.br/assets/images/home-7-oracoes-sagradas.jpg',
   'https://setemadrugadas.com.br/novena.html', true, 10),
  ('banner_2', 'Pai Nosso completo',
   'https://setemadrugadas.com.br/assets/images/home-pai-nosso.jpg',
   'https://setemadrugadas.com.br/dia.html?material=pai-nosso', true, 20),
  ('banner_3', 'Novena Desatadora dos Nós',
   'https://setemadrugadas.com.br/assets/images/desatadora/home.svg',
   'https://setemadrugadas.com.br/desatadora.html', true, 30)
on conflict (key) do nothing;


-- ---------------------------------------------------------------------
-- Conferir se deu certo
-- ---------------------------------------------------------------------
-- Deve devolver três linhas, todas com enabled = true.
select key, title, enabled, sort_order, image_url
from public.member_home_banners
order by sort_order;


-- =====================================================================
-- COMO DESFAZER
-- =====================================================================
-- Apaga a tabela inteira e tudo que está nela. A home volta a usar os
-- três banners escritos no js/banner.js na mesma hora, sem deploy.
--
--   drop table if exists public.member_home_banners;
--
-- =====================================================================
