# App em inglês (7 Amens Before Dawn) - plano de execução

> Criado em 13/11/2026. Fonte de verdade do app dos EUA.
> Área de trabalho: worktree `D:\Downloads Certos\PkScale\7amens-en-app`, branch `en-app`, nascida da `origin/main` (cb3b354).
> Irmão mais velho: `docs/app-es.md` (o app em espanhol). O inglês é uma CÓPIA dele, traduzida.

## Em uma frase
A cliente americana que compra o "7 Amens Before Dawn" recebe um app em inglês em `setemadrugadas.com.br/en`: entra com o e-mail da compra e reza uma oração por dia, no mesmo desenho e com as mesmas funções do app em espanhol.

## Decisões do Arthur (13/11/2026)
| Assunto | Decisão |
|---|---|
| Base | **tudo igual ao espanhol**, só traduzido. Nada muda no visual nem nas funções |
| Regras | as do espanhol: acesso de 12 meses, reembolso e disputa não tiram o acesso, uma oração por dia desde o primeiro acesso, virando à meia-noite do fuso do celular |
| Endereço | o mesmo domínio, em `/en` |
| Checkout | **por último**: ainda está sendo montado. As funções de pagamento (o equivalente de `latam-kashpay`, `latam-whop`, `latam-digistore`) só depois |
| Vídeos | já em produção (roteiros no Drive, ver "Fontes"). Enquanto não chegam, cada dia mostra a foto e o texto |
| Suporte (e-mail e WhatsApp) | o Arthur manda depois |
| `7sacredprayers` | fora da conta: não mexer |
| Revisão do inglês | **sem revisão nativa**: o agente faz a tradução e uma revisão independente com subagente |
| Supabase | o Brasil vai baixar o volume; se precisar, o Arthur paga mais. Antes de ir ao ar, desligar o bloqueio do limite de gasto (o excesso custa US$ 2 por milhão) |

## A regra que manda em tudo: Brasil e espanhol não sentem NADA
Mesmo Netlify, mesmo repositório e mesmo Supabase, com prefixo próprio.

1. **Site: tudo do inglês começa com `en`.**
   - Páginas: `en.html` (abre em `/en`) e `en-*.html`, com nome em inglês (tabela abaixo).
   - Programação: `js/en/` (os arquivos têm os MESMOS nomes de `js/es/`, para comparar e copiar de novo com facilidade).
   - Visual: `css/en/`.
   - Imagens: `assets/en/img/` (cópia das fotos sem texto do espanhol). PDFs em inglês: `assets/en/pdf/`, quando existirem.
2. **Nenhum arquivo do Brasil nem do espanhol muda.** O `scripts/build.mjs` já leva os `.html` da raiz e as pastas `js`, `css` e `assets`.
3. **As páginas `en` não carregam nada de `js/es`, `css/es`, nem do Brasil.**
4. **Navegador:** chaves `amens-en.*`.
5. **Banco:** tabelas `en_*` no mesmo projeto (`supabase/en/*.sql`). Os nomes dos campos da API são os mesmos do espanhol (`cliente.nombre`, `hoy`, `abierto`…), de propósito: a função é a mesma cópia.
6. **Funções:** `en-api` (entrar, sessão, progresso), `en-chat` (o chat de suporte) e `en-refund` (o reembolso em um toque). Sessão no cabeçalho `x-en-session`. Segredos com prefixo `EN_`.
7. **Fuso padrão** (quando o celular não manda um válido): `America/New_York`.

### Os endereços
| Espanhol | Inglês |
|---|---|
| `/es` | `/en` |
| `/es-entrar` | `/en-login` |
| `/es-novena` | `/en-journey` |
| `/es-dia?dia=N` | `/en-day?dia=N` |
| `/es-arcangeles` | `/en-archangels` |
| `/es-arcangel?a=` | `/en-archangel?a=` |
| `/es-oracion-arcangel?a=&o=` | `/en-archangel-prayer?a=&o=` |
| `/es-cantico` | `/en-canticle` |
| `/es-cantico-dia?dia=` | `/en-canticle-day?dia=` |
| `/es-oferta-arcangeles` | `/en-offer-archangels` |
| `/es-oferta-cantico` | `/en-offer-canticle` |
| `/es-reembolso` | `/en-refund` |
| `/es-admin` | `/en-admin` |

A cópia mecânica (nomes, endereços, prefixos) foi feita por um script em 13/11; a tradução vem por cima.

## Glossário (termos fixos)
Saem dos roteiros em inglês já aprovados no Drive. **O app usa as mesmas palavras que o padre fala nos vídeos.**

