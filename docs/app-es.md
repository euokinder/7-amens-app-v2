# App em espanhol (7 Amenes de la Madrugada) - plano de execução

> Criado em 05/11/2026. Fonte de verdade do app da LATAM.
> Área de trabalho: worktree `D:\Downloads Certos\PkScale\7amens-latam-app`, branch `latam-app`, nascida da `origin/main` (de37a6c).

## Em uma frase
A cliente que compra o "7 Amenes de la Madrugada" (KashPay → Whop) recebe, além dos PDFs, um app em espanhol: entra com o e-mail da compra e reza uma oração por dia, no mesmo desenho do app brasileiro.

## A regra que manda em tudo: o Brasil não sente NADA
Decisão do Caio (05/11): mesmo Netlify, mesmo repositório e mesmo Supabase, com regras que não deixam embolar.

1. **Site: tudo da LATAM começa com `es`.**
   - Páginas: `es.html` (abre em `/es`) e `es-*.html`.
   - Programação: `js/es/`.
   - Visual: `css/es/`.
   - Imagens e PDFs: `assets/latam/` (já existe na main).
2. **Nenhum arquivo do Brasil muda**, nem o `scripts/build.mjs` nem o `netlify.toml`.
   - O build já copia os `.html` da raiz e as pastas `js`, `css` e `assets`.
   - O cache de um ano já vale para `/js/*`, `/css/*` e `/assets/*`.
   - Para ganhar a impressão digital do build, as páginas `es` apontam para CSS e JS com caminho que começa na barra: `/css/es/app.css`, `/js/es/inicio.js`. Com `../` o build não reconhece.
3. **As páginas `es` não carregam nenhum JS ou CSS do Brasil.** O que servir é copiado para dentro de `js/es/` ou `css/es/`. Mexer num app nunca quebra o outro.
4. **O que fica guardado no navegador usa chaves `amenes-es.*`.** O domínio é o mesmo, então o armazenamento do navegador é dividido com o app brasileiro.
5. **Banco: tabelas `latam_*` no mesmo projeto, criadas por `supabase/latam/01-tabelas.sql`.** Nenhuma tabela, visão, função ou trava do Brasil muda.
   - Não usamos um schema separado porque ele exigiria mudar a configuração da API do Supabase (*Exposed schemas*).
   - Se essa configuração apontar para um schema inexistente, a API inteira cai, com o erro do 28/10 (PGRST002).
6. **Funções próprias:** `latam-api` (entrar, sessão, progresso) e `latam-whop` (o aviso da Whop). A `member-api`, o `hubla-webhook` e o `payt-webhook` não mudam.
7. **Git:** o trabalho fica na worktree `latam-app`. Os arquivos que outros chats mexem na pasta principal (`development`) não entram aqui.
   - Antes do clique de publicar, o `git diff --stat` contra a `origin/main` tem de mostrar **só arquivos novos**, e nenhuma linha brasileira alterada.

## Créditos e limites: nada pode travar
**Netlify.** O crédito é um só para os 3 sites da conta: se acabar, param todos (27/10).
- **Nenhum build para testar.** Tudo é provado no computador (`localhost`), com o banco de teste.
- **Publicação em lote:** 1 build para ir ao ar e, no máximo, 1 de correção. Cada build custa 15 créditos.
- **App só de texto:** sem áudio e sem vídeo. Páginas pequenas, e CSS e JS ficam um ano no celular.
- **PDFs:** o conjunto tem cerca de 2,3 MB. Com 10 vendas por dia, dá ~0,7 GB por mês, ou ~14 créditos. Se crescer, vão para a Bunny.

**Supabase.** A cota de 2 milhões de chamadas por mês é da organização inteira, dividida com o Brasil.
- **O app em espanhol NÃO confere a sessão de 5 em 5 minutos.** O brasileiro confere por causa dos pop-ups. A LATAM confere só ao abrir a página: cerca de 3 chamadas por visita. Os pop-ups (desde 07/11) vêm junto nessa mesma ida ao servidor, e só "apareceu" e "tocou/fechou" custam uma chamada cada (no máximo 3 pop-ups por cliente, na vida inteira).
- **Conta:** 100 clientes ativas × 7 dias × 2 visitas × 3 chamadas ≈ 4.200 chamadas por mês, 0,2% da cota.
- **Nenhuma consulta pesada.** As tabelas são pequenas e há índice no que se procura.

**Banco de teste.** O `localhost` usa o banco de teste (`wyiqwsgfictcfkytldnu`), como no Brasil.

## Como a cliente usa
1. Ela compra na KashPay, que cobra pela Whop.
2. A Whop avisa a `latam-whop` (`payment.succeeded`).
3. A função cria a cliente e o acesso, por 12 meses.
4. O e-mail da KashPay leva a `setemadrugadas.com.br/es`.
5. Ela digita o e-mail da compra e entra.
6. Ela tem a jornada, com uma oração por dia, que abre à meia-noite do fuso dela.

**Regra do aviso da Whop.** A venda da KashPay chega **sem o código do produto** (`product_id` nulo), e o código do preço (`plan_`) muda a cada checkout. Por isso:
- **Pagamento pago na empresa "7 Amenes" (`biz_aTBX1NJKGf65tH`) = acesso ao app.**
- A exceção é "As 3 Madrugadas de Intercessão" (`prod_5j3iKMwnWInbK`), produto do Brasil que está na mesma empresa da Whop. Esse pagamento fica `ignored`.

