# Diário de bordo — onde a gente parou

> **Leia isto primeiro, antes de qualquer coisa.**
> O `CLAUDE.md` diz *como as coisas são*. Este arquivo diz *onde paramos*.
> Regra: o mais recente fica em cima. Nada aqui é apagado, só empurrado para baixo.
> Quem lê este arquivo é o `/abrir`. Quem escreve nele é o `/fechar`.
> Atualizado: 2026-09-20

---

## 🔴 Esperando decisão do Caio

Nada anda nestes pontos até ele responder.

| # | Assunto | A pergunta |
|---|---|---|
| 1 | **Publicar o webhook no Supabase** | O conserto que impede o webhook de perder evento está commitado e já foi para a `main` — mas isso **não publica nada**: Edge Function do Supabase sobe por fora da Netlify. Enquanto ninguém publicar lá, o buraco que engoliu a venda de R$ 197 continua aberto. ⚠️ **Corrigido em 19/09:** este item também dizia que o relógio do painel esperava deploy na Netlify. **Já subiu**, dentro do commit `c83eb29` — conferido no conteúdo do arquivo, não no nome. Sobrou só a metade do Supabase. |
| 2 | **Conteúdo pago aberto por link direto** (achado #4 da auditoria) | Quem descobrir o endereço de um áudio ou PDF baixa sem ter comprado. Travar isso dá trabalho e muda a experiência. É decisão de negócio, não técnica. |
| 3 | **Topologia de branches** (achado #5 da auditoria) | Hoje teste e produção saem os dois da `main`. Isso precisa ser separado, mas envolve mexer em configuração da Netlify — e ele pediu para não mexer no que está no ar sem perguntar. |
| 5 | **Atualizar o `CLAUDE.md`?** | Perguntei duas vezes em 19/09 e o Caio não respondeu — então **nada foi tocado lá**. Quatro coisas que este chat descobriu pertencem ao `CLAUDE.md`, não ao diário, porque são "como as coisas são": (a) o `schema-completo.sql` passou a ter **3 visões**, não 2; (b) o código de produto que chega no evento **não é** o do link de checkout (Arcanjos: link `ODOZxlF1tfhee2TkZikI`, evento `5pUr8toveL5R5zR3zyaT`) — é a armadilha do slug, agora comprovada dentro do próprio evento; (c) `invoice.amount` é um **objeto** (`totalCents`), não um número; (d) `funnel_stage` classifica errado quem pula degrau e não deve ser fonte de número nenhum. |
| 4 | **Qual e-mail vale quando a cliente tem dois** | Três clientes têm um e-mail na fatura e outro na conta da Hubla (ver entrada de 18/09 sobre a janela cega). Elas vão tentar entrar com o do recibo, que o app não conhece. Dá para corrigir no painel, mas a pergunta é qual dos dois passa a valer: o do recibo é o que ela lembra; o da conta Hubla é o que o webhook vai continuar mandando nas próximas compras dela. |
| ~~5~~ | ~~**Ligar o conserto do formulário de perfil na produção**~~ | ✅ **RESOLVIDO em 20/09 às 00:35.** O Caio autorizou e o conserto foi aplicado na produção, com conferência. Ver a entrada de 20/09. |

---

## 📦 A FILA DE PUBLICAÇÃO — leia isto ANTES de publicar qualquer coisa

> Escrito em 19/09/2026, 18h. **Quem publicar sobe o trabalho de cinco chats de uma vez**, não só o seu. Esta seção existe para ninguém descobrir isso depois.

### Como está a produção AGORA — conferido, não suposto

| O quê | Situação |
|---|---|
| `setemadrugadas.com.br` | HTTP 200, no ar |
| `7-amens-app-v2.netlify.app` | HTTP 200 |
| `member-api` de produção | **v12**, de 19/09 12:54 |
| `hubla-webhook` de produção | **v4, de 18/09 09:52 — SEM o conserto do evento perdido** |
| Coluna `offered_product_key` no banco de produção | não existe |
| Visão `admin_payment_overview` no banco de produção | não existe |

⚠️ **O webhook que está atendendo as vendas neste momento é o antigo.** Passaram 226 vendas por ele só em 19/09, cada uma correndo o risco que custou a cliente de R$ 197 em 18/09. **Aqui o risco é não publicar, não o contrário.**

### O que está esperando, e quem viu funcionando

| Arquivo | O que é | Quem vê | Testado? |
|---|---|---|---|
| `supabase/functions/hubla-webhook/index.ts` | ⚠️ **metade já está commitada, metade não.** A retentativa e o resgate do evento **estão no `HEAD` e na `main`** (conferido no conteúdo do arquivo). A atribuição do pop-up — 46 linhas — **não está**: é deste chat. As duas metades só valem depois de a função ser publicada no Supabase | ninguém vê, mas é por onde o acesso é liberado | ✅ 45 conferências automáticas |
| `supabase/functions/member-api/index.ts` | a escada UP01→UP02→UP03 e os números da carteira | só o painel | ✅ visto na tela, no banco de teste |
| `admin.html`, `js/admin.js`, `css/admin.css` | seção "Quem comprou o quê" (escada, trava de base pequena, chips UP01/02/03), fuso de Brasília nas datas, e a etapa da cliente deixando de sair de `funnel_stage` | **só o admin** | ✅ visto na tela, celular e desktop |
| `js/member.js`, `index.html`, `css/styles.css` | saudação com o nome da cliente (alterados 19/09 18:16–18:22) | **a cliente** | ✅ pelo próprio chat — contraste medido no navegador; ver a entrada "A saudação passou a chamar a cliente pelo nome" |
| `oferta-arcanjos.html`, `css/oferta.css` | preço antigo riscado e clique da VTurb (17:30–17:31) | **a cliente** | ✅ pelo próprio chat — ver a entrada "O preço da oferta, o clique que a VTurb nunca contou" |
| `supabase/metricas-do-funil.sql` | coluna + visão + resgate das conversões | — | ✅ rodado inteiro no banco de teste |
| `supabase/dados-de-teste.sql` | 12 clientes falsas para validar o painel | — | ⛔ **NUNCA na produção** |
| ~~`supabase/marcar-exibicao-do-formulario-no-banco.sql`~~ | ✅ **JÁ FOI APLICADO NA PRODUÇÃO** em 20/09 00:35, com autorização do Caio, e conferido. **Não precisa entrar nesta fila** — é só SQL, não depende de deploy nem de push. Ver a entrada de 20/09. | | |

Nada disso tem commit. **Está tudo solto no computador do Caio** — se a máquina pifar hoje, some.

⚠️ **Antes de commitar, confira a hora de cada arquivo** (`date -r arquivo`) contra a hora em que o seu chat começou. Neste projeto o `git status` contém trabalho de outras conversas: quem assumir que tudo que está sujo é seu vai commitar o trabalho pela metade de outra pessoa. Lição registrada pelo chat da saudação, que viu 3 arquivos virarem 15 enquanto trabalhava.

### A ordem de publicar

1. **Anotar o ponto de retorno.** Netlify → `7madrugadas` → Deploys → anotar data e ID do último deploy bom. É a única forma de voltar atrás, e voltar não gasta crédito.
2. **Rodar `supabase/metricas-do-funil.sql` na produção** (SQL Editor). Cria a coluna e a visão e recupera as conversões de pop-up já ocorridas — devem ser **exatamente 2**. Se der outro número, parar e conferir antes de seguir.
3. **Publicar as duas funções** no Supabase de produção: `hubla-webhook` e `member-api`. ⚠️ **`verify_jwt` = false nas duas.** O padrão da ferramenta é `true`, e com `true` todo login das clientes passa a dar 401.
4. **Publicar o site** (push na `main` — que atualiza produção E validação ao mesmo tempo, ver o topo do CLAUDE.md).
5. **Conferir na produção, não só enviar:** site 200 · login de uma cliente real abre · painel abre e mostra o Funil comercial · `hubla_events` continua recebendo linha depois da próxima venda.

**A ordem 2 antes de 3 é recomendada, não obrigatória.** A marcação de conversão falha em silêncio de propósito: se a função subir antes do SQL, ninguém fica sem acesso — só a coluna continua zerada.

### O que muda para a cliente

Do lado do painel e do webhook: **nada na tela dela.** O único efeito é a favor — o webhook passa a tentar de novo quando o erro é passageiro e guarda o evento quando falha.
Do lado de `js/member.js`, `index.html` e `oferta-arcanjos.html`: **muda, sim.** É trabalho de outros chats e precisa de conferência de quem o escreveu.

---

## 🟡 Pendente — pode tocar sem perguntar

- 🆕 **16 arquivos alterados e nenhum commitado** (19/09, fim do dia). São **QUATRO** trabalhos diferentes misturados na mesma pasta: o card da oferta (de ontem), o painel de funil comercial (de outro chat que rodou em paralelo), a saudação com o nome e o conserto do formulário de perfil. O Caio pediu um commit único com tudo, o commit foi preparado e conferido, mas ele mandou parar antes de gravar. **Nada foi commitado.** Quem for commitar precisa saber que está levando os quatro de uma vez.
  ⚠️ **Dois arquivos carregam trabalho de mais de um chat ao mesmo tempo**, então não dá para separar por arquivo: `js/member.js` tem a saudação com o nome **e** a retirada do aviso do formulário; `supabase/schema-completo.sql` tem a visão nova do painel **e** a função nova do formulário.
- 🆕 **Olhar a taxa de resposta do formulário de perfil com tempo de estrada** (20/09). Ele estreou hoje à 00:01 e na primeira meia hora foram **4 entregas e 0 respostas completas** — número que não significa nada ainda, porque duas pessoas estavam respondendo naquele instante. A consulta: contar `member_survey_events` contra `member_survey_responses` no banco de produção. Se a taxa ficar baixa de verdade depois de uns dias, o suspeito número um é a pergunta 4 (item abaixo).
- 🆕 **A opção "Por mim mesma" fica escondida na pergunta 4 do formulário** (19/09). Nas perguntas 4, 5 e 6 nem todas as opções cabem na tela do celular, e a barra "Voltar / Continuar" fica fixa no rodapé dando a impressão de que a lista acabou. Nas perguntas 5 e 6 sobra meio cartão aparecendo, o que avisa que tem mais; **na pergunta 4 não** — os cinco primeiros terminam inteiros e o sexto, "Por mim mesma", só aparece rolando. É justamente a resposta de quem reza sozinha, sem filho nem neto. Saída mais barata: subir "Por mim mesma" na lista. O Caio viu este apontamento e respondeu *"muito bom, layout ficou ótimo"* — **não dá para saber se ele recusou a mudança ou se só não comentou.** Perguntar antes de mexer.
- 🆕 **Ver o formulário de perfil num celular de verdade** (19/09). Foi percorrido inteiro no navegador em tela de 375px, tela por tela. Ninguém abriu num aparelho real.
- 🆕 **Ver a saudação com o nome num celular de verdade** (19/09). Foi conferida no navegador em tela de 375px, com nome vindo do banco de teste. Ninguém abriu num aparelho real.
- 🆕 **13 clientes vão ver a saudação sem o nome** (19/09). De 577, duas não têm nome nenhum e umas onze têm nome imprestável (número no meio, uma letra só, nome grudado sem espaço). Elas leem "Olá, que a paz do Senhor esteja com você!", sem nome. Não é defeito, é a saída desenhada — mas dá para arrumar o cadastro delas no painel, se valer a pena.
- 🆕 **O card novo da oferta está só na máquina** (19/09). As 4 cartas lado a lado e os textos novos do título e da instrução não foram commitados. O preço e a classe da VTurb já estão no ar; o card não. Falta decidir se commita e publica.
- 🆕 **Conferir no painel da VTurb se o clique passou a ser contado** (19/09). A classe certa subiu para a produção e está provado que o clique chega até o fim — mas o número só aparece no Analytics da VTurb, e ninguém olhou. Enquanto ninguém olhar, não se sabe se a conta começou.
- 🆕 **Descobrir se o checkout da Hubla avisa que a cobrança é mensal** (19/09). A página de oferta deixou de avisar (decisão do Caio, ver a entrada de hoje). Tentei ler o checkout e **não consegui**: o endereço é o de compra em um clique (`/upsell`) e respondeu só "Já estamos processando a sua compra". Só dá para saber abrindo o link logada como compradora, ou olhando a configuração do produto no painel da Hubla.
- 🆕 **Abrir o painel admin da produção e confirmar com os olhos** (19/09). O conserto do travamento em 500 foi publicado (`member-api` versão 12) e a produção respondeu saudável, mas ninguém viu a tela — conferir isso exigiria entrar como uma cliente real. Basta o Caio abrir o `admin.html` e ver o número de clientes passar de 500.
- **Decidir sobre a headline "O Papa me pediu para mostrar isso pra vocês".** Já está no ar, na página de oferta. A revisão apontou que ela afirma um endosso que não existe, para vender assinatura recorrente, a um público para quem a palavra do Papa tem peso real — risco de estorno e de publicidade enganosa. Copy é decisão do Caio; ele foi avisado duas vezes e optou por seguir. Mudar agora custa um build.
- **A lista dos 26 achados menores da auditoria foi prometida e nunca entregue.** O Caio pediu e não recebeu.
- **Ver o pop-up e a página de oferta com os olhos, no site no ar.** Os dois públicos foram conferidos pelo caminho dos dados em 18/09 (ver a entrada de hoje), e a página foi testada na tela em `localhost` — mas ninguém abriu `setemadrugadas.com.br`, clicou no pop-up e percorreu até as cartas. As variantes de **segunda exibição** (`front_novas_2` e `front_antigas_2`, rótulos `-b`) continuam sem nenhum teste.
- ✅ **A primeira venda vinda do pop-up ACONTECEU.** Esta linha dizia que nenhuma venda tinha vindo do pop-up — era verdade quando foi escrita e **deixou de ser** no mesmo dia: em 19/09 entraram **2 vendas com a etiqueta `utm_medium=popup`**, as duas da campanha `front_novas_1`. O rastreamento está provado com venda real, não só com teste. Conversão medida: 2 em 176 cliques desde que a etiqueta subiu = **1,1%**. A consulta que separa as duas origens está comentada no fim de `supabase/etiquetar-popup-para-medir-venda.sql`.
- **Conferir a etiqueta numa venda de verdade.** Depois que o rastreamento do pop-up estiver ligado, abrir a primeira venda dos Arcanjos na Hubla e ver se o campo "Parâmetros de UTM" traz o nome do pop-up. A documentação oficial da Hubla diz que traz, e o nosso webhook já guarda o evento inteiro — mas **nenhuma venda real passou por esse caminho ainda**.
- **Opcional, economia de peso:** `assets/audio/dia-01-oracao.mp3` está em estéreo 192kbps (4,98 MB). Em mono 64kbps cai para 1,66 MB. Voz falada não perde nada audível. São ~3,3 MB a menos para cada cliente baixar.
- **Avisar as três clientes de e-mail duplo.** `cliente A · e-mail da fatura`, `cliente B · e-mail da fatura` e `cliente C · e-mail da fatura` **não conseguem entrar** — o app as conhece por outro endereço. Não é bug, é a diferença entre o e-mail do recibo e o da conta Hubla. Depende da decisão nº 4 acima para saber qual e-mail gravar.
- 🆕 **Consertar a corrida do 409 ao criar cliente** (19/09). Achado olhando os eventos reais: `gsampaio13@icloud.com` teve o evento marcado como falho às 03:14 com `Database operation failed (409) on customers` — dois eventos da mesma pessoa chegaram juntos e os dois tentaram criar o cadastro; um ganhou, o outro bateu na trava do banco. **Ela está com acesso ativo, ninguém ficou no prejuízo**, porque a compra entrou pelo outro evento. Mas a retentativa que escrevi hoje **não resolve este caso**: ela repete o mesmo pedido, que vai bater no mesmo 409. O conserto certo é outro — ao levar 409 criando cliente, reler o cadastro que o outro evento acabou de criar em vez de desistir. Ofereci ao Caio e ele não respondeu.
- **Conferir o resgate do webhook contra um Supabase de verdade.** A correção foi testada num banco de mentira, escrito por mim a partir do que eu *acredito* que o PostgREST faz. O ponto exato que precisa de confirmação é o comando que grava a linha de falha (`on_conflict=idempotency_key` com `resolution=merge-duplicates`). Se o banco real se comportar diferente, a rede de segurança não abre — e só se descobre na próxima falha. O jeito de confirmar: publicar a função no projeto de **teste** e disparar um evento de mentira. Não depende de decisão nenhuma.
- ✅ **O painel foi visto funcionando, com dados.** Esta linha dizia que o banco de teste não tinha admin nem cliente com visitas. Tem agora: `supabase/dados-de-teste.sql` cria 12 clientes falsas e a operadora `admin.teste@exemplo.com`. Abrir http://localhost:3000, entrar com esse e-mail, e o painel inteiro aparece. Continua sem conferir: as datas na ficha de uma cliente **real**, na produção.
- **Rodar `supabase/metricas-do-funil.sql`** — cria a coluna e a visão que fazem o painel mostrar o funil. Muda a estrutura do banco, então entra junto com a decisão de deploy. Já validado no banco de teste.
- **Rodar `supabase/conferir-acessos-perdidos.sql` depois de cada dia de vendas.** É a rede de segurança que acha quem pagou e ficou sem acesso. Leva segundos e não altera nada.
- **`node` não está no PATH do Windows.** Até alguém acrescentar `C:\Program Files\nodejs`, todo comando precisa do caminho completo. Não é urgente, é chato.

---

## 2026-09-20 — O formulário começou a aparecer sozinho, e o conserto entrou na produção

**Chat:** continuação do chat do formulário, já depois da meia-noite. O Caio escreveu: *"você já upou o forms no site principal? pq ele apareceu pra mim eu acho"*.

### Não, ninguém publicou nada — e era exatamente o previsto

O formulário está no ar desde o deploy de **18/09**. A contagem de dias começou naquele dia, então **20/09 é o terceiro dia** de quem entra todo dia. Ele começou a aparecer sozinho, **à 00:01:38**, sem deploy, sem SQL, sem ninguém apertar nada.

O chat anterior tinha avisado que isso aconteceria hoje. Aconteceu no minuto um.

### Os quatro primeiros, lidos ao vivo às 00:31

| Apareceu | O que a pessoa fez | Quem era |
|---|---|---|
| 00:01:38 | não tocou em "Começar" | cliente |
| 00:22:22 | começou a responder | cliente |
| 00:26:12 | começou a responder | cliente |
| 00:28:27 | abriu e saiu em **4 segundos** | **o próprio Caio** (é admin) |

Todas com exatamente **3 dias de acesso** — a regra funcionando. Naquele momento, **0 respostas completas**, mas duas pessoas estavam com o formulário aberto *naquele instante*, então não dava para concluir nada sobre taxa de abandono. **Quem for ler isto depois: reveja o número com mais tempo de estrada.**

⚠️ **O Caio não vai ver o formulário de novo.** Ele abriu e saiu, e a saída já marca "apareceu". É a regra que ele mesmo escolheu, funcionando contra ele. Foi oferecido devolver o formulário para a conta dele e ele **dispensou** — já tinha visto todas as telas nas capturas.

### ✅ O conserto foi para a produção — autorizado, aplicado e conferido

Com três clientes reais já tendo recebido o formulário pelo mecanismo antigo, o Caio autorizou rodar o conserto na hora.

**Cuidado tomado antes de aplicar:** a definição que estava rodando foi lida do próprio banco (`pg_get_functiondef`) e guardada. Ela usava `language plpgsql set search_path to ''`, **sem** `security invoker` — e o comando aplicado manteve esse cabeçalho idêntico, mudando só o miolo. Menos diferença, menos risco. O arquivo `supabase/marcar-exibicao-do-formulario-no-banco.sql` foi corrigido para bater com o que realmente foi aplicado, e o rollback dentro dele é o texto exato que estava lá, lido do banco, não reconstruído de memória.

**Os dois comandos de permissão do arquivo NÃO foram rodados, de propósito:** `create or replace function` preserva as permissões existentes, e elas já estavam certas. Mexer sem necessidade é risco de graça. Eles ficaram comentados, porque num banco novo continuam necessários.

### A conferência, logo depois de aplicar

| Checagem | Resultado |
|---|---|
| O corpo novo entrou | ✅ |
| A `member-api` (`service_role`) ainda pode executar a função | ✅ — **se isto falhasse, ninguém entraria no app** |
| `anon` continua sem poder executar | ✅ trancado |
| A função roda sem erro (chamada real, na conta do admin) | ✅ |
| Entregou de novo para quem já tinha visto? | ✅ **não** — 0 |
| Eventos duplicados ou re-marcados | ✅ nenhum: 4 eventos, 4 marcados |
| `member-api` de produção | 401 para sessão inválida, 403 para e-mail inexistente — corretos |
| `setemadrugadas.com.br` | HTTP 200 |

**A prova que vale mais que todas:** essa função é a **única** coisa que grava dia de acesso. Três minutos depois da troca, **5 clientes reais tinham registrado visita**, a mais recente 18 segundos antes da consulta. Se a função tivesse quebrado, nenhuma teria entrado.

### Como voltar atrás

O bloco de rollback está comentado no fim de `supabase/marcar-exibicao-do-formulario-no-banco.sql`. Descomentar e rodar no SQL Editor. Volta na hora, **não passa pela Netlify e não gasta crédito**.

### O que NÃO foi verificado

- **Ninguém percorreu o formulário no site de produção com os próprios olhos.** A conferência foi pelo banco e pelo endereço. Fazer isso exigiria entrar como uma cliente real, ou devolver o formulário para a conta do Caio — que ele dispensou.
- **A taxa de resposta ainda não significa nada.** 0 de 4 com o relógio marcando meia hora de vida.

---

## 2026-09-19 (noite) — O formulário de perfil, validado de ponta a ponta

**Chat:** o Caio pediu para "terminar o forms e validar local". Faixa autorizada por ele: **mexer local + escrever no banco de teste**. Nada de commit, nada de publicação.

### A descoberta que mudou o tamanho da tarefa

**Não faltava construir nada.** O formulário de perfil já estava inteiro — as 6 perguntas, o backend, as 4 tabelas no banco, a regra dos 3 dias — e **já está no ar desde o deploy de 18/09** (commits `9711cd0` e `c83eb29`).

E a regra que o Caio descreveu já era, letra por letra, a que estava programada:

| O que ele pediu | O que o banco já fazia |
|---|---|
| Aparecer para todos os clientes | campanha `profile_after_third_visit_day`, sem filtro de produto |
| No terceiro dia | `min_distinct_visit_days = 3` |
| **Sem precisar ser consecutivo** | conta dias **distintos** em `member_visit_days`; pular semanas não zera nada |
| Apareceu uma vez, nunca mais | uma linha por cliente em `member_survey_events` |
| Guardar no banco | `member_survey_responses`, com cada resposta travada numa lista de valores válidos |

### ⏰ Por que ele nunca apareceu para ninguém — e por que isso muda amanhã

A tabela que conta os dias foi criada em **18/09**. Ninguém tem histórico anterior, nem as clientes antigas. Então:

| Dia | Contador de quem entra todo dia |
|---|---|
| 18/09 | 1º dia |
| 19/09 | 2º dia |
| **20/09** | **3º dia — o formulário começa a aparecer sozinho** |

**Isso acontece sem ninguém publicar nada.** A página já está no ar.

### O defeito real que foi consertado

Quem registrava "esta cliente já viu" era o **navegador**: o `js/member.js` disparava um aviso e esperava por ele no máximo 0,9 segundo antes de redirecionar de qualquer jeito.

Numa internet ruim esse aviso se perdia calado. Se a cliente **respondesse**, tudo bem — a resposta fecha o assunto. Mas se ela **saísse sem responder**, o formulário voltava a aparecer. Era o "nunca mais" furando.

**Decisão do Caio, escolhida entre três opções:** marcar no banco, na hora. Agora entregar e registrar são a mesma operação — não depende de rede nenhuma.

O preço, assumido de olhos abertos: se a cliente fechar o app no meio do carregamento, ela perde o formulário para sempre. É mais raro que a falha de rede que isto conserta.

**De brinde, uma corrida que ninguém tinha visto:** com duas abas do app abertas, as duas podiam receber o mesmo formulário. Agora a condição "ainda não apareceu" está dentro do próprio comando de gravação, então a segunda aba encontra a linha já marcada e não recebe nada.

### A prova — 10 conferências, todas no banco de teste

| O que foi testado | Resultado |
|---|---|
| Dispara no 3º dia de acesso | ✅ |
| **Não consecutivo** — dias 01, 10 e 19 de setembro | ✅ entregou |
| Entrega uma vez; 2ª e 3ª tentativa voltam vazias | ✅ |
| A marca "já apareceu" é gravada pelo banco, no mesmo instante da entrega | ✅ mesmo horário, ao microssegundo |
| Pega a cliente em qualquer página (testado entrando pela Novena) | ✅ |
| Fluxo completo, do login à tela — **3 rodadas** | ✅ 3 de 3 |
| As 6 respostas chegam corretas ao banco | ✅ conferidas uma a uma |
| **Saiu sem responder → não aparece mais** | ✅ |
| Já respondeu **e alguém apagar o registro de exibição** → ainda assim não volta | ✅ dupla tranca |
| Volta para a página de onde ela veio | ✅ |
| Build local | ✅ passa |

O layout foi percorrido tela por tela em tamanho de celular e **aprovado pelo Caio**: *"muito bom, layout ficou ótimo"*.

### O que foi alterado, e onde

| Onde | O quê |
|---|---|
| **Banco de TESTE** (`wyiqwsgfictcfkytldnu`) | função `claim_member_survey` trocada; dias de visita falsos criados para as duas cobaias; eventos e respostas limpos no fim |
| **Máquina do Caio** | `js/member.js` (tirado o aviso redundante), `supabase/schema-completo.sql` (receita atualizada), `supabase/marcar-exibicao-do-formulario-no-banco.sql` (**novo**, com rollback pronto) |
| **PRODUÇÃO** | **nada. Nem o banco, nem o site, nem função nenhuma.** |

### Três coisas que enganam e custaram tempo

**1. A tela aparece desbotada e parece erro de contraste — não é.** Aba em segundo plano **congela animação CSS**: a animação fica "rodando" parada no quadro zero, que é transparente. As primeiras capturas do formulário saíram lavadas embora a cor do texto estivesse correta. Antes de fotografar, forçar o fim: `document.querySelectorAll('.profile-screen').forEach(s => s.getAnimations().forEach(a => a.finish()))`.

**2. Quase reportei um defeito que não existia.** Numa rodada a API entregou o formulário e o app não desviou — parecia falha grave, do tipo que faz a cliente perder o formulário sem vê-lo. Era a função do Supabase **respondendo fria**, demorando mais que os 2,5 segundos que eu tinha esperado antes de ler a tela. Confirmado com 3 rodadas limpas e espera folgada: 3 de 3 funcionaram. **Lição: com Edge Function, esperar pouco e concluir é como se inventa bug.**

**3. O app parece travado em "Verificando seu acesso…" no navegador automatizado.** É o `document.hidden`: com a aba em segundo plano o app não gasta chamada de banco, de propósito. Não é defeito para a cliente. Isso obrigou a **simular "aba visível" em todos os testes** — o caminho do código a partir daí é idêntico ao da cliente, mas não é a mesma coisa.

### Dois chats trabalhando na mesma pasta, ao mesmo tempo

Quando este chat começou havia 2 arquivos alterados; no fim, 16. Além dos arquivos, ficou provado que **o banco de teste e o navegador também são compartilhados**: o banco passou de 2 para 15 clientes durante a conversa, e o navegador estava logado como `admin.teste@exemplo.com`, conta criada pelo outro chat.

⚠️ **Para preparar a demonstração, a sessão do navegador foi trocada** para `teste.novas@exemplo.com`. Se o outro chat estava no meio de um teste do painel, ele precisa entrar de novo.

### O que NÃO foi verificado — leia antes de confiar

- **Nada em produção.** Nem o banco, nem a tela, nem se a função de lá se comporta igual à de teste.
- **Nenhum aparelho real.** Tudo foi em navegador de computador, em tela emulada de 375px.
- **Ninguém abriu o painel admin** para ver uma resposta de perfil aparecendo na ficha da cliente.
- **Todos os testes precisaram simular "aba visível"** (ver armadilha 3 acima).

---

## 2026-09-19 (noite) — A escada UP01 → UP02 → UP03, e o painel que parou de confundir

**Chat:** o Caio perguntou a conversão do upsell, o assunto virou painel e terminou em redesenho. Faixa: **mexer local**. Nada publicado em produção.

### ✅ APROVADO E CONGELADO PELO CAIO — não mexa nisto

Ao ver a versão pronta, o Caio disse, textualmente: *"Ficou legal essa versão, não mudaria nada nem vamos adicionar nada não."*

**Isto é uma decisão, não uma pausa.** O desenho está fechado. Um chat futuro que leia a especificação completa (ela tinha 19 blocos; entraram 5) vai encontrar muita coisa "faltando" — **não está faltando, foi recusado**. O mesmo vale para a visão de receita que eu sugeri no fim: foi oferecida e **declinada na hora**.

Se algum dia mudar, quem muda é o Caio, dizendo. Até lá, mexer aqui é desfazer trabalho aprovado.

### 🔴 O número que este chat descobriu

A conversão **sobe** a cada degrau, e isso vira onde investir:

| Degrau | Quantas | De quantas | Taxa |
|---|---|---|---|
| Front → **UP01** | 91 | de 591 | **15,4%** |
| **UP01 → UP02** | 26 | de 91 | **28,6%** |
| **UP02 → UP03** | 13 | de 26 | **50,0%** |
| Só o front, nenhum extra | **500** | de 591 | 84,6% |

**O gargalo é o primeiro degrau, não os últimos.** 500 das 591 nunca levaram extra nenhum. Melhorar o UP03 (melhor taxa, R$ 659 de receita) não move a agulha; atravessar gente do front para o UP01 move.

⚠️ **Ressalva que precisa andar junto com esses números:** ninguém pula degrau (zero clientes têm UP02 sem UP01), mas **isso é imposto pela esteira de vendas** — o extra seguinte só é oferecido a quem levou o anterior. A taxa diz "quantas aceitaram quando foi oferecido", nunca "quantas escolheram entre tudo". A tela fala isso com todas as letras, dentro do bloco.

### O quadro de receita, que apareceu de brinde

O valor está guardado em cada fatura (⚠️ **`invoice.amount` é um OBJETO**, `amount.totalCents`, não um número solto — tratar como número dá erro de tipo no Postgres):

| Degrau | Preço | Receita | Fatia |
|---|---|---|---|
| Front | R$ 197 (302×) e R$ 97 (74×) | R$ 66.710 | **85,3%** |
| UP01 | R$ 137/mês | R$ 9.331 | 11,9% |
| UP02 | R$ 69,90 | R$ 1.481 | 1,9% |
| UP03 | R$ 49,90 | R$ 659 | 0,8% |

Os três extras somados são **14,6%** do faturamento. O front tem **dois preços** em uso (R$ 197 e R$ 97) — dá para medir se o ticket menor leva mais ou menos extras. Ninguém mediu ainda.

### Como o desenho foi decidido

Não foi no chute: 12 agentes em paralelo — quatro mapeando (banco, painel, API, negócio), três propondo com lentes diferentes, três juízes e um crítico de completude. **A crítica derrubou coisa da própria especificação** e achou bugs reais. O que ela pegou e entrou:

| Achado | Onde estava |
|---|---|
| **`funnel_stage` classifica errado quem pula degrau** — cliente com principal + UP02 sem UP01 é impressa como "Somente Front" | `schema-completo.sql:603-609`, usado em `js/admin.js` em dois lugares |
| **Não dividir `comprou` por `clicou`** — os cliques são contados desde sempre, as compras só desde 19/09 00:59. A razão mistura duas janelas e sai menor que a realidade | o card de campanha imprimia isso |
| **`.admin-detail-line` é flex**, por isso as porcentagens de linhas diferentes não se alinhavam — e alinhamento vertical *é* o gesto de comparar | `css/admin.css` |
| **Porcentagem com base pequena mente**: com 26 no UP02 e 13 no UP03, uma pessoa move 8 pontos | o painel exibia tudo igual |

### O que foi construído

- **A escada**, o maior bloco da tela. A barra de cada produto é **sempre proporcional ao total**, nunca ao degrau anterior — se usasse a taxa condicional, o UP02 (28,6% de 91) ficaria quase o dobro do UP01 (15,4% de 591) e a *forma* afirmaria que o UP02 é maior, quando são 26 contra 91. A taxa condicional vive no texto.
- **A trava `taxa()`**, num lugar só: base ≥ 30 mostra a porcentagem em destaque; de 10 a 29 mostra o bruto e a porcentagem pequena com "base pequena"; abaixo de 10 **não existe porcentagem**. Não tem como contornar.
- **Vocabulário único**: UP01/UP02/UP03 em chip escuro, com o nome comercial sempre ao lado e uma legenda fixa. Inclusive no cartão de cada cliente, que agora diz "Front · UP01 · UP02" em vez de "Funil completo".
- **A página reordenada**: carteira primeiro, uso do app depois, pop-up por último (tem 2 vendas e ocupava um dos três cartões maiores). A seção de campanhas deixou de se chamar "funil" — a palavra nomeava duas coisas diferentes em seções vizinhas.
- **Denominador declarado uma vez** no topo, em vez de "de 591" repetido em cada linha.

### A prova

| O quê | Resultado |
|---|---|
| Testes do webhook | 45 passaram, 0 falharam |
| Testes das datas | 4 fusos, todos passaram |
| Build | passa |
| Painel na tela | ✅ celular (375px) e desktop (1200px), sem rolagem lateral, sem texto sobreposto |
| A escada com dados | ✅ 3 → 2 → 1 no banco de teste, com a trava de base pequena funcionando |
| Cartão da cliente | ✅ "Front · UP01 · UP02 · UP03" montado de `active_products` |

### Duas armadilhas que custaram tempo aqui

- **`--surface` não existe neste projeto.** Usei essa variável no chip e ele saiu **preto sobre preto**, invisível. A CSS não reclama: `var()` sem valor simplesmente herda. Os nomes reais estão no `:root` do `css/styles.css` — para texto claro sobre fundo escuro é `--card-ink`. Ficou uma conferência rápida para isso: extrair todo `var(--x)` do CSS e checar se `--x:` existe em algum arquivo.
- **O `document.hidden` do navegador automatizado** trava o app em "Verificando seu acesso…" — já estava registrado pelo chat da saudação, e eu caí mesmo assim. O contorno funciona: redefinir `document.hidden` para `false` e disparar `visibilitychange`.

### O que NÃO entrou, de propósito

- **Cifra em reais no painel.** Não existe coluna de preço em `products`, e o banco guarda se o *acesso* está ativo, não se a *mensalidade* foi paga. `91 × R$ 137` seria o número mais caro de errar. Os valores desta entrada saíram das faturas, por consulta, e cobrem só a era do webhook.
- **Repartir as vendas de UP01 entre pop-up e funil do anúncio.** Só a etiqueta separa, e ela existe desde 19/09 às 00:59.
- **A faixa "últimos 7 dias".** A carga histórica reescreveu `created_at` para a data real da compra, então a base antiga cai dentro da janela e o número sairia parecido com o total.
- **"Onde elas param nas 7 madrugadas".** `completed_prayers` é contagem, e "onde parou" é o maior dia — quem marcou 1,2,3,5,6,7 tem 6 concluídas e não terminou. Precisa de `max(dia)` numa visão nova.

### O que ficou sem verificação — leia antes de confiar

- **O painel nunca foi visto com dados de PRODUÇÃO.** Tudo o que apareceu na tela veio do banco de teste, com 15 clientes inventadas. Os números de produção desta entrada saíram de consulta SQL, não do painel.
- **A trava de base pequena nunca foi vista com base grande.** No teste todas as bases são menores que 30, então só o modo "base pequena" foi exercitado na tela. O modo normal (porcentagem em destaque) foi conferido só por leitura do código.
- **A sintaxe do resgate do webhook contra o PostgREST de verdade** continua sem confirmação — é a mesma pendência desde a manhã.
- **Nenhum commit.** Nada deste chat foi gravado no Git.

### O que mudou no ambiente de teste

`member-api` do projeto de teste subiu para a **versão 5**. O banco de teste ganhou UP02 e UP03 para duas e uma das cobaias, para a escada ter degraus. **Produção: só leitura.**

---

## 2026-09-19 (noite) — A saudação passou a chamar a cliente pelo nome

**Chat:** este. **Faixa dada pelo Caio:** "pode mexer local". Depois autorizou um commit único com tudo, e mandou parar antes de ele acontecer.

### O que mudou

A primeira linha da home era "Bem-vindo(a)". Agora é **"Olá Maria, que a paz do Senhor esteja com você!"**, com o nome vindo do banco.

| Arquivo | O que entrou |
|---|---|
| `index.html` | O texto novo, com `id="saudacao"` próprio |
| `js/member.js` | Pega o nome da sessão, peneira e monta a frase |
| `css/styles.css` | Regra `#saudacao`: tamanho, largura e cor |

### O achado que economizou o trabalho todo

**A `member-api` já devolvia `customer.name` desde sempre** — a tela é que jogava fora. Então isto é mudança só de frontend: **não precisou publicar Edge Function no Supabase**, e portanto não esbarrou no item nº 1 que está travado esperando decisão.

O webhook da Hubla preenche `name`, `first_name` e `last_name` a cada venda. O caminho do dado já existia inteiro.

### Por que o nome passa por uma peneira

Conferido na produção em 19/09: de 577 clientes, 575 têm nome. Mas **27 estão em MAIÚSCULAS, 9 em minúsculas, 5 têm número no meio**, 6 têm uma letra ou duas, e o maior "primeiro nome" tem 32 letras (nome inteiro grudado sem espaço).

Por isso: só o primeiro nome, arrumado para "Maria", e nome que não passa na peneira não vira "Olá ," nem "Olá MARIA123," — cai na versão sem nome, que já está escrita no HTML e se sustenta sozinha. **A peneira foi testada em 20 casos, todos passaram.**

### ⚠️ Mexi na cor, e isso passou do que foi pedido

O dourado daquela linha (`--accent`) dá **2,31 de contraste** sobre o creme do fundo. O mínimo aceitável para texto é 4,5. Passava enquanto a linha dizia só "Bem-vindo(a)" e ninguém precisava ler; agora ela carrega o nome da cliente, para um público de senhoras 45+.

Troquei por um dourado mais fundo, `oklch(0.52 0.14 82)`: **5,08 de contraste**, mesma paleta. Medido no navegador sobre o fundo real, não estimado.

⚠️ **O `--accent-strong` não resolve** — dá 3,97, ainda reprova. E a classe `.eyebrow` original **não foi alterada**, porque ela também veste o título do `admin.html`. O contraste ruim continua lá e em outros lugares que usam `--accent` para texto. **Não foi varrido.**

### A frase quebra sempre em 2 linhas, de propósito

Com `max-width: 30ch`, "Olá Ana" e "Olá Conceição" ocupam as mesmas duas linhas. Sem isso, a home inteira descia um degrau dependendo de quem entrasse.

### O commit que não aconteceu

O Caio autorizou "um commit só com tudo". Foi preparado e conferido — **sem segredo, sem e-mail de cliente, `migration/` e `dist/` fora do versionamento, build passando, 41 testes do webhook passando** — e ele mandou parar antes de gravar. **Nada foi commitado, nada foi enviado, o site no ar não mudou.**

### 🔴 Outro chat estava editando esta mesma pasta ao mesmo tempo

Ao abrir este chat havia 3 arquivos alterados. Ao fim havia **15**. Os que apareceram — `admin.html`, `js/admin.js`, `css/admin.css`, a `member-api`, o `hubla-webhook`, o `schema-completo.sql` e dois SQL novos — **não são deste chat**: foram salvos entre 18:14 e 18:17, enquanto eu trabalhava. São o **painel de funil comercial** (quantas compraram, quantas entraram no app, cliques na oferta, divisão Pix/cartão/boleto) e o registro de conversão do pop-up no webhook.

**Lição para o próximo:** neste projeto o `git status` pode conter trabalho de outra conversa. Antes de commitar, comparar a hora de alteração de cada arquivo (`date -r`) com a hora em que o chat começou. Assumir que tudo que está sujo é seu leva a commitar o trabalho pela metade de outra pessoa.

### Armadilhas novas

| Armadilha | O que acontece |
|---|---|
| **O navegador automatizado marca a página como oculta (`document.hidden === true`)** | O `refresh()` do `js/member.js` desiste quando a aba está oculta, então o app trava para sempre em "Verificando seu acesso…" e a tela nunca abre. Não é defeito para a cliente. Para testar, redefinir `document.hidden` para `false` e disparar `visibilitychange`. |
| **O token da sessão vai no cabeçalho `x-member-session`, não no corpo** | Chamar a `member-api` com o token no JSON devolve 401 e faz parecer que a sessão expirou, quando o errado é a chamada. |
| **O formulário de perfil sequestra a home** | A cobaia do banco de teste não respondeu o perfil, então `index.html` desvia para `perfil.html` e não dá para ver a home. Contorno sem tocar no banco: desligar a chamada do formulário **na cópia `dist/`**, olhar, e recompilar para desfazer. |
| **`dist/` é apagado e refeito pelo build** | Isso é vantagem: remendo feito lá para testar some sozinho no próximo `build.mjs`. Nunca editar `dist/` esperando que dure. |

### O que foi verificado rodando, e o que não foi

| Verificado | |
|---|---|
| O nome sai do banco e aparece na tela | ✅ com a cobaia `teste.novas@exemplo.com` |
| A peneira do primeiro nome, em 20 casos | ✅ todos passaram |
| Contraste medido no navegador, sobre o fundo real | ✅ 5,08 |
| Toda a frase em 2 linhas, com nome curto e comprido | ✅ |
| `node scripts/build.mjs` | ✅ passa |
| 41 testes do `hubla-webhook` | ✅ passam |
| O `admin.html` não mudou de aparência junto | ✅ a `.eyebrow` ficou intacta |

| **Não** verificado | |
|---|---|
| Num celular de verdade | só no navegador a 375px |
| Com nome de cliente real | o banco de teste só tem "Cliente Teste Novas" |
| O contraste ruim nos outros lugares que usam `--accent` | não varrido |

### O que foi mexido no banco

**Nada.** Só duas consultas de leitura na produção (contagem de nomes preenchidos e formato deles) e uma no banco de teste. Nenhuma escrita em lugar nenhum. O login da cobaia no banco de teste gravou uma sessão, como qualquer teste local faz.

---

## 2026-09-19 — Métricas de funil no painel, e a descoberta que derrubou o número que eu mesmo tinha dado

> ⚠️ **O painel descrito nesta entrada foi SUBSTITUÍDO no mesmo dia.** Os cartões "Compraram o upsell" e "Cliques que viraram compra" e a seção "Funil comercial" não existem mais. A versão que vale — e que o Caio aprovou — está na entrada **"A escada UP01 → UP02 → UP03"**, acima. Esta entrada continua aqui pelo que ela registra de *descoberta* (a atribuição do pop-up que estava 5x errada), não pelo desenho de tela.

**Chat:** o Caio perguntou a conversão do upsell, o assunto virou painel e no fim virou correção. Faixa: **mexer local**. Nada publicado.

### 🔴 O ERRO QUE ESTE CHAT CORRIGIU — leia antes de usar qualquer número de pop-up

Durante a conversa eu afirmei ao Caio que **o pop-up convertia 4,1%** (10 compras em 245 cliques) e projetei em cima disso um ganho de **R$ 3.699/mês**. **Estava errado.**

O erro foi de método: eu contei como "conversão do pop-up" toda cliente que clicou no pop-up e hoje tem o produto. Só que os Quatro Arcanjos são vendidos em **dois lugares que caem no mesmo checkout** — o upsell do funil do anúncio (minutos depois da compra principal) e o pop-up dentro do app. Quem comprou o front, abriu o app, clicou no pop-up e fechou a compra pelo funil aparecia como conversão do pop-up sem ter sido.

Medido pela etiqueta que prova a origem:

| Critério | Conversões do pop-up |
|---|---|
| "Clicou e hoje tem o produto" (o meu, errado) | 10 |
| Etiqueta `utm_medium=popup` no evento (a prova) | **2** |

**Cinco vezes menos.** A conversão real é **2 em 176 cliques desde que o rastreamento subiu = 1,1%**, não 4,1%.

### E isto também atualiza a entrada de hoje sobre o rastreamento

Aquela entrada registrou que **nenhuma** venda tinha vindo do pop-up. Era verdade quando foi escrita. **Já não é:** em 19/09 apareceram **as duas primeiras vendas com etiqueta de pop-up**, ambas da campanha `front_novas_1` (`novas-1a-exibicao`). O rastreamento funciona de ponta a ponta — está provado com venda real, não só com teste.

| Pop-up | Cliques desde o rastreio | Vendas com etiqueta |
|---|---|---|
| `front_novas_1` | 96 | **2** |
| `front_novas_2` | 22 | 0 |
| `front_antigas_1` | 48 | 0 |
| `front_antigas_2` | 10 | 0 |

### Uma armadilha achada no caminho, que vale para sempre

**O código de produto que chega no evento NÃO é o da página de checkout.** Os Quatro Arcanjos:

| Onde | Código |
|---|---|
| Página de checkout (o que aparece no link) | `ODOZxlF1tfhee2TkZikI` |
| **Evento da Hubla** (o que chega no webhook) | `5pUr8toveL5R5zR3zyaT` |

Os dois estão no `hubla_product_map` e por isso nada quebrou — mas uma consulta escrita à mão com o código do link volta **vazia**, e parece que não houve venda nenhuma. Foi o que aconteceu comigo antes de eu conferir.

### O que foi construído

| # | O quê | Onde |
|---|---|---|
| 1 | O webhook marca a conversão do pop-up — **só quando a venda chega com a etiqueta** | `hubla-webhook/index.ts` |
| 2 | Seção "Funil comercial" no painel: conversão do upsell, % que entrou no app, cliques que viraram compra | `admin.html`, `js/admin.js`, `css/admin.css`, `member-api/index.ts` |
| 3 | Pix vs cartão, lido dos eventos já guardados — sem coluna nova e funcionando para trás | `supabase/metricas-do-funil.sql` |

**A marcação de conversão falha em silêncio de propósito.** É contabilidade de marketing: se der erro, a cliente recebe o acesso do mesmo jeito e o evento consta como processado. Tem teste só para isso. Também é o que permite publicar a função antes de rodar o SQL sem quebrar nada.

### A prova — rodando, não deduzindo

| O quê | Resultado |
|---|---|
| Testes do webhook | **45 passaram, 0 falharam** (eram 32 de manhã) |
| Testes das datas do painel | 11 conferências × 4 fusos, todas passaram |
| Hook de proteção da produção | 0 falhas |
| `node scripts/build.mjs` | passa |
| SQL do arquivo | rodado inteiro no **banco de teste**, limpo |
| Visual da seção nova | conferido no navegador, celular e desktop: 3 cartões alinhados, sem rolagem lateral, sem texto sobreposto |
| O resgate marcaria quantas? | **ensaiado como consulta de leitura na produção: exatamente 2** — bate com a etiqueta |

### O que foi alterado em banco

**Produção: só leitura.** Nenhuma escrita.

**Banco de TESTE: sim, houve escrita** — coluna `offered_product_key` criada, quatro campanhas apontadas para `upsell_01` e a visão `admin_payment_overview` criada. Foi de propósito, é o lugar certo para validar, e lá não tem cliente nenhuma.

### O que NÃO foi verificado

- ~~O painel com dados de verdade~~ — **resolvido no mesmo chat, mais tarde.** Ver o fim desta entrada.
- **A sintaxe do resgate do webhook contra o PostgREST de verdade** (`on_conflict` + `merge-duplicates`) continua sem confirmação — é a mesma pendência da manhã, não mexi nela.
- **Os 2 são pouco para concluir qualquer coisa.** Dois dias de dados e uma amostra de duas vendas não sustentam decisão de investimento. O que está provado é que o caminho funciona, não qual é a taxa.

### ✅ Depois: o painel foi visto funcionando, com dados

O Caio pediu para validar localmente. Feito, de ponta a ponta.

**O que foi preciso:** o banco de teste nasce vazio, e painel sem dado não prova nada — todo número zerado parece certo. Então entrou `supabase/dados-de-teste.sql`: **12 clientes inventadas** com vendas, visitas, pop-ups e faturas, em proporções escolhidas para cada número dar um resultado **diferente**, conferível na mão. E a `member-api` foi publicada **no projeto de TESTE** (versão 3, ATIVA, `verify_jwt` desligado — sem isso todo login daria 401).

**O resultado na tela, conferido contra o banco linha por linha:**

| Cartão no painel | Na tela | No banco |
|---|---|---|
| Compraram o upsell | 20,0% — 3 de 15 | 3 de 15 ✅ |
| Entraram no app | 66,7% — 10 de 15 | 9 de 15 + o meu login ✅ |
| Cliques que viraram compra | 16,7% — 1 de 6 | 1 de 6 ✅ |
| Cartão de crédito | 75,0% — 3 de 4 | 3 de 4 ✅ |
| Pix | 0,0% — 0 de 8 | 0 de 8 ✅ |

O card da campanha também ganhou a linha `16,7% dos cliques viraram compra`. Zero erro no console, painel abre normal, status some depois de carregar.

**Um detalhe que parece defeito e não é:** "Entraram no app" subiu de 9 para 10 sozinho — porque **eu** entrei. O número mede login, e o meu contou. É o sinal de que ele está medindo o que deve.

**Para entrar no painel local:** `admin.teste@exemplo.com` em http://localhost:3000. Esse e-mail é administrador e tem acesso ao app — as duas coisas são exigidas.

### E aí o Caio achou um buraco no desenho

Olhando a tela pronta, ele perguntou: *"está escrito 'Compraram o upsell' — mas QUAL upsell?"*

Estava certo. São **três** produtos extras, e o cartão mostrava só o `upsell_01`, com um nome genérico. Os outros dois simplesmente não apareciam em lugar nenhum do painel — quem olhasse concluiria que a operação vende um extra só.

Corrigido: o cartão virou **"Compraram algum extra"** (qualquer um dos três) e embaixo entrou a lista **"Quem comprou cada extra"**, com o nome comercial de cada produto e a sua taxa. A lista é montada a partir do catálogo, nunca escrita à mão — quando entrar novena ou jornada de 21 dias, aparece sozinha.

Conferido na tela, no banco de teste: Arcanjos 20,0% (3 de 15), Músicas dos Anjos 0,0%, Comunidade da Fé 0,0%. **Produto com zero continua aparecendo** — é justamente o que o desenho anterior escondia.

Na produção, os números que isso vai mostrar (consulta de leitura, 19/09):

| Extra | Compraram | Taxa |
|---|---|---|
| Oração Celestial dos Quatro Arcanjos | 90 de 589 | **15,3%** |
| Músicas dos Anjos | 26 de 589 | 4,4% |
| Comunidade da Fé | 13 de 589 | 2,2% |

**⚠️ O que isso mudou no projeto de teste:** a `member-api` de lá agora é a versão nova (v4). Se algum chat futuro testar login no localhost e achar comportamento diferente do que está na `main`, é por isso. **A produção continua sem nada disso.**

---

## 2026-09-19 — O preço da oferta, o clique que a VTurb nunca contou e o card novo

**Chat:** este. **Faixa dada pelo Caio:** começou em "faça localmente" e terminou em "pode commitar no main, tem minha autorização".

### O que está no ar — conferido na produção, não só enviado

Commit `db3fba0`, na `development` e na `main`. Deploy **`6aaee9d76242cb0008a8699e`**, situação **ready**. Conferido baixando a página de `setemadrugadas.com.br` e procurando o texto dentro dela:

| O quê | No ar? |
|---|---|
| Preço "de R$ 197 por R$ 137" | ✅ sim |
| Classe da VTurb nas 4 cartas | ✅ sim |
| Card com as 4 cartas lado a lado | ❌ **não** — ficou só na máquina |

📌 **Ponto de retorno**, se a produção precisar voltar: deploy `6aae06d6beafe00008ba580b`, de 19/09 às 00:52. Netlify → projeto `7madrugadas` → Deploys → "Publish deploy". Não gasta build.

### 1. O preço na hora da revelação

Quando a cliente toca numa carta, a linha do preço passou de "R$ 137 por mês" para **"de R$ 197 por R$ 137"** — o 197 riscado em vermelho, o 137 em verde e maior.

Vermelho e verde puros ficam sujos sobre o roxo do painel. Os dois tons (`#ff8f8f` e `#7ee787`) foram **medidos** contra as três faixas do fundo e passam no contraste com folga, na mesma altura do dourado que já existia.

### 2. ⚠️ O aviso de cobrança mensal saiu da tela — decisão do Caio

**Isto é o que mais importa nesta entrada.** O produto `upsell_01` é **assinatura mensal de R$ 137**, não pagamento único. A página tinha avisos disso, e todos saíram a pedido do Caio, em duas etapas:

| Frase | Estado |
|---|---|
| "Cobrança mensal, até você cancelar." | retirada |
| "por mês", colado no valor | retirado |
| "30% de desconto **na sua assinatura**", no título | virou "…de desconto **agora**" |

Ou seja: **hoje a página de oferta não informa a recorrência em lugar nenhum.** O risco (a cliente entende pagamento único, é cobrada de novo em 30 dias e pede estorno) foi apontado duas vezes e ele decidiu seguir. Fica registrado aqui e também num comentário dentro do `oferta-arcanjos.html`, junto do preço, dizendo onde o aviso entra de volta.

**O que não foi possível confirmar:** se o checkout da Hubla avisa. Segui os dois redirecionamentos do link e cheguei em `pay.hub.la/ODOZxlF1tfhee2TkZikI/upsell`, que respondeu apenas "Já estamos processando a sua compra" — sem preço e sem termos. **Não vi o que a cliente vê.** O endereço terminar em `/upsell` indica compra em um clique, com o cartão já salvo, em que pode não existir tela de checkout tradicional. Está na lista de pendentes.

### 3. 🔴 A VTurb nunca contou um único clique nas cartas

O Caio perguntou se a classe de contagem estava lá. **Não estava — e nunca esteve.** `smartplayer-click-event` não existia em arquivo nenhum do projeto.

Consequência: desde que a página subiu, em **18/09**, o Analytics da VTurb mostrava **zero cliques**. Esses cliques estão perdidos, não há como recuperar.

A documentação oficial da VTurb é clara: para contar clique em botão que não é dela, o que vale é **a classe** `smartplayer-click-event` no elemento. Os códigos compridos que cada carta já tinha (`id="7d08c4af-fe10…"`) **não servem para isso** — são identificadores nossos e para a VTurb valem zero. Reforça isso o fato de três dos quatro nem seguirem o formato de código gerado por sistema; parecem escritos à mão. A classe do contrário, para tirar um botão da conta, é `ignore-click-event`.

A classe foi posta nas quatro cartas e já está no ar. Conferido também que o `preventDefault()` do nosso código **não** impede a VTurb de ouvir: o clique sobe até o topo da página. E os 5 segundos de espera antes do checkout são folga de sobra para o registro sair.

**O que falta:** abrir o Analytics da VTurb e ver o número subir. Daqui não dá.

### 4. O card ficou igual ao modelo que o Caio mandou

Ele mandou uma imagem e pediu "exatamente igual". O que mudou:

| | Antes | Agora |
|---|---|---|
| Arranjo | 2 em cima, 2 embaixo | **4 lado a lado** |
| Fonte do título | Georgia (serifada) | Manrope (sem serifa), mais encorpada |
| Título | "Descubra o seu Arcanjo protetor e garanta 30% de desconto na sua assinatura" | "Descubra seu anjo da guarda e receba 30% de desconto agora" |
| Instrução | "…para revelar o seu Arcanjo protetor…" | "…você revelará o seu anjo da guarda e automaticamente ele vai se conectar com você e transformar toda a sua vida." |
| Cor da instrução | dourado | creme claro |

A imagem da carta **já era a mesma** do modelo — não precisou trocar arte nenhuma.

O código trazia um aviso de quem montou o 2×2: "quatro lado a lado deixaria cada carta pequena demais para o dedo". Fui **medir** em vez de acreditar ou descartar: cada carta ficou com **60 × 109 pixels**, contra os 44 que se considera o mínimo confortável para toque. O receio não se confirmou nessa medida. O número ficou escrito no CSS, junto da instrução de como voltar para 2×2 (trocar um `4` por um `2`).

### O que foi verificado rodando, e o que não foi

| Verificado | |
|---|---|
| Cores, tamanhos e textos lidos do navegador em tela de 375px | ✅ |
| Tocar na carta ainda revela o Arcanjo e some com as cartas | ✅ |
| A etiqueta `utm_content` continua chegando nos 4 links | ✅ |
| `node scripts/build.mjs` | ✅ passa |
| A produção serve mesmo o texto novo | ✅ conferido baixando a página |

| **Não** verificado | |
|---|---|
| Se o número de cliques aparece no painel da VTurb | só de lá |
| Se o checkout da Hubla avisa da recorrência | a leitura falhou, ver acima |
| Ninguém abriu `setemadrugadas.com.br` num celular de verdade e tocou numa carta | segue pendente |

### Armadilhas que custaram tempo (para o próximo não repetir)

| Armadilha | O que acontece |
|---|---|
| **`oferta-arcanjos.html` usa quebra de linha do Windows (CRLF); o `css/oferta.css` usa a do Unix (LF)** | Trocar texto com a quebra errada **não encontra nada**, e parece que o trecho sumiu do arquivo. Detectar a quebra do próprio arquivo antes de substituir. |
| **A trava `protege-producao` barra qualquer comando com a palavra "push" dentro** | Até dentro de um texto de `echo`. Barrou uma consulta inofensiva de estado do Git. Escrever o comando sem a palavra. |
| **O `localhost` demora vários segundos no "Verificando seu acesso…"** | Captura de tela tirada cedo demais mostra uma página que parece quebrada, quando só está carregando. Esperar o painel ter tamanho maior que zero antes de medir ou fotografar. |
| **`?previa=1`** | Atalho útil: mostra as cartas na hora, sem esperar os 5:56 do vídeo. ⚠️ Tocar numa carta leva ao checkout **de verdade** depois de 5 segundos. |

### Nada foi alterado no banco

Nenhuma consulta, nenhuma escrita, nenhum `update` no Supabase — nem na produção, nem no teste. Este chat mexeu só em arquivos do site.

---

## 2026-09-19 — Painel admin travado em 500 clientes

**Chat:** este. **Status: ✅ publicado na produção e conferido.** Faixa autorizada pelo Caio: "pode ajustar direto no principal, faça na calma".

### O que estava errado

O Caio viu o painel travado em 500 clientes. A causa era uma linha em `supabase/functions/member-api/index.ts`: o painel pedia ao banco `limit=500`, sempre.

**E era pior que a lista.** Os quatro números do topo — clientes cadastradas, com acesso, perfis respondidos, orações concluídas — eram somados **em cima dessas 500 linhas**, não do banco. Os quatro estavam mentindo.

Como a ordem é da mais recente para a mais antiga, quem sumia eram **as mais antigas**: a base histórica importada da Hubla.

E a busca do painel filtra no navegador, em cima do que chegou. Então procurar uma cliente antiga pelo e-mail respondia "Nenhuma cliente encontrada" **para uma cliente que existe e pagou**. Risco real de atendimento.

**Nada disso afetou o acesso das clientes.** Login e liberação de conteúdo usam consultas diferentes, sem esse limite. Era cegueira do painel, não falha do produto.

### O que foi mudado

Duas mudanças, só no backend. O painel (`js/admin.js`, `admin.html`) **não precisou de nenhuma alteração** — ele já lia os números do resumo e já buscava na lista completa; era a lista que chegava cortada.

1. **Novo `dbTodas()`** — lê o banco em páginas até a última, em vez de parar na primeira. Com trava de 20.000 linhas para nunca virar varredura sem fim.
2. **O painel passou a usar `dbTodas`**, com desempate por `id` na ordenação.

⚠️ **Por que não bastava trocar 500 por 5000:** o banco tem um teto próprio por consulta (normalmente 1000) e corta em silêncio. O painel travaria em 1000 e pareceria resolvido. O `dbTodas` descobre o teto real do servidor na primeira página e se adapta.

### O que foi verificado

A lógica de paginação foi testada contra um banco simulado, 10 casos, todos passaram: banco vazio, 1 cliente, total exato igual ao tamanho da página, teto do servidor menor que o pedido, 2500 clientes, e a trava de 20.000. Conferido também que nenhuma linha se repete nem some na virada de página.

### Verificado no banco de teste — com o problema reproduzido de propósito

Publicado no projeto de teste (`wyiqwsgfictcfkytldnu`) como **versão 2, ATIVA, `verify_jwt: false`**.

O banco de teste só tinha 2 clientes — com 2 clientes o conserto não aparece, porque tanto o código velho quanto o novo devolvem 2. Então o cenário foi montado: **1.200 clientes de mentira** (`carga.teste.N@exemplo.invalid`), todas com acesso principal, mais uma admin.

Resultado, entrando pelo login de verdade e abrindo o painel:

| | |
|---|---|
| Clientes cadastradas | **1202** (era o que existia) |
| Com acesso | 1202 |
| Linhas na lista | **1202** |
| Ids únicos | 1202 — **nenhuma repetida** |
| Passou de 1000? | **Sim** — o teto do servidor foi vencido |
| A cliente mais antiga veio junto? | **Sim** |
| Tempo | 1,5 segundo |

O teste dos ids repetidos foi de propósito o mais cruel possível: as 1.200 foram criadas no mesmo instante, então todas têm praticamente o mesmo horário de cadastro. É exatamente o caso em que a ordenação sem desempate embaralha linhas na virada de página. Nenhuma repetiu.

**Limpeza:** as 1.200 cobaias foram apagadas; o banco de teste voltou a ter 2 clientes. **A admin foi mantida de propósito** — o diário listava "ver as datas corrigidas no painel de verdade" como bloqueado por não existir admin no banco de teste. Agora existe.

### Publicado na produção — 19/09

Ordem pedida pelo Caio: salvar na `development` primeiro, depois publicar.

1. **Commit `853db9a` na `development`** (só `member-api/index.ts` e este diário — o trabalho em andamento de outros chats não pegou carona). Push feito. **Não disparou build:** a `development` não alimenta site nenhum, então custo zero de crédito Netlify.
2. **`member-api` publicada na produção** (`lbaudlocfbjunnaoyrtz`): **versão 12, ATIVA, `verify_jwt: false`**.

Conferência logo depois de publicar:

| Checagem | Resultado |
|---|---|
| A função subiu e responde | HTTP 401 "Entre novamente com seu e-mail." — correto |
| O login fala com o banco | HTTP 403 para e-mail inexistente — correto |
| Origem estranha continua barrada | HTTP 403 — correto |
| `setemadrugadas.com.br` | HTTP 200 |

**Nenhuma cliente real foi usada no teste.** Entrar como uma delas criaria sessão de verdade na conta de uma pessoa, então a conferência usou um e-mail inexistente de propósito — prova que o caminho do login funciona sem tocar em ninguém.

### ⚠️ A `main` ainda não tem este conserto

A produção do Supabase está rodando código que, no repositório, **só existe na `development`**. Se alguém publicar a `member-api` a partir da `main`, **desfaz o conserto sem perceber**. Levar para a `main` custa um build nos dois sites (o arquivo nem faz parte do site), então ficou para ir junto com a próxima leva — mas não pode ser esquecido.

### Como voltar atrás, se precisar

Republicar a versão guardada no commit `588fe6d`:
`git show 588fe6d:supabase/functions/member-api/index.ts`
Leva um minuto, não passa pela Netlify, não gasta crédito.

### O que ainda NÃO foi verificado

- **Os tipos não foram checados:** o Deno não está instalado nesta máquina. Na prática o código rodou, o que vale mais — mas não é a mesma coisa.
- **Ninguém abriu o `admin.html` da produção e olhou com os olhos.** É a única coisa que falta: o Caio entrar no painel e ver o número passar de 500. No teste a conferência foi pelo caminho dos dados; na produção nem isso, porque exigiria entrar como uma cliente real.
- **Continuo sem saber quantas clientes a produção tem.** A consulta direta ao banco segue bloqueada pelo modo de segurança da sessão. O painel agora sabe — é só abrir.

### ⚠️ Antes de publicar, leia isto

A `member-api` é **a mesma função que faz o login de todas as clientes**. Um deploy ruim aqui não estraga só o painel — ninguém entra no app.

Caminho calmo recomendado: publicar primeiro no projeto de **teste** (`wyiqwsgfictcfkytldnu`), entrar pelo site local, conferir o painel, e só depois publicar na produção.

Publicar a função **não passa pela Netlify** e não gasta crédito de build. São coisas separadas.

⚠️ Ao publicar, `verify_jwt` **tem que ser `false`**. A ferramenta de deploy vem com `true` por padrão — aceitar o padrão faz todo login virar erro 401.

---

## 2026-09-19 — A venda passa a dizer de qual pop-up ela veio

**Chat:** aberto pelo Caio com uma tarefa só — medir o desempenho de cada pop-up. Faixa combinada: **mexer local, validar e relatar**. No fim, autorizado a commitar.

### O buraco

A etiqueta do pop-up **morria na página de oferta**. Os links das quatro cartas eram `hub.la/r/Hr4Z0fVu3XkpmbkIBHJ6` puro, sem nenhum parâmetro. A Hubla registrava a venda dos Arcanjos sem dizer de onde ela veio, e as quatro versões do pop-up ficavam indistinguíveis uma da outra.

### Por que o `src` não servia — o Caio já desconfiava, e estava certo

A documentação da VTurb confirma: ela **lê** `src`, `sck` e os cinco campos `utm_*`, mas **escreve** no `src` quando a plataforma de venda não é uma das que ela integra nativamente. A Hubla não é. Ou seja: o que a gente escrevesse em `src` seria sobrescrito antes de chegar ao checkout.

A saída é o `utm_content`. Os campos `utm_*` a VTurb apenas lê, nunca escreve — e a Hubla aceita os cinco, mostra na fatura e devolve no webhook.

### Os nomes das campanhas, definidos de uma vez

Fixos nos quatro pop-ups: `utm_source=app` · `utm_medium=popup` · `utm_campaign=arcanjos`.
Quem mede é o `utm_content`:

| Pop-up no banco | Quem vê | `utm_content` |
|---|---|---|
| `front_novas_1` | cliente que acabou de comprar, 1ª vez | `novas-1a-exibicao` |
| `front_novas_2` | cliente que acabou de comprar, 2ª vez | `novas-2a-exibicao` |
| `front_antigas_1` | base histórica, 1ª vez | `antigas-1a-exibicao` |
| `front_antigas_2` | base histórica, 2ª vez | `antigas-2a-exibicao` |

Nome por extenso de propósito: daqui a três meses, numa fatura da Hubla, `antigas-1a-exibicao` se explica sozinho. O rótulo antigo, `v2-a`, não explicava nada sem consultar uma tabela.

### Onde o Caio vai ler isso

1. Na Hubla, na fatura da venda, no campo **"Parâmetros de UTM"**.
2. No nosso banco, dentro de `hubla_events.payload`, no caminho `event.subscription.firstPaymentSession.utm.content`. **O webhook não precisou de mudança nenhuma** — ele já guardava o evento inteiro. A consulta pronta que conta venda por pop-up está comentada no fim do arquivo SQL.

### A prova — rodando, não deduzindo

| Elo da corrente | Como foi provado | |
|---|---|---|
| Pop-up → página | Rodada a mesma função do `js/member.js` que troca o domínio em `localhost` | etiqueta sobrevive ✅ |
| Página → checkout | Navegador, as 4 cartas conferidas uma a uma | todas etiquetadas ✅ |
| **Aguenta a VTurb** | Apagado o endereço inteiro da página e posto `?src=vturb-sobrescreveu-tudo` | etiqueta intacta ✅ |
| Chegou sem etiqueta | Página aberta sem parâmetro nenhum | vira `sem-popup` ✅ |
| Alguém digitando lixo | `utm_content` com `<script>` dentro | recusado ✅ |
| Checkout → Hubla | `curl` nos 4 links reais, seguindo os redirecionamentos | 4/4 chegam em `pay.hub.la`, HTTP 200 ✅ |
| Build | `node scripts/build.mjs` | passa ✅ |

O `curl` confirmou de quebra que as cartas apontam para `ODOZxlF1tfhee2TkZikI` — é o `upsell_01`, os Quatro Arcanjos. Produto certo.

### Arquivos

| Arquivo | |
|---|---|
| `oferta-arcanjos.html` | alterado — captura a etiqueta e cola nos links das quatro cartas |
| `supabase/etiquetar-popup-para-medir-venda.sql` | **novo** — troca o endereço dos quatro pop-ups, com conferência, consulta de resultado e rollback |

### ✅ FOI PUBLICADO no mesmo dia

O Caio autorizou ("pode publicar") e os dois passos foram executados:

| Passo | Quem fez | Quando | Prova |
|---|---|---|---|
| Deploy da página | Caio (`git push origin main`) | 19/09 | deploy `6aae06d6beafe00008ba580b`, página responde 200 com o código na linha 35 |
| SQL das campanhas | Caio (SQL Editor) | 19/09 **00:59** | as 4 linhas conferidas no banco, cada uma com o seu `utm_content` |

**Ponto de retorno**, se a produção precisar voltar: deploy `6aade6f319eefa0008691a09`, de 18/09 às 22:35, commit `c83eb29`. Netlify → `7madrugadas` → Deploys → "Publish deploy". Não gasta crédito.

⚠️ **A ordem saiu invertida** — o deploy foi antes do SQL, ao contrário do que estava escrito. Na janela entre um e outro (~20 min), um clique no pop-up teria virado `sem-popup`. **Impacto real: zero**, porque nenhuma venda do pop-up aconteceu nessa janela (nem antes). Mas a ordem continua valendo para a próxima vez.

### 🔴 A descoberta que muda como ler os números

Investigando os eventos reais no banco — não a documentação — apareceu isto:

**Os Quatro Arcanjos são vendidos em DOIS lugares, e os dois caem no MESMO checkout:**

| Origem | Como se reconhece | Vendas até 19/09 |
|---|---|---|
| Upsell pós-compra do **funil** (logo depois da compra principal, ainda no fluxo do anúncio) | endereço com `fbclid` e um parâmetro `sck` com o nome do anúncio do Facebook | **27** identificadas + 12 sem etiqueta + 3 outras |
| **Pop-up dentro do app** (o que este trabalho etiqueta) | `utm_medium=popup` | **0** |

Ou seja: **nenhuma das 42 vendas do produto veio do pop-up.** Não é defeito — o pop-up só passou a apontar para a página dentro do app em 18/09, e o rastreamento subiu hoje.

**Por que isso importa:** quem olhar "vendas dos Arcanjos" achando que é resultado do pop-up vai superestimar muito. E quem agrupar só por `utm_content` vai ver nome de anúncio do Facebook misturado com os nossos rótulos e achar que quebrou. A consulta comentada no fim do arquivo SQL já separa as duas origens.

**De quebra, isso resolveu a dúvida que faltava:** nas vendas do funil, o `firstPaymentSession` do evento do upsell reflete a sessão do checkout **do upsell**, não a da compra principal. Era exatamente o risco do campo escolhido. Conferido cruzando o `customer.member_added` com o `invoice.status_updated` da mesma venda: os dois batem.

O funil rastreia por `sck`; nós rastreamos por `utm_*`. Os dois não se atrapalham — e nenhum dos dois é o `src`, que é da VTurb.

### O que NÃO foi verificado — leia antes de confiar

- **Nenhuma venda real passou pelo pop-up ainda.** Toda a corrente foi provada elo por elo, mas a confirmação final é a primeira venda de verdade com `utm_medium=popup`.
- **A VTurb não carrega em `localhost`** (o CDN dela recusa a origem por CORS). O comportamento dela foi **simulado**, não observado. A simulação apagou o endereço inteiro, que é o pior caso possível — mas continua sendo simulação.
- **Ninguém clicou no pop-up no site no ar e percorreu até o checkout com os próprios olhos.** A conferência da produção foi pelo endereço (`curl`) e pelo banco.

### Dois detalhes que enganam e valem registro

**O que faz isso aguentar a VTurb é a POSIÇÃO do código, não o código.** A captura da etiqueta fica no topo do `<head>`, antes de qualquer script de fora. Quando o player mexe no endereço depois, a nossa cópia já está guardada. Se alguém mover esse bloco para baixo do player "para organizar", o rastreamento quebra **em silêncio** — nada aparece errado na tela, a venda só volta a chegar sem origem.

**Link encurtado da Hubla preserva parâmetro.** O `hub.la/r/...` passa por **dois** redirecionamentos até `pay.hub.la` e os parâmetros chegam inteiros do outro lado. Conferido com `curl`, não suposto — encurtador que come query string é comum o bastante para valer o teste.

---

## 2026-09-18 — O webhook para de perder evento, o painel para de errar o dia

**Chat:** aberto pelo Caio com duas tarefas — consertar o webhook e corrigir os horários do painel. Faixa combinada: **mexer local, sem publicar**.

### Tarefa 1 — por que um evento sumia sem deixar rastro

O código antigo, ao dar erro, mandava o banco *marcar como falha* a linha daquele evento. No caso da Cléa (R$ 197, 18/09) o erro aconteceu **na hora de criar a linha** — então não havia linha para marcar. O comando rodou, não encontrou nada e devolveu sucesso, porque marcar zero linhas não é erro para o banco. O evento evaporou.

Quatro mudanças em `supabase/functions/hubla-webhook/index.ts`:

| # | O que mudou | Por quê |
|---|---|---|
| 1 | Cada conversa com o banco tenta **até 3 vezes**, com pausa curta | O 401 que derrubou a venda durou um instante. Só insiste em erros que podem se curar sozinhos; pedido malformado nosso falha na hora, sem enrolação |
| 2 | Ao falhar, **cria a linha** com o evento inteiro dentro (não "marca" uma linha que pode não existir) | É o conserto do buraco. O payload sobrevive e o `conferir-acessos-perdidos.sql` acha |
| 3 | Se nem isso funcionar, o payload completo vai para o registro da função com a etiqueta `EVENTO_NAO_GRAVADO` | Última rede. Os registros expiram, mas é melhor que nada |
| 4 | Guarda contra uma pane que ninguém tinha visto | Se o banco respondesse "já existe" sem devolver a linha, o código estourava. O teste **confirmou** essa pane no código antigo |

### Tarefa 2 — por que o painel mostrava 17/09 para quem comprou em 18/09

**O banco estava certo.** O dia da visita está gravado como `2026-09-18`, já em horário de Brasília — isso a versão anterior acertou.

O erro era só na hora de mostrar. O banco manda a data **sem hora**. O navegador recebe `2026-09-18` e, por uma regra antiga da linguagem, entende "meia-noite em Londres". Depois converte para cá, volta três horas e chega em **17/09 às 21h**.

Não era só o Bolívar do print: **toda data de visita no painel estava um dia atrasada, sempre.**

Apareceu de brinde um segundo problema, que ainda não tinha dado as caras: os horários eram exibidos no fuso **do computador que abre o painel**. No do Caio, em Brasília, sai certo por sorte. Numa máquina configurada em outro fuso, tudo desloca em silêncio — comprovado: numa máquina em Londres o mesmo evento aparecia às 23:16 em vez de 20:16.

Agora o `js/admin.js` manda exibir em `America/Sao_Paulo` explicitamente, e datas sem hora são apenas reordenadas, sem conversão nenhuma.

### A prova

Os dois consertos têm teste automático que roda sem navegador, sem banco e sem internet.

| Teste | Como rodar | Resultado |
|---|---|---|
| Webhook | `"C:\Program Files\nodejs\node.exe" supabase/functions/hubla-webhook/testa-webhook.mjs` | **32 passaram, 0 falharam** |
| Datas do painel | `"C:\Program Files\nodejs\node.exe" scripts/testa-datas-admin.mjs` | **11 conferências × 4 fusos, todas passaram** |

O teste do webhook aceita o caminho de outra versão da função como argumento. Rodado contra o código antigo, ele reprova — e é essa a prova de que o conserto vale:

| | Código antigo | Código novo |
|---|---|---|
| Passaram | 21 | **32** |
| Falharam | **11** | 0 |

As falhas do código antigo são literalmente `o evento NÃO sumiu — tem 0`.

O erro do print também foi reproduzido em laboratório: com o código antigo, `day("2026-09-18")` devolvia `17/09/2026`.

### Arquivos

| Arquivo | |
|---|---|
| `supabase/functions/hubla-webhook/index.ts` | alterado |
| `supabase/functions/hubla-webhook/testa-webhook.mjs` | **novo** — banco de mentira que força as falhas reais |
| `js/admin.js` | alterado |
| `scripts/testa-datas-admin.mjs` | **novo** — roda em 4 fusos, em processos separados |

`node scripts/build.mjs` roda normalmente. Conferido que os dois arquivos de teste **não** vão para o `dist/` — não sobem para o site.

### O que NÃO foi tocado

**Nada em produção. Nada em banco nenhum — nem o de produção, nem o de teste.** Nenhum deploy, nenhum push, nenhum commit. Tudo continua solto no computador do Caio.

### O que NÃO foi verificado — leia antes de confiar

- **O banco de mentira é uma imitação minha do PostgREST.** O ponto que mais precisa de confirmação contra um Supabase real é o comando de resgate (`on_conflict=idempotency_key` + `resolution=merge-duplicates`). Se o banco real divergir, a rede de segurança não abre e só se descobre na próxima falha.
- **Ninguém abriu o painel e olhou a data com os próprios olhos.** A conferência foi toda por teste automático.
- **A documentação da Hubla não diz em quantos segundos ela desiste de esperar.** As novas tentativas somam até ~1,2 segundo por consulta quando o banco está ruim. Se a Hubla desistir, ela reenvia — e agora o evento já está gravado. Risco pequeno, mas não zero.

### Detalhe que engana

Uma data no formato `2026-09-18` e uma data com hora (`2026-09-18T23:16:00Z`) **são tratadas de formas diferentes** pelo navegador: a primeira vira meia-noite em Londres, a segunda respeita o fuso informado. Por isso o bug atingia só as visitas e não as compras — e por isso parecia que "o banco estava errado" quando o banco estava certo.

---

## 2026-09-18 — A oferta de upsell entrou no app, e a topologia das branches ficou provada

**Chat:** a página de oferta dentro do app · publicado em produção

### O ponto de retorno deste deploy

Se a produção precisar voltar atrás, é para cá:

| | |
|---|---|
| Deploy bom **anterior** a esta leva | `6aad48c17323b50008e0399b` |
| Publicado em | 18/09/2026, 14:20:59 UTC |
| Commit | `348db75` — *"Impedir os dois pop-ups no mesmo dia"* |
| Ver como estava | `https://6aad48c17323b50008e0399b--7madrugadas.netlify.app` |

Netlify → `7madrugadas` → **Deploys** → esse ID → **"Publish deploy"**. Volta em segundos e **não gasta crédito**, porque não roda build.

### 🔴 A correção que motivou esta entrada

O `CLAUDE.md` dizia que ninguém tinha confirmado qual branch alimenta a produção. Foi confirmado — e o resultado contraria o que se supunha:

**Os DOIS projetos da Netlify seguem a branch `main`.** Provado pela API, não deduzido: o deploy no ar da *validação* traz `"branch": "main"` e `"context": "production"`.

O que isso custa na prática:
- **Não existe ensaio.** Um push na `main` muda produção e validação ao mesmo tempo. A validação não serve de rede.
- **Push na `development` não muda site nenhum** — não publica e não gasta build. Serve só para guardar no GitHub.
- **O único ensaio real é o teste local.** Deixou de ser boa prática e virou a única rede antes das clientes.

Isso é o achado #5 da auditoria (item 3 da lista de decisões lá em cima), agora com prova.

### O que foi ao ar

`oferta-arcanjos.html` — a VSL de upsell dentro do app, no lugar de mandar a cliente para um site de fora. Cabeçalho, vídeo da VTurb e o painel das quatro cartas, que só aparece aos **5:56** de vídeo pelo código oficial de delay da VTurb (conta tempo **assistido**, não tempo de página aberta).

Conferido no ar: página 200, painel escondido por padrão, preço "R$ 137 por mês", 4 cartas com o checkout certo, `noindex` na página, `_teste_sem_js.html` fora (404), produção **sem** `x-robots-tag` (o risco de desindexar o site não se materializou) e a `member-api` viva.

### O pop-up foi repontado — o caminho está fechado

Rodado em produção no mesmo dia, depois de a página estar no ar (a ordem importava: ao contrário, quem clicasse cairia numa página inexistente).

As quatro campanhas do front trocaram de destino, cada uma mantendo o seu rótulo:

| | |
|---|---|
| Antes | `https://thedailyinsightreport.com/uppp?src=rec-app-up01-…` |
| Agora | `https://setemadrugadas.com.br/oferta-arcanjos.html?src=rec-app-up01-…` |

`front_novas_1` = `v1-a`, `front_novas_2` = `v1-b`, `front_antigas_1` = `v2-a`, `front_antigas_2` = `v2-b`. As quatro seguem `enabled = true`.

**Para desfazer:** o bloco de rollback está pronto e comentado no fim de `supabase/repontar-popup-para-o-app.sql`. Volta na hora, sem deploy.

**Conferido depois de rodar**, perguntando ao backend o que ele entregaria de verdade:

| Cobaia | Campanha entregue | Rótulo |
|---|---|---|
| `teste.novas@exemplo.com` (compra nova) | `front_novas_1` | `v1-a` |
| `teste.antigas@exemplo.com` (base histórica) | `front_antigas_1` | `v2-a` |

Isso fecha o item "Testar a cliente antiga", que estava pendente desde 18/09 — **com uma ressalva**: a conferência foi pelo caminho dos dados (função do banco + member-api), não clicando na tela. O painel do navegador não estava desenhando na hora.

O mesmo teste provou a troca de endereço por ambiente: o banco guarda o endereço de produção, e quem abre em `localhost` é levado para `localhost`, não para o site das clientes.

### Três armadilhas que valeram o registro

**O produto é assinatura MENSAL, não compra única.** Descoberto indo até o fim do checkout: a Hubla mostra "R$ 137,00 por mês · Plano de assinatura". A página dizia só "R$ 137", que uma senhora lê como pagamento único. Corrigido para "R$ 137 **por mês**" mais uma linha de recorrência. O `CLAUDE.md` registrava `upsell_01` como addon simples — também corrigido.

**Dado pessoal de cliente quase foi para um repositório público.** `docs/DIARIO.md` e `supabase/conferir-acessos-perdidos.sql` traziam 14 e-mails reais, nenhum deles ainda no histórico do Git. O repositório é **público** (`"visibility": "public"`) e o próprio `.gitignore` já mandava não versionar dado pessoal. Uma varredura por CSV e por chave de API **não pega isso** — os e-mails estavam dentro de comentário de SQL e de texto em Markdown. Os endereços saíram; a lição técnica ficou.

**A rede de segurança de um delay não pode contar o relógio da página.** A primeira versão revelava as cartas 476s após o carregamento. Se a cliente pausasse o vídeo para atender o telefone, as cartas apareciam antes do pitch. Hoje a rede se desliga assim que o player dá sinal de vida.

---

## 2026-09-18 — A janela cega de 9 horas: 38 clientes sem acesso, reparadas

**Chat:** urgência aberta pelo Caio — uma cliente pagou e não recebeu acesso.

### O que aconteceu

O Caio avisou que `cliente D` comprou e não foi liberado. Investigando, apareceram **duas falhas diferentes** — e a segunda ninguém tinha visto.

**Falha 1 — a emenda entre os dois sistemas ficou aberta.**

| | Horário de Brasília |
|---|---|
| A carga histórica cobriu até | **23:54 de 17/09** |
| O webhook começou a gravar | **09:08 de 18/09** |
| Buraco | **9h14min** |

Quem comprou nesse intervalo não existia em lugar nenhum: fora do export que gerou a carga histórica e antes de o webhook existir. Não é bug de código — é a costura entre os dois. A compra do Caio que motivou tudo foi às 05:57, bem no meio.

**Falha 2 — um evento perdido sem deixar rastro.** `cliente E` pagou R$ 197 no Pix às 13:33 com o webhook já rodando. O evento dela chegou e a função quebrou com *"Database operation failed (401) on hubla_events"* — a chave de serviço foi recusada naquele instante. Como a falha foi **na própria gravação**, o tratamento de erro não tinha linha para marcar como "falhou". A Hubla recebeu erro 500 e não reenviou. Só apareceu porque alguém foi ler os registros da função — e **esses registros expiram**.

### O que foi gravado no banco de produção

Isto **alterou a produção**, com autorização do Caio, a partir do export de faturas da Hubla do dia 18/09 (175 linhas, todas `Paga`, zero reembolso, 137 e-mails únicos).

| | |
|---|---|
| Clientes criadas | **38** (37 da janela + Cléa) |
| Acessos concedidos | **49** — 38 principal, 6 upsell_01, 4 upsell_02, 1 upsell_03 |
| Situação final do banco | **322 clientes, todas com acesso ativo** |

Todos entraram com `source = 'hubla'` e a **data real do pagamento**, não a data da importação — então o registro delas ficou idêntico ao que o webhook teria criado, e elas recebem o pop-up de cliente nova, que é o correto. Tudo ficou registrado em `admin_actions`, com o motivo escrito por extenso.

### A armadilha que quase criou 38 contas duplicadas

Pareciam faltar **40** clientes. Eram 37. As outras 3 já tinham acesso — **cadastradas com outro e-mail**:

| Cliente | E-mail na fatura (o do recibo) | E-mail no app (o que o webhook usou) |
|---|---|---|
| A | mesmo usuário, domínio `.com.br` | mesmo usuário, domínio `.com` |
| B | endereço do provedor antigo | endereço pessoal, outro provedor |
| C | endereço pessoal dela | endereço de outra pessoa da família |

> 🔒 **Os endereços reais não ficam aqui.** Este repositório é **público**.
> Para ver de quem se trata, procure pelo `hubla_user_id` no painel admin.

O export de faturas traz o e-mail de **quem pagou**. O webhook traz o e-mail da **conta na Hubla**. Quando a pessoa já tinha conta com outro endereço, os dois divergem — e um deles é o nome de outra pessoa da família.

Quem segurou foi a trava de `hubla_user_id` único do banco, que recusou a gravação. **Regra que vale para sempre: ao inserir cliente vinda de um export, cruzar pelo `ID do cliente` (o `hubla_user_id`), nunca só pelo e-mail.**

### Uma conclusão errada que foi corrigida no meio do caminho

Antes de descobrir o e-mail duplo, a leitura era de que a Hubla não tinha entregue o evento dessas 3 — o que dava uma taxa de perda de ~3% e sugeria um webhook furado. **Estava errado.** Com o e-mail duplo explicado, a conta real do dia é: **441 requisições, 1 perda** (a da Cléa). O webhook está confiável.

Também foi levantado e descartado um susto com o código `oZajYNyCrVgwAbBn46dW` (Comunidade da Fé), que não está no `hubla_product_map`. Não é problema: é o endereço da página de checkout, não o identificador que chega no evento. Uma das três vendas desse produto entrou sozinha, normalmente.

### O que ficou comprovado e o que não

- **Comprovado:** as 38 têm acesso ativo; a conferência cruzada contra as faturas pagas da Hubla volta zero pendências; o fuso do export é horário de Brasília (conferido contra o payload da Cléa, que tinha os dois lados).
- **Não comprovado:** nenhuma das 38 foi testada entrando no site de verdade. A conferência foi toda pelo banco.

### Arquivo novo

`supabase/conferir-acessos-perdidos.sql` — duas conferências prontas: quem pagou e ficou sem acesso, e como achar a mesma pessoa com dois e-mails. Não altera nada, só lê. **O CSV de faturas não entrou no repositório** — tem nome, telefone e CPF de cliente real.

---

## 2026-09-18 — Ambiente de teste ligado de ponta a ponta

**Chat:** "Plugins e skills" (encerrado por estouro de contexto — ver nota no fim)

### O que foi feito

**A receita do banco existe agora.** `supabase/schema-completo.sql` (37 KB) reconstrói o banco inteiro do zero. Ele foi deixado **fora** da pasta `supabase/migrations/` de propósito, para que nenhuma ferramenta o execute contra a produção por acidente. Conferido contra o banco vivo, item por item:

| | |
|---|---|
| Tabelas | 16/16 |
| Colunas | 152/152 |
| Restrições | 61/61 |
| Índices | 33/33 |
| Políticas de acesso | 16/16 |
| Funções | 3/3 |
| Visões | 2/2 |
| Produtos | 4/4 |
| Códigos da Hubla | 7/7 |
| Campanhas | 8/8 (4 ligadas) |

Isso fecha o achado #9 da auditoria (o repositório não reproduzia o banco).

**O site local agora fala com o banco de teste, não mais com o de produção.** Toda a troca acontece em um arquivo só, `js/member-config.js`: se o endereço é `localhost`, vai para o banco de teste; qualquer outro endereço vai para produção. Não tem comando para rodar, não tem variável para configurar — o próprio navegador decide. Em toda carga local aparece um aviso laranja no console: *"⚠️ BANCO DE TESTE — nenhuma cliente real aqui."*

**A função `member-api` foi publicada no projeto de teste** (autorizado pelo "pode publicar"). Antes disso o projeto de teste tinha zero funções — o encanamento estava trocado, mas a torneira do outro lado não existia.

- Situação: ATIVA, versão 1
- Publicada com `verify_jwt: false`, que é obrigatório: o site autentica por um cabeçalho próprio (`x-member-session`) e nunca manda `Authorization`. A ferramenta de publicação vem com isso ligado por padrão — se tivesse aceitado o padrão, **todo login de teste teria dado erro 401**.

**O login foi testado de verdade, pelo navegador.** Não só pela API: preencheu o e-mail no formulário, clicou em entrar, a sessão abriu, a home carregou e o popup segmentado certo apareceu — o de público novo, com a chamada *"O inimigo não precisa impedir sua oração."*

Corrente comprovada inteira: endereço local → banco de teste → função publicada aceita a conexão de outra origem → sessão criada → home libera a entrada → o sistema lê que tipo de cliente é → mostra a campanha certa.

**O `CLAUDE.md` foi atualizado** em três pontos que estavam desatualizados e induziam a erro: a receita do banco, o aviso de que o teste local falava com produção (não fala mais) e a descrição do projeto de teste (que constava como "vazio, não usar").

### O que NÃO foi tocado

**A produção nunca foi escrita.** Toda consulta à produção foi leitura. Toda escrita foi no banco de teste. Nenhum deploy na Netlify foi feito — nem neste trecho nem no anterior.

Produção conferida e saudável: `setemadrugadas.com.br` respondendo 200, e a `member-api` de produção respondendo 401 para uma sessão inválida, que é a resposta correta e prova que ela está viva.

### Dois detalhes que enganam e vale registrar

- **O console do navegador é cumulativo.** Erros vermelhos de cargas antigas continuam na lista depois de navegar. Apareceram 3 erros de rede que pareciam falha atual — eram sobras de antes da função ser publicada. Uma carga nova não gerou nenhum erro novo.
- **Quando a página está navegando, olhe o título da aba, não a tela.** O primeiro print depois do login parecia falha (botão ainda escrito "Entrando..."). O que provava o sucesso era o título ter mudado de "Entrar" para "Início".

### Cobaias no banco de teste

| Cliente falsa | Origem | Campanha |
|---|---|---|
| `teste.novas@exemplo.com` | `hubla` (compra nova) | `front_novas_1` → popup v1 |
| `teste.antigas@exemplo.com` | `hubla_import` (base histórica) | `front_antigas_1` → popup v2 |

### Por que este chat morreu

Chegou a 2.935 mensagens e 101 capturas de tela. Ficou grande demais para continuar **e** grande demais para resumir — para fazer o resumo é preciso reler tudo de uma vez, e "tudo" já não cabia. Deu "Prompt is too long" e parou.

Este diário existe por causa disso. A lista de pendências acima estava só na cabeça daquele chat.
