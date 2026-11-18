# Pedidos de reembolso por e-mail → painel de reembolsos

> Pedido do Arthur em 18/11/2026. Preparado e provado no banco de TESTE em 18/11. **Ainda não está na produção.**

## O que faz, em uma frase
Quando uma cliente pede o dinheiro de volta por e-mail (LATAM: caixa `soporte`; EUA: a caixa do Gmail), o pedido aparece sozinho no painel `/es-reembolsos`, já com a compra dela, um resumo em português e as etiquetas de tipo e motivo.

## O que NÃO faz
- **Não responde ninguém.** A resposta à cliente é a automação do Lucas.
- **Não mexe no Gmail:** não arquiva, não marca como lido, não muda marcador, não apaga.
- **Não devolve dinheiro.** Só cria o pedido; quem devolve é o suporte, pelo painel.
- **Não guarda e-mail que não seja pedido de reembolso.** Agradecimento, dúvida, aviso de plataforma: a IA lê e descarta, nada fica gravado.
- Não toca no Brasil (só tabelas `latam_` e `en_`).

## Como funciona
```
Gmail da caixa ──(a cada 10 min, só os e-mails novos)──> Robô do Google (Apps Script)
   tira: e-mails da própria caixa, robôs (Whop, Digistore, Brevo, Hubla...), boletins,
         respostas automáticas e o que estiver em IGNORAR (a automação do Lucas)
   corta a citação dos e-mails anteriores
        │
        ▼
Função suporte-email (Supabase) ── IA (Claude Haiku) ──> é pedido de reembolso?
        │ não → descarta, nada gravado
        │ sim → acha a cliente e a compra (a mesma busca da página /es-reembolso),
        │       primeiro na região da caixa, depois na outra
        ▼
latam_refund_requests  ou  en_refund_requests   (canal = 'email')
```
- **Conta como pedido:** pedir o dinheiro de volta, cobrança em dobro, "não reconheço a compra" e ameaça de ir ao banco ou abrir disputa.
- **Etiquetas:** `email_tipo` (`pedido_reembolso`, `cobro_doble`, `no_reconoce`, `amenaza_banco`) e `motivo` (os de sempre + `extra_sin_querer`).
- **Já existe pedido pendente dela:** não cria outro. Completa o que estiver vazio e acrescenta uma linha na nota, com data, tipo e resumo do e-mail novo.
- **Sem compra achada:** o pedido entra igual, com "sem compra" (`sin_compra`), e o suporte procura.
- **Se ela citar outro e-mail** ("comprei com o e-mail X"), a busca usa esse também.
- **Primeira vez (varredura):** lê os últimos 7 dias e descarta o que já foi devolvido (na plataforma ou com pedido "Reembolsado" no painel).
- **O mesmo e-mail nunca vira dois pedidos** (índice único no `email_message_id`), e dois e-mails da mesma cliente no mesmo lote também não.

Arquivos:
| Peça | Onde |
|---|---|
| Banco (colunas novas) | `supabase/latam/16-reembolso-por-email.sql` |
| Função | `supabase/functions/suporte-email/index.ts` |
| Robô do Gmail | `suporte/gmail-leitor.gs` (fora do site: o build não publica essa pasta) |
| Teste local (92 conferências) | `supabase/functions/suporte-email/testa-suporte-email.mjs` |
| Prova no banco de teste | `supabase/functions/suporte-email/prova-no-teste.mjs` |

## Quanto custa
- **IA:** cerca de US$ 0,0003 por e-mail lido (Claude Haiku: ~1.000 palavras-código de entrada e ~300 de saída). Com 300 e-mails por dia nas duas caixas, dá uns **US$ 0,10 por dia, ~US$ 3 por mês**. Sai da mesma conta da API que a Lucía usa (o crédito do plano Team).
- **Supabase:** dentro do gratuito. O robô só chama a função quando há e-mail novo (no máximo 144 chamadas por dia por caixa), e cada pedido faz poucas consultas pequenas, todas por e-mail. As tabelas de compras têm poucos MB (conferido em 18/11).
- **Google (Apps Script):** grátis.

## Como desligar
- **Uma caixa:** no projeto do robô (script.google.com, logado naquela caixa), escolher a função `desinstalar` e clicar em **Executar**. Ou apagar o gatilho em *Acionadores*.
- **Tudo de uma vez:** apagar o segredo `SUPORTE_EMAIL_TOKEN` no Supabase (*Edge Functions → Secrets*). A função passa a recusar tudo, e nada mais é gravado.
- Os pedidos já criados continuam no painel (dá para excluir lá).

---

