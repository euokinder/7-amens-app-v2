# 7 Améns da Madrugada — Contexto do Projeto

> Fonte de verdade das regras do projeto. Atualizado: 2026-09-21
> Contexto histórico completo em `docs/contexto-completo.md`. Leia sob demanda, não sempre.

## 🧭 Comece pelo diário
Antes de qualquer coisa, leia `docs/DIARIO.md`. Ele diz **onde a gente parou** — o que está pendente e o que está travado esperando decisão do Caio. Este arquivo aqui diz *como as coisas são*; o diário diz *o que falta*. Começar sem ler o diário é repetir trabalho já feito ou mexer no que está esperando resposta.

**O jeito rápido de fazer isso: `/abrir`.** Ele lê o diário, confere o estado real da máquina (alterações locais, commits não enviados), reporta o que está pendente e o que está travado esperando decisão do Caio — e para, sem executar nada.

**Ao terminar um chat, rode `/fechar`.** Ele escreve no diário enquanto ainda há espaço para pensar. Um chat que enche até o teto morre levando junto a lista do que faltava — aconteceu em 2026-09-18, com 2.935 mensagens e 101 capturas de tela.

**Um chat por tarefa.** Quando a frase que descreve a tarefa estiver respondida, fecha e abre outro. Captura de tela do navegador pesa muito: ler a página como texto é o padrão, foto só quando o Caio precisa ver com os próprios olhos.

## Em uma frase
Um app católico extremamente simples para a cliente, com infraestrutura por trás capaz de saber quem ela é, o que comprou, o que pode acessar e onde parou — tudo automaticamente.

## ⚠️ Só UM site publica hoje — e são TRÊS projetos na conta
Desde **2026-09-21** existe um único site que constrói sozinho. Antes eram dois, e cada publicação gastava dois builds por nada.

| Papel | Endereço | Projeto na Netlify | Constrói sozinho? |
|---|---|---|---|
| **PRODUÇÃO** (clientes que pagaram) | https://setemadrugadas.com.br | `7madrugadas` | ✅ **sim** — segue a `main` |
| **CONGELADO** (era "validação") | https://7-amens-app-v2.netlify.app | `7-amens-app-v2` | ⛔ **não** — *Stopped builds* desde 21/09 |
| **Versão americana** (operação à parte) | https://7sacredprayers.netlify.app | `7sacredprayers` | não entra na conta do dia a dia |

**Publicar custa 1 build.** Era 2 até 21/09.

O endereço antigo `https://7madrugadas.netlify.app` é o MESMO site de produção. Ele está sendo redirecionado para o domínio pelo `netlify.toml`, e a `member-api` também o aceita — mas não use esse endereço para nada.

### Por que a "validação" foi desligada
Ela **nunca validou nada**. Seguia a mesma branch da produção (`main`, conferido na API em 18/09), então mudava no mesmo instante — e apontava para o **mesmo banco das clientes reais**. A única diferença entre os dois sites era um "não indexe no Google", escrito pelo `scripts/build.mjs`. Era uma cópia idêntica da produção, cobrada à parte.

⚠️ **Ela continua no ar, congelada na versão de 21/09, e vai envelhecer.** Quem cair naquele endereço daqui a um mês vê um app velho conversando com o **banco vivo** — poderia, por exemplo, mostrar as 7 orações de uma vez, porque a trava do `js/trava.js` não estaria na versão congelada. O acabamento certo é fazer aquele endereço redirecionar para o site de verdade, como já se faz com o `7madrugadas.netlify.app`. **Não foi feito ainda.**

### O que continua valendo
1. **Push na `main` é publicar para as clientes**, direto, sem ensaio. Antes dele, anotar data e ID do último deploy bom na Netlify: é a única forma de voltar atrás.
2. **Push na `development` não muda site nenhum.** Não gasta build e não publica nada — serve só para guardar o trabalho no GitHub. Foi o que aconteceu no commit `c83eb29`: o push saiu, os sites continuaram na versão antiga.
3. **O único ensaio real é o teste local** (`node scripts/build.mjs && node scripts/preview.mjs`). Não é "boa prática": é a única rede antes das clientes.
4. O hook `.claude/hooks/protege-producao.sh` nega push por padrão e só libera `git push origin development`, então a `main` não sai daqui por acidente.

