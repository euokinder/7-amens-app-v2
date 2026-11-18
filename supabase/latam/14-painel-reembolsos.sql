-- =====================================================================
-- 14-painel-reembolsos.sql — o painel de reembolsos do suporte (18/11/2026)
-- =====================================================================
-- Pedido do Arthur (18/11): os pedidos da /es-reembolso ficavam só numa
-- tabela que ninguém via sem o agente. Agora o suporte tem um painel próprio
-- (/es-reembolsos) para ver a fila, marcar o que foi reembolsado, o que a
-- cliente desistiu ou foi recusado, editar e excluir. A devolução do dinheiro
-- continua sendo feita À MÃO pelo suporte, na Whop ou na Digistore: o painel
-- só guarda e mostra.
--
-- Quem entra: quem está em latam_admins (a mesma lista do /es-admin). Decisão
-- do Arthur (18/11): o suporte faz tudo, inclusive liberar produtos.
--
-- O que muda (só objetos latam_; o Brasil não sente nada):
--   1. latam_refund_requests ganha o estado 'desistiu' e as colunas
--      canal, valor_devolvido_cents, resuelto_por e atualizado_em
--   2. latam_admin_actions aceita 'refund_create', 'refund_update' e
--      'refund_delete' (excluir apaga de vez; a foto do pedido fica aqui)
--   3. latam_admin_reembolsos(): a lista do painel, já com o que a Whop e a
--      KashPay registraram de cada cobrança (devolvido / disputa)
--
-- DEPENDE DE: 04-admin.sql e 11-reembolso.sql (os dois já na produção).
-- ORDEM DE PUBLICAR: este SQL -> função latam-reembolso -> site.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- 1. Os pedidos: o estado novo e as colunas do painel.
alter table public.latam_refund_requests
  add column if not exists canal text not null default 'pagina',
  add column if not exists valor_devolvido_cents integer,
  add column if not exists resuelto_por uuid references public.latam_customers(id) on delete set null,
  add column if not exists atualizado_em timestamptz;

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_status_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_status_check
  check (status in ('pendente','feito','recusado','desistiu'));

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_canal_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_canal_check
  check (canal in ('pagina','manual'));

alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_devolvido_check;
alter table public.latam_refund_requests add constraint latam_refund_requests_devolvido_check
  check (valor_devolvido_cents is null or valor_devolvido_cents between 0 and 10000000);

-- Excluir apaga de vez: o painel precisa de DELETE (só o servidor).
grant delete on public.latam_refund_requests to service_role;


-- 2. O histórico aceita as ações do painel de reembolsos.
alter table public.latam_admin_actions drop constraint if exists latam_admin_actions_action_check;
alter table public.latam_admin_actions add constraint latam_admin_actions_action_check check (
  action in ('grant_access','revoke_access','update_email','entry_link','renew_entry_link',
             'grant_extra','revoke_extra',
             'refund_create','refund_update','refund_delete')
);


-- 3. A lista do painel. Todos os pendentes + os 400 resolvidos mais novos.
--    Cada item ganha "na_plataforma": 'devolvido' (a Whop ou a KashPay já
--    registrou a devolução), 'disputa' (a cliente foi ao banco) ou null.
--    Leve: a tabela de pedidos é pequena, e as buscas na Whop usam o índice
--    de payment_id; as da KashPay, a chave (event, transaction_id).
create or replace function public.latam_admin_reembolsos()
returns jsonb
language sql stable set search_path to ''
as $function$
  with escolhidos as (
    (select * from public.latam_refund_requests where status = 'pendente')
    union all
    (select * from public.latam_refund_requests where status <> 'pendente'
     order by coalesce(resuelto_en, created_at) desc limit 400)
  )
  select coalesce(jsonb_agg(linha order by (linha->>'created_at')::timestamptz desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id,
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
    from escolhidos r
    left join lateral (
      select x.* from public.latam_customers x
      where x.id = r.customer_id
      union all
      select x.* from public.latam_customers x
      where r.customer_id is null and x.email = r.email
      limit 1
    ) c on true
    left join public.latam_customers quem on quem.id = r.resuelto_por
  ) t;
$function$;

revoke all on function public.latam_admin_reembolsos() from public, anon, authenticated;
grant execute on function public.latam_admin_reembolsos() to service_role;


-- =====================================================================
-- COLOCAR ALGUÉM DO SUPORTE NO PAINEL (o Arthur roda, com o e-mail dela;
-- o e-mail NUNCA fica escrito neste arquivo: o repositório é público).
-- Ela entra pela /es-entrar com esse e-mail, então precisa de acesso ao app.
--   1. no /es-admin, "Liberar acesso" com o e-mail dela;
--   2. insert into public.latam_admins (customer_id)
--      select id from public.latam_customers where email = '<e-mail>'
--      on conflict do nothing;
-- =====================================================================

-- =====================================================================
-- DESFAZER (só se for preciso). Pedidos 'desistiu' voltam a 'recusado'
-- antes de devolver a trava antiga.
-- =====================================================================
-- drop function if exists public.latam_admin_reembolsos();
-- update public.latam_refund_requests set status = 'recusado' where status = 'desistiu';
-- alter table public.latam_refund_requests drop constraint if exists latam_refund_requests_status_check;
-- alter table public.latam_refund_requests add constraint latam_refund_requests_status_check
--   check (status in ('pendente','feito','recusado'));
-- (as colunas novas podem ficar: a função antiga não as lê)