## Ir ao ar — roteiro do Arthur
**Ordem:** SQL 16 → SQL 17 (o do painel, da outra sessão) → função → segredos → robô em cada Gmail. O agente prepara cada passo e confere depois; o Arthur clica. Um passo por tela, com foto quando pedido.

**Horário:** qualquer hora fora das 3h–8h de Brasília.

### Passo 1 — SQL 16 (2 min)
1. Supabase → projeto **7-amens-app-v2** → **SQL Editor** → **New query**.
2. O agente põe o conteúdo de `supabase/latam/16-reembolso-por-email.sql` na área de transferência. Clique no editor, **Ctrl+A**, **Ctrl+V**, **Run**.
3. Esperado: "Success. No rows returned". Pode rodar de novo sem estragar nada.

O que muda para a cliente: nada. Só abre espaço no banco.

### Passo 2 — a função `suporte-email` (5 min)
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. ⚠️ **Antes de tudo, escreva o nome lá embaixo: `suporte-email`.** (O "Deploy" publica com o nome que estiver no campo, e não dá para trocar depois.)
3. O agente põe `supabase/functions/suporte-email/index.ts` na área de transferência. No editor: **Ctrl+A**, **Ctrl+V**. Mande a foto.
4. **Deploy function**.
5. Aba **Settings** → desligar **"Verify JWT with legacy secret"** → **Save changes**. (Ligado, o robô recebe "401" e nada entra.)

### Passo 3 — os segredos (2 min)
1. Supabase → **Edge Functions** → **Secrets**.
2. Conferir que **`ANTHROPIC_API_KEY`** já está na lista (é a da Lucía). Se não estiver, avisar o agente.
3. **Add new secret**: nome **`SUPORTE_EMAIL_TOKEN`**; valor: o agente gera uma senha longa e põe na área de transferência. **Save**.
4. Guarde essa senha só até o passo 4 (vai nas duas caixas). Ela nunca entra em arquivo nenhum.

### Passo 4 — o robô em cada Gmail (5 min por caixa)
Fazer duas vezes: na caixa **soporte** (LATAM) e na caixa dos **EUA**.
1. Abrir **script.google.com** logado **na caixa de suporte** (não na sua conta pessoal).
2. **Novo projeto**. Nome: "Leitor de reembolsos".
3. Apagar o que vier escrito; o agente põe `suporte/gmail-leitor.gs` na área de transferência; **Ctrl+V**; **Salvar** (ícone de disquete).
4. Engrenagem **Configurações do projeto** → lá embaixo, **Propriedades do script** → **Adicionar propriedade**:
   - `CAIXA` = `soporte` (na caixa da LATAM) ou `eua` (na dos EUA)
   - `SUPORTE_EMAIL_TOKEN` = a senha do passo 3
   - `IGNORAR` = o e-mail da automação do Lucas, se ela escrever de um endereço diferente da própria caixa (pode deixar vazio)
5. Voltar ao **Editor**, escolher a função **`instalar`** na lista do topo e clicar em **Executar**.
6. O Google pede autorização: escolher a conta da caixa → "Avançado" → "Acessar Leitor de reembolsos" → **Permitir**.
   - ⚠️ A tela do Google fala em "ler, escrever e apagar e-mails": é o pedido padrão do Google para qualquer robô de Gmail. **O código só lê** (não há envio, arquivamento nem exclusão nele).
   - Se aparecer "bloqueado pelo administrador", a conta Google Workspace da PK Scale precisa liberar Apps Script: avisar o agente.
7. Esperado no registro de execução: "Lidos N, enviados M". A primeira vez lê os últimos 7 dias e pode levar alguns minutos (se passar do tempo, continua sozinho na volta seguinte).

### Passo 5 — conferir (o agente)
- Abrir `/es-reembolsos` e ver os pedidos com canal "e-mail".
- Logs da função no Supabase sem erro.
- Mandar um e-mail de teste para a caixa pedindo reembolso (de um e-mail pessoal, sem compra) e ver o pedido aparecer em até 10 min com "sem compra". Depois, excluir no painel.

### Ponto de volta
- Desligar: ver "Como desligar", acima. Nada do resto do app depende disto.
- Banco: o bloco "DESFAZER" no fim do SQL 16 (só se for preciso; as colunas novas podem ficar).

---

