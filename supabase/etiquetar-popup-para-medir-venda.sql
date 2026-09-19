-- =====================================================================
-- ETIQUETAR OS POP-UPS PARA MEDIR VENDA
--
-- O QUE ISTO RESOLVE
-- Hoje a venda chega na Hubla sem dizer qual pop-up a trouxe. Depois disto,
-- cada uma das quatro versões do pop-up carrega a sua própria etiqueta até
-- o checkout, e a Hubla devolve essa etiqueta no webhook. Aí dá para
-- responder: qual pop-up vende mais?
--
-- ⚠️ POR QUE A ETIQUETA DEIXOU DE SE CHAMAR "src"
-- A VTurb (o player do vídeo da página de oferta) escreve a etiqueta DELA
-- no parâmetro "src" quando a plataforma de venda não é uma das que ela
-- integra nativamente — e a Hubla não é. Ou seja: o que a gente escrevesse
-- em "src" seria sobrescrito antes de chegar ao checkout. Por isso agora
-- usamos os campos utm_*, que a VTurb apenas LÊ, nunca escreve.
--
-- OS NOMES DAS CAMPANHAS (definidos aqui, uma vez, para não mudar depois)
--   utm_source   = app        -> a venda nasceu dentro do aplicativo
--   utm_medium   = popup      -> veio de um pop-up (não de anúncio, não de e-mail)
--   utm_campaign = arcanjos   -> a oferta vendida (Oração Celestial dos Quatro Arcanjos)
--   utm_content  = a versão do pop-up. É ESTE o campo que mede:
--
--     novas-1a-exibicao     cliente que acabou de comprar, primeira vez que vê
--     novas-2a-exibicao     cliente que acabou de comprar, segunda vez que vê
--     antigas-1a-exibicao   cliente da base histórica, primeira vez que vê
--     antigas-2a-exibicao   cliente da base histórica, segunda vez que vê
--
-- ONDE O CAIO VAI LER ISSO
--   1. Na Hubla, na fatura da venda, no campo "Parâmetros de UTM".
--   2. No nosso banco, dentro de hubla_events.payload, no caminho
--      event.subscription.firstPaymentSession.utm.content
--      (o webhook já guarda o evento inteiro; não precisa mudar nada nele).
--
-- ⚠️ NÃO RODAR SEM O CAIO MANDAR. Isto muda o comportamento do app que as
--    clientes estão usando AGORA, na hora, sem precisar de deploy.
--
-- ⚠️ A ORDEM IMPORTA — rode ESTE SQL PRIMEIRO, publique a página DEPOIS.
--    Motivo: a página oferta-arcanjos.html só passa a etiqueta adiante na
--    versão nova. Entre um passo e outro existe uma janela curta:
--      • rodando o SQL primeiro, a venda dessa janela chega SEM etiqueta
--        (campo em branco na Hubla) — ou seja, "não sei de onde veio",
--        que é verdade;
--      • fazendo o contrário, a página carimbaria "sem-popup" numa venda
--        que VEIO do pop-up — ou seja, um dado errado.
--    Em branco é melhor que errado. Por isso: SQL primeiro.
--
-- O endereço abaixo é o de produção mesmo, escrito por extenso, porque o
-- banco só aceita https. Quem testa no computador não é mandado para
-- produção: o js/member.js reconhece que é uma página do próprio app e
-- troca o domínio pelo de onde ela está.
--
-- Para testar no banco de TESTE (wyiqwsgfictcfkytldnu), rode este mesmo
-- arquivo lá. Não tem cliente real nenhuma nesse banco.
-- =====================================================================

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?utm_source=app&utm_medium=popup&utm_campaign=arcanjos&utm_content=novas-1a-exibicao',
       updated_at = now()
 where key = 'front_novas_1';

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?utm_source=app&utm_medium=popup&utm_campaign=arcanjos&utm_content=novas-2a-exibicao',
       updated_at = now()
 where key = 'front_novas_2';

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?utm_source=app&utm_medium=popup&utm_campaign=arcanjos&utm_content=antigas-1a-exibicao',
       updated_at = now()
 where key = 'front_antigas_1';

update public.member_offer_campaigns
   set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?utm_source=app&utm_medium=popup&utm_campaign=arcanjos&utm_content=antigas-2a-exibicao',
       updated_at = now()
 where key = 'front_antigas_2';


-- Confirme o resultado. As quatro linhas têm que aparecer com o endereço
-- novo, e cada uma com o seu próprio utm_content no fim.
select key, enabled, target_url
  from public.member_offer_campaigns
 where key in ('front_novas_1','front_novas_2','front_antigas_1','front_antigas_2')
 order by sort_order;


-- =====================================================================
-- DEPOIS DAS PRIMEIRAS VENDAS: quantas vendas cada pop-up trouxe
--
-- Só leitura, não altera nada. Roda direto no SQL Editor do Supabase.
-- Lê o evento cru que a Hubla mandou, exatamente como ele chegou.
-- =====================================================================
-- select
--   coalesce(
--     payload -> 'event' -> 'subscription' -> 'firstPaymentSession' -> 'utm' ->> 'content',
--     '(sem etiqueta)'
--   ) as pop_up,
--   count(*) as vendas
-- from public.hubla_events
-- where event_type = 'customer.member_added'
--   and hubla_product_id = 'ODOZxlF1tfhee2TkZikI'   -- Quatro Arcanjos
-- group by 1
-- order by vendas desc;


-- =====================================================================
-- COMO VOLTAR ATRÁS, se precisar
--
-- Devolve as quatro campanhas para a etiqueta antiga (?src=...). Volta na
-- hora, sem deploy. Lembrando que a etiqueta antiga nunca chegou ao
-- checkout — era justamente esse o problema.
-- =====================================================================
-- update public.member_offer_campaigns
--    set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v1-a', updated_at = now()
--  where key = 'front_novas_1';
--
-- update public.member_offer_campaigns
--    set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v1-b', updated_at = now()
--  where key = 'front_novas_2';
--
-- update public.member_offer_campaigns
--    set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v2-a', updated_at = now()
--  where key = 'front_antigas_1';
--
-- update public.member_offer_campaigns
--    set target_url = 'https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-v2-b', updated_at = now()
--  where key = 'front_antigas_2';
