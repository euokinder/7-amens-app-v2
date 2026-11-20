# Rastreamento do app em inglês (7 Amens Before Dawn)

> Criado em 20/11/2026. Decisão do Arthur: o app é o motor de monetização, e para isso é preciso saber o que cada cliente faz lá dentro.
> **Estado: a base está pronta e provada só no banco de TESTE. Nada foi publicado na produção.**
> Só objetos `en_`. Nada do Brasil nem da LATAM é tocado.

## Em uma frase

Cada coisa que a cliente faz no app vira um **passo** (abriu a página, viu o card, tocou, deu play, o botão de compra apareceu, tocou em comprar). Os passos ficam numa tabela só. Uma vez por dia eles viram um **resumo** pequeno, e é só o resumo que os painéis leem. Em cima disso roda qualquer **teste A/B**.

## As peças

| Peça | Onde mora | O que faz |
|---|---|---|
| O registrador da tela | `js/en/rastro.js` | junta os passos e manda em pacote |
| A versão do teste na tela | `js/en/sesion.js` (`AMENES.variante`) | diz que versão esta cliente vê |
| A porta | `supabase/functions/en-api` (ação `eventos`) | limpa o pacote e grava |
| O banco | `supabase/en/16-rastreio.sql` | tabelas, sorteio do teste, resumo, funil, visões |
| As provas | `supabase/en/testes/` e `supabase/functions/en-api/testa-en-api.mjs` | ver "Provas", no fim |

## Como a tela usa

```js
window.AMENES.rastro('card_toque', { card: 'arcangeles', situacao: 'bloqueado' });

const retrato = await AMENES.retrato();
if (AMENES.variante('card_arcanjos_titulo') === 'b') { /* mostra a versão b */ }
```

- `rastro(nome, props)` nunca dá erro e nunca espera resposta. Sem o `rastro.js` na página, é uma função vazia.
- `variante(chave)` devolve a versão (`'a'`, `'b'`...) ou `null`. `null` = não há teste para ela: **a tela mostra o padrão**. Só responde depois do `await AMENES.retrato()`.
- Cada `en*.html` precisa da tag `<script src="/js/en/rastro.js" defer></script>`. A ordem entre ele e o `sesion.js` não importa.

## O catálogo dos passos (é um contrato: não renomear)

| Passo | Props | Quem grava |
|---|---|---|
| `pagina` | `de` (a página anterior do app), `volta` | o `rastro.js`, sozinho, ao carregar |
| `card_visto`, `card_toque` | `card`, `situacao` | a tela |
| `dia_aberto` | `dia` | a tela |
| `video_play`, `video_progresso` | `video`, `onde`, `pct` (25, 50, 75, 100) | a tela |
| `pdf_aberto` | `pdf`, `onde` | a tela |
| `audio_play`, `audio_progresso` | `extra`, `faixa`, `pct` | a tela |
| `lucy_aberta`, `lucy_mensagem` | — | a tela |
| `suporte_toque` | `canal` | a tela |
| `oferta_play`, `oferta_pitch`, `oferta_checkout_toque` | `oferta`, `nivel` | a tela |
| `popup_visto`, `popup_toque`, `popup_fechou` | `campanha` | **o servidor** (junto da ação `oferta`) |
| `rezou` | `dia`, `jornada` (`principal` ou `cantico`), `done` | **o servidor** (junto da ação `progress`) |

A **compra não é passo**: vem dos avisos de venda (`en_pedidos_pagos`) e entra no funil pela cliente.

### Os valores que o funil lê

- `oferta`: `arcangeles` ou `cantico`.
- `card` dos dois extras: `arcangeles` e `cantico`.
- `situacao`: `bloqueado` (ela não tem; o card vende) ou `liberado` (ela tem). **O funil só conta `bloqueado`.**
- A tela usou outro nome? Uma linha em `en_rastro_mapa` resolve, sem publicar nada:
  ```sql
  insert into public.en_rastro_mapa (tipo, valor, oferta) values ('card', 'four_archangels', 'arcangeles');
  ```
- Oferta nova (ex.: As 3 Madrugadas): uma linha por card, por página de venda e por valor de `oferta`.

### O que o servidor corta

- Nome fora de `^[a-z0-9_]{1,40}$`.
- `popup_*` e `rezou` vindos da tela (só o servidor grava).
- Em `props`: mais de 8 chaves, chave fora de `^[a-z][a-z0-9_]{0,23}$`, lista ou objeto dentro de objeto, texto com mais de 80 letras (corta) e **texto com `@`** (pode ser e-mail).
- Na página: tudo que não for só o caminho. O que vem depois de `?` ou `#` nunca é gravado (o código do link de entrada mora no `#`).
- Mais de 20 passos num pacote.