| Português | Inglês |
|---|---|
| 7 Améns da Madrugada | **7 Amens Before Dawn** |
| Padre Tiago | **Father James Brennan** ("Father James" no texto corrido) |
| a freira do Dia 3 | **Sister Cecilia** |
| Introdução (Dia 0) | **Start Here** |
| Dia 1 · Pai Nosso Completo | **First Amen · The Complete Our Father** |
| Dia 2 · Perdão | **Second Amen · The Prayer for Forgiveness** |
| Dia 3 · Cura | **Third Amen · The Prayer for Healing** |
| Dia 4 · Libertação | **Fourth Amen · The Prayer for Deliverance** |
| Dia 5 · Prosperidade | **Fifth Amen · The Prayer for Prosperity** |
| Dia 6 · Paz | **Sixth Amen · The Prayer for Peace** |
| Dia 7 · Aliança | **Seventh Amen · The Covenant Prayer** |
| madrugada | **early morning** / **morning** ("seven early mornings", "one morning at a time") |
| horário | **between four and seven in the morning** |
| "Abre amanhã" (cadeado) | **Unlocks tomorrow** |
| "Concluí esta oração" | **I prayed this prayer** |
| "Não sei qual e-mail usei" | **I don't know which email I used** |
| "Fale conosco" | **Contact us** |
| As 3 Madrugadas | **Three Mornings of Intercession** (US$ 27) |
| Basílica das Sete Orações | **Basilica of the Seven Prayers** (contribuições: "a section of the floor, a pew, a stone for the altar") |
| Central dos 4 Arcanjos | **The Four Archangels** (provisório) |
| Cântico Angelical | **Angelic Canticle** |
| Material de presente | **Bonus material** |
| Pai Nosso | o texto tradicional das paróquias americanas: "Our Father, who art in heaven…" |
| Lucía (chat de suporte) | **Lucy** (provisório) |
| 7 Oraciones Sagradas (card e lista) | **The Seven Prayers** (não "7 Sacred Prayers", que lembra a outra operação; é como a Sister Cecilia fala) |
| Declaración del día | **Today's words of faith** ("declaration" soa evangélico nos EUA) |
| Contribuições do Dia 3 | **A section of the floor · A pew · A stone for the altar** (como no vídeo; valores `[US$ ?]`) |

### Contas de prova (banco de TESTE)
- `teste.en@exemplo.com` (Mary Test): app, Arcanjos e Cântico; também é administradora.
- `teste.en.basico@exemplo.com` (Ann Test): só o app.
Primeiro acesso das duas: 13/11/2026.

### Como funciona sem checkout
Toda leitura de compra passa pela visão `en_pedidos_pagos` (`02-compras.sql`), hoje vazia. O checkout entra trocando o select dessa visão. Até lá: extras só liberados à mão no painel; pop-ups nascem desligados; o resgate pelo cartão não acha ninguém e segue para a emergência; o reembolso grava o pedido e a equipe procura. A Lucy nasce desligada (ver "A Lucy", abaixo).

### Decidido pelo Arthur (14/11/2026): fica igual ao espanhol
- Página de venda dos Arcanjos: "The Pope asked me to share this with you", "Your guardian angel is Saint Michael" e "he will transform your whole life" ficam como estão, tradução fiel do espanhol. Os agentes tinham apontado o risco (fala por pessoa real, anjo da guarda não é arcanjo, promessa); o Arthur decidiu manter. Não "corrigir".
- Roteiro de São Miguel 1 (Drive): "I declare that my life belongs to the Lord" fica, igual ao espanhol.
- "your husband or wife" no Dia 7, num público de mulheres (está no roteiro do vídeo).

Registro: inglês americano, católico, "you" acolhedor, frases curtas e letra grande (mulheres 45+). Nunca vocabulário evangélico ou de autoajuda (born again, breakthrough, I declare, manifest, the universe, energy). Grafia dos EUA.

## Fontes do conteúdo em inglês (Drive "7 Améns [EUA - Inglês]", pasta 02. Entregável)
| O quê | Doc | Situação em 13/11 |
|---|---|---|
| Vídeos da jornada (Dia 0 a 7) | `1X5ZQq4Gl-6KE-QfrkEu3SKw5UqylANlQpYai-Oxz0KI` | ✅ roteiros prontos |
| PDFs da jornada | `1UG2XK8MOJNlunsRi9EnNjnKvdK3llc-BwhZLl4KsUZw` | ⏳ vazio |
| Áudios dos 4 Arcanjos (12) | `1AzO3BgVvnEeqzTa3E3llXfXAShAUguEHyY0qU5lW7-k` | ✅ roteiros prontos |
| Cântico (7 dias) | `1AnOhpIfukRH7e-THIwUjwQM7gkU_6DxbeqOJO3QvYhQ` | ✅ roteiros prontos |
| Textos das telas | `1yPqBsquUZHY99NrRWet2mJLY_kFibV7YPtU-mmwosLE` | ⏳ vazio (o app é a fonte) |
| Oferta do Dia 3 (Basílica) | `1aLHO9awAmdLmrEPWP4K_oPndlUfrWh2A5pgBTRJxr38` | ⏳ vazio; a fala da Sister Cecilia está no doc dos vídeos |

## Os blocos
| Bloco | O quê | Situação |
|---|---|---|
| 0 | Worktree `en-app`, este plano e a cópia mecânica | ✅ 13/11 |
| 1 | Tradução das telas, dos textos e das mensagens, mais uma revisão independente (17 correções) | ✅ 13/11 |
| 2 | Banco `en_*` (18 tabelas, ordem 01 → 02 → 03 → 04 → 05 → 09 → 10 → 11) e funções `en-api`, `en-chat`, `en-refund` (v1, JWT desligado) no banco de TESTE. Provas: `testa-en-api` 219 ok, `testa-en-chat` 110 ok, `testa-en-refund` 24 ok, `supabase/en/testes/prova-http.mjs` 14 ok | ✅ 13/11 |
| 3 | Prova no computador (`localhost`, 375 px): entrar, home, lista, Dia 1 com "I prayed this prayer" e desfazer, trava ("It unlocks in 2 days"), Arcanjos, Cântico, cliente sem extras (cadeado e "Learn more"), reembolso, sair. Sem erro no console | ✅ 13/11 |
| 4 | PDFs em inglês (`assets/en/pdf/`, 12 arquivos, ~1 MB no total) e a página de entrega `/en-materials` (cópia da `/materiales`) | ✅ 13/11 |
| 5 | Vídeos, áudios dos Arcanjos e do Cântico, quando chegarem (Bunny, armazenamento próprio do inglês) | ⏳ |
| 6 | Checkout: Digistore24 dos EUA, função `en-digistore` e `13-digistore.sql` (ver "A venda pela Digistore24") | ✅ 14/11 |
| 7 | **NO AR desde 14/11/2026, ~01h50 (Brasília).** Banco: os 9 arquivos num SQL só (01 → … → 11 → 13), colado pelo Arthur, 20 tabelas com RLS. Funções `en-api` (v4, com o e-mail novo), `en-refund`, `en-digistore`, `en-chat` (Lucy desligada), todas com o JWT desligado. Segredo `EN_DIGISTORE_IPN_PASSWORD` e a conexão IPN na conta da Digistore dos EUA ("Test connection" OK). 4 administradores (os mesmos do Brasil e da LATAM, pela carga do `04-admin.sql`). Site: `cb3b354..0602b4e`; ponto de retorno na Netlify: o deploy `6af7794a…` de 13/11, 17h55 | ✅ 14/11 |

