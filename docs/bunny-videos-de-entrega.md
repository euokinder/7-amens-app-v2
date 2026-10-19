# Vídeos de entrega na Bunny — o plano

> Escrito em 2026-10-19. **A conta e a biblioteca foram criadas e configuradas em 19/10.** O código ainda não foi feito, e nenhum vídeo foi enviado.
> Quando uma fase andar, anotar aqui (e no diário) o que mudou.

## A decisão
**Caio, 19/10/2026:** os vídeos que são **só entrega** passam para a **Bunny** (o produto Bunny Stream). Os vídeos **que têm venda continuam na VTurb**.

**Por quê.** A VTurb cobra por play. A Bunny cobra pelo volume de dados entregues e, na rede "Volume" (que tem um ponto em São Paulo), cobra **US$ 0,005 por GB**.

A estimativa de 19/10:
- Nos últimos 30 dias, **5.165 clientes** usaram o app, somando **25.902 dias de visita** (`member_visit_days`).
- Isso dá uns **26 mil plays por mês** de entrega, ou cerca de **2 TB**.
- Na Bunny, ficaria em **~US$ 10 a 15 por mês**. Na VTurb, esses plays custam **R$ 310 a 520**.

⚠️ É estimativa. O número real de plays dos vídeos de entrega está no painel da VTurb. O Caio decidiu não conferir: a VTurb é cara, e a migração vale de qualquer jeito.

A VTurb continua sendo a ferramenta certa para vender: ela mostra em que minuto as pessoas saem do vídeo, e o app usa o relógio dela para fazer o botão aparecer na hora certa.

## Quais vídeos vão e quais ficam

### Vão para a Bunny (10 vídeos)
| Vídeo | Onde aparece no código | ID na VTurb hoje | Formato |
|---|---|---|---|
| Introdução (Dia 0) | `js/dias.js` | `vid-6abca3b0504eece7be6e9010` | em pé (3:4) |
| Dia 1 — Pai Nosso | `js/dias.js` **e** `js/materiais.js` (`pai-nosso`): é o mesmo vídeo, e os dois trocam juntos | `vid-6abca3e2e46f7d51c60f5510` | em pé |
| Dia 2 — Perdão | `js/dias.js` | `vid-6abca3e5d76b5fcf4180e910` | em pé |
| Dia 4 — Libertação | `js/dias.js` | `vid-6abca3d638fddd9e2e94b56a` | em pé |
| Dia 5 — Prosperidade | `js/dias.js` | `vid-6abca3db43c8cc80762da215` | em pé |
| Dia 6 — Paz | `js/dias.js` | `vid-6abca3c908b80e9782bc1c9a` | em pé |
| As 3 Madrugadas — 1ª | `js/tres-madrugadas.js` | `vid-6ad4fe8cff942efd73ed0258` | em pé |
| As 3 Madrugadas — 2ª | `js/tres-madrugadas.js` | `vid-6ad5031184ff5e9c27000fd4` | em pé |
| As 3 Madrugadas — 3ª | `js/tres-madrugadas.js` | `vid-6ad506eeeb8fcb3d90d4893d` | em pé |
| Live do São Rafael (pós-live) | `live-rafael.html` | `vid-6ac6ff5c7d2a6b90e1cafed7` | **deitado (16:9)** |

**Nenhum destes 10 usa o relógio da VTurb.** Conferido em 19/10: só o Dia 3 e o Dia 7 usam (`dia.html`, linhas 258 a 321). Por isso a troca é só de player. A trava de um dia por vez, o "Concluí" e o progresso não mudam.

### Ficam na VTurb
| Vídeo | Por quê |
|---|---|
| **Dia 3 — Cura** | As contribuições (R$ 947 / 397 / 297) aparecem aos 9:14, pelo relógio da VTurb (`doacaoDelaySegundos`, `displayHiddenElements`). Tem venda, então fica. Se um dia for para a Bunny, o relógio precisa ser refeito com o `timeupdate` do player da Bunny. |
| **Dia 7 — Aliança** | A oferta das 3 Madrugadas aparece aos 13:17, e o dia se marca sozinho aos 5:50 (`oferta`, em `js/dias.js`). |
| Páginas de venda | `oferta-arcanjos.html`, `oferta-cantico.html`, `arcanjo-rafael.html`, `upsell-01/`, `upsell-02/`, `kits/cartas-arcanjos/`, `padre-tiago.html`: todas são VSLs. |

