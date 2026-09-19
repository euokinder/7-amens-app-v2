# Diário de bordo — onde a gente parou

> **Leia isto primeiro, antes de qualquer coisa.**
> O `CLAUDE.md` diz *como as coisas são*. Este arquivo diz *onde paramos*.
> Regra: o mais recente fica em cima. Nada aqui é apagado, só empurrado para baixo.
> Quem lê este arquivo é o `/abrir`. Quem escreve nele é o `/fechar`.
> Atualizado: 2026-09-18

---

## 🔴 Esperando decisão do Caio

Nada anda nestes pontos até ele responder.

| # | Assunto | A pergunta |
|---|---|---|
| 1 | **Deploy acumulado** | Tem correções locais prontas que nunca subiram. O Caio disse que quer "mais algumas otimizações" antes. Quando ele autorizar, sobe **tudo de uma vez só**, não em pedaços. Desde 18/09 a pilha inclui duas correções que só valem depois de publicadas: o webhook que parava de perder evento (precisa ser publicado no **Supabase**) e o relógio do painel (precisa de deploy na **Netlify**). São dois lugares diferentes — publicar um não publica o outro. |
| 2 | **Conteúdo pago aberto por link direto** (achado #4 da auditoria) | Quem descobrir o endereço de um áudio ou PDF baixa sem ter comprado. Travar isso dá trabalho e muda a experiência. É decisão de negócio, não técnica. |
| 3 | **Topologia de branches** (achado #5 da auditoria) | Hoje teste e produção saem os dois da `main`. Isso precisa ser separado, mas envolve mexer em configuração da Netlify — e ele pediu para não mexer no que está no ar sem perguntar. |
| 4 | **Qual e-mail vale quando a cliente tem dois** | Três clientes têm um e-mail na fatura e outro na conta da Hubla (ver entrada de 18/09 sobre a janela cega). Elas vão tentar entrar com o do recibo, que o app não conhece. Dá para corrigir no painel, mas a pergunta é qual dos dois passa a valer: o do recibo é o que ela lembra; o da conta Hubla é o que o webhook vai continuar mandando nas próximas compras dela. |

---

## 🟡 Pendente — pode tocar sem perguntar

- **Rodar `supabase/repontar-popup-para-o-app.sql`.** É o que faz o pop-up parar de mandar a cliente para fora e passar a abrir a página de oferta dentro do app. A página já está no ar (18/09), então a ordem está satisfeita. **Ainda não foi rodado** — depende do Caio mandar.
- **A lista dos 26 achados menores da auditoria foi prometida e nunca entregue.** O Caio pediu e não recebeu.
- **Testar a cliente antiga.** Só a `teste.novas@exemplo.com` (público novo, popup v1) foi testada de ponta a ponta. A `teste.antigas@exemplo.com` (base histórica, popup v2) e as variantes de segunda exibição (`-b`) nunca foram abertas.
- **Confirmar o link do popup pelo HTML.** O popup certo apareceu na tela, mas ninguém leu o endereço do botão — então o `?src=rec-app-up01-v1-a` está deduzido pelo texto, não comprovado.
- **Opcional, economia de peso:** `assets/audio/dia-01-oracao.mp3` está em estéreo 192kbps (4,98 MB). Em mono 64kbps cai para 1,66 MB. Voz falada não perde nada audível. São ~3,3 MB a menos para cada cliente baixar.
- **Avisar as três clientes de e-mail duplo.** `cliente A · e-mail da fatura`, `cliente B · e-mail da fatura` e `cliente C · e-mail da fatura` **não conseguem entrar** — o app as conhece por outro endereço. Não é bug, é a diferença entre o e-mail do recibo e o da conta Hubla. Depende da decisão nº 4 acima para saber qual e-mail gravar.
- **Conferir o resgate do webhook contra um Supabase de verdade.** A correção foi testada num banco de mentira, escrito por mim a partir do que eu *acredito* que o PostgREST faz. O ponto exato que precisa de confirmação é o comando que grava a linha de falha (`on_conflict=idempotency_key` com `resolution=merge-duplicates`). Se o banco real se comportar diferente, a rede de segurança não abre — e só se descobre na próxima falha. O jeito de confirmar: publicar a função no projeto de **teste** e disparar um evento de mentira. Não depende de decisão nenhuma.
- **Ver as datas corrigidas no painel de verdade.** A correção do fuso passou em 11 conferências × 4 fusos, mas ninguém abriu o `admin.html` e olhou a ficha de uma cliente com a tela. O banco de teste não tem admin cadastrado nem cliente com visitas, então isso ficou de fora.
- **Rodar `supabase/conferir-acessos-perdidos.sql` depois de cada dia de vendas.** É a rede de segurança que acha quem pagou e ficou sem acesso. Leva segundos e não altera nada.
- **`node` não está no PATH do Windows.** Até alguém acrescentar `C:\Program Files\nodejs`, todo comando precisa do caminho completo. Não é urgente, é chato.

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