## Os PDFs em inglês (13/11/2026)
A oficina mora FORA do repositório, em `D:\Downloads Certos\PkScale\7 Améns EUA\_montagem\` (como a do espanhol, em `7 Améns LATAM\_montagem\`). Os PDFs prontos ficam em `7 Améns EUA\PDFs in English\`, e uma cópia de cada vai para `assets/en/pdf/`.

| Arquivo no app | Gerado por | Onde aparece |
|---|---|---|
| `start-here-guide.pdf` (6 p.) | `materiais_en.py` | Dia 0 e `/en-materials` |
| `day-1-first-amen.pdf` … `day-7-seventh-amen.pdf` (2 p. cada) | `dias_en.py` | cada dia e `/en-materials` |
| `complete-our-father.pdf`, `one-prayer-two-languages.pdf` | `materiais_en.py` | "Bonus material" da lista e `/en-materials` |
| `prayers-to-the-holy-archangels.pdf` (6 p.) | `extras_en.py` | Central dos Arcanjos (Michael, Gabriel e Raphael; Uriel não está, como no espanhol) |
| `novena-mary-undoer-of-knots.pdf` (12 p.) | `extras_en.py` | Cântico (o presente; no espanhol, a Novena a la Virgen Desatanudos) |

⚠️ **Os PDFs dos dias e o guia leem o texto de `js/en/dias.js`.** Mudou um texto lá, rodar `dias_en.py` e `materiais_en.py` de novo e copiar para `assets/en/pdf/` (o `LEIA-ME.txt` da oficina diz como). Assim o app e o PDF nunca dizem coisas diferentes.

⚠️ A primeira página de cada dia fica meio vazia: a oração vai inteira para a página 2. É igual no espanhol (o desenho não parte a oração).

## Revisão de 13/11/2026 (depois dos PDFs)
- **Varredura do código:** nenhum link quebrado, nenhum arquivo do espanhol ou do Brasil referenciado, nenhum texto visível em espanhol.
- **No navegador (localhost, banco de TESTE, 375 px):** home com o card "Your PDF materials"; Dia 0 com o botão do PDF; os 12 PDFs e a `/en-materials` respondem 200; "Bonus material" na lista; Arcanjos e Cântico com o PDF no aviso "Audio coming soon"; cliente sem extras com cadeado; resgate de quem esqueceu o e-mail (nome → cartão → "I'd rather not use my card" → entrada de emergência), que entra e aparece no painel; painel `/en-admin` em inglês. Nenhum erro no console.
- Ficou no banco de teste a cliente de prova da emergência, `teste.en.emergencia@exemplo.com` (nome "Ann Test"), esperando no painel.

## 🔴 Antes de ir ao ar (sem isto, não publicar)
1. ✅ **Canal de ajuda (14/11):** e-mail próprio dos EUA, `sevenamenssupport@gmail.com` (Arthur, na noite de ir ao ar), em `js/en/config.js`, no `SUPPORT_EMAIL` da `en-api` e no manual da Lucy. O WhatsApp continua o provisório da LATAM (+55 88 99443-2257): ⚠️ quem atende fala espanhol; trocar quando houver número americano. Conferido na tela (com o e-mail antigo): "Contact us" abre o e-mail com o assunto em inglês, e o card do WhatsApp leva a mensagem já escrita em inglês. A Lucy está pronta e provada no TESTE (ver "A Lucy").
2. ✅ **Checkout (14/11, provado só no TESTE):** Digistore24 dos EUA, a função `en-digistore` e o `13-digistore.sql`, que liga a visão `en_pedidos_pagos` aos pagamentos. Falta colar na produção: os passos estão em "A venda pela Digistore24". Sem isso, ninguém entra sozinha.
3. **Desligar o bloqueio do limite de gasto do Supabase** (ver "Decisões").
4. As páginas de venda dos extras (`/en-offer-archangels`, `/en-offer-canticle`) hoje só mostram o título: precisam do vídeo. O checkout já está ligado (14/11). Sem o vídeo, o botão do Cântico aparece desde o começo, e as cartas dos Arcanjos só depois de ~8 min de página aberta (a rede de segurança).

## A Lucy, o chat de suporte (14/11/2026, ✅ provada só no TESTE)
Cópia da Lucía do espanhol (`supabase/functions/en-chat/`, `supabase/en/10-chat.sql`, `js/en/lucia.js`).
- **Chave:** a MESMA da Lucía, o segredo `ANTHROPIC_API_KEY`, que já existe no teste e na produção (decisão do Arthur, 14/11: uma chave só; o gasto do inglês sai separado no banco, em `en_chat_mensagens`). Se um dia o inglês tiver chave própria, basta criar `EN_ANTHROPIC_API_KEY`: ela vem primeiro.
- **Manual:** `D:\Downloads Certos\PkScale\7 Améns EUA\Chat\manual-lucy.md` (versão 3), FORA do repositório público, colado em `en_chat_config.manual`. Adaptado do manual da Lucía, com os nomes das telas em inglês, o suporte provisório e sem prometer número de dias de garantia (a Digistore dá 60 dias nos EUA; quem confirma é a equipe).
- **Diferenças da Lucía (14/11):**
  - **crise:** motivo próprio `crisis` (gravado como `other`, com `[CRISIS]` no começo do resumo); a tela NÃO mostra botões nem a mensagem pronta, e o aviso interno manda não falar de botões nem de prazo;
  - **idioma:** responde no idioma em que a cliente escreve; em espanhol, trata por "tú" e aponta `/es`; em português, aponta o app brasileiro;
  - **manual §11:** só diz que a compra está registrada quando tem os dados da cliente (quem ainda não entrou não ouve isso).
- **Provas:** `testa-en-chat.mjs` 110 ok; no TESTE, 12 conversas difíceis e depois as 5 corrigidas, todas certas (~US$ 0,004 por resposta, 4 a 10 s).
- **Estado do TESTE:** `en-chat` v3 com o manual versão 2 e `ligado = true`, com freios aumentados para testar (500 mensagens/dia, 100 conversas/h; os da produção são 40 e 6). Depois da v3 o arquivo ganhou só textos (o aviso interno da crise, o "tú", comentários) e o manual a versão 3 ("Welcome her calmly"): na produção, colar os arquivos atuais.
- **Para ligar na produção (o Arthur cola, no dia de ir ao ar):** o `10-chat.sql` já entra com o resto do banco; depois `update en_chat_config set manual = <o manual>, ligado = true where id = 1;` e a função `en-chat` pelo painel (nome antes do *Deploy*, "Verify JWT" desligado). A chave já está lá.
- ⚠️ A Lucía do espanhol (no ar) tem as mesmas duas falhas que foram corrigidas aqui (botões na crise e "compra registrada" para quem não entrou). Anotado no cérebro em 14/11.
- Ainda igual à Lucía (menor): a mensagem pronta para a equipe começa na voz dela ("Hello, I am…") e segue com o resumo na terceira pessoa; e um segundo caso na mesma conversa sobrescreve o motivo do primeiro.

## A venda pela Digistore24 (`en-digistore`, 14/11/2026, ✅ provada só no TESTE)
**Em uma frase:** a cliente paga na Digistore24 dos EUA, o aviso da Digistore (IPN) chega na função `en-digistore`, e o app abre sozinho para o e-mail da compra, com o extra quando ela comprou os Arcanjos ou o Cântico.

### Decisões do Arthur (14/11/2026)
- **Conta da Digistore própria dos EUA**, separada da da LATAM: outra senha do aviso e outros números de produto.
- **Os números** (print do Arthur), cadastrados na tabela `en_digistore_products`:

  | Número | Nome na Digistore | No app |
  |---|---|---|
  | 741394 | The 7 Amens of the Early Morning | `principal` (front) |
  | 741402 | The 7 Amens of the Early Morning 27 | `principal` (front com outro preço) |
  | 741403 | The 7 Amens of the Early Morning 57 | `principal` (front de teste a US$ 57, 14/11) |
  | 741399 | Protection of the Four Archangels | `arcangeles` (Up 01) |
  | 741401 | Angelic Canticle | `cantico` (Up 02) |

- **Os extras dentro do app usam os MESMOS produtos do funil** (741399 e 741401), no link padrão `https://www.checkout-ds24.com/product/…`, como no espanhol. O que separa a venda do app da do funil é a etiqueta `utm_source=app-en`, que as páginas já colam (`en-offer-archangels.html`, as 4 cartas; `en-offer-canticle.html` + `js/en/oferta-vsl.js`, o botão).
- **Só a nossa função libera.** A automação do Pedro (Make + Brevo) NÃO roda nos EUA. Se a função falhar, a rede é a própria Digistore, que repete o aviso até receber `OK` (pelo menos 20 vezes em 10 dias), e a lista `needs_review` (consultas no fim do `13-digistore.sql`).
- **A página de obrigado e o e-mail da Digistore** já levam a `/en` e a `/en-materials` (Arthur, 14/11).
- Ainda **sem produto na Digistore**: as três contribuições do Dia 3 (`aporte`) e Three Mornings of Intercession (`tres_madrugadas`). Os botões de `js/en/oferta-dia.js` continuam vazios. Quando existirem, cadastrar os números ANTES da primeira venda (o molde está no `13-digistore.sql`) e pôr os links com as etiquetas que o próprio arquivo descreve.