## Como fica no código — ✅ pronto e DESLIGADO desde 19/10/2026
Hoje nenhum vídeo tem o campo `bunny`, então **tudo continua tocando pela VTurb**, exatamente como antes. Conferido no teste local em 19/10, com uma conta de teste:
- a Introdução, os Dias 1, 3 e 7, o Pai Nosso, a 1ª das 3 Madrugadas e a Live abriram com o mesmo vídeo da VTurb, no mesmo tamanho e com as 4 máscaras dos cantos;
- o Dia 7 continuou com o relógio do Amém, e o Dia 3 com as contribuições;
- nenhum erro no console.
O desenho da Bunny também foi conferido, com um ID de mentira: a moldura saiu no **mesmo tamanho** do player da VTurb (3:4, 371 × 495 px na tela de teste), com o endereço certo. **O vídeo de verdade só dá para conferir quando o Dia 1 estiver na Bunny.**

- **Um arquivo só desenha o player da Bunny: `js/video.js`**, com `VIDEO.escolher({ bunny, vturb, titulo })` e `VIDEO.carregarScript(...)`. É a mesma regra do `js/tocador.js` para os áudios: player novo numa tela usa o módulo, nunca uma cópia. O número da biblioteca (`784501`) fica numa constante, só ali.
  - **A chave geral `BUNNY_LIGADA`**, no mesmo arquivo: `false` manda todos os vídeos de volta para a VTurb de uma vez.
  - Um ID que não tenha o formato de ID da Bunny (por exemplo, um `vid-…` da VTurb colado no lugar errado) **volta sozinho para a VTurb**: não deixa a tela sem vídeo.
  - **O `dia.html` ignora o campo `bunny` no Dia 3 e no Dia 7**, de propósito: os dois usam o relógio da VTurb.
- **Para ligar o Dia 1** (Fase 2): acrescentar `bunny: { video: '<ID>', formato: '3:4' }` no Dia 1 do `js/dias.js` **e** no `pai-nosso` do `js/materiais.js`, e subir o `?v=` dos dois arquivos nas páginas que os carregam.
- **O endereço do vídeo sai sempre com `autoplay=false`.** ⚠️ Na Bunny, o padrão é **tocar sozinho**. Vão também `rememberPosition=true`, `showSpeed=true` e `lang=pt`. O português existe e já está escolhido na biblioteca, mas falta ver no piloto se o texto do player sai em português do Brasil.
- **Cada vídeo ganha um campo `bunny`** (o ID do vídeo e o formato), ao lado do `videoEmbed` da VTurb, que **continua no arquivo**:
  - com o campo `bunny` preenchido, a tela usa a Bunny;
  - sem ele, usa a VTurb, como hoje.
  - **Para voltar atrás, apaga-se a linha `bunny`** (1 build). Ou se volta o deploy anterior na Netlify, que não gasta build.
- **Telas ligadas ao módulo** (19/10):
  - `dia.html`: o bloco do `videoHtml`;
  - `tres-madrugadas-video.html`: o vídeo e o carregamento do script;
  - `live-rafael.html`: o código da VTurb saiu do HTML e foi para um `VIDEO.escolher(...)` na própria página, com `bunny: null` à espera do ID.
- A moldura de cantos arredondados (`video-wrap-embed` + `corner-mask`) continua.
- **Não muda nada no Supabase, na `member-api` nem no `netlify.toml`.**
  - O `Referrer-Policy` do site já é `strict-origin-when-cross-origin` (`netlify.toml`, linha 26). É o que a Bunny pede para a trava de domínio funcionar.
  - O `Content-Security-Policy` de lá só diz quem pode colocar o NOSSO site numa moldura (`frame-ancestors`). Ele não barra o player da Bunny.