## Decisões
| Assunto | Decisão | Quando |
|---|---|---|
| Separação | mesmo Netlify, Supabase e repositório, com as regras acima | Caio, 05/11 |
| Prazo do acesso | 12 meses a partir da compra, como diz a venda | recomendação, adotada para começar |
| Reembolso e disputa | **não** tiram o acesso; ficam só registrados (como na Payt). Tirar é à mão | recomendação, adotada para começar |
| Conteúdo da versão 1 | só texto: Comienza aquí (Día 0), os 7 días, Padre Nuestro e "dos lados"; PDFs para baixar. Ficam fora: grupo e Mensagem do Dia. **Os Arcángeles (UP01) e o Cántico (UP02) entraram em 07/11** (ver "Os extras dentro do app") | recomendação, adotada para começar; extras: Caio, 07/11 |
| Trava | uma oração por dia, contando do primeiro acesso, à meia-noite do fuso do celular dela (guardado no primeiro acesso e conferido pelo servidor; sem fuso válido, vale `America/Mexico_City`). Oração concluída nunca volta a trancar | recomendação, adotada para começar |
| Idioma | "tú"; "Sanación"; "Material de regalo"; Padre Nuestro na versão litúrgica latino-americana | Caio, 01/11 |
| Suporte em espanhol | ⏳ **falta**: canal e quem atende | antes de ir ao ar |
| Revisão do espanhol | ⏳ **falta**: uma pessoa nativa revisa | antes de ir ao ar |

## Problemas previstos e como cada um é tratado
| Problema | Como evitamos |
|---|---|
| Mudar algo do Brasil sem querer | prefixo `es`, worktree separada, `git add` só de arquivos novos, e conferência do `--stat` antes do clique |
| O crédito da Netlify acabar | nenhum build para testar; 1 build para ir ao ar; cache de um ano; app só de texto |
| A cota do Supabase | sem conferência de 5 em 5 minutos; a conta fica abaixo de 0,5% da cota |
| A API do Supabase cair por configuração | tabelas `latam_` no schema que já existe; nenhuma configuração muda |
| O mesmo navegador abrir os dois apps | chaves próprias (`amenes-es.*`) |
| O agente não pode escrever na produção | o Caio cola o SQL e as funções, um passo por vez, depois de tudo provado no teste |
| Função nova nasce com o JWT ligado, ou com nome inventado | escrever o nome antes do *Deploy* e desligar "Verify JWT" (lição de 16/10) |
| O aviso da Whop vir sem e-mail, ou num formato diferente | o formato foi conferido nas vendas reais, lidas pela API da Whop. Um *Send test event* no dia de ir ao ar confere o envelope e a chave. O aviso inteiro fica guardado, para refazer, e o que falta vira `needs_review`, nunca acesso adivinhado |
| Aviso repetido | a chave é o `webhook-id`, e a gravação usa `on_conflict` (lição de 16/10) |
| Compra de teste com cartão da equipe | **nunca**: a Whop marca como fraude e prende o saldo |
| Cliente digitou o e-mail errado na KashPay | o suporte corrige (Bloco 6); até lá, há SQL pronto para o Caio |
| Cliente da LATAM entra pelo login do Brasil | o e-mail da KashPay leva direto a `/es`; o login do Brasil não muda |
| Textos em espanhol ficam públicos | aceito (o repositório é público, como os textos do Brasil) |
| Trava no fuso errado | o fuso é guardado no primeiro acesso e conferido pelo servidor |
| O Google indexar o app | `noindex` no próprio HTML das páginas `es` |
| A página antiga `/materiales` | continua no ar e recebe os PDFs corrigidos (`-v2`) na mesma publicação |

## Os blocos
Cada bloco termina provado, antes do seguinte. Do Bloco 0 ao 4, o custo é zero.

