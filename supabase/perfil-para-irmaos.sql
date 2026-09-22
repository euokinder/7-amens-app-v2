-- Formulário de perfil para homens e mulheres
-- ============================================
-- Rodar no SQL Editor do Supabase, no projeto de PRODUÇÃO.
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

alter table public.member_survey_responses
  drop constraint if exists member_survey_responses_motherhood_check;

alter table public.member_survey_responses
  add constraint member_survey_responses_motherhood_check check (
    motherhood_status in (
      'mother', 'grandmother', 'mother_and_grandmother', 'neither',
      -- Valores novos. 'neither' serve aos dois: "Ainda não sou mãe nem avó"
      -- e "Ainda não sou pai nem avô" são a mesma resposta.
      'father', 'grandfather', 'father_and_grandfather'
    ));

commit;

-- CONFERÊNCIA — rodar depois e esperar 7 valores na lista:
--
-- select pg_get_constraintdef(oid)
--   from pg_constraint
--  where conname = 'member_survey_responses_motherhood_check';