### Como funciona
- **Produto conhecido = está na tabela.** Nada é reconhecido pelo nome. Número que não está lá fica `needs_review` e não libera nada (a equipe cadastra e libera à mão no `/en-admin`; a Digistore não reenvia um aviso que já recebeu `OK`). Oferta nova = uma linha de SQL, sem publicar a função.
- Todo produto conhecido libera o app por **12 meses**, "ativo até a data mais longe" (comprar de novo nunca encurta). Arcanjos e Cântico também liberam o extra. Contribuição e Three Mornings só renovam o app.
- **A origem em `en_access` é `checkout`**, a que o app em inglês reservou para "a venda" desde o começo: o painel mostra "from the purchase" e a Lucy conta como compradora (`en_chat_posicao`). Por isso a trava de origem e o `10-chat.sql` não mudaram. Quem cobrou fica em `en_digistore_events`.
- **Reembolso e disputa só registram** (a regra do espanhol). Na visão, a compra vira `devuelto = true` (o reembolso em um toque mostra como devolvida). Tirar o acesso é o "Remove" do `/en-admin`.
- **Compra de teste (Testpay) na produção fica `ignored`** e não libera, de propósito. No banco de TESTE ela libera, para dar para provar o caminho.
- **A visão `en_pedidos_pagos` lê os pagamentos da Digistore**: os extras, os pop-ups (não oferecem o que ela já comprou), o painel e o reembolso enxergam a compra. ⚠️ Rodar o `02-compras.sql` de novo depois do `13` volta a visão para a vazia.
- **Dado pessoal, o mínimo:** e-mail, nome e país vão só para `en_customers`. A linha do aviso guarda o `customer_id` e os NOMES dos campos (`campos`), nunca o e-mail.
- A assinatura é a do espanhol (SHA-512 do guia oficial), com a senha no segredo **`EN_DIGISTORE_IPN_PASSWORD`**. A resposta é o texto exato `OK`.