| Bloco | O quê | Quem | Situação |
|---|---|---|---|
| 0 | Worktree `latam-app` e este plano | agente | ✅ 05/11 |
| 1 | Tabelas `latam_*` (`supabase/latam/01-tabelas.sql`) no banco de TESTE, conferidas: 8 tabelas com RLS, sem leitura para `anon`, e as recusas certas | agente | ✅ 05/11 |
| 2 | Funções `latam-api` e `latam-whop`, com teste automático, publicadas no projeto de TESTE | agente | ✅ 05/11 |
| 3 | Telas em espanhol: `es.html` (início e jornada), `es-entrar.html` (e-mail e link de entrada) e `es-dia.html` (a oração em texto, "Ya recé" e o PDF). Os textos saem dos PDFs (`_montagem/dias_es.py` e `materiais_es.py`). Visual creme, dourado e preto, com letra grande (skill `ux-45mais`), provado em tamanho de celular | agente | ✅ 05/11 |
| 4 | Prova completa no teste. **Mudou em 05/11:** apontar um webhook da Whop para o TESTE levaria vendas REAIS (e-mails de clientes de verdade) para o banco de teste, onde não pode haver cliente real. O formato do pagamento já foi conferido nas vendas reais, lidas pela API da Whop (`customer_email`, `account_id`, `paid_at`, `product_id` nulo), e o caminho todo (venda assinada → login → trava → "Ya recé") foi provado no teste nos Blocos 2 e 3. O que só um aviso de verdade mostra (o envelope e a leitura da chave) fica para o passo (e) do Bloco 5 | agente | ✅ 05/11 |
| 5 | Ir ao ar, nesta ordem (cada passo é inofensivo sem o seguinte): (a) SQL na produção; (b) as 2 funções pelo painel, com o nome antes do *Deploy* e o JWT desligado; (c) segredo `LATAM_WHOP_SECRET`; (d) site, com 1 build; (e) webhook da Whop → produção (eventos `payment.succeeded`, `refund.created`, `refund.updated` e `dispute.created`), com **um** *Send test event*: conferir em `latam_whop_events` se chegou `processed` e qual leitura da chave conferiu, e depois apagar a cliente de mentira que ele cria; (f) carga das compradoras de antes, lidas da Whop, com o SQL **fora do repositório**; (g) link do app no e-mail da KashPay | Caio clica, agente prepara | ⏳ |
| 6 | Suporte: achar a cliente, liberar à mão, corrigir o e-mail e gerar o link de entrada | agente | depois de ir ao ar |
| 7 | Primeira semana: avisos `processed` e nenhum `failed`; o consumo da Netlify, uma vez | agente | depois de ir ao ar |

## O roteiro do Bloco 5: ir ao ar (preparado em 06/11, 00:05)
**Conferido antes:**
- a `origin/main` não andou desde a base (`de37a6c`);
- os 3 commits da LATAM estão na branch;
- montando o site da `main` e o da `latam-app`, **só mudam arquivos da LATAM** (`es*.html`, `js/es`, `css/es`, `materiales.html` e `assets/latam/pdf`); todo arquivo do Brasil sai idêntico;
- na produção não há nada `latam_` nem função `latam-*`;
- o ponto de retorno da Netlify é o deploy `6aece0118531e61c70fce54c`.

Os PDFs antigos continuam nos endereços antigos, com o texto corrigido, para nenhum link já mandado dar 404.

Um passo por vez, com foto. Cada passo é inofensivo sem o seguinte, e nenhum toca no Brasil. Nada entre 3h e 8h de Brasília.

| # | Quem | O quê | Como conferir |
|---|---|---|---|
| 1 | Caio | SQL Editor da produção ← `supabase/latam/01-tabelas.sql` (o agente põe na área de transferência) | consulta de leitura: 8 tabelas `latam_` com RLS |
| 2 | Caio | *Edge Functions → Deploy a new function → Via Editor*: nome **`latam-api`** escrito ANTES do Deploy; colar o `index.ts`; depois *Settings* → desligar "Verify JWT" | `list_edge_functions`: `latam-api`, `verify_jwt: false` |
| 3 | Caio | o mesmo para **`latam-whop`** | idem |
| 4 | Caio | Whop → *Developer → Webhooks → Create*: URL `https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/latam-whop`, eventos `payment.succeeded`, `refund.created`, `refund.updated` e `dispute.created`. Copiar o segredo `ws_…` | — |
| 5 | Caio | Supabase → *Edge Functions → Secrets*: **`LATAM_WHOP_SECRET`** = o `ws_…`. O agente nunca vê o segredo | — |
| 6 | Caio | *Send test event*, uma vez | `latam_whop_events`: `processed` e qual chave conferiu. Depois, apagar a cliente de mentira (SQL do agente, colado pelo Caio) |
| 7 | Caio | **1 clique**: commit e `git push origin HEAD:main`, na worktree. É **1 build** | o agente confere `/es`, `/es-entrar`, `/materiales` e uma página do Brasil no ar |
| 8 | Caio | SQL da carga de quem comprou antes do webhook, gerado pelo agente a partir da Whop. Fica **fora do repositório** | contagem de acessos `import` |
| 9 | Caio | KashPay → e-mail de compra e página depois do pagamento com `setemadrugadas.com.br/es` (e a `/materiales`) | o agente lê no painel |

Entre o passo 4 e o 5, uma venda real recebe 401, e a Whop tenta de novo por 3 dias, então nenhuma venda se perde. As vendas de antes do webhook entram pelo passo 8.

**O que aconteceu na madrugada de 06/11 (horário de Brasília):**
- ✅ **Passo 1:** SQL colado pelo Caio. O SQL Editor avisou "creates tables without enabling RLS" porque não enxerga o laço que liga o RLS; a escolha foi "Run without RLS" (o script como provado). Conferido: 8 tabelas com RLS, 1 política cada, `anon` e `authenticated` sem leitura, e a função `latam_allow_login` sem execução para `anon`.
- ✅ **Passos 2 e 3:** `latam-api` v1 e `latam-whop` v1, com `verify_jwt: false`. Conferido:
  - login com e-mail inexistente → 403 em espanhol;
  - aviso sem assinatura → 401;
  - as 3 funções do Brasil continuam na mesma versão.