- **Não apagar os vídeos da VTurb** até 30 dias depois de tudo migrado. Eles são a volta atrás, e a VTurb cobra por play, não por vídeo guardado (confirmar no plano dela).

## A biblioteca na Bunny — ✅ criada e configurada em 19/10/2026
O agente fez pelo navegador do app, depois do login do Caio, e cada tela foi conferida de novo depois de salva.

**A conta** é a da operação (o e-mail está na memória do agente, fora deste repositório público).
- Teste grátis: **US$ 20**, que acaba por volta de **02/11/2026**.
- A recarga automática fica **desligada** (decisão de 19/10). Em troca, o consumo é acompanhado (ver "Acompanhar o consumo", abaixo).
- ⏳ **Falta o Caio ligar a verificação em duas etapas** da conta (menu do e-mail, no canto de cima → *Account settings*).

**A biblioteca: "7 Améns - entregas", número `784501`.** O número é público: vai no endereço de todo vídeo, `https://player.mediadelivery.net/embed/784501/<ID do vídeo>`.

| Aba | Como ficou | Por quê |
|---|---|---|
| Criação | Cópias em **Frankfurt** (a principal, fixa) e **São Paulo**. A Bunny já vinha com Los Angeles, Nova York e Singapura marcadas, e elas foram desmarcadas. Armazenamento: **US$ 0,02 por GB**. ⚠️ **As cidades não podem ser tiradas depois.** | Quando o ponto de entrega perto da cliente não tem o vídeo, ele vai buscar na cópia de São Paulo, e não na Alemanha. Custa centavos. |
| **Delivery** | **High Volume Tier**, a **US$ 0,005 por GB**. Os filtros "só Europa" ficaram **desligados**. | É a rede barata, com ponto em São Paulo. Ligar um filtro "só Europa" mandaria as clientes buscar o vídeo do outro lado do oceano. |
| **Encoding** | Conversão grátis (H.264). Só **240p, 360p, 480p e 720p**, sem 1080p. **Keep original** e **MP4 fallback** desligados. Early-Play, Content tagging e o Just-In-Time (pago) desligados. Multi-audio ficou como veio (ligado). | 720p basta num vídeo em pé, no celular. Os originais estão no Drive. O MP4 extra seria um arquivo fácil de baixar e repassar. |
| **Player** | Idioma **Portuguese (pt)**. Cor **#CC9C1F**, o dourado do app (`--accent`). Botões: tocar grande, tocar/pausar, **voltar e avançar 10 s**, barra, tempo atual, **duração**, volume, mudo, ajustes e tela cheia. Fora: AirPlay, Chromecast, legendas e janela flutuante. Velocidades **1x, 1,5x e 2x**, as mesmas do tocador de áudio. **"Continuar de onde parou" ligado.** Mapa de calor e controles compactos desligados. | Menos botões disputando a atenção (regra dos 45+), e o mesmo jeito do tocador. |
| **Security → General** | Domínios permitidos: `setemadrugadas.com.br`, `www.setemadrugadas.com.br` e `localhost`. "Block direct url file access" **veio ligado** e ficou. Os dois tokens estão **desligados**. "Enable direct play" **veio ligado** e ficou, por enquanto. | Outro site não consegue mostrar os vídeos. O "direct play" é o link que o Caio vai usar para testar no celular, na Fase 1. |
| **Security → DRM** | MediaCage Basic e Enterprise **desligados**. | O Enterprise custa US$ 99 por mês. |
| **Transcribing** | **Tudo desligado.** | Legenda automática custa US$ 0,10 por minuto. |
| **O autoplay** | Não existe no painel. | Ele vai no endereço do vídeo: `autoplay=false`. |

⏳ **Decidir antes de o Dia 1 ir ao ar:** desligar o "Enable direct play"? Com ele ligado, qualquer pessoa com o ID do vídeo assiste pela página da própria Bunny. Hoje a VTurb também é assim, e os IDs ficam neste repositório público.