### O que o aviso da Digistore NÃO traz (guia oficial, relido em 14/11)
- **Os números do cartão.** O resgate pelo cartão (`/en-login` → "I don't know which email I used") não acha quem comprou pela Digistore e segue para a entrada de emergência.
- **As etiquetas `utm_*`**: o guia não lista. ⏳ Conferir no primeiro aviso real (coluna `campos`). Se não vierem, o painel conta 0 vendas por pop-up.
- **O upsell tem o MESMO pedido (`order_id`) da compra principal**, com transação própria: por isso a "compra" do app é a transação, não o pedido.

### Arquivos
| Arquivo | O quê |
|---|---|
| `supabase/functions/en-digistore/index.ts` | a função (cópia da `latam-digistore`, com a tabela de produtos e vários produtos por pagamento) |
| `supabase/functions/en-digistore/testa-en-digistore.mjs` | teste local, banco de mentira: 69 conferências |
| `supabase/en/13-digistore.sql` | `en_digistore_products` (com os 4 números), `en_digistore_events` e a visão `en_pedidos_pagos` de verdade |
| `supabase/en/testes/prova-digistore-no-teste.mjs` | prova de ponta a ponta no banco de TESTE |
| `js/en/admin.js` | o painel ganhou os nomes das ofertas dos Dias 3 e 7 |

### Provado (14/11/2026)
- **Local:** `testa-en-digistore` 69 ok; `testa-en-api` 219 ok e `testa-en-refund` 24 ok continuam verdes.
- **Banco de TESTE:** `13-digistore.sql` rodado (as 2 tabelas com RLS, a visão com `security_invoker`); `en-digistore` v1 publicada com o JWT desligado; `prova-digistore-no-teste.mjs` 15 de 15: teste de conexão, venda do front, ela entra no app pelo e-mail da compra (acesso até 2027), Arcanjos no mesmo pedido e a repetição (nada duplica), Arcanjos aparecem na sessão, o reembolso enxerga as 2 compras, o reembolso dos Arcanjos só registra (o acesso continua e a compra aparece devolvida), produto desconhecido não libera ninguém, senha errada recusada. No banco: app e Arcanjos com origem `checkout`, o painel com 2 pagamentos e os 2 produtos, `en_extras` com "compra". As clientes de mentira (`@exemplo.com`) foram apagadas.
- ⏳ **Não conferido no navegador:** as cartas e o botão saindo com a etiqueta. O código que cola a etiqueta é o do espanhol, conferido no navegador em 13/11; só o endereço mudou.

### ⏳ Ir ao ar (junto com o resto do app em inglês, bloco 7; o Arthur clica, uma tela por vez, com foto; nunca entre 3h e 8h de Brasília)
1. **O banco.** Depois dos outros arquivos `en_` (01 → 02 → 03 → 04 → 05 → 09 → 10 → 11), o `13-digistore.sql` no *SQL Editor* da produção. O agente põe o arquivo na área de transferência; o Arthur cola e roda. O agente confere com as consultas "CONFERIR" do fim do arquivo (leves).
2. **A função.** *Edge Functions → Deploy a new function → Via Editor*. Apagar o exemplo e colar `supabase/functions/en-digistore/index.ts` (o agente põe na área de transferência). **Escrever o nome `en-digistore` no campo do nome ANTES do *Deploy function*** (renomear depois não muda o endereço). Depois, aba *Settings* → desligar **"Verify JWT with legacy secret"** → *Save changes*. O agente confere a versão e o JWT desligado.
3. **A senha.** O agente gera uma senha longa e põe na área de transferência. O Arthur cola a MESMA em dois lugares: no Supabase, *Edge Functions → Secrets*, com o nome `EN_DIGISTORE_IPN_PASSWORD`; e na Digistore, no campo da senha da conexão (passo 4). Sem ela, todo aviso volta recusado (401), e a Digistore fica repetindo.
4. **A conexão na Digistore dos EUA.** *Settings → Integrations (IPN) → Add new connection → Generic*: URL `https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/en-digistore`, a senha do passo 3, os 4 produtos, os eventos de pagamento, reembolso e disputa, timing **"Before redirect to thank you page"**. Salvar e clicar **"Test connection"**: tem de dar OK. Os artigos da Digistore divergem nos nomes dos campos: conferir na tela, com foto.
5. **A primeira venda real.** O agente confere `en_digistore_events` (consulta leve, com `limit`): `recorded`, "App: acesso até…", e se a coluna `campos` traz os `utm_*`. Provar com Testpay na produção NÃO serve (fica `ignored`). Prova real = uma compra da equipe e depois o reembolso pela Digistore (só registra; tirar o acesso dela é no `/en-admin`).

