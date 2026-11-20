-- =====================================================================
-- 16-rastreio.sql — o rastreamento do app em inglês (20/11/2026)
-- =====================================================================
-- Decisão do Arthur em 20/11/2026: o app é o motor de monetização, e para
-- isso ele precisa saber o que cada cliente faz lá dentro. Este arquivo cria
-- a BASE disso, só com objetos en_ (nada do Brasil nem da LATAM é tocado):
--
--   1. en_events              um passo por linha (abriu a página, tocou no
--                             card, deu play, o botão de compra apareceu...).
--                             SEM dado de pessoa: só o customer_id.
--   2. en_experiments         os testes A/B (qualquer elemento: card, pop-up,
--      en_experiment_assignments  página, texto, preço, ordem). A cliente cai
--                             SEMPRE na mesma versão. Teste novo = uma linha
--                             de SQL, sem publicar função nem site.
--   3. en_events_daily        o RESUMO por dia. É o que os painéis leem.
--      en_events_funnel       o funil de cada oferta, por cliente (a primeira
--                             vez de cada etapa).
--      en_rastro_mapa         que card e que página pertencem a que oferta.
--      en_rastro_estado       até onde o funil já leu.
--   4. As funções: gravar (a en-api chama), sortear a versão do teste,
--      resumir um dia, atualizar o funil, apagar o que passou de 90 dias.
--   5. As visões en_painel_*: funil, testes, ativas, volta, hora, uso.
--
-- ⛔ OS PAINÉIS NUNCA LEEM en_events. Leem en_events_daily, en_events_funnel
--    e as visões en_painel_*. A tabela bruta só é lida pelas funções daqui,
--    um dia por vez, pelo índice.
--
-- O catálogo dos passos, como criar um teste e a ordem de publicar:
-- docs/rastreio-en.md.
--
-- DEPENDE DE: 01 (clientes, sessões, dias de visita), 03 (pop-ups), 05
-- (en_extras) e 14 (en_pedidos_pagos com a Hubla).
-- ORDEM: banco de TESTE (o agente) -> PRODUÇÃO (o Arthur, no SQL Editor,
-- nunca entre 3h e 8h de Brasília). Pode rodar de novo: tudo é "if not
-- exists", "create or replace" ou "on conflict do nothing". Nada é apagado.
-- ORDEM DE PUBLICAR: este SQL -> função en-api -> site. Cada passo é
-- inofensivo sem o seguinte.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. OS PASSOS
-- ---------------------------------------------------------------------
--    ocorrido_em  quando aconteceu, pelo relógio do SERVIDOR (a tela manda só
--                 "há quantos segundos"; o relógio do celular não entra).
--    recebido_em  quando chegou (o freio por cliente conta por aqui).
--    dia_local e hora_local  no fuso da cliente (en_customers.timezone).
--    variantes    as versões de teste que ela via ({"chave": "versao"}),
--                 preenchidas pelo BANCO, nunca pela tela.
--    origem       as utm da página em que o passo aconteceu.
--    fonte        'tela' (veio do js/en/rastro.js) ou 'servidor' (a en-api
--                 gravou sozinha: pop-up e "rezou").
create table if not exists public.en_events (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  nome text not null,
  props jsonb not null default '{}'::jsonb,
  pagina text not null default '',
  ocorrido_em timestamptz not null default now(),
  recebido_em timestamptz not null default now(),
  dia_local date not null,
  hora_local smallint not null,
  aparelho text,             -- mobile | desktop
  sistema text,              -- ios | android | windows | mac | other
  instalado boolean,         -- aberto pelo ícone da tela inicial
  variantes jsonb not null default '{}'::jsonb,
  origem jsonb not null default '{}'::jsonb,
  fonte text not null default 'tela',
  constraint en_events_nome_check check (nome ~ '^[a-z0-9_]{1,40}$'),
  constraint en_events_props_check check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 800),
  constraint en_events_pagina_check check (length(pagina) <= 80),
  constraint en_events_hora_check check (hora_local between 0 and 23),
  constraint en_events_aparelho_check check (aparelho is null or aparelho in ('mobile','desktop')),
  constraint en_events_sistema_check check (sistema is null or sistema in ('ios','android','windows','mac','other')),
  constraint en_events_variantes_check check (jsonb_typeof(variantes) = 'object' and octet_length(variantes::text) <= 600),
  constraint en_events_origem_check check (jsonb_typeof(origem) = 'object' and octet_length(origem::text) <= 600),
  constraint en_events_fonte_check check (fonte in ('tela','servidor'))
);
-- O resumo lê um dia por vez; o freio e a ficha de uma cliente, por cliente.
create index if not exists en_events_dia_nome_idx on public.en_events (dia_local, nome);
create index if not exists en_events_cliente_idx on public.en_events (customer_id, recebido_em desc);


-- ---------------------------------------------------------------------
-- 2. OS TESTES A/B
-- ---------------------------------------------------------------------
--    versoes  [{"v":"a","peso":1},{"v":"b","peso":1}]  (peso 0 = não recebe
--             cliente nova; quem já estava nela continua nela)
--    publico  {} = todas. Chaves aceitas (todas opcionais):
--               "desde": "2026-11-21"   só quem entrou no app a partir deste dia
--               "antes": "2026-11-21"   só quem entrou no app antes deste dia
--               "tem": ["arcangeles"]   só quem tem TODOS estes extras
--               "nao_tem": ["cantico"]  só quem não tem NENHUM destes
--             Quem fica fora do público não entra no teste: a tela mostra o
--             padrão (variante() devolve null).
--    ligado   false = a tela volta ao padrão para todas. As versões sorteadas
--             ficam guardadas: ligar de novo devolve a MESMA versão a cada uma.
create table if not exists public.en_experiments (
  chave text primary key,
  ligado boolean not null default false,
  versoes jsonb not null,
  publico jsonb not null default '{}'::jsonb,
  nota text not null default '',
  criado_em timestamptz not null default now(),
  constraint en_experiments_chave_check check (chave ~ '^[a-z][a-z0-9_]{0,39}$')
);