- ✅ **Passos 4 e 5:** webhook da Whop criado na empresa 7 Amenes, com os eventos `payment.succeeded`, `refund.created/updated` e `dispute.created/updated`. Segredo `LATAM_WHOP_SECRET` gravado pelo Caio no Supabase.
- ✅ **Passo 6:**
  - **Os 2 testes da Whop:** a assinatura conferiu com a leitura **"texto"** (o segredo `ws_…` usado como texto). O teste vem com a empresa `biz_xxxxxxxxxxxxxx` e o e-mail `…@shinetime.example`, por isso a função o marca `ignored` e não cria cliente nenhuma. **Não há nada para apagar.**
  - **Uma venda REAL**, a primeira depois do webhook (01:07, US$ 37, KashPay), chegou e ficou `processed`: app liberado até 06/11/2027. O aviso real traz `customer_email`, `paid_at` e `metadata.kashpay_checkout_id`.
- ✅ **Passo 7:** publicado pelo Caio às 01:17, no deploy `6aed54b9d7076544f8de5ec2` (commit `c7b12c8`). A Netlify registrou só as 4 páginas da LATAM e os arquivos delas.
  - O primeiro envio caiu ("curl 55, Connection was reset", com a internet a 83 KB/s). O segundo passou com `git -c http.version=HTTP/1.1 -c http.postBuffer=157286400 … push`.
  - Conferido no ar: `/es` leva a `/es-entrar`, a página fala com a `latam-api` da produção (sem erro de CORS) e o e-mail inexistente recebe a mensagem em espanhol. `/login` do Brasil, 200.
- ✅ **Passo 8:** carga colada pelo Caio, com o SQL fora do repositório. Liberou:
  - **8 compradoras de antes do webhook**, com `source = 'import'` e 12 meses a partir do pagamento;
  - **as 4 administradoras do Brasil**, a pedido do Caio: `source = 'manual'`, sem prazo, lidas de `member_admins` e só gravadas nas `latam_`. **Admin nova no Brasil = rodar de novo esse bloco.**
  - ⚠️ Uma das 8 compras, a "do Rio" (`pay_kLqR2wYd07MaE0`), foi feita com o e-mail de uma administradora: era compra de teste da equipe, com cartão de verdade, na Whop real. No estudo das regras, esse é o risco nº 1 de saldo preso. Não repetir.
- **Na produção, em 06/11:** 12 acessos (1 `whop` + 8 `import` + 3 `manual`) e 3 avisos da Whop (1 `processed` + 2 testes `ignored`).

## As funções (Bloco 2)
**`latam-api`** (`supabase/functions/latam-api/index.ts`)
- **Ações:** `login` (e-mail), `entry` (link de entrada), `session`, `progress` (`{day, done}`) e `logout`.
- **Sessão:** vai no cabeçalho `x-latam-session` (64 letras; o banco guarda só a impressão digital) e dura 90 dias.
- **Retrato devolvido:** `cliente.nombre`, `hoy`, `zona`, `abierto` (até que dia está aberto, de 1 a 7), `completados` e `acceso_hasta` (dd/mm/aaaa).
- **A trava é calculada no servidor:** `abierto = mín(7, máx(1, 1 + dias desde o primeiro acesso, maior dia marcado))`, contando no fuso dela. Marcar um dia ainda fechado devolve 409.
- **Mensagens em espanhol.** A tela chama a função só ao abrir a página.

**`latam-whop`** (`supabase/functions/latam-whop/index.ts`)
- **Regra:** `payment.succeeded` da empresa `biz_aTBX1NJKGf65tH` libera o app por 12 meses a partir de `paid_at`. Compra repetida estica o prazo, e aviso atrasado nunca encurta. Compra nova reativa quem foi retirada à mão.
- **O que não libera:**
  - produto de outra porta (`prod_5j3iKMwnWInbK`) e outra empresa: `ignored`;
  - sem e-mail: `needs_review`;
  - reembolso e disputa: `ignored`, e o acesso fica;
  - falha do banco: 500 (a Whop tenta de novo) e o aviso fica `failed`.
- **Assinatura:** Standard Webhooks, com o segredo **`LATAM_WHOP_SECRET`**, nome próprio da LATAM.
- ⚠️ **No banco de TESTE**, enquanto esse segredo não estiver configurado lá, vale um segredo de ensaio escrito no código. Ele nunca vale na produção, que sem o segredo recusa tudo (401).
- ⚠️ ***Send test event* no webhook da PRODUÇÃO cria uma cliente de mentira.** Usar **uma vez só**, no passo (e) do Bloco 5, e apagar a cliente logo depois. Nunca apontar o webhook da Whop para o projeto de TESTE: ele receberia as vendas reais, e o banco de teste não pode ter cliente real.

**Provas** (o `node` desta máquina não está no PATH: `"C:\Program Files\nodejs\node.exe" <arquivo>`)

| Arquivo | Onde roda | O que confere | Resultado em 05/11 |
|---|---|---|---|
| `supabase/functions/latam-whop/testa-latam-whop.mjs` | banco de mentira | assinatura, repetição, prazo, produto de fora, reembolso, falhas e "nenhuma tabela do Brasil tocada" | 57 ok |
| `supabase/functions/latam-api/testa-latam-api.mjs` | banco de mentira | CORS, login, fuso, freio, trava, "Ya recé", link de entrada, falhas e "nenhuma tabela do Brasil tocada" | 60 ok |
| `supabase/latam/testes/prova-no-teste.mjs` | as funções publicadas no projeto de TESTE | venda → login → sessão → progresso → sair. Imprime o SQL que apaga a cliente de prova | 11 ok; os dados de prova foram apagados |