Cada passo é inofensivo sem o seguinte. Nenhum build a mais: os links das páginas entram no build do app em inglês.

**Opção não usada:** depois do `OK`, a resposta pode levar linhas `loginurl:` e `username:`, que a Digistore mostra no e-mail de compra (só com o timing "Before redirect to thank you page" e "group by upsells" desligado). Não faz falta enquanto o e-mail já leva ao app.

### Voltar atrás
- **Parar de liberar:** desativar a conexão na Digistore. Quem já entrou continua com o acesso.
- **A função:** apagar a `en-digistore` no painel (o aviso passa a dar erro, e a Digistore repete por 10 dias).
- **O banco:** seção DESFAZER do `13-digistore.sql` (a visão volta a ser a vazia rodando o `02-compras.sql`). O acesso de quem já foi liberado fica.

## A venda pela Hubla (`en-hubla`, 19/11/2026, ✅ provada só no TESTE)
**Em uma frase:** a página de venda dos Arcanjos dentro do app (`/en-offer-archangels`, nova em 19/11) vende pela Hubla, em dólar. O aviso da Hubla chega na função `en-hubla`, que libera o app (12 meses) e os Arcanjos para o e-mail da compra, com as mesmas regras da Digistore.

- **Separada do Brasil (decisão de 19/11):** a `en-hubla` recebe de uma integração de webhook PRÓPRIA na Hubla (cada integração tem o seu token; segredo `EN_HUBLA_WEBHOOK_TOKEN`). A `hubla-webhook` do Brasil, a `hubla_events` e o `hubla_product_map` não mudaram. ⛔ Nunca cadastrar estes códigos no `hubla_product_map`: a venda americana abriria o app brasileiro.
- **Os códigos** (`en_hubla_products`, `supabase/en/14-hubla.sql`), todos → `arcangeles`: `iUKyTVZAZdUij7F61dFt` (o produto e a oferta The Complete Shield, $98) · `9TXhK3aXGlTym1dxWgXm` (The Shield of Michael, $49) · `rKFwFW1A2b7KkM4R0Po3` (The Family Fortress, $147). **Os três níveis abrem a Central inteira** (Arthur, 19/11): o app não separa por nível.
- **Libera em** `customer.member_added` e `invoice.payment_succeeded` (os dois: a Hubla não garante a ordem e não manda `member_added` para quem já tem a oferta). Liberar duas vezes não muda nada. **Reembolso, disputa e "acesso removido" só registram.** Código desconhecido = `needs_review`, nada liberado: cadastrar o código e **reenviar o aviso pelo histórico da Hubla** (a função atualiza a linha). Aviso de teste da Hubla (`x-hubla-sandbox: true`) na produção fica `ignored`.
- **A visão `en_pedidos_pagos` lê a Digistore E a Hubla** (uma linha por fatura paga, `pedido` = `hubla:<fatura>`). ⚠️ Rodar o `13-digistore.sql` (ou o `02`) de novo depois do `14` tira as compras da Hubla da visão: rodar o `14` em seguida.
- **Forma do aviso:** a documentação oficial (hubla.gitbook.io/docs/webhooks, lida em 19/11) e os dois primeiros avisos reais deste produto (19/11, 19h50: assinatura **grátis** de um administrador, no `hubla_events` do Brasil, `needs_reconciliation`; não são vendas, não há o que liberar). ⏳ **Na primeira venda paga, conferir** em `en_hubla_events` o `amount_cents` e a `currency` (a documentação não deixa claro se venda em dólar vem em centavos de dólar) e os `utm_*`.
- **Arquivos:** `supabase/functions/en-hubla/index.ts`, `supabase/en/14-hubla.sql`, `supabase/en/testes/prova-hubla-no-teste.mjs`.
- **Provado no TESTE (19/11):** `en-hubla` v1 (JWT desligado) e o `14` rodado; `prova-hubla-no-teste.mjs` 14 de 14 (libera, a repetição não duplica, ela entra no app com os Arcanjos e 12 meses, o reembolso lista US$ 34,30 e depois "devolvida", o acesso fica, código desconhecido não entra, token errado 401); `prova-digistore-no-teste.mjs` 15 de 15 de novo com a visão nova. Clientes de prova apagadas.
- **Ruído no Brasil:** enquanto a regra de webhook do Brasil mandar "todos os produtos", a `hubla-webhook` também recebe estas vendas e grava `needs_reconciliation` ("Produto não mapeado"). É inofensivo (nada é liberado no Brasil). Para calar, tirar este produto da regra do Brasil na Hubla.

### ⏳ Ir ao ar (o Arthur clica, uma tela por vez; nunca entre 3h e 8h de Brasília)
1. **Banco:** `supabase/en/14-hubla.sql` no *SQL Editor* da produção. Conferir com o bloco CONFERIR do fim.
2. **Função:** *Edge Functions → Deploy a new function → Via Editor*, colar `supabase/functions/en-hubla/index.ts`, **nome `en-hubla` antes do Deploy**, depois *Settings* → desligar "Verify JWT with legacy secret".
3. **Hubla:** *Integrações → Webhooks* → **nova integração** "App EN" (não mexer na do Brasil) → copiar o **Token de Autenticação**. Criar a regra: URL `https://lbaudlocfbjunnaoyrtz.supabase.co/functions/v1/en-hubla`, produto **Protection of the Four Archangels** (todas as ofertas), eventos de **Membro** (acesso concedido e removido) e de **Fatura** (pagamento realizado, reembolsada, status atualizado). Deixar a regra **pausada** até o passo 4.
4. **Segredo:** no Supabase, *Edge Functions → Secrets*, `EN_HUBLA_WEBHOOK_TOKEN` = o token do passo 3. Só então **ligar a regra** na Hubla. (Sem o segredo a função responde 401, e a Hubla NÃO repete 4xx: o aviso fica só no histórico.)
5. **Site:** o build do app em inglês (os áudios dos Arcanjos e a página de venda nova).
6. **Primeira venda:** conferir `en_hubla_events` (consulta leve do fim do `14`).