⚠️ **O achado #5 da auditoria mudou de resposta.** Ele sugeria apontar o `7-amens-app-v2` para a `development`, para recuperar o ensaio. **Isso sairia mais caro:** hoje `git push origin development` custa zero, e com a validação seguindo essa branch cada envio viraria um build — e envia-se para a `development` muito mais vezes do que se publica. Por isso a escolha de 21/09 foi **desligar**, não redirecionar.

⚠️ **Ligar os builds de volta é um clique** (*Site configuration → Build & deploy → Build status → Active builds*) — e volta a custar 2. Não fazer isso sem o Caio pedir.

## Status atual
- **Produção:** https://setemadrugadas.com.br — **com login e sistema de membros no ar desde 20/09**. (Este item dizia "ainda rodando versão antiga, sem login" até 21/09, quando já fazia dias que não era verdade.)
- **Congelado:** https://7-amens-app-v2.netlify.app/ — parado na versão de 21/09, não constrói mais (ver a seção acima).
- É um site HTML/CSS/JS puro desenhado para parecer app. **Não está em loja nenhuma.**
- Desafio NÃO é criar do zero — é **otimizar e completar** o que existe.
- O login por e-mail está **pronto e em uso pelas clientes**. Não é mais "a próxima tarefa".

## Quem é o dono do projeto
Caio — copywriter da operação, à frente do desenvolvimento como **idealizador**, não como dev.
Não tem malícia de programação. Precisa que eu:
- explique decisões técnicas em português claro, sem jargão gratuito;
- **avise proativamente sobre custo** (Netlify, Supabase, cobrança automática no cartão);
- **economize tokens** — sem exploração desnecessária, sem reler o que já sei;
- construa junto, não só aconselhe.

## Público-alvo
Mulheres católicas brasileiras **45+** (também descrito como 40+/50+, senhoras maduras).
Isso é regra de UX, não detalhe: letras grandes, sans-serif, alto contraste, cards grandes, poucos elementos competindo, linguagem claríssima. **Lógica de "Netflix de orações", nunca de dashboard SaaS.**
Paleta aprovada: **creme + dourado + preto**, muito respiro, cards bem separados.
Regra fixa: revisar visualmente — nada de texto sobreposto ou elemento pequeno.

## Produto principal — 7 Améns da Madrugada
Jornada de 7 madrugadas, **1 oração por dia**, na ordem:
| Dia | Oração |
|---|---|
| 1 | Pai Nosso Completo |
| 2 | Perdão |
| 3 | Cura |
| 4 | Libertação |
| 5 | Prosperidade |
| 6 | Paz |
| 7 | Aliança |

- Horário recomendado: **4h–7h**, em voz alta, com áudio guiado.
- **Se perder um dia: NÃO reinicia e NÃO faz duas no mesmo dia.** Continua de onde parou, no dia seguinte.
- Depois dos 7 dias, materiais como o Pai Nosso seguem utilizáveis à parte.

## ⏳ O app libera UMA oração por dia (no ar desde 2026-09-20)
Até 20/09 o app entregava as 7 madrugadas de uma vez. Hoje ele caminha junto com a cliente. A conta mora em **`js/trava.js`**; a `member-api` manda os dois campos que ela usa (`hoje` e `primeiroAcesso`), em **todo** snapshot.

**A regra, decidida pelo Caio em 2026-09-20:**
- No dia em que ela **entra no app pela primeira vez**, ela tem a Introdução (Dia 0) e o **Dia 1**.
- Cada meia-noite de **Brasília** abre a próxima, até o Dia 7. Quem manda a data é o servidor (`Intl` com `America/Sao_Paulo`), nunca o relógio do celular dela.
- **Não depende de ela marcar "Concluí esta oração".** É calendário, não botão — quem reza e esquece de marcar não fica presa.
- Quem já tinha entrado no app **antes de 20/09** abriu com o Dia 3 pronto e segue de um em um (`ENTROU_NO_AR` e `PISO_DAS_ANTIGAS`, em `js/trava.js`).
- Oração já concluída **nunca** volta a ficar trancada.

⚠️ **A âncora é o primeiro ACESSO, não a data da compra.** Quem comprou em agosto e só abre o app hoje começa pelo Dia 1 hoje. É de propósito: ancorar na compra faria quem demorou a entrar cair direto no Dia 6 e perder as cinco primeiras orações para sempre.

⚠️ **O "primeiro acesso" só enxerga a partir de 2026-09-18**, que é quando `member_visit_days` nasceu. Quem usou o app antes disso e não voltou desde então conta como estreante.