**Nada de dado de pessoa nos passos.** A linha tem só o id da cliente. Nome, e-mail e telefone nunca vão em `props`.

## O que cada passo guarda

`customer_id` · `nome` · `props` · `pagina` · `ocorrido_em` (hora do servidor) · `dia_local` e `hora_local` (no fuso dela) · `aparelho` (mobile/desktop), `sistema`, `instalado` (abriu pelo ícone da tela inicial) · `variantes` (as versões de teste que ela via, carimbadas pelo banco) · `origem` (as utm da página) · `fonte` (tela ou servidor).

A tela manda só "há quantos segundos aconteceu". O relógio do celular não entra na conta.

## Testes A/B

Serve para qualquer elemento: card, pop-up, página, texto, preço, ordem. A cliente cai **sempre na mesma versão**, em qualquer aparelho.

**Criar** (nasce desligado):
```sql
insert into public.en_experiments (chave, versoes, publico, nota) values
  ('card_arcanjos_titulo', '[{"v":"a","peso":1},{"v":"b","peso":1}]', '{"nao_tem":["arcangeles"]}',
   'Título do card dos Arcanjos: a = atual, b = novo');
```
**Ligar / desligar** (sem publicar função nem site):
```sql
update public.en_experiments set ligado = true  where chave = 'card_arcanjos_titulo';
update public.en_experiments set ligado = false where chave = 'card_arcanjos_titulo';
```
- `peso`: 1 e 1 = meio a meio; 1 e 3 = 25% e 75%. Peso 0 = não recebe cliente nova (quem já estava nela continua).
- `publico` (tudo opcional; `{}` = todas): `"desde"` e `"antes"` (dia do primeiro acesso), `"tem"` e `"nao_tem"` (`arcangeles`, `cantico`).
- Quem fica fora do público não entra no teste e vê o padrão.
- Desligar faz todas voltarem ao padrão em até 5 minutos. Ligar de novo devolve a **mesma** versão a cada uma.
- ⚠️ A tela precisa saber desenhar a versão `b`. O banco só sorteia.
- ⚠️ A chave `rastro` é reservada (ver "Freio de mão").

**Ler o resultado:**
```sql
select * from public.en_painel_testes where teste = 'card_arcanjos_titulo';        -- tamanho de cada grupo
select * from public.en_painel_funil_teste where teste = 'card_arcanjos_titulo';   -- o funil de cada versão, com compras
select nome, recorte, valor, versao, clientes, total from public.en_events_daily   -- qualquer passo, por versão e dia
 where teste = 'card_arcanjos_titulo' and dia >= current_date - 14 order by dia, nome, versao;
```

## O resumo (o que os painéis leem)

⛔ **Os painéis nunca leem `en_events`.** Leem estas:

| O quê | Onde |
|---|---|
| Funil de cada oferta, por dia de entrada (card visto → tocado → página → play → pitch → toque em comprar → compra; e o pop-up) | `en_painel_funil` |
| O mesmo funil por teste e versão | `en_painel_funil_teste` |
| Tamanho de cada grupo de teste | `en_painel_testes` |
| Ativas por dia e quantas são novas | `en_painel_ativas` |
| Volta no 2º, 3º, 7º e 14º dia, por turma | `en_painel_volta` |
| A que horas (no fuso delas) abrem o app | `en_painel_hora` |
| Uso por dia: dia aberto, rezou, vídeo, PDF, áudio dos extras, Lucy, suporte | `en_painel_uso` |
| Qualquer passo, por dia, cortado por cada prop, por página, aparelho, origem e versão | `en_events_daily` |

Duas contas diferentes, para não enganar:
- **`en_painel_funil` conta pessoas.** Cada cliente aparece uma vez por oferta, no dia em que entrou no funil. Somar os dias dá gente de verdade.
- **`en_events_daily` conta clientes por dia.** Somar vários dias conta a mesma pessoa mais de uma vez.

### Como o resumo roda

Uma função, `en_rastro_rodar()`: refaz o resumo dos últimos 4 dias, atualiza o funil e apaga os passos antigos. Sempre com limite de tempo na frente:
```sql
set statement_timeout = '10s'; select public.en_rastro_rodar();
```
Rodar duas vezes dá o mesmo resultado.

