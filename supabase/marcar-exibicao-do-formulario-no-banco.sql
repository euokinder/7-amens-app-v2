-- =====================================================================
-- O FORMULÁRIO DE PERFIL PASSA A SER MARCADO COMO "JÁ APARECEU" NO BANCO
--
-- A REGRA QUE PRECISA VALER (pedido do Caio, 19/09):
--   "Se apareceu uma vez pra pessoa, não pode aparecer mais."
--
-- COMO ERA, E POR QUE FURAVA
--   Quem registrava "esta cliente já viu o formulário" era o NAVEGADOR:
--   o js/member.js disparava um aviso para a member-api e esperava por
--   ele no máximo 0,9 segundo antes de redirecionar assim mesmo.
--
--   Se a internet da cliente engasgasse nesse instante — coisa comum num
--   celular em rede de dados — ela ia para o formulário e o banco não
--   ficava sabendo. Se ela respondesse, tudo bem: a resposta fecha o
--   assunto. Mas se ela SAÍSSE SEM RESPONDER, o formulário voltava a
--   aparecer na próxima vez que ela abrisse o app.
--
-- COMO FICA
--   Quem marca é o próprio banco, na mesma operação em que ele decide
--   entregar o formulário. Não depende de rede, não depende do celular
--   dela, não depende de ela chegar até a página.
--
--   O preço, assumido de olhos abertos: se a cliente fechar o app no meio
--   do carregamento, ela perde o formulário para sempre. É mais raro que
--   a falha de rede que isto conserta, e é o que a regra pede.
--
-- DE BRINDE, UMA CORRIDA QUE NINGUÉM TINHA VISTO
--   Com duas abas do app abertas ao mesmo tempo, as duas perguntavam ao
--   banco e as duas podiam receber o mesmo formulário. Agora não: a
--   condição "ainda não apareceu" está dentro do próprio UPDATE, então a
--   segunda aba encontra a linha já marcada e recebe nada.
--
-- O QUE ISTO NÃO MUDA
--   Nada da regra dos 3 dias, nada das respostas já gravadas, nada das
--   outras campanhas. A contagem de dias distintos continua idêntica.
--
-- ⚠️ Depois de rodar isto, o js/member.js não precisa mais avisar
--    "mostrei" — e foi retirado de lá. As ações 'started' e 'dismissed',
--    que o js/perfil.js manda, continuam valendo normalmente.
-- =====================================================================

-- ✅ APLICADO NA PRODUÇÃO em 20/09/2026, 00:35 (horário de Brasília), com
--    autorização do Caio. Conferido logo depois: função trocada, a member-api
--    continua podendo executá-la, `anon` continua trancado, e 5 clientes reais
--    registraram visita nos 3 minutos seguintes — prova de que o login não
--    quebrou. Ver a entrada de 20/09 no `docs/DIARIO.md`.
--
-- ⚠️ O cabeçalho abaixo é IDÊNTICO ao que já estava na produção (sem
--    `security invoker`, que é o padrão do Postgres de qualquer jeito). Foi
--    de propósito: mudar só o miolo deixa a diferença menor e o risco menor.