**Voltar atrás:** pausar a regra "App EN" na Hubla. Quem já entrou continua.

### O checkout da Hubla (19/11/2026)
- **Foto do produto:** a arte dos 4 Arcanjos do card da home (`assets/images/home/arcanjos.jpg`), posta pela API (a Hubla guarda uma cópia).
- **Banner no topo de cada oferta** (layout `top_and_bottom_banner`), feito por script com a mesma arte, o nome da oferta e uma frase: `setemadrugadas-en.b-cdn.net/checkout/banner-{michael|complete|family}-{desktop|mobile}-v2.jpg`. Arquivos em `7 Améns EUA/Checkout Hubla - banners/`. A Hubla mostra o banner num quadro de 340 px de altura que corta as laterais (`object-fit: cover`): ~1,1:1 no celular e ~1,7:1 no computador. Por isso as artes têm 1080×980 e 1400×820, com o texto no meio. Conferido em 375 px e em 1280 px.
- A API da oferta pede a oferta INTEIRA no PUT: omitir `afterPurchase` apaga a volta para `/en`. Fazer GET, mudar só o `checkout` e mandar tudo de volta; conferir preço, volta, cupom e turma depois.
- **O checkout pede passaporte/documento, endereço completo e telefone** para cartão estrangeiro, mesmo com "endereço" desligado na oferta. A ajuda oficial da Hubla diz que o endereço é obrigatório (imposto). A API tem `showPhoneNumber` e `showFullName`, ainda não testados.

## O Cântico pela Hubla (`/en-offer-canticle`, 19/11/2026, ✅ provado só no TESTE)
Pedido do Arthur em 19/11: a venda do Cântico (Up 02) dentro do app sai da Digistore (741401, US$ 27) e vai para a Hubla, como a dos Arcanjos.
- **A página:** headline, o VSL em inglês da VTurb (`vid-6aff912f375e4d0a929be34e`) e **um card só**, no visual dos cards "Shield" (`css/en/escudo.css` + `css/en/cantico-oferta.css`, com a foto do card da home). O card aparece no pitch, aos **8:39** (`segundosDoPitch = 519`, no script do fim); `?previa=1` mostra na hora. A etiqueta de origem vai colada no botão (sem etiqueta: `utm_source=app-en&utm_medium=direto&utm_campaign=cantico&utm_content=sem-popup`).
- **Preço: "de $47 por $32.90"**, Black Friday, 30% off, **sem cupom** (Arthur, 19/11, ~21h50). O 30OFF não pôde valer para o Cântico (a API não muda a lista de ofertas de um cupom, a trava do agente barrou desligar e recriar, e o painel não deixou editar). Por isso a oferta na Hubla cobra **US$ 32,90 direto** e a página mostra o $47 riscado. **Acabou a Black Friday:** voltar o preço da oferta para 47 na Hubla (PUT com a oferta INTEIRA) **e** tirar o riscado da página (1 build).
- **Na Hubla (criado pela API em 19/11):** produto **"Angelic Canticle"**, `jXYM7bYWFscWbDIhrTWC` (o produto e a oferta, `pay.hub.la/jXYM7bYWFscWbDIhrTWC`), legacyId `ZHFtB3h77n7zAjgwgam2`. À venda, US$ 32,90, só cartão (com Apple/Google Pay), sem afiliados, volta para `https://setemadrugadas.com.br/en` depois de pagar, foto = `assets/images/home/cantico.jpg`. **Sem banner** no checkout (os Arcanjos têm). Conferido no checkout em 375 px: "Angelic Canticle $32.90" com a foto.
- **A liberação:** `supabase/en/15-hubla-cantico.sql` cadastra os 2 códigos em `en_hubla_products` → `cantico`. A `en-hubla` não muda (a v2 da produção já libera o `cantico`: o app por 12 meses e o extra). ⛔ Nunca no `hubla_product_map` do Brasil.
- **Provado no TESTE (19/11):** o `15` rodado; `supabase/en/testes/prova-hubla-cantico-no-teste.mjs` 8 de 8 (libera, a repetição não duplica, ela entra no app com o Cântico e só ele, acesso até 2027, o reembolso lista a compra de US$ 32,90). Cliente de prova apagada. No localhost a 375 px: VSL carrega, card escondido até o pitch, com `?previa=1` aparece ($47 riscado, $32.90), sem rolagem de lado, botão com o link e a etiqueta certos.
- ⚠️ **Os 7 áudios em inglês do Cântico ainda não existem:** quem compra vê "Audio coming soon" e o PDF da Novena. A página promete a jornada de 7 dias e o PDF.
- ⚠️ **O VTurb guarda no aparelho que o card já foi mostrado** (`displayHiddenElements-<vídeo>` no `localStorage`, por causa do `persist`): quem já passou do pitch vê o card logo ao abrir de novo. Para testar do zero, apagar essa chave.