## Para quem mexer depois
- **Contrato com o painel:** o `email_message_id` é `<caixa>:<id da mensagem no Gmail>` (ex.: `soporte:18c...`). O `email_link` abre a conversa no Gmail da caixa (`?authuser=<caixa>#all/<id da conversa>`). Na tabela dos EUA, a coluna `canal` nasce no SQL 16.
- **A linha da nota** de um e-mail que completou um pedido termina com `[msg <id>]`: é o que impede a mesma linha de entrar duas vezes. Não apagar a marca ao editar a nota (se apagar, um reenvio do mesmo e-mail pode repetir a linha; nada além disso).
- **O robô lembra até onde leu** nas propriedades do script (`CURSOR`, `VISTOS`, `FALHAS`, `INSTALADO_EM`). Apagar `CURSOR` faz reler desde a instalação; apagar `INSTALADO_EM` também refaz a varredura de 7 dias.
- **E-mail que falha 3 vezes** (IA fora, banco fora) é deixado para trás para não travar os outros. Aparece nos logs da função.
- **Volume:** a primeira leitura pega até 500 conversas. Se a caixa tiver mais que isso em 7 dias, as mais antigas ficam de fora.
- **O teste local:** `"C:\Program Files\nodejs\node.exe" supabase/functions/suporte-email/testa-suporte-email.mjs` (banco, IA e Gmail de mentira).
- **A prova no teste** usa a IA de verdade e compras inventadas no banco de teste (`prova-leitor-*@exemplo.com`, já semeadas em 18/11). O token de ensaio `ensaio-do-leitor` só vale no banco de teste e só enquanto lá não houver o segredo.

### Preparo da prova (banco de TESTE; dados inventados)
```sql
insert into public.latam_customers (email, name) values
  ('prova-leitor-maria@exemplo.com', 'Prova Maria'), ('prova-leitor-velha@exemplo.com', 'Prova Velha')
on conflict (email) do nothing;
insert into public.latam_whop_events (webhook_id, event_type, payment_id, customer_email, status, payload, received_at) values
  ('prova-leitor-w1', 'payment.succeeded', 'pay_ProvaLeitor001', 'prova-leitor-maria@exemplo.com', 'processed',
   jsonb_build_object('data', jsonb_build_object('total', jsonb_build_object('amount', '21.00'), 'currency', 'usd', 'paid_at', (now() - interval '2 days')::text)), now() - interval '2 days'),
  ('prova-leitor-w2', 'payment.succeeded', 'pay_ProvaLeitor002', 'prova-leitor-maria@exemplo.com', 'processed',
   jsonb_build_object('data', jsonb_build_object('total', jsonb_build_object('amount', '69.00'), 'currency', 'usd', 'paid_at', (now() - interval '2 days')::text)), now() - interval '2 days'),
  ('prova-leitor-w3', 'payment.succeeded', 'pay_ProvaLeitor003', 'prova-leitor-velha@exemplo.com', 'processed',
   jsonb_build_object('data', jsonb_build_object('total', jsonb_build_object('amount', '21.00'), 'currency', 'usd', 'paid_at', (now() - interval '5 days')::text)), now() - interval '5 days'),
  ('prova-leitor-w4', 'refund.created', 'pay_ProvaLeitor003', 'prova-leitor-velha@exemplo.com', 'processed',
   jsonb_build_object('data', jsonb_build_object('status', 'succeeded')), now() - interval '4 days')
on conflict do nothing;
-- As duas compras da Maria ligadas a um produto (sem isso, o nome vira "Tu compra", como na página):
update public.latam_whop_events set payload = jsonb_set(payload, '{data,metadata}', jsonb_build_object('kashpay_transaction_id',
  case webhook_id when 'prova-leitor-w1' then 'prova-leitor-tx1' else 'prova-leitor-tx2' end))
where webhook_id in ('prova-leitor-w1','prova-leitor-w2');
insert into public.latam_kashpay_events (event, transaction_id, amount_cents, currency, produtos, paid_at, event_created_at) values
  ('order.paid', 'prova-leitor-tx1', 2100, 'USD', array['principal'], now() - interval '2 days', now() - interval '2 days'),
  ('order.paid', 'prova-leitor-tx2', 6900, 'USD', array['arcangeles'], now() - interval '2 days', now() - interval '2 days')
on conflict do nothing;
-- Para rodar a prova de novo do zero:
-- delete from latam_refund_requests where email like 'prova-leitor-%'; delete from en_refund_requests where email like 'prova-leitor-%';
```
Resultado esperado (18/11, IA de verdade): a velha é **descartada** (já devolvida, varredura), o agradecimento e a tentativa de "mandar" na IA são **ignorados**, a Maria vira **um** pedido (7 Amenes + Arcángeles, US$ 90) que os outros três e-mails dela e do filho **completam**, o John vira pedido "sem compra" nos EUA, e o reenvio é **repetido**.
