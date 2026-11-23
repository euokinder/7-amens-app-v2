-- =====================================================================
-- App em inglês: a liberação da Hubla passa a rodar A CADA MINUTO
-- (23/11/2026, pedido do Arthur).
--
-- POR QUÊ: quem compra um extra (hoje, o Three Mornings) esperava até
-- 5 minutos para o pg_cron liberar, e mais um pouco para o app perguntar
-- de novo. A home do /en agora pergunta ao servidor quando a cliente volta
-- ao app (js/en/inicio.js); com a liberação a cada minuto, a compra aparece
-- em ~1 minuto.
--
-- O QUE MUDA: só o horário do job 'en-hubla-liberar' (criado no
-- 18-tres-madrugadas.sql). O comando é o mesmo; rodar cron.schedule com o
-- mesmo nome só troca o agendamento. A consulta olha 2 dias de
-- hubla_events pelo índice de received_at (~0,1 s) e tem freio de 10 s.
-- Nada do Brasil é alterado: en_hubla_liberar() só LÊ hubla_events.
--
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

select cron.schedule(
  'en-hubla-liberar',
  '* * * * *',
  $cron$set statement_timeout = '10s'; select public.en_hubla_liberar(now() - interval '2 days');$cron$
);

-- CONFERIR (só leitura):
-- select jobname, schedule, active from cron.job where jobname = 'en-hubla-liberar';

-- DESFAZER (voltar a cada 5 minutos): o mesmo comando, com '*/5 * * * *'.
