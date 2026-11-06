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
- **O app em espanhol NÃO confere a sessão de 5 em 5 minutos.** O brasileiro confere por causa dos pop-ups, e a LATAM não tem pop-up. Confere só ao abrir a página: cerca de 3 chamadas por visita.
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
| Conteúdo da versão 1 | só texto: Comienza aquí (Día 0), os 7 días, Padre Nuestro e "dos lados"; PDFs para baixar. Ficam fora: Arcanjos, Cântico, grupo, Mensagem do Dia e Desatadora (que é extra pago na LATAM) | recomendação, adotada para começar |
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

## As telas (Bloco 3)
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

## Como voltar atrás
- **Site:** publicar de novo o deploy anterior na Netlify (*Deploys → Publish deploy*), sem build novo. As páginas `es` só existem para quem tem o link.
- **Banco:** a seção "DESFAZER" de `supabase/latam/01-tabelas.sql` apaga só o que é `latam_`.
- **Funções:** apagar `latam-api` e `latam-whop` no painel. O Brasil não usa nenhuma das duas.