Publicadas no projeto de TESTE em 05/11 (`latam-api` v1 e `latam-whop` v1, JWT desligado).

## O desenho: cópia do app brasileiro (06/11/2026)
O Caio perguntou por que o app em espanhol tinha outro desenho, e pediu para **duplicar o código do Brasil e adaptar**. Desde 06/11 as telas são cópias:

| Endereço | Cópia de | O que mudou |
|---|---|---|
| `/es` (`es.html` + `js/es/inicio.js`) | `index.html` | Em espanhol. Ficaram o card "7 Oraciones Sagradas", "Tus materiales en PDF" (`/materiales`) e "Escríbenos". Saíram o grupo, a Mensagem do Dia e os extras |
| `/es-novena` (`es-novena.html` + `js/es/novena.js`) | `novena.html` | Os mesmos cards com foto, número, ▶, cadeado e "✓ Oración rezada"; o "Antes de continuar, confirma" do Dia 2 em diante; o Material de regalo |
| `/es-dia?dia=0…7` (`es-dia.html` + `js/es/dia.js`) | `dia.html` | No lugar do vídeo, a foto e a oração completa nos blocos do "Material de Apoio" do Brasil. O "Concluí" virou "Recé esta oración", com o mesmo jeito de marcar e desfazer. O pedido do dia fica só no celular |
| `/es-entrar` (`es-entrar.html` + `js/es/entrar.js`) | `login.html` | Em espanhol. "No sé qué correo usé" leva ao suporte, porque a LATAM não tem CPF |

- **Visual:** `css/es/app.css` é a cópia de `css/styles.css` (inteiro) mais o que estas telas usam do `css/member.css`.
- **Efeitos:** `js/es/app.js` é a cópia do `js/app.js` (foco ao rolar, confirmação, voltar ao topo e luz nos cards).
- **Por que cópia, e não link:** os arquivos do Brasil não são carregados, então mudar o Brasil não muda a LATAM. Se o desenho do Brasil mudar e a LATAM tiver de acompanhar, é preciso copiar de novo.
- **Fotos:** as das telas são as mesmas do Brasil (`assets/images/…`).

## Os vídeos (desde 06/11/2026)
- **Onde ficam:** na Bunny, na mesma biblioteca dos vídeos de entrega do Brasil ("7 Améns - entregas", 784501). Nunca na Netlify.
- **Onde se ligam:** `js/es/video.js`, uma linha por dia em `VIDEOS` (`{ video: '<ID>', formato: '3:4' }`). É uma cópia do `js/video.js` do Brasil, só com a Bunny, e com os botões do player em espanhol (`lang=es`). O `js/es/dias.js` é gerado e não é tocado.
- **Na tela:** a `/es-dia` põe o vídeo no topo, no lugar da foto. Dia sem vídeo, ou ainda fechado, continua com a foto.
- **Ligados:** Dia 0 (Introducción, 9:20) em 06/11; Dias 1, 2 e 3 em 07/11. Todos em pé (3:4). Os Dias 4 a 7 vêm depois.
- **Nome na Bunny:** todo vídeo da LATAM começa com **`ES · Día N —`** e o nome da oração (ex.: `ES · Día 1 — El Padre Nuestro Completo`). A biblioteca é a mesma do Brasil, e o nome do arquivo que sobe ("Dia 1.mp4") se confunde com os de lá. Renomear assim que subir: no vídeo → *Video info* → *Title*; grava sozinho ao sair do campo. O nome não muda o ID nem o link.
- **Achar o ID:** na Bunny, a miniatura do vídeo tem o ID no endereço; o formato se confere pelo tamanho dela (1080×1440 = em pé, 3:4). O título da página `player.mediadelivery.net/embed/784501/<ID>` confirma qual vídeo é.
- ⏳ **Para a revisão nativa:** a capa dos vídeos escreve "LOS 7 AMÉNES"; em espanhol o plural de *amén* é *amenes*, sem acento (é o nome aprovado do produto).
- **Junto:** a `/materiales` ganhou, no topo, o card "Tu app de oraciones", que leva a `/es`, para quem chega pelo e-mail da compra.

## As telas (Bloco 3, primeira versão, substituída em 06/11 pela cópia acima)
| Endereço | Arquivo | O que faz |
|---|---|---|
| `/es` | `es.html` + `js/es/inicio.js` | **Início:** "Hola, {nome}"; a oração de agora (o Comienza aquí até ela começar; depois, o primeiro dia aberto que ainda não marcou; ou "Por hoy, ya está"; ou a jornada concluída); "Rezaste N de 7"; a jornada (de 0 a 7, com "Abierta", "✓ Ya rezaste" ou "🔒 Se abre mañana"); o Material de regalo (os PDFs); a ajuda; e "Salir" |
| `/es-entrar` | `es-entrar.html` + `js/es/entrar.js` | **Entrada pelo e-mail.** Também recebe o link de entrada `/es-entrar#CÓDIGO`, inclusive com a página já aberta |
| `/es-dia?dia=0…7` | `es-dia.html` + `js/es/dia.js` | **Os sete Amenes**, no roteiro do PDF: cómo rezar, antes de empezar, la oración, después, declaración, "Ya recé" (com "Guardando…") e o PDF do dia. **Dia 0:** a guía de inicio. **Dia trancado:** "Se abre mañana", sem a oração |