**Proposta (decisão do Arthur): agendar pelo `pg_cron`**, que já existe nos dois projetos. Duas vezes por dia, 02:30 e 14:30 de Brasília, fora da janela das 3h às 8h:
```sql
select cron.schedule('en-rastro-resumo', '30 5,17 * * *',
  $$set statement_timeout = '10s'; select public.en_rastro_rodar();$$);
```
Sem o agendamento, o resumo roda sob demanda: quem atualiza os painéis roda a linha acima antes de ler.

### Retenção da tabela bruta

Proposta: **90 dias** (o padrão de `en_rastro_limpar`). O resumo e o funil ficam para sempre; só os passos crus são apagados.

Estimativa de tamanho (é estimativa, não medida): com ~850 clientes ativas por dia (o número de 19/11) e ~25 passos por cliente, são ~21 mil linhas por dia. Em 90 dias, perto de 2 milhões de linhas e de **0,7 GB**. Em 45 dias, metade. Se o app dobrar, dobra. Vale decidir entre 45 e 90 olhando o espaço do banco.

## Quantas chamadas isso custa

Hoje abrir uma página do app muitas vezes custa **zero** chamadas (o retrato fica guardado 5 minutos). Com o rastreamento, cada página vista passa a custar **1 a 2**:

- abrir e sair, sem mais nada: **1** (na saída);
- página com passos da tela: 1 aos 10 segundos + 1 na saída, se houve passo novo;
- página longa (vídeo): no máximo 1 por minuto, e só se houver passo novo.

Estimativa (não medida): ~850 ativas por dia × ~6 páginas × ~1,3 chamada = **~6.500 chamadas por dia, perto de 200 mil por mês**, no tamanho de hoje. A cota de chamadas é da organização inteira, dividida com o Brasil e a LATAM. **Conferir o consumo da cota antes de ligar**, e de novo uma semana depois.

Cada chamada é leve: uma ida só ao banco (sessão, freio e gravação juntas), sem ler a cliente nem o acesso. O pacote vai como `text/plain`, sem cabeçalho próprio, para o navegador não fazer a pergunta prévia (OPTIONS).

Para gastar menos: em `js/en/rastro.js`, `PRIMEIRO_ENVIO` maior (ou só na saída) leva para perto de 1 por página. E a tela pode mandar `card_visto` só dos cards que vendem, não de todos.

### Freio de mão (sem publicar nada)

Para a tela parar de mandar passos, em até 5 minutos:
```sql
insert into public.en_experiments (chave, ligado, versoes, nota)
values ('rastro', true, '[{"v":"off"}]', 'FREIO DE MÃO: a tela para de mandar passos')
on conflict (chave) do update set ligado = true;
```
Soltar: `update public.en_experiments set ligado = false where chave = 'rastro';`

O pop-up e o "rezou" continuam gravados pelo servidor (não custam chamada a mais).

## Consultas de conferência (leves)

```sql
-- Chegou passo hoje? (sempre com o filtro do dia: usa o índice)
select fonte, nome, count(*) from public.en_events
 where dia_local = current_date group by 1, 2 order by 3 desc;

-- O agendamento rodou?
select status, return_message, start_time from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'en-rastro-resumo')
 order by start_time desc limit 5;

-- O que o resumo diz
select * from public.en_painel_uso order by dia desc limit 14;
select * from public.en_painel_funil order by coorte desc, oferta limit 40;
select * from public.en_painel_volta order by turma desc limit 30;
```
⛔ Nunca `select ... from en_events` sem `where dia_local = ...` (ou sem `customer_id`). Nunca entre 3h e 8h de Brasília.

## Riscos para o login (a `en-api` é a porta de entrada)

O que muda no caminho de quem entra:

1. **Uma consulta a mais em todo retrato** (`en_testes`, em paralelo com as outras, sem repetição). Sem teste ligado, ela lê uma tabela vazia e volta. Se falhar ou não existir: `testes: {}` e o login segue.
2. **O teto do corpo do pedido** continua 2.048 letras para tudo; só a ação `eventos` aceita até 16 mil.
3. **`oferta` e `progress`** fazem uma gravação a mais, em paralelo, que nunca devolve erro.
4. **A ação `eventos`** fica antes do bloco de sessão e não toca em login, acesso nem jornada.

O teste local cobre os quatro (cenários 37 a 40), inclusive "banco sem o SQL 16: login, jornada, pop-up e rezou como antes".

