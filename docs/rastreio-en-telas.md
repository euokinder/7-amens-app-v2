# Rastreio do app em inglês — o que cada tela registra

> 20/11/2026. Só o app em inglês (`en*.html`, `js/en/`). Quem GRAVA o passo é `js/en/rastro.js` (outro chat); as telas só chamam `window.AMENES.rastro(nome, props)`.

## Como está ligado
- Todo `en*.html` (menos o painel) carrega, logo depois do `sesion.js`: `rastro.js` (SEM `defer`, de propósito: o `sesion.js` põe um `AMENES.rastro` vazio enquanto o real não carrega, e chamada feita nesse intervalo se perdia em silêncio) e **`js/en/rastro-telas.js`** (novo, deste trabalho).
- `rastro-telas.js` é o ajudante: chama o registrador com segurança (se faltar ou falhar, a tela segue igual; pedido feito antes do `rastro.js` existir fica numa fila e sai ao fim do carregamento), mede play e 25/50/75/100 % (VTurb, Bunny, `<audio>`) e, por um ouvinte só no documento, registra **todo PDF** e **todo toque de suporte**.
- As telas chamam `window.AMENES_RASTRO?.…`. Pular o vídeo/áudio para a frente **não** conta marco: só vale o que passou tocando.
- `/en-materials` e `/en-refund` não carregam o `sesion.js` (nunca carregaram); só ganharam `rastro.js` + `rastro-telas.js`. O `rastro.js` precisa funcionar sem o `sesion.js` nessas duas.

## Tela → passos → arquivo
| Tela | Passo | Onde |
|---|---|---|
| Home | `card_visto`, `card_toque` {card: jornada/pdfs/arcangeles/cantico/whatsapp/contato, situacao só nos 2 extras: liberado/bloqueado} | `js/en/inicio.js` (fim do arquivo) |
| Home / dias | `lucy_aberta` {onde: cartao/botao/entrada}, uma vez por página; `lucy_mensagem` (sem texto), a cada mensagem | `js/en/lucia.js` (`abrirConversa`, `mandar`) |
| Dia (Start Here e 1–7) | `dia_aberto` {dia} | `js/en/dia.js` (depois do `carregar`) |
| Dia: vídeo Bunny ou VTurb | `video_play`, `video_progresso` {video, onde: dia-N, pct} | `js/en/video.js` (`rastrear`), chamado em `dia.js` |
| Dias 3 e 7 (oferta no vídeo) | `oferta_play` {oferta} (no play do vídeo), `oferta_pitch` {oferta} (botão/cards aparecem), `oferta_checkout_toque` {oferta, nivel: floor/pew/stone no Dia 3; unico no Dia 7} | `js/en/dia.js`; `js/en/oferta-dia.js` (`ligar`) |
| PDF (jornada, materials, dia, oração, "audio coming soon") | `pdf_aberto` {pdf (nome do arquivo), onde: journey/materials/dia-N/…} | `js/en/rastro-telas.js` (delegação em `a[href$=.pdf]` e `[data-pdf]`) |
| Arcanjos (oração) | `audio_play`, `audio_progresso` {extra: arcangeles, faixa: `miguel-1`, pct} | `js/en/oracion-arcangel.js` → `js/en/tocador.js` |
| Cântico (dia) | idem {extra: cantico, faixa: `dia-N`} | `js/en/cantico-dia.js` → `js/en/tocador.js` |
| Suporte (qualquer tela) | `suporte_toque` {canal: whatsapp/email}: todo link `mailto:` e `wa.me` (portão "Need help?", Lucy, entrada, reembolso, card do WhatsApp) | `js/en/rastro-telas.js` |
| Venda Arcanjos | `oferta_play`, `oferta_pitch`, `oferta_checkout_toque` {oferta: arcangeles, nivel: michael/complete/family} | script no fim de `en-offer-archangels.html` |
| Venda Cântico | idem {oferta: cantico, nivel: unico} | script no fim de `en-offer-canticle.html` |

## O que NÃO deu para registrar (e por quê)
- **Vídeo da Bunny (dias 0–2, 4–6): código pronto, mas NÃO provado.** No navegador de teste o player da Bunny não respondeu a nenhuma mensagem (nem com a biblioteca oficial). Se na produção `video_play` do Bunny não aparecer, é isso; plano B: carregar a biblioteca `playerjs` da Bunny. O da VTurb (Dias 3 e 7) foi provado.
- **Áudio do Cântico:** os áudios em inglês ainda não existem (`pendiente`). A ligação é a mesma dos Arcanjos (provada); no Cântico foi provada com um áudio de teste no tocador.
- `js/en/oferta-vsl.js` não é usado por nenhuma página em inglês (as de venda têm script próprio): não mexi.
- Os vídeos de venda só têm `oferta_play` (sem 25/50/75/100 %): o contrato não pede.
- `dia_aberto` só existe nos dias da jornada; o Cântico/Arcanjos usam `pagina` + áudio. `novena.js` e as listas (`arcangeles-lista.js`, `cantico-lista.js`, `arcangel.js`) não precisaram de nada: são links, e a página seguinte registra.
- `oferta_play`/`oferta_pitch` não levam `nivel` (só o toque de checkout leva).
- Quem pula um vídeo/áudio para a frente perde os marcos pulados, de propósito.
- Login de teste e Lucy real não foram exercitados contra o servidor de chat (a resposta foi simulada).

## Provado no banco de TESTE (en_events)
pagina, card_visto (6 cards), card_toque, dia_aberto, oferta_pitch (Arcanjos, Cântico, Dia 3), oferta_play, oferta_checkout_toque, video_play (VTurb, Dia 3), pdf_aberto, audio_play (Arcanjos), lucy_aberta, suporte_toque (whatsapp). Vídeo que abre retomado do meio não ganha os marcos que ficaram para trás.
