-- Recuperação de acesso por CPF
-- ============================================================================
-- Para que serve: a cliente que não lembra (ou errou) o e-mail da compra digita
-- o CPF no app e recebe de volta o e-mail de acesso, entrando na hora. Hoje ela
-- não tem saída nenhuma a não ser o WhatsApp do suporte.
--
-- Este arquivo faz TRÊS coisas, nesta ordem:
--   1. cria as duas colunas novas em `customers`
--   2. preenche o histórico a partir dos eventos da Hubla já guardados
--   3. confere o resultado e mostra os números
--
-- É seguro rodar mais de uma vez: tudo é "se não existir" / "atualiza se mudou".
-- Nenhuma linha é apagada e nenhum acesso é alterado.
--
-- ⚠️ ONDE O CPF JÁ ESTAVA: desde sempre, dentro de `hubla_events.payload`, em
-- texto puro, no campo `event.user.document`. O webhook recebia e nunca lia.
-- Esta migração não traz CPF de fora — ela só organiza o que já estava no banco.
--
-- ⚠️ POR QUE GUARDAR EMBARALHADO (hash): assim a tabela de clientes nunca vira
-- uma lista de CPFs legível, e nem a busca nem o painel precisam manusear o
-- número. É SHA-256 puro, sem segredo por cima, DE PROPÓSITO: a mesma conta
-- precisa ser feita aqui no banco e lá na Edge Function, e um segredo que
-- divergisse entre os dois faria a busca parar de achar qualquer cliente em
-- silêncio. Contra quem já tivesse o banco inteiro, o segredo não protegeria
-- nada de todo jeito — os CPFs em texto puro continuam em `hubla_events`.
-- ============================================================================

set search_path to public, extensions;

-- pgcrypto entrega o digest(). No Supabase ele já vem instalado; a linha existe
-- para o caso de um banco novo montado do zero.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. As colunas
-- ----------------------------------------------------------------------------
-- cpf_hash  : o CPF (só dígitos) passado por SHA-256, em hexadecimal.
-- cpf_ultimos3 : os 3 últimos dígitos, em texto puro, para o painel mostrar
--             "•••.•••.•••-42" e você reconhecer a cliente sem ver o CPF todo.
alter table public.customers add column if not exists cpf_hash text;
alter table public.customers add column if not exists cpf_ultimos3 text;

-- A busca é sempre "acha o CPF exato", então um índice comum resolve.
-- NÃO é unique: a mesma pessoa pode ter comprado duas vezes com e-mails
-- diferentes, e travar isso quebraria a segunda compra dela no webhook.
create index if not exists customers_cpf_hash_idx on public.customers (cpf_hash)
  where cpf_hash is not null;

comment on column public.customers.cpf_hash is
  'SHA-256 do CPF só com dígitos. Usado para a cliente recuperar o e-mail de acesso. Nunca guarda o CPF legível.';
comment on column public.customers.cpf_ultimos3 is
  'Os 3 últimos dígitos do CPF, para conferência visual no painel admin.';

-- ----------------------------------------------------------------------------
-- 2. Preencher o histórico
-- ----------------------------------------------------------------------------
-- De onde sai: `hubla_events.payload -> event -> user -> document`, presente em
-- 99,6% dos eventos guardados (conferido em 22/09/2026).
--
-- A ligação com a cliente é feita por hubla_user_id OU por e-mail. Os dois,
-- porque nem toda cliente tem o hubla_user_id preenchido e o e-mail do evento
-- é o mesmo que virou o login dela.
--
-- `distinct on` com o evento mais recente primeiro: se a pessoa aparece em
-- vários eventos, vale o CPF do último — é o mais provável de estar correto.
with documentos as (
  select distinct on (usuario, endereco)
    nullif(btrim(coalesce(payload->'event'->'user'->>'id', '')), '')            as usuario,
    lower(nullif(btrim(coalesce(payload->'event'->'user'->>'email', '')), ''))  as endereco,
    regexp_replace(payload->'event'->'user'->>'document', '[^0-9]', '', 'g')    as digitos
  from public.hubla_events
  where coalesce(btrim(payload->'event'->'user'->>'document'), '') <> ''
  order by usuario, endereco, received_at desc
),
-- Só CPF de pessoa física. Em 22/09 todos os 5.496 eventos vieram com 11
-- dígitos, nenhum CNPJ — mas a trava fica, porque venda em nome de empresa
-- pode acontecer amanhã e um CNPJ aqui não serviria para recuperar nada.
limpos as (
  select usuario, endereco, digitos
  from documentos
  where length(digitos) = 11
    and digitos !~ '^(.)\1{10}$'   -- descarta 00000000000, 11111111111, etc.
)
update public.customers c
set cpf_hash     = encode(digest(l.digitos, 'sha256'), 'hex'),
    cpf_ultimos3 = right(l.digitos, 3)
from limpos l
where (c.hubla_user_id = l.usuario or c.email = l.endereco)
  -- Não reescreve o que já está igual: mantém o `update` barato quando este
  -- arquivo for rodado de novo.
  and c.cpf_hash is distinct from encode(digest(l.digitos, 'sha256'), 'hex');

-- ----------------------------------------------------------------------------
-- 3. Conferência — não altera nada, só mostra os números
-- ----------------------------------------------------------------------------
-- O que esperar (medido em 22/09/2026, produção):
--   B deve ficar perto de 1.205
--   D deve ficar perto de 220  →  são as clientes da base histórica de 18/09,
--                                 que nunca passaram pelo webhook
with ativas as (
  select c.*
  from public.customers c
  join public.entitlements e
    on e.customer_id = c.id and e.product_key = 'principal' and e.status = 'active'
)
select     'A. Clientes com acesso ativo'          as medida, (select count(*) from ativas)::text as valor
union all select 'B. Dessas, JA com CPF guardado',   (select count(*) from ativas where cpf_hash is not null)::text
union all select 'C. Cobertura',                     coalesce((select round(100.0 * count(*) filter (where cpf_hash is not null) / nullif(count(*), 0), 1) from ativas)::text, '0') || '%'
union all select 'D. Ainda sem CPF',                 (select count(*) from ativas where cpf_hash is null)::text
union all select 'E. Hashes diferentes (sanidade)',  (select count(distinct cpf_hash) from ativas where cpf_hash is not null)::text;