create or replace function public.claim_member_survey(p_customer_id uuid)
returns table(campaign_key text, survey_key text, target_path text)
language plpgsql set search_path to ''
as $$
declare distinct_days integer;
begin
  -- Marca o dia de hoje como dia de acesso. Dias DISTINTOS, não seguidos:
  -- pular uma semana não zera nada, é só um dia a mais quando ela voltar.
  insert into public.member_visit_days(customer_id, visited_on)
  values (p_customer_id, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict (customer_id, visited_on) do update set last_seen_at = now();

  select count(*) into distinct_days
  from public.member_visit_days visits
  where visits.customer_id = p_customer_id;

  -- Torna a cliente elegível, se for a hora. O "not exists" duplo garante
  -- que quem já foi marcada uma vez, ou já respondeu, não entra de novo.
  insert into public.member_survey_events(customer_id, campaign_key)
  select p_customer_id, campaign.key
  from public.member_survey_campaigns campaign
  where campaign.enabled
    and campaign.min_distinct_visit_days <= distinct_days
    and (campaign.starts_at is null or campaign.starts_at <= now())
    and (campaign.ends_at is null or campaign.ends_at > now())
    and not exists (
      select 1 from public.member_survey_events event
      where event.customer_id = p_customer_id and event.campaign_key = campaign.key
    )
    and not exists (
      select 1 from public.member_survey_responses response
      where response.customer_id = p_customer_id and response.survey_key = campaign.survey_key
    )
  order by campaign.sort_order, campaign.key
  limit 1
  on conflict do nothing;

  -- ESTA É A MUDANÇA. Antes isto era um SELECT: lia e devolvia, deixando
  -- para o navegador a tarefa de marcar. Agora é um UPDATE que marca e
  -- devolve na mesma operação — entregar e registrar viraram a mesma coisa.
  --
  -- O "shown_at is null" dentro do UPDATE é o que resolve a corrida das
  -- duas abas: a segunda espera a primeira terminar, reavalia a condição,
  -- encontra a linha já marcada e não atualiza nada.
  return query
  with marcada as (
    update public.member_survey_events event
       set shown_at = now()
     where event.customer_id = p_customer_id
       and event.shown_at is null
       and event.completed_at is null
       and event.campaign_key = (
         select elegivel.campaign_key
         from public.member_survey_events elegivel
         join public.member_survey_campaigns campaign on campaign.key = elegivel.campaign_key
         where elegivel.customer_id = p_customer_id
           and elegivel.shown_at is null
           and elegivel.completed_at is null
           and campaign.enabled
           and (campaign.starts_at is null or campaign.starts_at <= now())
           and (campaign.ends_at is null or campaign.ends_at > now())
         order by elegivel.claimed_at, campaign.sort_order
         limit 1
       )
    returning event.campaign_key
  )
  select campaign.key, campaign.survey_key, campaign.target_path
  from marcada
  join public.member_survey_campaigns campaign on campaign.key = marcada.campaign_key;
end;
$$;

-- ⚠️ Os dois comandos de permissão abaixo NÃO foram rodados na produção, de
--    propósito: `create or replace function` preserva as permissões que já
--    existem, e elas já estavam certas (conferido depois: `service_role`
--    executa, `anon` não). Rodá-los seria mexer sem necessidade. Eles ficam
--    aqui porque num banco NOVO, criado do zero, são necessários.

-- revoke all on function public.claim_member_survey(uuid) from public, anon, authenticated;
-- grant execute on function public.claim_member_survey(uuid) to service_role;


-- =====================================================================
-- COMO VOLTAR ATRÁS
--
-- Descomente o bloco abaixo e rode. Ele devolve a versão antiga, a que
-- espera o navegador avisar. Volta na hora, sem deploy e sem build.
-- =====================================================================

-- Este é o texto EXATO que estava rodando na produção antes de 20/09 00:35,
-- lido do próprio banco com `pg_get_functiondef`, não reconstruído de memória.
--
-- create or replace function public.claim_member_survey(p_customer_id uuid)
-- returns table(campaign_key text, survey_key text, target_path text)
-- language plpgsql set search_path to ''
-- as $$
-- declare distinct_days integer;
-- begin
--  insert into public.member_visit_days(customer_id, visited_on)
--  values (p_customer_id, (now() at time zone 'America/Sao_Paulo')::date)
--  on conflict (customer_id, visited_on) do update set last_seen_at = now();
--
--  select count(*) into distinct_days
--  from public.member_visit_days visits
--  where visits.customer_id = p_customer_id;
--
--  insert into public.member_survey_events(customer_id, campaign_key)
--  select p_customer_id, campaign.key
--  from public.member_survey_campaigns campaign
--  where campaign.enabled
--    and campaign.min_distinct_visit_days <= distinct_days
--    and (campaign.starts_at is null or campaign.starts_at <= now())
--    and (campaign.ends_at is null or campaign.ends_at > now())
--    and not exists (
--      select 1 from public.member_survey_events event
--      where event.customer_id = p_customer_id and event.campaign_key = campaign.key
--    )
--    and not exists (
--      select 1 from public.member_survey_responses response
--      where response.customer_id = p_customer_id and response.survey_key = campaign.survey_key
--    )
--  order by campaign.sort_order, campaign.key
--  limit 1
--  on conflict do nothing;
--
--  return query
--  select campaign.key, campaign.survey_key, campaign.target_path
--  from public.member_survey_events event
--  join public.member_survey_campaigns campaign on campaign.key = event.campaign_key
--  where event.customer_id = p_customer_id
--    and event.shown_at is null
--    and event.completed_at is null
--    and campaign.enabled
--    and (campaign.starts_at is null or campaign.starts_at <= now())
--    and (campaign.ends_at is null or campaign.ends_at > now())
--  order by event.claimed_at, campaign.sort_order
--  limit 1;
-- end;
-- $$;