- **Os textos** estão em `js/es/dias.js`, **gerado** por `7 Améns LATAM\_montagem\app_es.py` a partir do `dias_es.py`, o mesmo programa dos PDFs. Nunca editar à mão: corrigir lá e rodar `python app_es.py "D:\Downloads Certos\PkScale\7amens-latam-app"`.
- **O resto:** o visual em `css/es/app.css` (o desenho da `/materiales`); a sessão em `js/es/sesion.js`; o endereço do servidor e o contato do suporte em `js/es/config.js`.
  - ⏳ O contato do suporte é **provisório** (`contact@pkscale.com`), até a decisão do canal.
- **Os PDFs corrigidos** (`-v2`) e a `/materiales` apontando para eles vão na mesma publicação.
- **Para ver no computador:**
  1. `"C:\Program Files\nodejs\node.exe" scripts/build.mjs`, dentro da worktree;
  2. abrir o preview `latam-app` (porta 3200, no `.claude/launch.json` da pasta principal);
  3. entrar com a cobaia **`teste.latam@exemplo.com`**, que está no banco de TESTE. O link de entrada dela é `/es-entrar#PruebaEnlace1234`.
- **Provado em 05/11, em tamanho de celular:**
  - e-mail errado (mensagem em espanhol);
  - login com o e-mail em maiúsculas;
  - início no primeiro dia;
  - "Ya la leí", "Ya recé" e "desmarcar";
  - dia trancado;
  - "Por hoy, ya está";
  - sair;
  - link de entrada;
  - os 10 PDFs da `/materiales` e os do app, todos abrindo.

  Gravar o "Ya recé" leva cerca de 1 segundo; antes de as consultas irem em paralelo, levava 4.

## Os pop-ups de oferta (07/11/2026)
Pedido do Caio: "exatamente igual ao Brasil, só traduzindo", nos pop-ups e nas páginas. É a lógica do `member_offer_campaigns` / `claim_member_offer` do Brasil, em tabelas `latam_`.

**As campanhas** (`supabase/latam/03-popups.sql`):

| sort | campanha | equivale no Brasil | quem vê | leva a |
|---|---|---|---|---|
| 9 | `es_cantico_dia_4` | `cantico_dia_4` | a partir do 4º dia de app, sem o Cántico | `/es-oferta-cantico` |
| 10 e 11 | `es_arcangeles_novas_1` e `_2` | `front_novas_1` e `_2` | quem entrou no app a partir do dia em que o SQL rodou, sem extra nenhum | `/es-oferta-arcangeles` |
| 12 e 13 | `es_arcangeles_antigas_1` e `_2` | `front_antigas_1` e `_2` | quem entrou no app antes desse dia, sem extra nenhum | `/es-oferta-arcangeles` |

**As regras** são as do Brasil:
- um pop-up por dia, no fuso dela;
- cada campanha aparece uma vez só (o banco guarda, então outro celular não repete);
- nunca nas páginas de venda;
- não muda o desenho (o CSS é cópia do `css/member.css`, e o `js/es/oferta.js` é cópia do `setupMemberOffer`).

**Quem comprou o quê.** O cruzamento é `latam_whop_events` × `latam_kashpay_events`, pelo número do pedido da KashPay. Na dúvida, ela fica sem pop-up:
- cliente da carga manual (`import`);
- pagamento sem pedido da KashPay que não seja a própria compra do app.

**As páginas** são cópias traduzidas das do Brasil:
- **`es-oferta-arcangeles.html`** copia a das cartas, `oferta-arcanjos.html`. O vídeo é o VSL em espanhol de `currentstoryjournal.com/us-up01` (`vid-6ae515a3c7321bec2b3fc67d`), e as cartas aparecem aos 5:54. O checkout é o da KashPay, `checkout-1793936105790` (US$ 27).
- **`es-oferta-cantico.html`** copia a do Cântico, `oferta-cantico.html`. O vídeo é o de `/us-up02` (`vid-6ae55235a1db2408a3689b3c`), e o botão aparece aos 8:53. O checkout é `checkout-1793936605002` (US$ 27).
- **O preço na revelação das cartas:** "de US$ 69 por US$ 27" (Caio, 07/11). No Brasil aparece "de R$ 197 por R$ 137".
- ⚠️ **O UP02 da LATAM é o Cántico, como no Brasil.** Na KashPay ele se chamava "Novena a la Virgen Desatanudos" por engano. Na tarde de 07/11 o Caio trocou o nome para "Cántico Angelical", no produto e na oferta. Antes disso, a oferta `a4dfdd71-87e9-4cca-b7e6-08b4a4892321` entrou em `latam_kashpay_offers`: o `latam-kashpay` reconhece o produto pelo nome e só consulta o id quando o nome não bate. Por isso o rastreio grava `desatanudos` em `latam_kashpay_events.produtos`: no banco, `desatanudos` quer dizer o Cántico. A 1ª versão do SQL, rodada na produção em 07/11, chamava esse pop-up de Novena (`es_novena_dia_4`). Ela nunca apareceu para ninguém e foi trocada pela `es_cantico_dia_4`.