create table if not exists public.en_experiment_assignments (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  chave text not null references public.en_experiments(chave) on delete cascade,
  versao text not null,
  atribuido_em timestamptz not null default now(),
  primary key (customer_id, chave)
);
create index if not exists en_experiment_assignments_chave_idx on public.en_experiment_assignments (chave, versao);

-- As versões e o público têm de estar bem escritos: erro de digitação aqui
-- é recusado na hora, em vez de virar teste torto.
create or replace function public.en_teste_valido(p_versoes jsonb, p_publico jsonb)
returns boolean language plpgsql immutable set search_path to ''
as $function$
declare x jsonb; k text; v_soma integer := 0; v_vistas text[] := '{}';
begin
  if jsonb_typeof(p_versoes) <> 'array' or jsonb_array_length(p_versoes) not between 1 and 8 then return false; end if;
  for x in select * from jsonb_array_elements(p_versoes) loop
    if jsonb_typeof(x) <> 'object' then return false; end if;
    if coalesce(x->>'v', '') !~ '^[a-z0-9_]{1,24}$' then return false; end if;
    if (x->>'v') = any(v_vistas) then return false; end if;
    if coalesce(x->>'peso', '1') !~ '^[0-9]{1,4}$' then return false; end if;
    v_vistas := v_vistas || (x->>'v');
    v_soma := v_soma + coalesce((x->>'peso')::integer, 1);
  end loop;
  if v_soma <= 0 then return false; end if;

  if jsonb_typeof(p_publico) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(p_publico) loop
    if k in ('desde', 'antes') then
      if coalesce(p_publico->>k, '') !~ '^20[0-9]{2}-[01][0-9]-[0-3][0-9]$' then return false; end if;
      perform (p_publico->>k)::date;
    elsif k in ('tem', 'nao_tem') then
      if jsonb_typeof(p_publico->k) <> 'array' then return false; end if;
      if exists (select 1 from jsonb_array_elements(p_publico->k) y
                  where jsonb_typeof(y) <> 'string' or (y #>> '{}') not in ('arcangeles', 'cantico')) then return false; end if;
    else
      return false;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$function$;

do $trava$
begin
  if not exists (select 1 from pg_constraint where conname = 'en_experiments_valido_check') then
    alter table public.en_experiments
      add constraint en_experiments_valido_check check (public.en_teste_valido(versoes, publico));
  end if;
end
$trava$;


-- ---------------------------------------------------------------------
-- 3. O RESUMO (o que os painéis leem)
-- ---------------------------------------------------------------------
-- 3a. Por dia (o dia é o do fuso de cada cliente). Uma linha por:
--       dia + passo + recorte + valor + teste + versão
--     recorte ''         o total do passo no dia
--     recorte <chave>    cada chave do props (card, oferta, video, pct, dia...)
--     recorte '_props'   todas as chaves juntas, em ordem ("card=arcangeles|situacao=bloqueado")
--     recorte '_pagina', '_hora', '_aparelho'   só no passo `pagina`
--     recorte '_origem'  utm_source/utm_medium/utm_campaign da página
--     teste '' = todas as clientes; teste <chave> = só quem via aquela versão.
--     clientes = clientes únicas NAQUELE DIA (somar dias conta a mesma
--     pessoa mais de uma vez: para "quantas pessoas", usar o funil, 3b).
create table if not exists public.en_events_daily (
  dia date not null,
  nome text not null,
  recorte text not null default '',
  valor text not null default '',
  teste text not null default '',
  versao text not null default '',
  clientes integer not null,
  total integer not null,
  primary key (dia, nome, recorte, valor, teste, versao)
);

-- 3b. O funil de cada oferta, por cliente: a PRIMEIRA vez de cada etapa.
--     Pequena (clientes x ofertas) e sem dado de pessoa. É dela que saem os
--     números "de cada 100 que viram o card, quantas compraram".
create table if not exists public.en_events_funnel (
  customer_id uuid not null references public.en_customers(id) on delete cascade,
  oferta text not null,
  primeiro_em timestamptz not null,
  card_visto_em timestamptz,
  card_toque_em timestamptz,
  popup_visto_em timestamptz,
  popup_toque_em timestamptz,
  pagina_em timestamptz,
  play_em timestamptz,
  pitch_em timestamptz,
  checkout_em timestamptz,
  primary key (customer_id, oferta)
);
create index if not exists en_events_funnel_oferta_idx on public.en_events_funnel (oferta, primeiro_em);

-- 3c. A que oferta pertence cada card, cada página e cada valor de `oferta`
--     que a tela manda. Oferta nova, ou a tela usando outro nome = uma linha
--     aqui (e, se quiser recontar o passado, o "RECONTAR O FUNIL" do fim).
create table if not exists public.en_rastro_mapa (
  tipo text not null,
  valor text not null,
  oferta text not null,
  primary key (tipo, valor),
  constraint en_rastro_mapa_tipo_check check (tipo in ('card', 'pagina', 'oferta')),
  constraint en_rastro_mapa_oferta_check check (oferta ~ '^[a-z0-9_]{1,40}$')
);
insert into public.en_rastro_mapa (tipo, valor, oferta) values
  ('card', 'arcangeles', 'arcangeles'), ('card', 'archangels', 'arcangeles'),
  ('card', 'cantico', 'cantico'),       ('card', 'canticle', 'cantico'),
  ('oferta', 'arcangeles', 'arcangeles'), ('oferta', 'archangels', 'arcangeles'),
  ('oferta', 'cantico', 'cantico'),       ('oferta', 'canticle', 'cantico'),
  ('pagina', '/en-offer-archangels', 'arcangeles'), ('pagina', '/en-offer-archangels.html', 'arcangeles'),
  ('pagina', '/en-offer-canticle', 'cantico'),      ('pagina', '/en-offer-canticle.html', 'cantico')
on conflict (tipo, valor) do nothing;

-- 3d. Até onde o funil já leu (o id do último passo lido).
create table if not exists public.en_rastro_estado (
  chave text primary key,
  valor bigint not null default 0,
  atualizado_em timestamptz not null default now()
);
insert into public.en_rastro_estado (chave, valor) values ('funil_ultimo_id', 0)
on conflict (chave) do nothing;


-- ---------------------------------------------------------------------
-- 4. Ninguém de fora lê nada (como nas outras en_).
-- ---------------------------------------------------------------------
do $trava$
declare t text;
begin
  foreach t in array array[
    'en_events','en_experiments','en_experiment_assignments',
    'en_events_daily','en_events_funnel','en_rastro_mapa','en_rastro_estado'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists backend_only on public.%I', t);
    execute format('create policy backend_only on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end
$trava$;


-- ---------------------------------------------------------------------
-- 5. AS FUNÇÕES QUE A en-api CHAMA
-- ---------------------------------------------------------------------

-- 5a. O fuso, conferido: nome de fuso que o banco não conhece vira Nova York
--     (o padrão do app), em vez de derrubar a gravação.
create or replace function public.en_rastro_zona(p_zone text)
returns text language plpgsql stable set search_path to ''
as $function$
begin
  if p_zone is null or p_zone !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' then return 'America/New_York'; end if;
  perform now() at time zone p_zone;
  return p_zone;
exception when others then
  return 'America/New_York';
end;
$function$;

-- 5b. As versões de teste da cliente: {"chave": "versao"}, só dos testes
--     LIGADOS. Sorteia (uma vez, para sempre) os testes ligados em que ela
--     ainda não tem versão e de cujo público ela faz parte. O sorteio sai do
--     próprio id dela: a mesma cliente dá sempre a mesma versão.
--     Qualquer erro aqui devolve {} (a tela mostra o padrão): nunca derruba
--     a entrada dela.
create or replace function public.en_testes(p_customer_id uuid)
returns jsonb language plpgsql set search_path to ''
as $function$
declare
  e record;
  v_first date;
  v_hoje date;
  v_extras text[];
  v_ok boolean;
  v_total integer;
  v_ponto integer;
  v_versao text;
  v_out jsonb;
begin
  -- O caminho de todo dia: sem teste ligado, não lê mais nada.
  if not exists (select 1 from public.en_experiments x where x.ligado) then return '{}'::jsonb; end if;

  select c.first_access_on, (now() at time zone public.en_rastro_zona(c.timezone))::date
    into v_first, v_hoje
    from public.en_customers c where c.id = p_customer_id;
  if not found then return '{}'::jsonb; end if;
  v_first := coalesce(v_first, v_hoje);  -- sem primeiro acesso gravado, é hoje (como a jornada)

  for e in
    select x.chave, x.versoes, x.publico
      from public.en_experiments x
     where x.ligado
       and not exists (select 1 from public.en_experiment_assignments a
                        where a.customer_id = p_customer_id and a.chave = x.chave)
     order by x.chave
  loop
    v_ok := true;
    if e.publico ? 'desde' and v_first < (e.publico->>'desde')::date then v_ok := false; end if;
    if e.publico ? 'antes' and v_first >= (e.publico->>'antes')::date then v_ok := false; end if;
    if v_ok and (e.publico ? 'tem' or e.publico ? 'nao_tem') then
      if v_extras is null then
        select coalesce(array(select jsonb_array_elements_text(coalesce(public.en_extras(p_customer_id)->'extras', '[]'::jsonb))), '{}'::text[])
          into v_extras;
      end if;
      if e.publico ? 'tem'
         and not (array(select jsonb_array_elements_text(e.publico->'tem')) <@ v_extras) then v_ok := false; end if;
      if e.publico ? 'nao_tem'
         and (array(select jsonb_array_elements_text(e.publico->'nao_tem')) && v_extras) then v_ok := false; end if;
    end if;
    if not v_ok then continue; end if;

    select coalesce(sum(coalesce((x->>'peso')::integer, 1)), 0) into v_total from jsonb_array_elements(e.versoes) x;
    if v_total <= 0 then continue; end if;
    v_ponto := (('x' || substr(md5(p_customer_id::text || ':' || e.chave), 1, 7))::bit(28)::integer) % v_total;
    select y.v into v_versao
      from (select t.x->>'v' as v,
                   sum(coalesce((t.x->>'peso')::integer, 1)) over (order by t.ord) as acumulado
              from jsonb_array_elements(e.versoes) with ordinality as t(x, ord)) y
     where y.acumulado > v_ponto
     order by y.acumulado
     limit 1;
    if v_versao is null then continue; end if;

    insert into public.en_experiment_assignments (customer_id, chave, versao)
    values (p_customer_id, e.chave, v_versao)
    on conflict (customer_id, chave) do nothing;
  end loop;

  select coalesce(jsonb_object_agg(a.chave, a.versao), '{}'::jsonb) into v_out
    from public.en_experiment_assignments a
    join public.en_experiments x on x.chave = a.chave and x.ligado
   where a.customer_id = p_customer_id;
  return v_out;
exception when others then
  return '{}'::jsonb;
end;
$function$;

-- 5c. Grava um pacote de passos de UMA cliente, num insert só.
--     p_passos: [{"n": nome, "p": {props}, "pg": "/en-day", "ha": 12, "o": {utm}}]
--       ha = há quantos segundos aconteceu (0 a 7 dias). A en-api já limpou
--       tudo; aqui só se repete o essencial, para um pacote torto não gravar.
--     Devolve quantos passos gravou.
create or replace function public.en_rastro_inserir(
  p_customer_id uuid, p_zone text, p_passos jsonb,
  p_aparelho text default null, p_sistema text default null, p_instalado boolean default null,
  p_fonte text default 'tela')
returns integer language plpgsql set search_path to ''
as $function$
declare
  v_zone text;
  v_variantes jsonb;
  v_n integer;
begin
  if jsonb_typeof(p_passos) <> 'array' then return 0; end if;
  select public.en_rastro_zona(coalesce(c.timezone, p_zone)) into v_zone
    from public.en_customers c where c.id = p_customer_id;
  if not found then return 0; end if;

  select coalesce(jsonb_object_agg(a.chave, a.versao), '{}'::jsonb) into v_variantes
    from public.en_experiment_assignments a
    join public.en_experiments x on x.chave = a.chave and x.ligado
   where a.customer_id = p_customer_id;

  insert into public.en_events
    (customer_id, nome, props, pagina, ocorrido_em, dia_local, hora_local,
     aparelho, sistema, instalado, variantes, origem, fonte)
  select p_customer_id,
         x.p->>'n',
         case when jsonb_typeof(x.p->'p') = 'object' and octet_length((x.p->'p')::text) <= 800 then x.p->'p' else '{}'::jsonb end,
         left(coalesce(x.p->>'pg', ''), 80),
         t.em,
         (t.em at time zone v_zone)::date,
         extract(hour from (t.em at time zone v_zone))::smallint,
         case when p_aparelho in ('mobile','desktop') then p_aparelho end,
         case when p_sistema in ('ios','android','windows','mac','other') then p_sistema end,
         p_instalado,
         v_variantes,
         case when jsonb_typeof(x.p->'o') = 'object' and octet_length((x.p->'o')::text) <= 600 then x.p->'o' else '{}'::jsonb end,
         case when p_fonte = 'servidor' then 'servidor' else 'tela' end
    from jsonb_array_elements(p_passos) with ordinality as x(p, i)
   cross join lateral (
     select now() - make_interval(secs => case when coalesce(x.p->>'ha', '') ~ '^[0-9]{1,6}$'
                                               then least((x.p->>'ha')::integer, 604800) else 0 end) as em
   ) t
   where x.i <= 25
     and jsonb_typeof(x.p) = 'object'
     and coalesce(x.p->>'n', '') ~ '^[a-z0-9_]{1,40}$';
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- 5d. O pacote que vem da TELA: confere a sessão, aplica o freio e grava.
--     Uma ida ao banco só. Devolve quantos gravou, ou:
--       -1  sessão que não existe ou venceu
--       -2  freio: mais de 600 passos em 10 minutos da mesma cliente (uma
--           pessoa de verdade faz umas dezenas; isso é laço ou abuso)
create or replace function public.en_rastro_gravar(
  p_token_hash text, p_zone text, p_passos jsonb,
  p_aparelho text default null, p_sistema text default null, p_instalado boolean default null)
returns integer language plpgsql set search_path to ''
as $function$
declare
  v_customer uuid;
  v_recentes integer;
begin
  select s.customer_id into v_customer
    from public.en_sessions s
   where s.token_hash = p_token_hash and s.expires_at > now();
  if v_customer is null then return -1; end if;

  select count(*) into v_recentes
    from public.en_events e
   where e.customer_id = v_customer and e.recebido_em > now() - interval '10 minutes';
  if v_recentes >= 600 then return -2; end if;

  return public.en_rastro_inserir(v_customer, p_zone, p_passos, p_aparelho, p_sistema, p_instalado, 'tela');
end;
$function$;


-- ---------------------------------------------------------------------
-- 6. AS FUNÇÕES DO RESUMO (leves: um dia por vez, pelo índice)
-- ---------------------------------------------------------------------

-- 6a. Refaz o resumo de UM dia (apaga o que havia daquele dia e conta de
--     novo). Pode rodar quantas vezes quiser: o resultado é o mesmo.
create or replace function public.en_rastro_resumir(p_dia date)
returns integer language plpgsql set search_path to ''
as $function$
declare v_n integer;
begin
  delete from public.en_events_daily d where d.dia = p_dia;

  insert into public.en_events_daily (dia, nome, recorte, valor, teste, versao, clientes, total)
  with base as (
    select e.customer_id, e.nome, e.props, e.pagina, e.hora_local,
           e.aparelho, e.sistema, e.instalado, e.origem, e.variantes
      from public.en_events e
     where e.dia_local = p_dia
  ),
  cortes as (
    select b.customer_id, b.nome, b.variantes, ''::text as recorte, ''::text as valor from base b
    union all
    select b.customer_id, b.nome, b.variantes, k.key, left(k.value, 80)
      from base b cross join lateral jsonb_each_text(b.props) k
     where coalesce(k.value, '') <> '' and k.key !~ '^_'
    union all
    select b.customer_id, b.nome, b.variantes, '_props', left(c.combo, 160)
      from base b
     cross join lateral (
       select string_agg(k.key || '=' || k.value, '|' order by k.key) as combo, count(*) as n
         from jsonb_each_text(b.props) k where coalesce(k.value, '') <> ''
     ) c
     where c.n >= 2
    union all
    select b.customer_id, b.nome, b.variantes, '_pagina', b.pagina
      from base b where b.nome = 'pagina' and b.pagina <> ''
    union all
    select b.customer_id, b.nome, b.variantes, '_hora', lpad(b.hora_local::text, 2, '0')
      from base b where b.nome = 'pagina'
    union all
    select b.customer_id, b.nome, b.variantes, '_aparelho',
           coalesce(b.aparelho, '?') || '/' || coalesce(b.sistema, '?') || case when b.instalado then '/instalado' else '' end
      from base b where b.nome = 'pagina'
    union all
    select b.customer_id, b.nome, b.variantes, '_origem',
           left(coalesce(b.origem->>'utm_source', '') || '/' || coalesce(b.origem->>'utm_medium', '') || '/' || coalesce(b.origem->>'utm_campaign', ''), 160)
      from base b where b.origem <> '{}'::jsonb
  ),
  com_testes as (
    select c.customer_id, c.nome, c.recorte, c.valor, ''::text as teste, ''::text as versao from cortes c
    union all
    select c.customer_id, c.nome, c.recorte, c.valor, t.key, t.value
      from cortes c cross join lateral jsonb_each_text(c.variantes) t
  )
  select p_dia, ct.nome, ct.recorte, ct.valor, ct.teste, ct.versao,
         count(distinct ct.customer_id)::integer, count(*)::integer
    from com_testes ct
   group by ct.nome, ct.recorte, ct.valor, ct.teste, ct.versao;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- 6b. Leva os passos novos para o funil. Lê só o que chegou depois da última
--     leitura (pelo id), no máximo p_lote passos por vez. Passo com menos de
--     1 minuto fica para a próxima (outro pacote pode estar gravando).
--     Card só conta quando ela NÃO tem o extra (situacao 'bloqueado', ou sem
--     situacao): card de quem já tem não é venda.
create or replace function public.en_rastro_funil_atualizar(p_lote integer default 5000)
returns integer language plpgsql set search_path to ''
as $function$
declare
  v_de bigint;
  v_jovem bigint;
  v_max bigint;
  v_ate bigint;
  v_n integer;
begin
  select coalesce((select s.valor from public.en_rastro_estado s where s.chave = 'funil_ultimo_id'), 0) into v_de;

  with lote as (
    select e.id, e.recebido_em from public.en_events e
     where e.id > v_de order by e.id limit greatest(p_lote, 1)
  )
  select min(l.id) filter (where l.recebido_em >= now() - interval '1 minute'), max(l.id)
    into v_jovem, v_max from lote l;
  v_ate := case when v_jovem is null then v_max else v_jovem - 1 end;
  if v_ate is null or v_ate <= v_de then return 0; end if;

  with passos as (
    select e.customer_id, e.nome, e.ocorrido_em,
           case
             when e.nome in ('card_visto', 'card_toque')
               then case when coalesce(e.props->>'situacao', 'bloqueado') = 'bloqueado'
                         then (select m.oferta from public.en_rastro_mapa m where m.tipo = 'card' and m.valor = e.props->>'card') end
             when e.nome = 'pagina'
               then (select m.oferta from public.en_rastro_mapa m where m.tipo = 'pagina' and m.valor = e.pagina)
             when e.nome in ('oferta_play', 'oferta_pitch', 'oferta_checkout_toque')
               then (select m.oferta from public.en_rastro_mapa m where m.tipo = 'oferta' and m.valor = e.props->>'oferta')
             when e.nome in ('popup_visto', 'popup_toque')
               then (select c.offered_product from public.en_offer_campaigns c where c.key = e.props->>'campanha')
           end as oferta
      from public.en_events e
     where e.id > v_de and e.id <= v_ate
       and e.nome in ('card_visto', 'card_toque', 'pagina', 'oferta_play', 'oferta_pitch',
                      'oferta_checkout_toque', 'popup_visto', 'popup_toque')
  ),
  juntos as (
    select p.customer_id, p.oferta,
           min(p.ocorrido_em) as primeiro_em,
           min(p.ocorrido_em) filter (where p.nome = 'card_visto') as card_visto_em,
           min(p.ocorrido_em) filter (where p.nome = 'card_toque') as card_toque_em,
           min(p.ocorrido_em) filter (where p.nome = 'popup_visto') as popup_visto_em,
           min(p.ocorrido_em) filter (where p.nome = 'popup_toque') as popup_toque_em,
           min(p.ocorrido_em) filter (where p.nome = 'pagina') as pagina_em,
           min(p.ocorrido_em) filter (where p.nome = 'oferta_play') as play_em,
           min(p.ocorrido_em) filter (where p.nome = 'oferta_pitch') as pitch_em,
           min(p.ocorrido_em) filter (where p.nome = 'oferta_checkout_toque') as checkout_em
      from passos p
     where p.oferta is not null
     group by p.customer_id, p.oferta
  )
  insert into public.en_events_funnel as f
    (customer_id, oferta, primeiro_em, card_visto_em, card_toque_em, popup_visto_em,
     popup_toque_em, pagina_em, play_em, pitch_em, checkout_em)
  select j.customer_id, j.oferta, j.primeiro_em, j.card_visto_em, j.card_toque_em, j.popup_visto_em,
         j.popup_toque_em, j.pagina_em, j.play_em, j.pitch_em, j.checkout_em
    from juntos j
  on conflict (customer_id, oferta) do update set
    primeiro_em    = least(f.primeiro_em, excluded.primeiro_em),
    card_visto_em  = least(f.card_visto_em, excluded.card_visto_em),
    card_toque_em  = least(f.card_toque_em, excluded.card_toque_em),
    popup_visto_em = least(f.popup_visto_em, excluded.popup_visto_em),
    popup_toque_em = least(f.popup_toque_em, excluded.popup_toque_em),
    pagina_em      = least(f.pagina_em, excluded.pagina_em),
    play_em        = least(f.play_em, excluded.play_em),
    pitch_em       = least(f.pitch_em, excluded.pitch_em),
    checkout_em    = least(f.checkout_em, excluded.checkout_em);
  get diagnostics v_n = row_count;

  insert into public.en_rastro_estado as s (chave, valor, atualizado_em)
  values ('funil_ultimo_id', v_ate, now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
  return v_n;
end;
$function$;

-- 6c. A retenção da tabela bruta: apaga os passos com mais de p_dias dias
--     (proposta: 90), no máximo p_lote por vez. O resumo e o funil ficam.
create or replace function public.en_rastro_limpar(p_dias integer default 90, p_lote integer default 20000)
returns integer language plpgsql set search_path to ''
as $function$
declare v_n integer;
begin
  if p_dias < 30 then return 0; end if;  -- trava contra apagar o que o resumo ainda relê
  delete from public.en_events e
   where e.id in (select x.id from public.en_events x
                   where x.dia_local < (current_date - p_dias)
                   order by x.dia_local limit greatest(p_lote, 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- 6d. A rodada completa: refaz o resumo dos últimos dias (de anteontem a
--     amanhã, em UTC: cobre o "hoje" de qualquer fuso e o passo que chegou
--     atrasado), atualiza o funil e aplica a retenção.
--     COMO CHAMAR (sempre com o limite de tempo na frente):
--       set statement_timeout = '10s'; select public.en_rastro_rodar();
create or replace function public.en_rastro_rodar()
returns jsonb language plpgsql set search_path to ''
as $function$
declare
  d date;
  v_hoje date := (now() at time zone 'UTC')::date;
  v_resumo jsonb := '{}'::jsonb;
  v_funil integer;
  v_apagados integer;
begin
  for d in select g::date from generate_series(v_hoje - 2, v_hoje + 1, interval '1 day') g loop
    v_resumo := v_resumo || jsonb_build_object(d::text, public.en_rastro_resumir(d));
  end loop;
  v_funil := public.en_rastro_funil_atualizar();
  v_apagados := public.en_rastro_limpar();
  return jsonb_build_object('resumo', v_resumo, 'funil', v_funil, 'apagados', v_apagados, 'em', now());
end;
$function$;

do $permissoes$
declare f text;
begin
  foreach f in array array[
    'en_teste_valido(jsonb, jsonb)',
    'en_rastro_zona(text)',
    'en_testes(uuid)',
    'en_rastro_inserir(uuid, text, jsonb, text, text, boolean, text)',
    'en_rastro_gravar(text, text, jsonb, text, text, boolean)',
    'en_rastro_resumir(date)',
    'en_rastro_funil_atualizar(integer)',
    'en_rastro_limpar(integer, integer)',
    'en_rastro_rodar()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end
$permissoes$;


-- ---------------------------------------------------------------------
-- 7. AS VISÕES DOS PAINÉIS (leem só o resumo, o funil e tabelas pequenas)
-- ---------------------------------------------------------------------
-- Todas com security_invoker = true (lição de 24/09: sem repetir a opção no
-- "create or replace view", ela some em silêncio) e só para o service_role.

-- 7a. O funil, cliente por cliente e oferta, já com a compra. A compra vem
--     de en_pedidos_pagos (Digistore + Hubla), pela cliente: vale a que foi
--     paga depois do primeiro passo dela naquela oferta (1 h de folga).
--     coorte = o dia do primeiro passo, em Nova York.
create or replace view public.en_painel_funil_base with (security_invoker = true) as
  select
    f.customer_id,
    f.oferta,
    (f.primeiro_em at time zone 'America/New_York')::date as coorte,
    (f.card_visto_em is not null)  as card_visto,
    (f.card_toque_em is not null)  as card_toque,
    (f.popup_visto_em is not null) as popup_visto,
    (f.popup_toque_em is not null) as popup_toque,
    (f.pagina_em is not null)      as pagina,
    (f.play_em is not null)        as play,
    (f.pitch_em is not null)       as pitch,
    (f.checkout_em is not null)    as checkout,
    exists (
      select 1 from public.en_pedidos_pagos p
       where p.customer_id = f.customer_id
         and f.oferta = any(p.produtos)
         and p.pagado_en >= f.primeiro_em - interval '1 hour'
    ) as comprou
  from public.en_events_funnel f;

-- 7b. O funil por oferta e por dia de entrada nele (somar os dias dá pessoas
--     de verdade: cada cliente está em UM dia só por oferta).
create or replace view public.en_painel_funil with (security_invoker = true) as
  select
    b.oferta, b.coorte,
    count(*)::integer                              as clientes,
    count(*) filter (where b.card_visto)::integer  as card_visto,
    count(*) filter (where b.card_toque)::integer  as card_toque,
    count(*) filter (where b.popup_visto)::integer as popup_visto,
    count(*) filter (where b.popup_toque)::integer as popup_toque,
    count(*) filter (where b.pagina)::integer      as pagina,
    count(*) filter (where b.play)::integer        as play,
    count(*) filter (where b.pitch)::integer       as pitch,
    count(*) filter (where b.checkout)::integer    as checkout,
    count(*) filter (where b.comprou)::integer     as compras
  from public.en_painel_funil_base b
  group by b.oferta, b.coorte;

-- 7c. O mesmo funil, separado por teste e versão (para qualquer teste, ligado
--     ou já desligado). Só entra quem tem versão sorteada.
create or replace view public.en_painel_funil_teste with (security_invoker = true) as
  select
    a.chave as teste, a.versao, b.oferta,
    count(*)::integer                              as clientes,
    count(*) filter (where b.card_visto)::integer  as card_visto,
    count(*) filter (where b.card_toque)::integer  as card_toque,
    count(*) filter (where b.popup_visto)::integer as popup_visto,
    count(*) filter (where b.popup_toque)::integer as popup_toque,
    count(*) filter (where b.pagina)::integer      as pagina,
    count(*) filter (where b.play)::integer        as play,
    count(*) filter (where b.pitch)::integer       as pitch,
    count(*) filter (where b.checkout)::integer    as checkout,
    count(*) filter (where b.comprou)::integer     as compras
  from public.en_painel_funil_base b
  join public.en_experiment_assignments a on a.customer_id = b.customer_id
  group by a.chave, a.versao, b.oferta;

-- 7d. Os testes: quantas clientes em cada versão (o tamanho de cada grupo).
create or replace view public.en_painel_testes with (security_invoker = true) as
  select x.chave as teste, x.ligado, x.nota, a.versao,
         count(a.customer_id)::integer as clientes,
         min(a.atribuido_em) as primeira_em, max(a.atribuido_em) as ultima_em
    from public.en_experiments x
    left join public.en_experiment_assignments a on a.chave = x.chave
   group by x.chave, x.ligado, x.nota, a.versao;

-- 7e. Ativas por dia (dos dias de visita, no fuso de cada uma), 90 dias.
create or replace view public.en_painel_ativas with (security_invoker = true) as
  select v.visited_on as dia,
         count(*)::integer as ativas,
         count(*) filter (where c.first_access_on = v.visited_on)::integer as novas
    from public.en_visit_days v
    join public.en_customers c on c.id = v.customer_id
   where v.visited_on >= current_date - 90
   group by v.visited_on;

-- 7f. A volta: de cada turma (o dia do primeiro acesso), quantas apareceram
--     no 2º, 3º, 7º e 14º dia (o dia do primeiro acesso é o dia 1, como na
--     jornada). Turmas dos últimos 60 dias. `dias_de_vida` diz se a turma já
--     chegou ao dia que se quer ler (turma de 3 dias ainda não tem "dia 7").
create or replace view public.en_painel_volta with (security_invoker = true) as
  select c.first_access_on as turma,
         (current_date - c.first_access_on + 1) as dias_de_vida,
         count(*)::integer as clientes,
         count(*) filter (where exists (select 1 from public.en_visit_days v where v.customer_id = c.id and v.visited_on = c.first_access_on + 1))::integer  as dia_2,
         count(*) filter (where exists (select 1 from public.en_visit_days v where v.customer_id = c.id and v.visited_on = c.first_access_on + 2))::integer  as dia_3,
         count(*) filter (where exists (select 1 from public.en_visit_days v where v.customer_id = c.id and v.visited_on = c.first_access_on + 6))::integer  as dia_7,
         count(*) filter (where exists (select 1 from public.en_visit_days v where v.customer_id = c.id and v.visited_on = c.first_access_on + 13))::integer as dia_14
    from public.en_customers c
   where c.first_access_on is not null and c.first_access_on >= current_date - 60
   group by c.first_access_on;

-- 7g. A que horas elas abrem o app (a hora do fuso de cada uma), por dia.
create or replace view public.en_painel_hora with (security_invoker = true) as
  select d.dia, d.valor::smallint as hora, d.clientes, d.total as paginas
    from public.en_events_daily d
   where d.nome = 'pagina' and d.recorte = '_hora' and d.teste = '';

-- 7h. O uso por dia: quantas clientes fizeram cada coisa.
create or replace view public.en_painel_uso with (security_invoker = true) as
  select d.dia,
         coalesce(max(d.clientes) filter (where d.nome = 'pagina'), 0)         as com_pagina,
         coalesce(max(d.clientes) filter (where d.nome = 'dia_aberto'), 0)     as abriram_dia,
         coalesce(max(d.clientes) filter (where d.nome = 'rezou'), 0)          as rezaram,
         coalesce(max(d.clientes) filter (where d.nome = 'video_play'), 0)     as video,
         coalesce(max(d.clientes) filter (where d.nome = 'pdf_aberto'), 0)     as pdf,
         coalesce(max(d.clientes) filter (where d.nome = 'audio_play'), 0)     as audio_extras,
         coalesce(max(d.clientes) filter (where d.nome = 'lucy_aberta'), 0)    as lucy_abriu,
         coalesce(max(d.clientes) filter (where d.nome = 'lucy_mensagem'), 0)  as lucy_escreveu,
         coalesce(max(d.clientes) filter (where d.nome = 'suporte_toque'), 0)  as suporte
    from public.en_events_daily d
   where d.recorte = '' and d.teste = ''
   group by d.dia;

do $permissoes$
declare v text;
begin
  foreach v in array array[
    'en_painel_funil_base','en_painel_funil','en_painel_funil_teste','en_painel_testes',
    'en_painel_ativas','en_painel_volta','en_painel_hora','en_painel_uso'
  ] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v);
    execute format('grant select on public.%I to service_role', v);
  end loop;
end
$permissoes$;

commit;


-- =====================================================================
-- CONFERIR (só leitura, leve), logo depois de rodar
-- =====================================================================
--   select relname, relrowsecurity from pg_class
--    where relname in ('en_events','en_experiments','en_experiment_assignments',
--                      'en_events_daily','en_events_funnel','en_rastro_mapa','en_rastro_estado')
--    order by 1;                                          -- 7 linhas, todas true
--   select relname, reloptions from pg_class where relname like 'en\_painel\_%' order by 1;  -- 8, security_invoker=true
--   select tipo, valor, oferta from public.en_rastro_mapa order by 1, 2;
--
-- NO DIA A DIA (leves)
--   Chegou passo hoje? (pelo índice do dia; nunca sem o filtro do dia)
--     select nome, count(*) from public.en_events
--      where dia_local = current_date group by 1 order by 2 desc;
--   Rodar o resumo na mão:
--     set statement_timeout = '10s'; select public.en_rastro_rodar();
--   Ler o resumo:
--     select * from public.en_painel_uso order by dia desc limit 14;
--     select * from public.en_painel_funil order by coorte desc, oferta limit 40;
--
-- CRIAR UM TESTE (uma linha; nasce desligado)
--   insert into public.en_experiments (chave, versoes, publico, nota) values
--     ('card_arcanjos_titulo', '[{"v":"a","peso":1},{"v":"b","peso":1}]', '{"nao_tem":["arcangeles"]}',
--      'Título do card dos Arcanjos: a = atual, b = novo');
--   update public.en_experiments set ligado = true  where chave = 'card_arcanjos_titulo';  -- ligar
--   update public.en_experiments set ligado = false where chave = 'card_arcanjos_titulo';  -- desligar (todas voltam ao padrão)
--   select * from public.en_painel_testes where teste = 'card_arcanjos_titulo';
--
-- AGENDAR O RESUMO (PROPOSTA; o pg_cron já existe no projeto). Duas vezes
-- por dia, 02:30 e 14:30 de Brasília (05:30 e 17:30 UTC): fora da janela das
-- 3h às 8h. Rodar UMA vez, no SQL Editor:
--   select cron.schedule('en-rastro-resumo', '30 5,17 * * *',
--     $$set statement_timeout = '10s'; select public.en_rastro_rodar();$$);
--   Conferir:  select jobid, schedule, command, active from cron.job where jobname = 'en-rastro-resumo';
--   Resultado: select status, return_message, start_time from cron.job_run_details
--               where jobid = (select jobid from cron.job where jobname = 'en-rastro-resumo')
--               order by start_time desc limit 5;
--   Parar:     select cron.unschedule('en-rastro-resumo');
--
-- RECONTAR O FUNIL (depois de mexer em en_rastro_mapa; só reconta os passos
-- que ainda estão na tabela bruta, 90 dias)
--   update public.en_rastro_estado set valor = 0 where chave = 'funil_ultimo_id';
--   set statement_timeout = '10s'; select public.en_rastro_funil_atualizar();  -- repetir até voltar 0
--
-- =====================================================================
-- DESFAZER (só se for preciso; nada do Brasil nem da LATAM). Antes: voltar
-- a en-api para a versão anterior (docs/rastreio-en.md) e parar o agendamento.
-- =====================================================================
-- select cron.unschedule('en-rastro-resumo');
-- drop view if exists public.en_painel_uso, public.en_painel_hora, public.en_painel_volta,
--   public.en_painel_ativas, public.en_painel_testes, public.en_painel_funil_teste,
--   public.en_painel_funil, public.en_painel_funil_base;
-- drop function if exists public.en_rastro_rodar(), public.en_rastro_limpar(integer, integer),
--   public.en_rastro_funil_atualizar(integer), public.en_rastro_resumir(date),
--   public.en_rastro_gravar(text, text, jsonb, text, text, boolean),
--   public.en_rastro_inserir(uuid, text, jsonb, text, text, boolean, text),
--   public.en_testes(uuid), public.en_rastro_zona(text);
-- drop table if exists public.en_rastro_estado, public.en_rastro_mapa, public.en_events_funnel,
--   public.en_events_daily, public.en_experiment_assignments, public.en_experiments, public.en_events;
-- drop function if exists public.en_teste_valido(jsonb, jsonb);
