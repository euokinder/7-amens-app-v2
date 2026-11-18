-- =====================================================================
-- 17-painel-latam-eua.sql — LATAM e EUA no mesmo painel de reembolsos
-- (18/11/2026)
-- =====================================================================
-- Pedido do Arthur (18/11): os pedidos de reembolso que chegam por e-mail
-- nas caixas de suporte entram sozinhos no painel (/es-reembolsos), e a LATAM
-- e os EUA ficam na mesma tela, com etiqueta de região e filtro. O leitor dos
-- e-mails e as colunas email_* são do SQL 16 (16-reembolso-por-email.sql,
-- outra peça; não confundir com 16-tres-madrugadas.sql); este arquivo é o
-- que o PAINEL precisa. Na tela, cada país (LATAM | EUA) vê só os seus.
--
-- O que muda (só objetos latam_ e en_; o Brasil não sente nada):
--   1. en_refund_requests ganha o que a latam_ já tem para o painel: o estado
--      'desistiu' e as colunas valor_devolvido_cents, resuelto_por e
--      atualizado_em (quem resolve é alguém de latam_admins: a equipe é uma
--      só). Excluir passa a valer nela também.
--   2. latam_admin_reembolsos_todos(): a lista do painel com as DUAS tabelas.
--      Cada pedido vem com "regiao" ('latam' ou 'eua'), as colunas email_*
--      do SQL 16 e, em cada compra, "na_plataforma":
--        LATAM: o que a Whop ou a KashPay registraram (como no SQL 14);
--        EUA:   o que a Digistore dos EUA avisou (en_digistore_events):
--               'devolvido' (on_refund) ou 'disputa' (on_chargeback).
--
-- A lista antiga, latam_admin_reembolsos() (SQL 14), fica como está: a função
-- latam-reembolso usa a nova e, se ela não existir, volta para a antiga. Por
-- isso nenhuma ordem de publicar quebra o painel.
--
-- Quem entra no painel continua sendo latam_admins. O histórico continua em
-- latam_admin_actions (as ações são as mesmas); num pedido dos EUA,
-- target_customer_id fica vazio (ele aponta para latam_customers) e os
-- detalhes levam regiao = 'eua'.
--
-- DEPENDE DE: 14-painel-reembolsos.sql, en/11-reembolso.sql,
-- en/13-digistore.sql e 16-reembolso-por-email.sql (colunas email_*). Sem o SQL 16 este arquivo
-- para no começo, sem mudar nada, com o aviso "rode o SQL 16 antes".
-- ORDEM DE PUBLICAR: SQL 16 -> este SQL -> função latam-reembolso -> site.
-- Leve (as duas tabelas de pedidos são pequenas; as buscas na Digistore usam
-- a chave e o índice de order_id). Pode rodar de novo sem estragar nada.
-- =====================================================================

-- 0. O SQL 16 tem de ter rodado: a lista lê as colunas email_* e o canal.
do $confere$
declare falta text;
begin
  select string_agg(t || '.' || c, ', ') into falta
  from unnest(array['latam_refund_requests','en_refund_requests']) as t,
       unnest(array['canal','email_tipo','email_resumo','email_assunto','email_trecho',
                    'email_de','email_recebido_em','email_caixa','email_link']) as c
  where not exists (select 1 from information_schema.columns k
                    where k.table_schema = 'public' and k.table_name = t and k.column_name = c);
  if falta is not null then
    raise exception 'Rode o SQL 16 antes deste (faltam: %).', falta;
  end if;
end
$confere$;


-- 1. Os pedidos dos EUA: o que o painel precisa para marcar e editar.
alter table public.en_refund_requests
  add column if not exists valor_devolvido_cents integer,
  add column if not exists resuelto_por uuid references public.latam_customers(id) on delete set null,
  add column if not exists atualizado_em timestamptz;

alter table public.en_refund_requests drop constraint if exists en_refund_requests_status_check;
alter table public.en_refund_requests add constraint en_refund_requests_status_check
  check (status in ('pendente','feito','recusado','desistiu'));

alter table public.en_refund_requests drop constraint if exists en_refund_requests_devolvido_check;
alter table public.en_refund_requests add constraint en_refund_requests_devolvido_check
  check (valor_devolvido_cents is null or valor_devolvido_cents between 0 and 10000000);