⚠️ **Rede de segurança embutida: sem o campo `hoje`, nada tranca.** Se o site subir antes da função — ou a função voltar para uma versão anterior — aparecem as sete, como antes da trava existir. O contrário (centenas de clientes pagantes vendo só o Dia 1 por um deploy fora de ordem) seria invisível na tela.

⚠️ **É trava de experiência, não de segurança** — mesmo desenho já decidido para o login. Os textos estão em `js/dias.js`, arquivo público. **Não prometer "liberado aos poucos" como se fosse cadeado em peça de venda.**

⚠️ **Ao mexer na lista de `novena.html`, AJUSTE os cartões — não redesenhe com `innerHTML`.** O `js/app.js` guarda referências a esses cartões para o efeito de foco ao rolar (o único que tira o cartão de `opacity: 0.5`) e para o pop-up "Antes de continuar, confirme" dos dias 2 a 4. Trocar o `innerHTML` joga os dois fora **em silêncio**: a lista fica inteira desbotada e a confirmação some, sem derrubar a tela.

## Stack
| Camada | Ferramenta | Papel |
|---|---|---|
| Frontend + hospedagem | **Netlify** | serve o HTML/CSS/JS, deploy automático |
| Código + histórico | **GitHub** | fonte central; commit lá → deploy na Netlify |
| Backend completo | **Supabase** | Postgres, usuários, entitlements, progresso, Edge Functions |
| Pagamentos | **Hubla** | fonte da verdade de compras e reembolsos, via webhook |

**Decisão firmada: NÃO reescrever em React/Next.** Preserva-se o frontend vanilla e adiciona-se backend por trás.

Arquivos conhecidos do frontend: `index.html`, `novena.html`, `dia.html`, `desatadora.html`, `app.js`, `dias.js`, `materiais.js`, `mensagens.js`, `novena-desatadora.js` — e, desde 24/09, a Central dos Arcanjos: `arcanjos.html`, `arcanjo.html`, `oracao-arcanjo.html`, `arcanjos.js`.

## Regras de negócio (inegociáveis)
1. **Login sem senha, sem OTP, sem código no e-mail.** A cliente digita o mesmo e-mail da compra e entra. O e-mail É a identidade. Risco de compartilhamento é aceito conscientemente — a fricção de auth tradicional é pior para esse público.
2. **Só quem comprou o produto principal entra no app.** A compra principal libera todo o conteúdo base e o acesso é **vitalício**.
3. **Extras são entitlements individuais.** Cliente pode ter principal + extra A sem ter extra B.
4. **Reembolso do principal → perde o app inteiro.** **Reembolso de um extra → mantém o app, perde só aquele extra.**
5. **Comprou o extra Y → libera Y e para de oferecer Y para ela**, idealmente já na próxima sincronização, mesmo com o app aberto.
6. **Progresso vive na nuvem (Supabase), não em `localStorage`.** Trocou de aparelho, o progresso continua.
7. **Webhooks da Hubla devem ser idempotentes.** Evento repetido não duplica entitlement nem quebra o banco.
8. **RLS ligado no Supabase.** Ninguém consulta dados de outra pessoa.

## ⚠️ Só UM conteúdo é trancado por produto: a Central dos Quatro Arcanjos
**Comprou o principal = acesso a todo o resto do aplicativo.** A única exceção é a **Central dos Quatro Arcanjos**, que entrega o `upsell_01` — pedida pelo Caio em **2026-09-24**. ⏳ **Construída no teste local, ainda NÃO publicada** (versão MVP, com textos, áudios e imagens provisórios). Quando subir, apagar esta frase.

| Quem | Vê na home | Ao tocar |
|---|---|---|
| Comprou os Arcanjos | card aberto, "Acessar Agora!" | entra na Central (`arcanjos.html` → `arcanjo.html?a=…` → `oracao-arcanjo.html?a=…&o=…`) |
| Não comprou | card com cadeado, "Desbloquear" | página de oferta (`oferta-arcanjos.html`, etiqueta `utm_medium=card`) |

**Regras decididas pelo Caio em 24/09:**
- **Cancelou a assinatura → CONTINUA com a Central.** Só **reembolso ou estorno** tiram (regra 4). A Hubla manda o mesmo `customer.member_removed` nos dois casos, e o webhook grava `revoked` nos dois. Quem separa é a `member-api` (`conteudosDela`): assinatura com fatura `refunded`/`chargeback` = reembolso. O campo novo `conteudos` do snapshot é o que a Central lê; `products` continua sendo só o que está ativo.
- **Retirada pelo painel também tira** — o painel passou a gravar `source = 'manual'` ao revogar.
- Quem compra com o app aberto vê a Central abrir sozinha na verificação seguinte (até 5 min).

