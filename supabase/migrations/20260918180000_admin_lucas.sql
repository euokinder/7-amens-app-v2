-- Terceiro operador do painel: Lucas.
--
-- Ser admin no painel exige TRES coisas, nesta ordem. Faltando qualquer uma, a
-- pessoa nao entra:
--   1. existir em customers            -- e quem o login procura pelo e-mail
--   2. ter 'principal' ativo           -- member-api recusa o login sem isso
--   3. ter linha em member_admins      -- e o que libera as acoes do painel
--
-- O acesso entra com source 'manual' de proposito: assim ninguem confunde um
-- operador da equipe com uma compra real da Hubla nos relatorios.
--
-- Escrito para poder rodar duas vezes sem estragar nada.

insert into public.customers(email, name)
select 'lucassamedeiross@gmail.com', 'Lucas Pk'
where not exists (
  select 1 from public.customers where lower(email) = 'lucassamedeiross@gmail.com'
);

insert into public.entitlements(customer_id, product_key, status, source, granted_at)
select customer.id, 'principal', 'active', 'manual', now()
from public.customers customer
where lower(customer.email) = 'lucassamedeiross@gmail.com'
  and not exists (
    select 1 from public.entitlements existing
    where existing.customer_id = customer.id and existing.product_key = 'principal'
  );

-- Se o acesso ja existia mas estava revogado, reativa em vez de duplicar.
update public.entitlements entitlement
   set status = 'active', revoked_at = null, granted_at = coalesce(entitlement.granted_at, now()), updated_at = now()
  from public.customers customer
 where customer.id = entitlement.customer_id
   and lower(customer.email) = 'lucassamedeiross@gmail.com'
   and entitlement.product_key = 'principal'
   and entitlement.status <> 'active';

insert into public.member_admins(customer_id)
select customer.id from public.customers customer
where lower(customer.email) = 'lucassamedeiross@gmail.com'
on conflict (customer_id) do nothing;