### ⏳ Ir ao ar (o Arthur clica, uma tela por vez; nunca entre 3h e 8h de Brasília)
1. ✅ **Banco** (19/11, ~21h45, Arthur): `supabase/en/15-hubla-cantico.sql` na produção. Conferido: os 2 códigos em `en_hubla_products` → `cantico`.
2. ✅ **Hubla, webhook** (19/11, Arthur): produto **Angelic Canticle** acrescentado na regra da integração **"App EN"**. Não dá para conferir pela API: a prova é a primeira venda. (Se a regra do Brasil mandar "todos os produtos", a `hubla-webhook` grava `needs_reconciliation` nestas vendas: inofensivo.)
3. ✅ **Preço** (19/11): oferta em US$ 32,90, sem cupom (ver acima).
4. **Site:** 1 build (a página nova + `css/en/cantico-oferta.css`; o `escudo.css` vai junto com os Arcanjos).
5. **Primeira venda:** conferir `en_hubla_events` (consulta leve do fim do `14`): `recorded`, "Extra: cantico liberado".

**Voltar atrás:** a página antiga (Digistore) está no commit `ebfdfb8`. Tirar o produto da regra "App EN" para de liberar; quem já entrou continua.

## Os áudios dos Arcanjos em inglês (19/11/2026)
- Os 12 áudios (Drive, baixados em 19/11) foram convertidos em mono 96 kbps (39 MB) e conferidos pela transcrição do começo de cada um: cada arquivo cai na oração certa, na ordem do app. Originais e convertidos FORA do repositório: `7 Améns EUA/Arcanjos - audios convertidos/`.
- **Bunny própria do inglês** (Arthur, 19/11): Storage Zone `setemadrugadas-en` (Nova York + Los Angeles) e Pull Zone `setemadrugadas-en` (rede Volume, cache de 30 dias, CORS como a da LATAM). Endereço: `https://setemadrugadas-en.b-cdn.net/arcangeles/miguel-1.mp3` … `uriel-3.mp3`, ligado em `js/en/arcangeles.js`. Arquivo trocado = nome novo.
- Conferido no localhost (375 px, banco de TESTE): a lista dos quatro, as três orações de Michael e o tocador (2:49) com o áudio da Bunny; os 12 carregam; nenhum "Audio coming soon"; console sem erro.
- ⏳ **Ainda não entregues** (prometidos na página de venda): o **Perpetual Shield Calendar** e a **Heavenly Prayer of the Four Archangels United** (nível $98) e a **Household Covering Prayer** (nível $147). O Arthur manda depois. Os textos das orações na tela também não existem (`oracion: null`, só o áudio, como no Brasil).

## Revisão de 14/11/2026, ~02h (logo depois de ir ao ar)
- **No ar, sem banco:** as 14 páginas `en` e os 90 arquivos que elas citam respondem (0 quebrados); o Brasil (`/`, `/login`) e a LATAM (`/es`) seguem 200; o e-mail novo e os links da Digistore (741399 ×4, 741401) estão no ar.
- **Funções no ar (3 chamadas, e-mail inventado, nenhuma cliente criada):** `en-api` recusa e-mail desconhecido em inglês e segue para o resgate (403, 1,3 s); `en-refund` devolve lista vazia (0,3 s); `en-chat` responde `desligado` (1,5 s). `en-digistore`: teste de conexão assinado = `OK`.
- **No computador (localhost, banco de TESTE, 375 px, mesmo código do ar), sem erro no console:** home com o nome; lista com "Unlocks tomorrow" (a virada é à meia-noite do fuso dela: em Nova York ainda era 13/11); Dia 1 com o vídeo da Bunny; Dia 0; Dia 3 trancado ("It unlocks in 2 days"); Arcanjos e Cântico com "Audio coming soon" e o PDF; `/en-materials`; painel `/en-admin` (pop-ups desligados, resgate esperando); cliente sem extras com cadeado e "Learn more"; o botão do Cântico e as 4 cartas dos Arcanjos saem com a etiqueta (`utm_source=app-en`, `utm_term=pagina-vsl` no Cântico).
- **Achados (para o Arthur decidir):**
  1. ✅ Página de venda dos Arcanjos: aparecia **"from [US$ ?] to [US$ ?]"** depois de tocar na carta. Resolvido no mesmo dia (Arthur): **"from $69 to $27"** e **"60% off"** no lugar de "30%" (a conta agora bate; no espanhol continua "30%"). Ainda: sem o VSL, as cartas só aparecem ~8 min depois de a página abrir, e a headline diz "Please listen:" sem nada para ouvir.
  2. 🟡 A Lucy está desligada: quem toca em "Questions? Talk to Lucy" lê "I can't answer here right now" e recebe os botões de WhatsApp e e-mail. Para ligar: um SQL com o manual versão 3 (montado fora do repositório, no scratchpad da sessão de 14/11, `producao-ligar-lucy.sql`).
  3. O WhatsApp do suporte é o da LATAM (atende em espanhol).
  4. Nome do produto: o app diz "7 Amens Before Dawn"; a Digistore e as capas dos vídeos, "The 7 Amens of the Early Morning".
- O e-mail saiu primeiro como `sevenamenssuport` (com um "p"); o Arthur corrigiu na mesma madrugada: é `sevenamenssupport@gmail.com`, com dois "p".

## O que fica pendente de informação do Arthur
- WhatsApp do suporte americano (o e-mail já é o dos EUA desde 14/11).
- Checkout: ✅ front, front de US$ 27, Arcanjos e Cântico (14/11). Faltam os produtos, os links e os preços das contribuições do Dia 3 e de Three Mornings of Intercession. (O preço da revelação dos Arcanjos: ✅ $69 → $27, 14/11.)
- Os IDs dos vídeos, quando prontos.
