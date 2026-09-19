-- Confere se alguem pagou e ficou sem acesso ao app.
--
-- POR QUE ISSO EXISTE
-- Em 2026-09-18 uma cliente pagou R$ 197 no Pix e nao recebeu acesso.
-- O `customer.member_added` dela chegou as 16:33:43 UTC e o webhook quebrou com
-- "Database operation failed (401) on hubla_events". Como a falha foi na PROPRIA
-- gravacao do evento, o tratamento de erro nao tinha linha para marcar como
-- `failed` -- entao nao sobrou rastro nenhum no banco. A Hubla recebeu 500 e nao
-- reenviou. So deu para achar lendo os logs da Edge Function, que expiram.
--
-- Esta consulta fecha esse buraco sem depender de log: os eventos
-- `invoice.status_updated` SAO gravados e carregam o status de pagamento. Se a
-- Hubla disse "paid" e a pessoa nao tem acesso, alguma coisa se perdeu no meio.
--
-- COMO LER O RESULTADO
-- Vazio  = esta tudo certo.
-- Com linhas = cada uma e alguem que pagou e esta trancado do lado de fora.
--
-- O QUE ESTA CONSULTA **NAO** PEGA
-- Quem comprou entre 23:54 de 17/09 e 09:08 de 18/09 (a janela entre o fim da
-- carga historica e a entrada do webhook no ar). Para essas nao existe evento
-- nenhum no banco, entao nao ha o que cruzar -- so o export da Hubla resolve.
-- Ver docs/migracao-base-historica.md.

with pagas as (
  select distinct
    lower(payload->'event'->'user'->>'email')                   as email,
    trim(concat(payload->'event'->'user'->>'firstName', ' ',
                payload->'event'->'user'->>'lastName'))         as nome,
    payload->'event'->'user'->>'phone'                          as telefone,
    payload->'event'->'user'->>'id'                             as hubla_user_id,
    payload->'event'->'invoice'->>'id'                          as invoice_id,
    payload->'event'->'invoice'->>'subscriptionId'              as subscription_id,
    (payload->'event'->'invoice'->'amount'->>'totalCents')::int as centavos,
    payload->'event'->'product'->>'name'                        as produto,
    payload->'event'->'product'->>'id'                          as produto_id,
    received_at
  from hubla_events
  where sandbox = false
    and payload->'event'->'invoice'->>'status' = 'paid'
)
select
  p.email,
  p.nome,
  p.produto,
  p.produto_id,
  (p.centavos / 100.0) as valor_reais,
  p.invoice_id,
  p.subscription_id,
  p.hubla_user_id,
  p.telefone,
  p.received_at as pagamento_confirmado_em
from pagas p
where not exists (
  select 1
  from customers c
  join entitlements e on e.customer_id = c.id
  where c.email = p.email
    and e.product_key = 'principal'
    and e.status = 'active'
)
order by p.received_at;


-- ============================================================================
-- SEGUNDA CONFERENCIA: a mesma pessoa com dois e-mails
--
-- POR QUE ISSO EXISTE
-- Em 18/09, ao reparar a janela cega a partir do export da Hubla, tres pessoas
-- pareciam estar sem acesso. Nao estavam: ja tinham conta, sob OUTRO e-mail.
--
--   Foram tres casos: em um, o mesmo usuario com dominio .com.br na fatura e
--   .com no app; em outro, provedor antigo contra endereco pessoal; no
--   terceiro, o endereco dela na fatura e o de um familiar na conta Hubla.
--
--   Os enderecos reais NAO ficam aqui: este repositorio e publico. Para
--   saber de quem se trata, procure pelo hubla_user_id no painel admin.
--
-- O export de faturas traz o e-mail do PAGADOR; o webhook traz o e-mail da
-- CONTA Hubla. Quando a pessoa ja tinha conta na Hubla com outro endereco, os
-- dois divergem. Inserir pelo e-mail da fatura criaria conta duplicada.
--
-- Quem segurou foi a trava `customers_hubla_user_id_unique`. Antes de inserir
-- qualquer cliente vindo de um export, cruze SEMPRE pelo `ID do cliente`
-- (hubla_user_id), nunca so pelo e-mail.
--
-- ATENCAO PARA O SUPORTE
-- Essas pessoas vao tentar entrar com o e-mail que aparece no recibo delas --
-- ou seja, com o e-mail da fatura, que o app NAO conhece. Elas nao vao
-- conseguir entrar e nao vao entender por que. Corrigir o e-mail pelo painel
-- (que derruba as sessoes abertas) resolve caso a caso.

select c.id, c.email as email_no_app, c.name, c.hubla_user_id,
       (select string_agg(e.product_key, ', ' order by e.product_key)
          from entitlements e where e.customer_id = c.id and e.status = 'active') as acessos
from customers c
where c.hubla_user_id is not null
  and c.hubla_user_id in (
    -- cole aqui os "ID do cliente" do export cujos e-mails nao foram achados
    select unnest(array[]::text[])
  );