⚠️ **Se aparecer erro 403 no piloto**, os primeiros suspeitos são o "Block direct url file access" e a lista de domínios.

## A ordem do trabalho
| Fase | Quem | O quê |
|---|---|---|
| 0 | Caio + agente | ✅ **Conta e biblioteca criadas e configuradas em 19/10.** ⏳ Falta: quando o Drive estiver pronto, subir **só o vídeo do Dia 1** (*Stream → 7 Améns - entregas → Videos → Upload*, arrastando o arquivo do computador) e mandar o ID do vídeo para o agente. O ID é público, porque aparece no endereço do vídeo: **nenhuma senha nem chave passa pelo chat**. ⏱️ O teste grátis acaba por volta de 02/11. Se o Dia 1 for ao ar depois disso, basta **pôr saldo antes de publicar**: a configuração continua guardada. |
| 1 | Caio | Assiste no celular, **no 4G**, pela pré-visualização do painel: demora para começar? trava? Melhor ainda se alguém fora de São Paulo também testar. |
| 2 | agente | Faz o `js/video.js`, liga o Dia 1 e o Pai Nosso na Bunny e testa no local. |
| 3 | Caio publica | **Só o Dia 1** vai ao ar (1 build). Uma semana olhando: o gasto na Bunny, reclamação no suporte e os plays da VTurb caindo. |
| 4 | Caio + agente | Sobem os outros 9 vídeos, e tudo vai ao ar numa publicação só (1 build). |
| 5 | Caio | 30 dias depois: compara a conta da Bunny com a da VTurb e decide se baixa o plano da VTurb. |

**Depois, como decisões separadas:**
- o **link que expira**: é a proteção de verdade, assinada pela `member-api`, e por isso mexe na função, que o Caio publica no painel;
- os **áudios e PDFs** saírem da banda da Netlify.

## Riscos e como evitar cada um
1. 💳 **O saldo acaba e os vídeos param para as clientes.** A conta é pré-paga, em dólar, e a recarga automática fica desligada (19/10). Ver "Acompanhar o consumo", logo abaixo.
2. **Um domínio esquecido na lista, e a cliente vê "vídeo bloqueado".** Por isso o piloto é com um vídeo só, conferido no site no ar.
3. **O vídeo toca sozinho.** O padrão da Bunny é tocar. Desligar na biblioteca **e** no endereço.
4. **"Continuar de onde parou".** Na VTurb, o player pergunta "Continuar assistindo?". Na Bunny, a posição fica guardada **por 7 dias** no celular, e não se sabe se ela pergunta ou retoma direto. Duas telas prometem a pergunta: `tres-madrugadas-video.html` (linha 81) e `live-rafael.html` (linha 85). **Testar no piloto e ajustar o texto dessas telas.**
5. **A rede Volume tem um único ponto no Brasil (São Paulo).** No Norte e no Nordeste, o vídeo pode demorar mais para começar. Se o piloto mostrar isso, trocar para a rede Standard, que é ~9 vezes mais cara (~R$ 500 por mês) e ainda fica perto da VTurb.
6. **O player com outra cara, ou em inglês.** Confirmar o `lang=pt`, a cor dourada e os botões grandes (regra dos 45+).
7. **Dólar e IOF** na fatura.
8. **O vídeo do Dia 1 aparece em dois lugares** (o Dia 1 e o Pai Nosso). Os dois trocam juntos.
9. **O repositório é público**, então os IDs da Bunny vão ficar à vista, como hoje acontece com os da VTurb. Sem o link que expira, quem tiver o ID assiste. A trava de domínio pelo menos impede outro site de mostrar o vídeo.