**A conta:** o toque no pop-up leva `utm_source=app-es&utm_medium=popup&utm_campaign=…&utm_content=…` até o checkout, e a KashPay grava os utm em `latam_kashpay_events`. As consultas de resultado estão no fim do `03-popups.sql`.

**Ordem de publicar:** banco → função → site, e qualquer ordem é inofensiva.
- Sem a função `latam_claim_offer` no banco, a `latam-api` devolve `oferta: null` e o app segue normal (provado no teste local).
- Sem a `latam-api` nova, o site novo não recebe oferta e não mostra nada.

**No banco de teste** há 7 cobaias `popup.a` … `popup.g@exemplo.com`, uma por situação:
- **a:** só o app, nova;
- **b:** levou os Arcángeles, no 4º dia;
- **c:** antiga, com 1 pagamento sem pedido da KashPay;
- **d:** dois pagamentos sem pedido da KashPay;
- **e:** carga manual;
- **f:** levou o UP02 (o Cántico);
- **g:** só o app, no 4º dia.

⚠️ Logo depois de publicar a `latam-api` no projeto de teste, a primeira chamada deu 401 do banco, e a segunda já funcionou. Se acontecer na produção, esperar um minuto e conferir de novo, antes de achar que quebrou.

## O painel da LATAM (`/es-admin`, 07/11/2026)
Pedido do Caio: um painel só do app em espanhol, com as mesmas funções do painel do Brasil e sem que um interfira no outro.
- **Onde:** `es-admin.html` + `js/es/admin.js` + `css/es/admin.css`. São cópias adaptadas de `admin.html`, `js/admin.js` e `css/admin.css`.
- **Servidor:** as ações `admin_*` da `latam-api` (painel, ficha, liberar, revogar, corrigir e-mail, link de entrada). Elas leem e gravam só tabelas `latam_`.
- **Banco** (`supabase/latam/04-admin.sql`):
  - `latam_admins` diz quem entra;
  - `latam_admin_actions` guarda o histórico com quem fez;
  - `latam_admin_customers()` monta a lista;
  - `latam_admin_offers()` monta os números dos pop-ups.
- **Quem entra:** as mesmas 4 administradoras do Brasil (Caio, 07/11). A carga lê a `member_admins` só para achar os e-mails, que não ficam escritos no repositório. Daí em diante as duas listas são independentes. A administradora entra pelo login do app em espanhol, com o e-mail dela.
- **Liberar na mão** dá 12 meses, como a compra. Quem já tinha um prazo maior não perde nada.
- **Os extras** (Arcángeles e Cántico) são entregues por e-mail, então o painel mostra quem comprou e não tem botão de liberar.
- **Corrigir o e-mail** também troca o e-mail nas compras dela (`latam_whop_events.customer_email`). Sem isso, ela "perderia" o que comprou, no painel e na escolha dos pop-ups.
- **Em português:** quem usa o painel é a equipe. A mensagem pronta do link de entrada é em espanhol, porque vai para a cliente.

## Os extras dentro do app (07/11/2026)
Pedido do Caio: o UP01 e o UP02 dentro do app em espanhol, "seguindo o mesmo esquema do Brasil, fazendo igualzinho o layout". As vozes ele grava à parte (outra conversa transcreve os 19 áudios do Brasil e escreve os roteiros); os PDFs e todo o desenho vão antes.

✅ **Ajuste no mesmo dia (07/11, à noite):** o botão "Ver las oraciones" da Central (texto fora do lugar) e o PDF em todas as orações e dias. 1 build.

✅ **NO AR desde 07/11/2026, ~17:25 (Brasília):** banco (`05-extras.sql`, colado pelo Caio), `latam-api` **v6** (colada pelo Caio, JWT desligado) e site (deploy `6aef8905465d856e678db524`, commit `7a8ded4`). Ponto de retorno: o deploy `6aef7793…`. Contagem no banco na hora de publicar: Arcángeles 68 (52 pela compra + 16 pela dúvida), Cántico 36 (20 + 16).

**Decisões do Caio (07/11):**
- **Arcángeles: 4 arcanjos, igual ao Brasil** (Miguel, Gabriel, Rafael e Uriel, 3 orações cada). O PDF em espanhol, que só tem os 3 que a Igreja nomeia, entra como material de regalo.
- **Cántico: o PDF da Novena a la Virgen Desatanudos vai junto**, de regalo. Quem comprou o UP02 até 07/11 recebeu esse PDF por e-mail, porque o checkout tinha esse nome.
- **Venda sem registro do produto (antes de 06/11, 22:54): libera os dois.** Esconder algo pago gera reclamação na Whop, o maior risco da conta.
- **Vai ao ar antes das vozes, só com os PDFs.** A tela de cada oração mostra "Audio en preparación" até a voz chegar.

