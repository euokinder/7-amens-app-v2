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

### Para o Arthur decidir (vem do original em espanhol)
- Página de venda dos Arcanjos: "The Pope asked me to share this with you" (fala por uma pessoa real), "Your guardian angel is Saint Michael" (para a Igreja, o anjo da guarda não é arcanjo) e "he will transform your whole life" (promessa).
- Roteiro de São Miguel 1 (Drive): "I declare that my life belongs to the Lord" — "I declare" soa evangélico; vale trocar antes de gravar.
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
| 6 | Checkout e a função que libera a venda | ⏳ por último |
| 7 | Ir ao ar: SQL e funções na produção (o Arthur cola), segredos, 1 build | ⏳ |

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
1. ✅ **Canal de ajuda (provisório, 14/11):** o Arthur mandou usar, por enquanto, o e-mail e o WhatsApp da LATAM (`soporte@pkscale.com` e +55 88 99443-2257), em `js/en/config.js` e no `SUPPORT_EMAIL` da `en-api`. Conferido na tela: "Contact us" abre o e-mail com o assunto em inglês, e o card do WhatsApp leva a mensagem já escrita em inglês. ⚠️ Quem atende fala espanhol; trocar quando o suporte americano existir. A Lucy está pronta e provada no TESTE (ver "A Lucy").
2. **Checkout** ligado à visão `en_pedidos_pagos` (`supabase/en/02-compras.sql`), com a função que recebe a venda. Sem ele, ninguém compra nem entra sozinha.
3. **Desligar o bloqueio do limite de gasto do Supabase** (ver "Decisões").
4. As páginas de venda dos extras (`/en-offer-archangels`, `/en-offer-canticle`) hoje só mostram o título: precisam do vídeo e do checkout, ou o card "Learn more" leva a uma página vazia.

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

## O que fica pendente de informação do Arthur
- E-mail e WhatsApp do suporte americano.
- Links e preços do checkout (principal, Arcanjos, Cântico, contribuições do Dia 3, Three Mornings).
- Os IDs dos vídeos, quando prontos.