⚠️ **A `en-api` deste repositório parte da v12 que está no ar** (a de 20/11, com a lista do painel em partes). Publicar uma versão antiga do repositório desfaria aquela correção.

## Ordem de publicar

**Banco → função → site.** Cada passo é inofensivo sem o seguinte.

| # | O quê | Quem | Sem o passo seguinte |
|---|---|---|---|
| 1 | `supabase/en/16-rastreio.sql` no SQL Editor da produção | Arthur (nunca entre 3h e 8h) | tabelas vazias, nada muda |
| 2 | `en-api` no painel do Supabase (colar o arquivo, **Verify JWT desligado**) | Arthur | o retrato ganha `testes: {}`; pop-up e rezou já viram passos |
| 3 | site: `rastro.js`, `sesion.js` e as tags nas páginas (1 build) | Arthur | — |
| 4 | agendar o resumo (`cron.schedule`, acima) | Arthur | sem ele, o resumo roda sob demanda |

Fora de ordem também não quebra: a função sem o banco devolve `testes: {}` e não grava; o site sem a função manda pacotes que voltam "Invalid request" e são descartados.

### Ponto de retorno

- **Função:** a v12 de 20/11/2026. Uma cópia exata foi guardada fora do repositório (nota `en-api-v12-no-ar-2026-11-20.ts`, na pasta de notas do chat de 20/11). Voltar = colar esse arquivo no painel. O banco pode ficar como está: a v12 não usa nada do SQL 16.
- **Site:** o deploy anterior na Netlify ("Publish deploy").
- **Sem publicar nada:** o freio de mão, acima.
- **Banco:** o bloco DESFAZER no fim do `16-rastreio.sql` (só depois de voltar a função).

## Provas

| Prova | Como rodar | Resultado em 20/11 |
|---|---|---|
| Teste local da `en-api` (banco de mentira) | `node supabase/functions/en-api/testa-en-api.mjs` | 275 conferências, 0 falhas (eram 219 antes do rastreamento) |
| Teste local do `rastro.js` (navegador de mentira) | `node supabase/en/testes/testa-rastro.mjs` | 45 conferências, 0 falhas |
| Ponta a ponta no banco de TESTE | `prova-rastreio-no-teste.sql` (PREPARAR) → `node supabase/en/testes/prova-rastreio-no-teste.mjs` → CONFERIR → LIMPAR | 26 conferências, 0 falhas, na `en-api` v2 do TESTE (idêntica ao arquivo) |

(`node` = `"C:\Program Files\nodejs\node.exe"` nesta máquina.)

O que o banco de TESTE mostrou em 20/11, com 6 clientes de mentira:
- 35 passos gravados (32 da tela, 3 do servidor), todos com a versão do teste e com dia e hora no fuso de Chicago; nenhum com `@`, nenhuma página com `?` ou `#`.
- A mesma versão do teste em três entradas seguidas; a cliente que já tinha o Cântico ficou fora do teste "só para quem não tem".
- Funil dos Arcanjos: 5 clientes, 5 viram o card, 3 tocaram, 3 chegaram à página, 2 deram play, 1 viu o botão, 1 tocou em comprar, 1 comprou (venda de mentira), 1 viu e tocou no pop-up. A cliente com o card "liberado" não entrou.
- Rodar o resumo duas vezes deu o mesmo resultado (207 linhas, 357 passos contados).
- O freio por cliente travou depois de 600 passos em 10 minutos.
- O agendamento do `pg_cron` foi aceito e removido em seguida. **Ele não chegou a disparar sozinho**: isso só se vê depois de agendar de verdade.
- A primeira rodada da prova, logo depois de publicar a função, falhou num login; a segunda passou inteira. Não achei a causa (o login na mão, entre as duas, funcionou).
- O banco de TESTE foi limpo no fim (bloco LIMPAR).

Não foi provado: o registrador num celular de verdade (as páginas ainda não carregam o `rastro.js`) e o tempo do resumo com volume real.

## O que falta decidir

1. **Retenção da tabela bruta:** 90 ou 45 dias.
2. **Agendar o resumo** pelo `pg_cron` (proposta acima) ou rodar sob demanda.
3. **Cota de chamadas:** conferir o consumo de hoje antes de ligar. Se estiver apertado, mandar só na saída da página.
4. **Quais cards mandam `card_visto`:** todos ou só os que vendem.
5. **Passos de quem não está logada** (a tela de entrar, a página de venda aberta): hoje não são gravados, porque não há cliente para ligar.