A conta mora em `js/member.js` (`temArcanjos`, `desenharCardArcanjos`, `trancarPaginaDosArcanjos`); o conteúdo, em `js/arcanjos.js`. Sem o campo `conteudos` (função antiga no ar), vale a lista de produtos ativos — rede de segurança igual à da trava.

⚠️ **É trava de experiência, não de segurança** (mesmo desenho do login e da trava das madrugadas): os textos estão em `js/arcanjos.js`, arquivo público. **Não prometer "conteúdo protegido"** na venda.

⚠️ **Não ativar o `upsell_01` no catálogo** (`products.enabled`). Ativado e com link preenchido, um código antigo de `js/member.js` (a seção `member-extras`) cria sozinho um segundo card, genérico, no fim da home.

**Não trancar nenhum outro conteúdo por upsell sem o Caio pedir.** Os entitlements de `upsell_02` e `upsell_03` continuam servindo só para a operação saber quem comprou o quê.

## Home como hub
Cards, na ordem: **7 Orações Sagradas · Central dos Quatro Arcanjos (⏳ só no local) · Entre No Nosso Canal Oficial · Mensagem do Dia · Pai Nosso · Novena Desatadora dos Nós · Lojinha · Fale Conosco**. (Até 24/09 esta lista esquecia o Canal Oficial e o Fale Conosco.)
O "Desbloquear" existe desde 24/09 só na Central dos Arcanjos: tem direito → entra; não tem → página de oferta.

## Modelo de dados — JÁ IMPLEMENTADO (`supabase/schema.sql`)
O backend está bem mais adiantado do que o desenho original sugeria. Nomes reais das tabelas:

| Tabela | Papel |
|---|---|
| `customers` | a cliente; e-mail normalizado, validado e `unique` |
| `products` | catálogo; semeado com `principal`, `upsell_01`, `upsell_02`, `upsell_03` |
| `entitlements` | o que cada cliente possui; `status` = `active` / `refunded` / `revoked` |
| `prayer_progress` | onde ela parou; `prayer_key` = `principal:0-7` ou `desatadora:1-9` |
| `member_sessions` | sessões opacas de 90 dias, **só o hash do token é guardado** |
| `member_login_limits` | anti-abuso: 20 tentativas por janela de 10 min |
| `member_offer_campaigns` | campanhas de oferta dentro do app |
| `member_offer_events` | registro servidor de exibição/clique, para não repetir oferta em outro aparelho |

Funções: `allow_member_login(bucket_key)` e `claim_member_offer(customer_id)`.
Edge Function: `supabase/functions/member-api/index.ts` — **todo acesso ao banco passa por ela.**

**RLS está ligado em todas as tabelas**, com `anon` e `authenticated` revogados e política `backend_only` exclusiva de `service_role`. O frontend nunca fala direto com o banco.

Motivo de `products` + `entitlements` em vez de um `tem_acesso = true`: o catálogo vai crescer (novenas, jornadas 21/30 dias, materiais). O banco não pode assumir produto único.

**Já existe e está rodando:** `hubla_events` e a Edge Function `supabase/functions/hubla-webhook/index.ts`, que recebe a venda da Hubla e libera o acesso sozinha.

### ✅ A receita do banco existe: `supabase/schema-completo.sql`
**Resolvido em 2026-09-18.** Este é o arquivo que constrói o banco inteiro do zero — 16 tabelas, **3 visões** (`admin_customer_overview`, `admin_offer_overview`, `admin_payment_overview`), 3 funções, 33 índices, 61 travas e a configuração de produtos e campanhas. Sem nenhum dado de cliente.

**Ele foi testado de verdade, não só escrito.** Rodou num banco vazio e o resultado bateu com a produção campo por campo (152 colunas de cada lado). Depois um teste funcional confirmou que a segmentação dos pop-ups funciona num banco construído só a partir dele: cliente nova recebeu `front_novas_1`, cliente da base antiga recebeu `front_antigas_1`.

A comparação pegou um erro real: na primeira versão faltavam as duas visões do painel (`admin_customer_overview`, `admin_offer_overview`), varridas de fora porque a consulta inicial só olhava tabelas. **Lição: conferir contra o banco vivo, nunca confiar no que parece completo.**

⛔ **Nunca rodar `schema-completo.sql` na produção.** Ele é todo "se não existir" e não estragaria nada, mas o lugar dele é um banco NOVO.