## Acompanhar o consumo (sem recarga automática)
**Como a Bunny se comporta quando o dinheiro acaba** (documentação, conferida em 19/10):
- O saldo **fica negativo** e o serviço continua. A Bunny manda **um e-mail por dia** enquanto ele estiver negativo.
- Se não houver recarga **em até 4 dias** depois de ficar negativo, a conta é **desligada**, e **todos os vídeos saem do ar**. Em conta nova ou com saldo muito negativo, isso pode acontecer **antes** dos 4 dias.
- Recarregou, volta **na hora**: nada se perde.
- **A Bunny não tem aviso de "saldo baixo" para conta paga.** Só existe aviso de saldo negativo. Quem avisa antes de acabar somos nós.
- ⚠️ **O teste grátis acaba em 14 dias** (ou antes, se os créditos acabarem), e o crédito que sobrar **some**. Como o piloto do Dia 1 vai estar no ar nessa época, **é preciso pôr saldo antes do 14º dia**. O teste dá US$ 20 de crédito, ou US$ 50 com um cartão cadastrado. Com a recarga desligada, o cartão não é cobrado sozinho.

**A rotina:**
| Quando | O quê |
|---|---|
| Antes de o teste grátis acabar | Pôr **US$ 25**. Pela estimativa, dá uns 2 meses com tudo migrado. |
| **Toda segunda-feira**, no piloto e no 1º mês | Abrir *Billing* na Bunny e anotar duas coisas: o **saldo** e o **gasto dos últimos 7 dias**. |
| Saldo **menor que 1 mês de gasto** | Recarregar mais US$ 25. |
| Gasto da semana **mais que o dobro do esperado** | Investigar antes de recarregar: algum site mostrando nossos vídeos, ou alguma resolução alta ligada sem querer. |
| Chegou um e-mail de **saldo negativo** | Recarregar **no mesmo dia**. |

**O gasto esperado**, para comparar:
- **No piloto** (só o Dia 1 e o Pai Nosso): ~**US$ 3 a 5 por mês**, ou menos de US$ 1,50 por semana. Toda cliente nova abre o Dia 1: foram 6.909 acessos novos ao principal em 30 dias, até 19/10.
- **Com os 10 vídeos:** ~**US$ 10 a 15 por mês**, uns US$ 3 por semana.

**Os e-mails da Bunny vão para o e-mail da conta.** Alguém precisa ler essa caixa: é o único alarme que existe.

**Se a conta cair mesmo assim:**
1. Recarregar. O vídeo volta na hora.
2. Se não der para recarregar logo: na Netlify, publicar de novo o **último deploy de antes da Bunny** (*Deploys → Publish deploy*). Não gasta build, e os vídeos voltam a tocar pela VTurb. Por isso os vídeos da VTurb não são apagados.

## O que só o Caio sabe ou decide
1. ✅ **Os originais dos 10 vídeos** vão ficar num Drive (19/10). Para subir na Bunny, o melhor é **baixar e arrastar o arquivo do computador** para o painel. A opção "buscar por endereço" costuma falhar com link do Google Drive em arquivo grande, porque o Drive mostra antes uma página de aviso.
2. ✅ **O plano da VTurb não precisa ser conferido.** Caio, 19/10: "a VTurb é cara". A migração dos vídeos de entrega segue sem essa conta.
3. ✅ **Recarga automática: desligada** (19/10), com o consumo acompanhado (ver acima).
4. ⏳ O **Dia 3** fica mesmo na VTurb? Pela regra "tem venda, fica", sim. Por enquanto, fica.
5. ✅ **A conta da Bunny** é criada com o e-mail da operação (19/10). O endereço **não fica escrito aqui**, porque o repositório é público: ele está na memória do agente, fora do repositório.

## Fontes (consultadas em 19/10/2026)
- Preços: https://bunny.net/pricing/stream/ · https://bunny.net/docs/stream/pricing · https://bunny.net/pricing/cdn/
- Rede (ponto Volume em São Paulo): https://bunny.net/network/
- Incorporação e parâmetros do player: https://bunny.net/docs/stream/embedding
- Relógio do player (`timeupdate`, `getCurrentTime`): https://bunny.net/docs/stream/playback-api
- Segurança: https://bunny.net/docs/stream/security-options · https://bunny.net/docs/stream/token-authentication
- Cobrança: https://bunny.net/docs/billing/auto-recharge · https://bunny.net/docs/billing/negative-balance · https://bunny.net/docs/free-trial-overview
