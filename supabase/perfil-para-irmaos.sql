-- Formulário de perfil para homens e mulheres
-- ============================================
-- ✅ JÁ FOI APLICADO NA PRODUÇÃO em 2026-09-21, com autorização do Caio, e
-- conferido depois: existe UMA trava, com os 7 valores. Este arquivo fica como
-- registro e para reconstruir um banco novo.
--
-- POR QUE ISTO EXISTE
-- O formulário de perfil falava só com mulheres: "Sou casada", "Por mim
-- mesma", "Irmã, hoje você é...". Medição de 19/09: cerca de 4 em cada 10
-- cadastros estão em nome masculino. Agora quem abre o formulário escolhe,
-- logo na primeira tela, entre "Sou irmã" e "Sou irmão", e o texto inteiro
-- se ajusta.
--
-- Na maioria das perguntas muda só o RÓTULO — "Sou casada" e "Sou casado"
-- gravam o mesmo `married`. Só a primeira pergunta muda o valor gravado,
-- porque pai não é mãe. São esses três valores novos que o banco precisa
-- passar a aceitar.
--
-- ⚠️ A TRAVA TEM DOIS NOMES POSSÍVEIS, E ESSE FOI O ERRO QUE QUASE PASSOU
-- A primeira versão deste arquivo só conhecia `..._motherhood_check`, o nome
-- que o `schema-completo.sql` usa ao criar a tabela do zero. Mas na PRODUÇÃO
-- a tabela nasceu de outro jeito e o Postgres batizou a trava sozinho, de
-- `..._motherhood_status_check` — com o "status" no meio.
--
-- O estrago seria silencioso: o `drop` não encontraria nada, o `add` criaria
-- uma trava NOVA e permissiva, e a trava VELHA e restritiva continuaria de pé
-- ao lado dela. O SQL diria "sucesso" e os homens continuariam sem conseguir
-- terminar o formulário.
--
-- Por isso os dois nomes são derrubados abaixo. A lição vale para todo SQL
-- deste projeto: conferir contra o banco vivo, nunca confiar no arquivo.
--
-- É SEGURO RODAR
-- Alargar uma trava CHECK nunca invalida linha que já existe: tudo que era
-- válido continua válido. Nenhuma resposta já coletada é tocada, nenhuma
-- coluna é criada ou apagada. Roda em segundos.
--
-- ORDEM OBRIGATÓRIA — e esta parte importa
--   1º) este SQL
--   2º) publicar a Edge Function `member-api` (a lista de valores aceitos
--       está DENTRO dela também, em supabase/functions/member-api/index.ts)
--   3º) publicar o site
--
-- Invertendo a ordem, um homem que escolher "Pai" ou "Avô" leva
-- "Responda todas as perguntas para continuar" e NÃO consegue terminar o
-- formulário — o valor novo bate na trava velha. As mulheres não sentem
-- nada, então o defeito atinge só metade do público e passa despercebido
-- por quem testar com a própria conta.

begin;

-- Os dois nomes: o da produção e o do schema-completo.sql. Derrubar o que não
-- existe não custa nada; deixar um de pé arruinaria tudo em silêncio.
alter table public.member_survey_responses
  drop constraint if exists member_survey_responses_motherhood_status_check;
alter table public.member_survey_responses
  drop constraint if exists member_survey_responses_motherhood_check;

alter table public.member_survey_responses
  add constraint member_survey_responses_motherhood_status_check check (
    motherhood_status in (
      'mother', 'grandmother', 'mother_and_grandmother', 'neither',
      -- Valores novos. 'neither' serve aos dois: "Ainda não sou mãe nem avó"
      -- e "Ainda não sou pai nem avô" são a mesma resposta.
      'father', 'grandfather', 'father_and_grandfather'
    ));

commit;

-- CONFERÊNCIA — rodar depois e esperar UMA linha, com os 7 valores.
-- Se vierem DUAS linhas, a trava velha sobreviveu e os homens continuam
-- bloqueados:
--
-- select con.conname, pg_get_constraintdef(con.oid)
--   from pg_constraint con
--   join pg_class rel on rel.oid = con.conrelid
--  where rel.relname = 'member_survey_responses'
--    and con.conname like '%motherhood%';