**O problema histórico que ele resolve:** as migrations do repositório e as aplicadas no Supabase são conjuntos diferentes — nenhum número coincide, e 7 alterações (entre elas a que cria `customers` e `entitlements`) nunca tiveram arquivo. Isso continua verdade para a pasta `migrations/`, então:
- **NÃO rodar `supabase db push` / `db reset` / `db pull`** — os três partem do princípio de que a pasta reflete o banco, e ela não reflete.
- Para recriar o banco ou montar ambiente novo, usar `schema-completo.sql`, não a pasta.

⚠️ Existe também um `supabase/schema.sql` antigo, anterior a esta reconstrução e **não validado**. Em caso de dúvida, o válido é o `schema-completo.sql`.

### Segredos obrigatórios do Supabase
Se um destes sumir, nada aparece quebrado na tela — e o estrago é silencioso:

| Segredo | O que quebra se faltar |
|---|---|
| `HUBLA_WEBHOOK_TOKEN` | o webhook recusa **todos** os eventos com "não autorizado": as vendas novas param de liberar acesso, sem aviso |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEYS` | a `member-api` para de responder: ninguém entra |

Sintoma número um para conferir: se `hubla_events` parar de receber linhas depois de uma venda, o suspeito é o `HUBLA_WEBHOOK_TOKEN`.

## Catálogo de produtos
| `products.key` | Nome comercial | Tipo |
|---|---|---|
| `principal` | **Os 7 Améns da Madrugada** | main — libera o app inteiro |
| `upsell_01` | **Oração Celestial dos Quatro Arcanjos** (no app: "Central dos Quatro Arcanjos") | addon — ⚠️ **assinatura MENSAL de R$ 137**, não pagamento único. Cancelar **não** tira o conteúdo; reembolso tira |
| `upsell_02` | **Músicas dos Anjos** | addon |
| `upsell_03` | **Comunidade da Fé** | addon |

O mapeamento vive em `hubla_product_map` (vários IDs da Hubla podem apontar para o mesmo produto). Situação em 2026-09-18:

| Produto | IDs mapeados | Quantos eventos REAIS chegaram com cada um (20/09) |
|---|---|---|
| principal | `bniYICXEzykgw1PzEyme` · `EnCFJKb2OJLinZYUy1MC` (oferta de R$ 97) | **2.265** · 0 |
| upsell_01 | `5pUr8toveL5R5zR3zyaT` · `ODOZxlF1tfhee2TkZikI` | **436** · 5 |
| upsell_02 | `gTLhMYXqRjFeNlyc7FlH` · `vRuLDZ1avAMG2LllTWAu` | **125** · 5 |
| upsell_03 | `nMyLP4oFcIWiJ77UIbsu` | **73** |

🔴 **Cada upsell precisa dos DOIS IDs mapeados, e o que mais chega é o que "parece slug".** O sandbox confirmou em 18/09 que o `event.product.id` real dos Arcanjos é `ODOZxlF1tfhee2TkZikI` — mas nas vendas de verdade quem chega, 436 vezes contra 5, é `5pUr8toveL5R5zR3zyaT`. **Apagar o "slug" do `hubla_product_map` por parecer errado derrubaria a liberação de quase todas as vendas daquele upsell.** Os dois ficam.

⚠️ **A lição de verdade: só o evento real confirma um ID, nunca a analogia — e nem mesmo o sandbox.** Em 18/09 o sandbox disse que o slug de `hub.la/g/...` não era o `event.product.id`, e por isso os IDs "reais" foram mapeados. Em 20/09 a produção desmentiu: **são os slugs que chegam nas vendas de verdade**, centenas de vezes contra meia dúzia. Nenhum dos dois lados estava mentindo — a Hubla manda formatos diferentes em situações diferentes, e é por isso que o mapeamento é **tabela** e não coluna. ID desconhecido cai em `needs_reconciliation` e **nunca** libera acesso errado.

A Novena Desatadora dos Nós **não é addon** — está incluída no produto principal.

## Hubla
Plataforma de vendas da operação. **Documentação oficial: https://hubla.gitbook.io/docs**
Tudo sobre Hubla — webhook, payload, evento, status, reembolso, produto — sai exclusivamente de lá. Nunca inferir por analogia com Kiwify, Hotmart ou Stripe.

⚠️ **Duas formas do payload que já enganaram:**
- `invoice.amount` é um **objeto**, não um número. O valor está em `invoice.amount.totalCents` (centavos).
- O e-mail vem em `event.user.email` (conta na Hubla). O export de faturas traz o e-mail de **quem pagou**, que pode ser outro. Ao inserir cliente vinda de export, cruzar sempre pelo `hubla_user_id`, nunca só pelo e-mail.

**Especificação de integração aprovada: [docs/hubla-integracao-spec.md](docs/hubla-integracao-spec.md).** É a referência para o webhook. Decisão: adotar 100% da lógica dela, mas **manter os nomes de tabela atuais** (`customers`, `prayer_progress`, `products.key`) em vez dos propostos no documento (`profiles`, `progress`, `slug`) — renomear quebraria a `member-api`, o admin e o perfil num app já em produção.

## Painel administrativo (`admin.html`)
Protegido pela tabela `member_admins` — e um admin também precisa do `principal` ativo, porque a `member-api` exige isso antes de qualquer ação.

Mostra: KPIs, campanhas do funil, lista de clientes com busca, e a ficha completa de cada uma (acessos, orações concluídas, dias de acesso ao site, campanhas enviadas, perfil respondido, eventos da Hubla e histórico administrativo).

Age: liberar acesso na mão (aceita e-mail que ainda não existe), revogar produto específico, corrigir e-mail (derruba as sessões abertas).

**Toda ação fica registrada em `admin_actions` com o admin responsável.**

⚠️ **`funnel_stage` não pode ser fonte de número nenhum.** Ele classifica errado quem pula degrau (compra o upsell_02 sem o upsell_01, por exemplo). Serve de rótulo na ficha de uma cliente; para contagem, somar os `active_products` — é o que o painel faz.

## ✅ Teste local fala com o banco de TESTE
**Mudou em 2026-09-18.** Antes, `localhost:3000` usava o Supabase das clientes reais — liberar ou revogar acesso no painel local alterava dados de verdade.

Hoje `js/member-config.js` escolhe o banco pelo endereço do navegador:

| Onde você abre | Banco |
|---|---|
| `localhost` ou `127.0.0.1` | **teste** (`wyiqwsgfictcfkytldnu`) — ninguém dentro |
| qualquer outro endereço | **produção** (`lbaudlocfbjunnaoyrtz`) — clientes reais |

Produção não muda: o site no ar nunca é "localhost". O desvio só existe na máquina de quem desenvolve. Quando o banco de teste está em uso, o console do navegador avisa em destaque.

⚠️ **Isso só vale se a `member-api` estiver publicada no projeto de teste.** Se não estiver, o site local não conecta em nada e mostra erro. Publicar a função lá não exige segredo nenhum: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados pelo próprio Supabase. Só o `hubla-webhook` precisaria de `HUBLA_WEBHOOK_TOKEN`, e só se alguém for testar webhook.

Para popular o banco de teste do zero: rodar `supabase/schema-completo.sql` nele.

🔴 **O banco de TESTE tem coisas que a produção NÃO tem — e isso não se adivinha olhando o repositório.** Conferido em 2026-09-20:

| | Teste (`wyiqwsgfictcfkytldnu`) | Produção (`lbaudlocfbjunnaoyrtz`) |
|---|---|---|
| Tabela `member_home_banners` | ✅ existe | ❌ não existe |
| Trava `admin_actions_action_check` | 6 ações (inclui `save_banner`, `delete_banner`, `move_banner`) | 3 ações |

⛔ **Nunca publicar na produção a `member-api` que está no projeto de teste.** A de lá lê `member_home_banners` e levaria o banner-carrossel junto, que o Caio pediu para segurar. Quando for publicar, extrair a função **do commit**, não do disco nem do outro projeto.

## Prioridades atuais (decididas em 2026-09-18)
1. ✅ **Webhook da Hubla** — entregue e rodando em produção desde 2026-09-18.
2. ✅ **Painel admin com controle** — construído; falta publicar na Netlify.
3. ✅ **Carga inicial das clientes antigas** — executada em 2026-09-18, registrada em `docs/migracao-base-historica.md`.

## Infraestrutura — identificadores
- Repositório: `euokinder/7-amens-app-v2` (branches `main` = produção, `development` = trabalho). **Não criar repositório novo.**
- ⚠️ Em 2026-09-18 a `main` recebeu tudo o que estava na `development` e foi enviada ao GitHub. Hoje as duas branches são idênticas — não existe mais uma versão antiga guardada na `main` para servir de rede de segurança. A rede de segurança é o deploy antigo na Netlify (ver rollback, abaixo).
- O hook `.claude/hooks/protege-producao.sh` nega push por padrão e só libera `git push origin development`. Teste de regressão: `python .claude/hooks/testa-protege-producao.py`. Ele só enxerga comandos rodados **pelo agente** nesta máquina — o Caio rodando no próprio terminal passa por fora, e é por isso que o caminho de publicar é o clique dele (ver "Como publicar", acima). As travas de verdade são branch protection na `main` (GitHub) e "Stop auto publishing" no projeto `7madrugadas` (Netlify).
- Supabase em uso: projeto **`7-amens-app-v2`**, ref `lbaudlocfbjunnaoyrtz`, região sa-east-1.
- Supabase de **TESTE**: projeto `7 Orações da Madrugada`, ref `wyiqwsgfictcfkytldnu`, região us-west-2. Desde 2026-09-18 ele tem o schema completo e é o banco que o `localhost` usa. Região diferente da produção não atrapalha teste. **Nenhuma cliente real aqui** — as contas `teste.novas@exemplo.com` e `teste.antigas@exemplo.com` são cobaias de propósito.

## Build e teste local
`netlify.toml` roda `node scripts/build.mjs` e publica `dist/`. **Existe etapa de build de verdade** — quebrar o `build.mjs` derruba o deploy.

**Sempre testar local antes de subir** (custo zero, Node 24 instalado):
```
node scripts/build.mjs && node scripts/preview.mjs
```
Abre em http://localhost:3000. Deploy de produção não é ferramenta de teste.

⚠️ **`node` não está no PATH desta máquina.** O comando acima falha com "node: command not found" até alguém acrescentar `C:\Program Files\nodejs` ao PATH do Windows. Enquanto isso não for feito, usar o caminho completo:
```
"C:\Program Files\nodejs\node.exe" scripts/build.mjs
```
O build apaga `dist/` antes de copiar, então o que você vê no preview é exatamente o que vai ao ar.

## ✅ Como publicar — o agente prepara, o Caio publica (combinado de 2026-09-21)
**Quem publica este site é o Caio. O agente nunca publica.** Isso não muda, e encerra a pergunta que ficou dias em aberto no diário ("dá para o agente publicar sozinho?"): não dá, e **não precisa** — o trabalho todo pode ficar pronto de antemão, e sobra para ele um comando só.

O agente deixa tudo montado e conferido, e escreve o comando final num bloco marcado como `bash`. O aplicativo põe um botão **Run** nesse bloco, e **é o Caio quem executa, no terminal dele**. Antes disso, o agente diz o que vai ao ar e quanto custa — que é justamente a conferência que o hook pede.

**A decisão de publicar é dele, e continua sendo dele em cada publicação.** É a única autorização que o agente não consegue produzir sozinho — a mesma conclusão a que o diário já tinha chegado.

### A ordem, quando o Caio disser "pode subir isso no site principal"

| Quem | O quê |
|---|---|
| agente | junta `origin/main` na `development` — as duas divergem com frequência, porque o Caio commita direto na `main` |
| agente | roda o build local; **é a única rede antes das clientes**, porque não existe ensaio na Netlify |
| agente | confere o que muda na tela da cliente e faz `git push origin development` |
| agente | `git checkout main` e `git merge --ff-only development` — deixa a `main` local pronta, **sem enviar** |
| agente | diz **o que vai ao ar**, avisa que custa **1 build** e lembra de anotar o ponto de retorno na Netlify |
| **Caio** | **1 clique** no bloco ` ```bash git push origin main ``` ` |
| agente | lê o terminal, confirma que o push entrou e confere o site no ar |

⛔ **O hook barra o agente se ele tentar publicar — e está certo.** Não é defeito, é o desenho, e o combinado acima existe justamente para o hook nunca precisar ser tocado. **Não editar `.claude/hooks/protege-producao.py`**, nem "só desta vez": trava que o agente abre sozinho não é trava. Se um dia a regra precisar mudar, quem muda é o Caio, no arquivo, de propósito.

⚠️ Existe uma **segunda camada de proteção**, do próprio Claude Code, que também recusa quando o agente tenta publicar ("Production Deploy"). Ela não está no repositório e não se desliga por aqui — e também não deve ser contornada.

⚠️ O hook barra `git push` **junto com qualquer outro comando** (`|`, `&&`, `;`). Até um `| tail -6` derruba. Push roda sozinho, sem nada depois.

## Se a produção quebrar depois de publicar (rollback)
Nesta ordem, e sem mexer em código:
1. Abrir o projeto **`7madrugadas`** na Netlify → aba **Deploys**.
2. Achar na lista o último deploy que estava bom (pela data/hora).
3. Clicar nele e usar **"Publish deploy"**. Volta em segundos, **não roda build novo** e portanto **não consome crédito**.
4. Só depois investigar a causa, com calma, **no teste local** — não existe mais ambiente de validação na Netlify.

As páginas HTML são servidas com `Cache-Control: no-cache`, então a volta atrás aparece na hora para as clientes.

⚠️ O ponto de retorno **não é um commit do Git**. O commit `6c90670` já contém o login — voltar para ele não restaura o site antigo aberto. A rede de segurança é o deploy antigo na Netlify: anote a data e o ID dele antes de promover.

## ⚠️ O login é portão de experiência, não de segurança
Decisão tomada de olhos abertos: o login esconde a tela de quem não entrou, mas **não tranca o conteúdo**. Os textos das orações (`js/dias.js`), os IDs dos vídeos e os PDFs continuam sendo arquivos públicos — qualquer pessoa com o link direto baixa sem e-mail nenhum.

O que o login entrega de verdade: saber quem entrou, medir progresso e mostrar ofertas. Isso ele faz bem.

Consequências que valem dinheiro:
- **Não prometer "conteúdo protegido" em nenhuma peça de venda.**
- Áudio (5,2 MB) e PDFs (1,6 MB) em endereço fixo consomem banda da Netlify de quem quer que baixe, inclusive robô e link colado em grupo de WhatsApp.
- Controle de acesso por papel na própria Netlify é **recurso de plano pago**, não um botão do plano gratuito. O caminho realista para proteção real é servir PDF e áudio pela API com link que expira — e isso é trabalho, não ajuste.

## Fluxo-alvo da Hubla
compra na Hubla → webhook → backend lê e-mail + produto + status → Supabase cria/atualiza entitlement → app consulta direitos → card libera sozinho.
Reembolso percorre o mesmo caminho removendo o entitlement certo.

## Objetivo do MVP técnico (a validar, nesta ordem)
cliente entra com e-mail → sistema a encontra → sabe o que comprou → mostra o conteúdo certo → registra onde parou → mantém em outro aparelho → libera/remove extras → depois recebe tudo automático da Hubla.

**Ordem de trabalho acordada:** primeiro criar usuários/compras/acessos **manualmente** no Supabase e validar login + entitlement + progresso. Só depois conectar a Hubla. Integração de pagamento não pode bloquear o teste do produto.

## ⚠️ Custos — vigiar sempre
- **Créditos do Netlify Free já foram zerados uma vez.** Plano pago ~US$9/mês em avaliação.
- **Nunca gastar deploy de produção em alteração pequena.** Desenvolver e testar localmente (inclusive Supabase, login, regras, progresso).
- Deploy externo só quando precisar de URL alcançável (teste real de webhook).
- **Três projetos na conta da Netlify, só um constrói** (ver a tabela no topo deste arquivo): `7madrugadas` = produção; `7-amens-app-v2` = congelado desde 21/09; `7sacredprayers` = versão americana. Publicar custa **1 build**, não 2. Não criar sites novos para fugir de créditos.
- Cada verificação de sessão do app grava no banco. O intervalo é de **5 minutos** (`js/member.js`); baixar esse número multiplica o consumo da Supabase.
- Alertar sobre qualquer risco de cobrança automática no cartão antes de acontecer.

## Segurança — calibragem
Site simples, superfície de ataque pequena, **não é a prioridade**. Exceções que importam de verdade: RLS no Supabase e não vazar chave de service_role no frontend.

## Fora do MVP (direção futura, não construir agora)
Novenas extras, biblioteca de PDFs, pedidos de oração com status pendente/respondido, jornadas de 21/30 dias, Rosário, calendário litúrgico, oração personalizada para familiares, comunidade privada, mini-formulário de perfil (máx. 7 perguntas, tom de padre acolhendo uma irmã — nunca formulário de marketing).

## Versão americana
Existe uma vertente para o público católico americano 40+ explorada à parte. **Não misturar as regras** com a operação brasileira. A infraestrutura atual a suporta no futuro.

## Princípio que rege tudo
O repositório deve explicar o negócio sozinho. Nenhum agente de IA deveria precisar "lembrar da conversa" para trabalhar com segurança aqui. Decisão importante → vai para o repositório, não fica no chat.
