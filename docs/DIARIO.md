# Diário de bordo — onde a gente parou

> **Leia isto primeiro, antes de qualquer coisa.**
> O `CLAUDE.md` diz *como as coisas são*. Este arquivo diz *onde paramos*.
> Regra: o mais recente fica em cima. Nada aqui é apagado, só empurrado para baixo.
> Quem lê este arquivo é o `/abrir`. Quem escreve nele é o `/fechar`.
> Atualizado: 2026-09-19

---

## 🔴 Esperando decisão do Caio

Nada anda nestes pontos até ele responder.

| # | Assunto | A pergunta |
|---|---|---|
| 1 | **Publicar o webhook no Supabase** | O conserto que impede o webhook de perder evento está commitado e já foi para a `main` — mas isso **não publica nada**: Edge Function do Supabase sobe por fora da Netlify. Enquanto ninguém publicar lá, o buraco que engoliu a venda de R$ 197 continua aberto. ⚠️ **Corrigido em 19/09:** este item também dizia que o relógio do painel esperava deploy na Netlify. **Já subiu**, dentro do commit `c83eb29` — conferido no conteúdo do arquivo, não no nome. Sobrou só a metade do Supabase. |
| 2 | **Conteúdo pago aberto por link direto** (achado #4 da auditoria) | Quem descobrir o endereço de um áudio ou PDF baixa sem ter comprado. Travar isso dá trabalho e muda a experiência. É decisão de negócio, não técnica. |
| 3 | **Topologia de branches** (achado #5 da auditoria) | Hoje teste e produção saem os dois da `main`. Isso precisa ser separado, mas envolve mexer em configuração da Netlify — e ele pediu para não mexer no que está no ar sem perguntar. |
| 4 | **Qual e-mail vale quando a cliente tem dois** | Três clientes têm um e-mail na fatura e outro na conta da Hubla (ver entrada de 18/09 sobre a janela cega). Elas vão tentar entrar com o do recibo, que o app não conhece. Dá para corrigir no painel, mas a pergunta é qual dos dois passa a valer: o do recibo é o que ela lembra; o da conta Hubla é o que o webhook vai continuar mandando nas próximas compras dela. |

---

## 🟡 Pendente — pode tocar sem perguntar

- 🆕 **Publicar a `member-api` corrigida no Supabase** (19/09). O conserto do painel travado em 500 clientes está pronto no código e testado na lógica, mas **não foi publicado na produção** — a sessão que o escreveu teve o acesso ao banco de produção bloqueado. Enquanto não subir, os quatro números do painel continuam errados e a busca continua cega para as clientes antigas. Mesmo bloqueio prático do item 🔴 nº 1: ninguém está conseguindo publicar Edge Function. ✅ **Já foi publicada e verificada no banco de teste** (19/09): 1.202 clientes de mentira, todas apareceram, nenhuma repetida, 1,5s. Falta só a produção. ⚠️ `verify_jwt` tem que ir como `false`.
- **Decidir sobre a headline "O Papa me pediu para mostrar isso pra vocês".** Já está no ar, na página de oferta. A revisão apontou que ela afirma um endosso que não existe, para vender assinatura recorrente, a um público para quem a palavra do Papa tem peso real — risco de estorno e de publicidade enganosa. Copy é decisão do Caio; ele foi avisado duas vezes e optou por seguir. Mudar agora custa um build.
- **A lista dos 26 achados menores da auditoria foi prometida e nunca entregue.** O Caio pediu e não recebeu.
- **Ver o pop-up e a página de oferta com os olhos, no site no ar.** Os dois públicos foram conferidos pelo caminho dos dados em 18/09 (ver a entrada de hoje), e a página foi testada na tela em `localhost` — mas ninguém abriu `setemadrugadas.com.br`, clicou no pop-up e percorreu até as cartas. As variantes de **segunda exibição** (`front_novas_2` e `front_antigas_2`, rótulos `-b`) continuam sem nenhum teste.
- **Esperar a primeira venda dos Arcanjos vinda do pop-up.** Até 19/09 existiam 42 vendas do produto e **nenhuma** veio do pop-up — todas vieram do upsell pós-compra do funil. Não é defeito: o pop-up só passou a apontar para a página dentro do app em 18/09, e o rastreamento subiu em 19/09. A consulta que separa as duas origens está comentada no fim de `supabase/etiquetar-popup-para-medir-venda.sql`.
- **Conferir a etiqueta numa venda de verdade.** Depois que o rastreamento do pop-up estiver ligado, abrir a primeira venda dos Arcanjos na Hubla e ver se o campo "Parâmetros de UTM" traz o nome do pop-up. A documentação oficial da Hubla diz que traz, e o nosso webhook já guarda o evento inteiro — mas **nenhuma venda real passou por esse caminho ainda**.
- **Opcional, economia de peso:** `assets/audio/dia-01-oracao.mp3` está em estéreo 192kbps (4,98 MB). Em mono 64kbps cai para 1,66 MB. Voz falada não perde nada audível. São ~3,3 MB a menos para cada cliente baixar.
- **Avisar as três clientes de e-mail duplo.** `cliente A · e-mail da fatura`, `cliente B · e-mail da fatura` e `cliente C · e-mail da fatura` **não conseguem entrar** — o app as conhece por outro endereço. Não é bug, é a diferença entre o e-mail do recibo e o da conta Hubla. Depende da decisão nº 4 acima para saber qual e-mail gravar.
- **Conferir o resgate do webhook contra um Supabase de verdade.** A correção foi testada num banco de mentira, escrito por mim a partir do que eu *acredito* que o PostgREST faz. O ponto exato que precisa de confirmação é o comando que grava a linha de falha (`on_conflict=idempotency_key` com `resolution=merge-duplicates`). Se o banco real se comportar diferente, a rede de segurança não abre — e só se descobre na próxima falha. O jeito de confirmar: publicar a função no projeto de **teste** e disparar um evento de mentira. Não depende de decisão nenhuma.
- **Ver as datas corrigidas no painel de verdade.** A correção do fuso passou em 11 conferências × 4 fusos, mas ninguém abriu o `admin.html` e olhou a ficha de uma cliente com a tela. O banco de teste não tem admin cadastrado nem cliente com visitas, então isso ficou de fora.
- **Rodar `supabase/conferir-acessos-perdidos.sql` depois de cada dia de vendas.** É a rede de segurança que acha quem pagou e ficou sem acesso. Leva segundos e não altera nada.
- **`node` não está no PATH do Windows.** Até alguém acrescentar `C:\Program Files\nodejs`, todo comando precisa do caminho completo. Não é urgente, é chato.

---

## 2026-09-19 — Painel admin travado em 500 clientes

**Chat:** este. **Status: publicado e verificado no banco de TESTE. Na produção, ainda NÃO.**

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

### O que ainda NÃO foi verificado

- **Os tipos não foram checados:** o Deno não está instalado nesta máquina. Na prática o código rodou, o que vale mais — mas não é a mesma coisa.
- **Ninguém abriu o `admin.html` e olhou com os olhos.** O teste foi pelo caminho dos dados: login de verdade, resposta de verdade, números conferidos. A tela em si não foi vista.
- **Não sabemos quantas clientes a produção tem.** A consulta ao banco de produção foi bloqueada pelo modo de segurança da sessão.

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