**Como a cliente vê** (cópia do Brasil):
| Quem | Na home ("Contenidos Exclusivos") | Ao tocar |
|---|---|---|
| Tem o extra | "DISPONIBLE", "Acceder al contenido" | entra (`/es-arcangeles` ou `/es-cantico`) |
| Não tem | "🔒 EXTRA", "Adquirir" | página de venda (`/es-oferta-arcangeles` ou `/es-oferta-cantico`), com `utm_medium=card&utm_content=card-home` |
- A frase "Los contenidos con 🔒 son extras..." some para quem tem os dois.
- Quem abre a página de um extra que não tem, por link, vê o convite "Conocer…" (`utm_content=link-directo`), como no Brasil.
- **O Cántico:** introdução + 7 dias, um por dia, com a **mesma âncora e o mesmo calendário das madrugadas** (como no Brasil: quem compra depois de uma semana encontra os 7 abertos). "Terminé este día" grava em `latam_cantico_progress`. A Introdução não tem áudio no Brasil e fica fora da lista, como lá.
- **Enquanto a voz não chega**, cada oração e cada dia mostram o quadro "Audio en preparación", com a frase "Ya estamos ajustando el audio…" e um botão de PDF: o dos Arcángeles em todas as 12 orações, e o da Novena Desatanudos nos 7 dias do Cántico (Caio, 07/11: "pra ter alguma coisa e não ficar sem nada"). O dia do Cántico não tem "Terminé" (ainda não há o que terminar). Quando a voz entra (`audioUrl`), o quadro dá lugar ao tocador.

**Os arquivos:**
| O quê | Onde |
|---|---|
| Banco | `supabase/latam/05-extras.sql`: `latam_access` aceita `arcangeles`/`cantico` (só o que o painel faz à mão), `latam_cantico_progress`, `latam_admin_actions` aceita `grant_extra`/`revoke_extra`, e a função `latam_extras()` |
| Servidor | `latam-api` v6: o retrato ganha `extras` e `cantico`; `progress` com `journey: 'cantico'`; o painel ganha `admin_grant_extra` e `admin_revoke_extra` |
| Telas | `es-arcangeles` → `es-arcangel?a=…` → `es-oracion-arcangel?a=…&o=…`; `es-cantico` → `es-cantico-dia?dia=…`; os cards em `es.html` |
| Conteúdo | `js/es/arcangeles.js` e `js/es/cantico.js` (traduzidos do Brasil) |
| Regra da tela | `js/es/extras.js` (card, cadeado, convite e "Audio en preparación") |
| Tocador | `js/es/tocador.js`, cópia do `js/tocador.js` em espanhol, sem cópia do áudio no site |
| PDFs | `assets/latam/pdf/oraciones-santos-arcangeles.pdf` e `novena-virgen-desatanudos.pdf` |
| Painel | ficha da cliente → bloco "Extras no app": a origem (compra, dúvida, à mão, retirado) e "Liberar"/"Retirar" |

**Quem tem cada extra** (`latam_extras`, nesta ordem):
1. **a compra:** o pagamento da Whop cruzado com o pedido da KashPay (a mesma conta dos pop-ups). `desatanudos` = o Cántico;
2. **a dúvida:** sobra um pagamento sem pedido que não é a compra do app → os dois;
3. **o painel por cima:** liberado à mão soma; retirado à mão tira, mesmo de quem comprou.
- A carga manual (`import`) não tem pagamento registrado: os extras dela, se houver, entram pelo painel.
- Reembolso e disputa não tiram o extra, como não tiram o app. O extra não tem prazo próprio.
- ⚠️ Liberar à mão **não** tira o pop-up de oferta daquele extra (o `latam_claim_offer` só olha a compra). Raro, e no máximo 3 pop-ups na vida.

**Rede de segurança:** sem `latam_extras` no banco, ou se ela falhar, a `latam-api` manda `extras: null`, e a tela **abre os dois** (como a trava do Brasil: trancar quem pagou é pior). Provado no computador com a função antiga.

**Ordem de publicar: banco → função → site.** Qualquer ordem é inofensiva: sem o banco, a função nova manda `extras: null` (abre); sem a função nova, o site novo também abre; sem o site novo, ninguém vê os cards.

**Quando as vozes chegarem** (19 áudios: 12 dos Arcángeles e 7 do Cántico):
1. converter (voz mono 96 kbps, como no Brasil) e subir na **Bunny**, nunca na Netlify;
2. em `js/es/arcangeles.js` e `js/es/cantico.js`: o endereço completo em `audioUrl` e apagar o `pendiente`;
3. 1 build. O "Terminé este día" aparece sozinho nos dias com áudio.

## Como voltar atrás
- **Site:** publicar de novo o deploy anterior na Netlify (*Deploys → Publish deploy*), sem build novo. As páginas `es` só existem para quem tem o link.
- **Banco:** a seção "DESFAZER" de `supabase/latam/01-tabelas.sql` apaga só o que é `latam_`.
- **Funções:** apagar `latam-api` e `latam-whop` no painel. O Brasil não usa nenhuma das duas.
- **Extras:** a `latam-api` de antes deles (v5) é a do commit `310073a` (`git show 310073a:supabase/functions/latam-api/index.ts`); sem ela, o site novo abre os dois extras para todas (rede de segurança). O banco pode ficar: a v5 não usa o que ele ganhou. Desfazer o banco: seção DESFAZER de `05-extras.sql`.
- **Pop-ups:** desligar um é `update public.latam_offer_campaigns set enabled = false where key = '…'`, sem build e sem mexer na função. Para voltar a `latam-api` de antes dos pop-ups, use o arquivo do commit `8580d7b` (`git show 8580d7b:supabase/functions/latam-api/index.ts`).
