-- =====================================================================
-- 16-reembolso-por-email.sql — pedidos de reembolso que chegam por e-mail (18/11/2026)
-- =====================================================================
-- Pedido do Arthur (18/11): os pedidos de reembolso que chegam nas caixas de
-- suporte (LATAM: soporte; EUA: a caixa do Gmail) entram SOZINHOS no painel
-- de reembolsos (/es-reembolsos), já ligados à cliente e à compra, com
-- resumo e etiquetas. Quem lê é um robô do Google (Apps Script, só leitura)
-- em cada Gmail, que manda os e-mails novos para a função suporte-email; a
-- IA separa o que é pedido de reembolso e a função grava o pedido aqui.
-- Ninguém é respondido por este caminho (a resposta é a automação do Lucas).
-- Guia completo: docs/reembolso-por-email.md.
--
-- O que muda (só objetos latam_ e en_; o Brasil não sente nada). Nas DUAS
-- tabelas de pedidos (latam_refund_requests e en_refund_requests), igual:
--   1. a coluna canal aceita 'email' (na en, ela nasce aqui, default 'pagina')
--   2. o motivo aceita 'extra_sin_querer' (comprou o extra sem perceber)
--   3. as colunas email_* (o e-mail que originou o pedido)
--   4. um índice único no email_message_id: o mesmo e-mail nunca vira dois pedidos
--
-- Não guarda o e-mail inteiro: só o texto da cliente, cortado em 2.000
-- caracteres e sem a citação dos e-mails anteriores. E-mail que não é
-- pedido de reembolso não é gravado em lugar nenhum.
--
-- DEPENDE DE: latam/11 e 14, en/11 (os três já na produção).
-- ORDEM DE PUBLICAR: este SQL -> SQL 17 (o painel) -> funções -> site.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- 1. LATAM -------------------------------------------------------------
alter table public.latam_refund_requests
  add column if not exists email_tipo text,          -- pedido_reembolso | cobro_doble | no_reconoce | amenaza_banco
  add column if not exists email_resumo text,        -- 1 a 3 frases em português, para o suporte
  add column if not exists email_assunto text,
  add column if not exists email_trecho text,        -- o texto dela, até 2.000 caracteres, sem citação
  add column if not exists email_de text,            -- o remetente (pode ser outro que o da compra)
  add column if not exists email_recebido_em timestamptz,
  add column if not exists email_caixa text,         -- soporte | eua
  add column if not exists email_message_id text,    -- <caixa>:<id da mensagem no Gmail>
  add column if not exists email_link text;          -- abre a conversa no Gmail

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_canal_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_canal_check
  check (canal in ('pagina','manual','email'));

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_motivo_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_motivo_check
  check (motivo is null or motivo in
    ('no_pude_entrar','no_era_lo_que_esperaba','no_reconozco','cobro_de_mas','extra_sin_querer','otro'));

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_email_tipo_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_email_tipo_check
  check (email_tipo is null or email_tipo in ('pedido_reembolso','cobro_doble','no_reconoce','amenaza_banco'));

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_email_caixa_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_email_caixa_check
  check (email_caixa is null or email_caixa in ('soporte','eua'));

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_email_trecho_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_email_trecho_check
  check (email_trecho is null or length(email_trecho) <= 2000);

create unique index if not exists latam_refund_requests_email_message_idx
  on public.latam_refund_requests (email_message_id) where email_message_id is not null;
create index if not exists latam_refund_requests_customer_idx
  on public.latam_refund_requests (customer_id) where status = 'pendente';


-- 2. EUA (as mesmas colunas e travas) ----------------------------------
alter table public.en_refund_requests
  add column if not exists canal text not null default 'pagina',
  add column if not exists email_tipo text,
  add column if not exists email_resumo text,
  add column if not exists email_assunto text,
  add column if not exists email_trecho text,
  add column if not exists email_de text,
  add column if not exists email_recebido_em timestamptz,
  add column if not exists email_caixa text,
  add column if not exists email_message_id text,
  add column if not exists email_link text;

alter table public.en_refund_requests drop constraint if exists en_refund_requests_canal_check;
alter table public.en_refund_requests add constraint en_refund_requests_canal_check
  check (canal in ('pagina','manual','email'));

alter table public.en_refund_requests drop constraint if exists en_refund_requests_motivo_check;
alter table public.en_refund_requests add constraint en_refund_requests_motivo_check
  check (motivo is null or motivo in
    ('no_pude_entrar','no_era_lo_que_esperaba','no_reconozco','cobro_de_mas','extra_sin_querer','otro'));

alter table public.en_refund_requests drop constraint if exists en_refund_requests_email_tipo_check;
alter table public.en_refund_requests add constraint en_refund_requests_email_tipo_check
  check (email_tipo is null or email_tipo in ('pedido_reembolso','cobro_doble','no_reconoce','amenaza_banco'));

alter table public.en_refund_requests drop constraint if exists en_refund_requests_email_caixa_check;
alter table public.en_refund_requests add constraint en_refund_requests_email_caixa_check
  check (email_caixa is null or email_caixa in ('soporte','eua'));

alter table public.en_refund_requests drop constraint if exists en_refund_requests_email_trecho_check;
alter table public.en_refund_requests add constraint en_refund_requests_email_trecho_check
  check (email_trecho is null or length(email_trecho) <= 2000);

create unique index if not exists en_refund_requests_email_message_idx
  on public.en_refund_requests (email_message_id) where email_message_id is not null;
create index if not exists en_refund_requests_customer_idx
  on public.en_refund_requests (customer_id) where status = 'pendente';


-- =====================================================================
-- CONSULTA: os pedidos que vieram por e-mail nos últimos 7 dias (leve).
--   select 'latam' regiao, created_at, email_caixa, email_tipo, motivo, sin_compra, total_cents, status
--   from public.latam_refund_requests where canal = 'email' and created_at > now() - interval '7 days'
--   union all
--   select 'eua', created_at, email_caixa, email_tipo, motivo, sin_compra, total_cents, status
--   from public.en_refund_requests where canal = 'email' and created_at > now() - interval '7 days'
--   order by created_at desc;
-- =====================================================================

-- =====================================================================
-- DESFAZER (só se for preciso). Primeiro desligar o robô (docs/reembolso-por-email.md).
-- Os pedidos 'email' viram 'manual' antes de devolver a trava antiga.
-- =====================================================================
-- update public.latam_refund_requests set canal = 'manual' where canal = 'email';
-- alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_canal_check;
-- alter table public.latam_refund_requests add constraint latam_refund_requests_canal_check check (canal in ('pagina','manual'));
-- update public.en_refund_requests set canal = 'manual' where canal = 'email';
-- (as colunas email_* e o motivo novo podem ficar: as funções antigas não os leem)
-- =====================================================================