-- Excluir apaga de vez (como na LATAM): o painel precisa de DELETE (só o servidor).
grant delete on public.en_refund_requests to service_role;


-- 2. A lista do painel, LATAM + EUA. Todos os pendentes das duas + os 400
--    resolvidos mais novos (das duas juntas). Mesmo formato da lista do
--    SQL 14, com "regiao" e as colunas email_* a mais.
create or replace function public.latam_admin_reembolsos_todos()
returns jsonb
language sql stable set search_path to ''
as $function$
  with todos as (
    select 'latam'::text as regiao, r.id, r.status, r.created_at, r.resuelto_en from public.latam_refund_requests r
    union all
    select 'eua'::text, r.id, r.status, r.created_at, r.resuelto_en from public.en_refund_requests r
  ),
  escolhidos as (
    (select regiao, id from todos where status = 'pendente')
    union all
    (select regiao, id from todos where status <> 'pendente'
     order by coalesce(resuelto_en, created_at) desc limit 400)
  ),
  linhas as (
    -- LATAM (a mesma conta do SQL 14)
    select jsonb_build_object(
      'id', r.id,
      'regiao', 'latam',
      'created_at', r.created_at,
      'email', r.email,
      'customer_id', coalesce(r.customer_id, c.id),
      'nome', coalesce(c.name, ''),
      'pais', coalesce(nullif(r.pais, ''), c.country, ''),
      'cliente_desde', c.created_at,
      'total_cents', r.total_cents,
      'moneda', r.moneda,
      'sin_compra', r.sin_compra,
      'motivo', r.motivo,
      'status', r.status,
      'resuelto_en', r.resuelto_en,
      'resuelto_por', coalesce(quem.email, ''),
      'nota', r.nota,
      'canal', r.canal,
      'valor_devolvido_cents', r.valor_devolvido_cents,
      'atualizado_em', r.atualizado_em,
      'email_tipo', r.email_tipo,
      'email_resumo', r.email_resumo,
      'email_assunto', r.email_assunto,
      'email_trecho', r.email_trecho,
      'email_de', r.email_de,
      'email_recebido_em', r.email_recebido_em,
      'email_caixa', r.email_caixa,
      'email_link', r.email_link,
      'acesso', (select jsonb_build_object('status', a.status, 'expires_at', a.expires_at, 'source', a.source)
                 from public.latam_access a
                 where a.customer_id = coalesce(r.customer_id, c.id) and a.product = 'app' limit 1),
      'outros_pedidos', (select count(*) from public.latam_refund_requests o
                         where o.email = r.email and o.id <> r.id),
      'itens', coalesce((
        select jsonb_agg(i.item || jsonb_build_object('na_plataforma',
          case
            when i.item->>'pedido' like 'pay\_%' then (
              select case
                       when bool_or(w.event_type like 'dispute.%') then 'disputa'
                       when bool_or(w.event_type like 'refund.%') then 'devolvido'
                     end
              from public.latam_whop_events w
              where w.payment_id = i.item->>'pedido'
                and w.event_type in ('refund.created','refund.updated','dispute.created','dispute.updated')
                and coalesce(w.payload #>> '{data,status}', '') <> 'failed')
            when i.item->>'pedido' like 'kashpay:%' then (
              select case
                       when bool_or(k.event = 'order.chargeback') then 'disputa'
                       when bool_or(k.event = 'order.refunded') then 'devolvido'
                     end
              from public.latam_kashpay_events k
              where k.event in ('order.refunded','order.chargeback')
                and k.transaction_id = substr(i.item->>'pedido', 9))
          end) order by i.ordem)
        from jsonb_array_elements(r.itens) with ordinality as i(item, ordem)
      ), '[]'::jsonb)
    ) as linha
    from escolhidos e
    join public.latam_refund_requests r on e.regiao = 'latam' and r.id = e.id
    left join lateral (
      select x.* from public.latam_customers x where x.id = r.customer_id
      union all
      select x.* from public.latam_customers x where r.customer_id is null and x.email = r.email
      limit 1
    ) c on true
    left join public.latam_customers quem on quem.id = r.resuelto_por

    union all

    -- EUA: a cliente e o acesso vêm das tabelas en_; quem resolveu, da equipe (latam_).
    select jsonb_build_object(
      'id', r.id,
      'regiao', 'eua',
      'created_at', r.created_at,
      'email', r.email,
      'customer_id', coalesce(r.customer_id, c.id),
      'nome', coalesce(c.name, ''),
      'pais', coalesce(nullif(r.pais, ''), c.country, ''),
      'cliente_desde', c.created_at,
      'total_cents', r.total_cents,
      'moneda', r.moneda,
      'sin_compra', r.sin_compra,
      'motivo', r.motivo,
      'status', r.status,
      'resuelto_en', r.resuelto_en,
      'resuelto_por', coalesce(quem.email, ''),
      'nota', r.nota,
      'canal', r.canal,
      'valor_devolvido_cents', r.valor_devolvido_cents,
      'atualizado_em', r.atualizado_em,
      'email_tipo', r.email_tipo,
      'email_resumo', r.email_resumo,
      'email_assunto', r.email_assunto,
      'email_trecho', r.email_trecho,
      'email_de', r.email_de,
      'email_recebido_em', r.email_recebido_em,
      'email_caixa', r.email_caixa,
      'email_link', r.email_link,
      'acesso', (select jsonb_build_object('status', a.status, 'expires_at', a.expires_at, 'source', a.source)
                 from public.en_access a
                 where a.customer_id = coalesce(r.customer_id, c.id) and a.product = 'app' limit 1),
      'outros_pedidos', (select count(*) from public.en_refund_requests o
                         where o.email = r.email and o.id <> r.id),
      -- O "pedido" de cada compra é a transação da Digistore (en_pedidos_pagos).
      -- Devolução e disputa chegam no mesmo order_id (a regra de en_pedidos_pagos).
      'itens', coalesce((
        select jsonb_agg(i.item || jsonb_build_object('na_plataforma', (
          select case
                   when bool_or(x.event = 'on_chargeback') then 'disputa'
                   when bool_or(x.event = 'on_refund') then 'devolvido'
                 end
          from public.en_digistore_events p
          join public.en_digistore_events x
            on x.order_id = p.order_id
           and x.event in ('on_refund','on_chargeback')
           and (x.product_id = p.product_id or x.product_id is null)
          where p.event = 'on_payment' and p.transaction_id = i.item->>'pedido'
        )) order by i.ordem)
        from jsonb_array_elements(r.itens) with ordinality as i(item, ordem)
      ), '[]'::jsonb)
    )
    from escolhidos e
    join public.en_refund_requests r on e.regiao = 'eua' and r.id = e.id
    left join lateral (
      select x.* from public.en_customers x where x.id = r.customer_id
      union all
      select x.* from public.en_customers x where r.customer_id is null and x.email = r.email
      limit 1
    ) c on true
    left join public.latam_customers quem on quem.id = r.resuelto_por
  )
  select coalesce(jsonb_agg(linha order by (linha->>'created_at')::timestamptz desc), '[]'::jsonb)
  from linhas;
$function$;

revoke all on function public.latam_admin_reembolsos_todos() from public, anon, authenticated;
grant execute on function public.latam_admin_reembolsos_todos() to service_role;


-- =====================================================================
-- CONFERIR (só leitura, leve)
--   select jsonb_array_length(public.latam_admin_reembolsos_todos());
--   select x->>'regiao', count(*) from jsonb_array_elements(public.latam_admin_reembolsos_todos()) x group by 1;
-- =====================================================================

-- =====================================================================
-- DESFAZER (só se for preciso). A função latam-reembolso volta sozinha
-- para a lista antiga (só LATAM) quando esta não existe.
-- =====================================================================
-- drop function if exists public.latam_admin_reembolsos_todos();
-- update public.en_refund_requests set status = 'recusado' where status = 'desistiu';
-- alter table public.en_refund_requests drop constraint if exists en_refund_requests_status_check;
-- alter table public.en_refund_requests add constraint en_refund_requests_status_check
--   check (status in ('pendente','feito','recusado'));
-- (as colunas novas podem ficar: nada antigo as lê)
